const BASE = import.meta.env.VITE_API_BASE ?? "";
const TOKEN_KEY = "token";

export type Kind = "startup" | "vacancy";
export type PostStatus = "open" | "closed";
export type ApplicationStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface UserPublic {
  id: number;
  name: string;
  headline: string;
  bio: string;
  telegram: string;
}

export interface Me extends UserPublic {
  email: string;
}

export interface Post {
  id: number;
  kind: Kind;
  title: string;
  summary: string;
  description: string;
  looking_for: string;
  status: PostStatus;
  created_at: string;
  updated_at: string;
  author: UserPublic;
  applications_count: number;
  pending_count: number;
  my_application_status: ApplicationStatus | null;
  my_application_id: number | null;
  is_mine: boolean;
}

export interface Feed {
  items: Post[];
  total: number;
  limit: number;
  offset: number;
}

export interface Application {
  id: number;
  status: ApplicationStatus;
  message: string;
  created_at: string;
  decided_at: string | null;
  applicant: UserPublic;
  post: Post;
}

export interface Summary {
  pending_received: number;
  my_posts: number;
  sent: number;
}

export interface PostPayload {
  kind: Kind;
  title: string;
  summary: string;
  description: string;
  looking_for: string;
}

export type ProfilePayload = Pick<Me, "name" | "headline" | "bio" | "telegram">;

/** Ошибки валидации от сервера, разложенные по полям формы. */
export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: FieldErrors = {},
  ) {
    super(message);
  }
}

// Токен в localStorage — компромисс для прототипа: с Bearer-заголовком не нужна
// защита от CSRF. Риск XSS закрыт строгой CSP и тем, что React экранирует весь вывод.
// В мини-приложении токен заменяется проверкой initData от Telegram (см. README).
export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (value: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, value);
    } catch {
      /* приватный режим: работаем без сохранения сессии */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* noop */
    }
  },
};

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Подписка на «сессия истекла» — чтобы разлогинить пользователя из любого места. */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

interface PydanticIssue {
  loc: (string | number)[];
  msg: string;
}

function humanize(msg: string): string {
  // Сообщения валидатора pydantic приходят на английском — переводим самые частые.
  return msg
    .replace(/^Value error, /, "")
    .replace(/String should have at least (\d+) characters?/, "Минимум $1 симв.")
    .replace(/String should have at most (\d+) characters?/, "Максимум $1 симв.")
    .replace(/^value is not a valid email address.*$/, "Проверьте адрес почты")
    .replace(/^Field required$/, "Обязательное поле")
    .replace(/^Extra inputs are not permitted$/, "Лишнее поле");
}

async function request<T>(path: string, options: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${BASE}/api${path}`, { ...options, headers, signal });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(0, "Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.");
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token) {
      tokenStore.clear();
      unauthorizedListeners.forEach((listener) => listener());
    }
    const detail = body?.detail;
    if (Array.isArray(detail)) {
      const fields: FieldErrors = {};
      for (const issue of detail as PydanticIssue[]) {
        const field = String(issue.loc[issue.loc.length - 1]);
        fields[field] ??= humanize(issue.msg);
      }
      throw new ApiError(response.status, "Проверьте поля формы", fields);
    }
    const message =
      typeof detail === "string"
        ? detail
        : response.status >= 500
          ? "Сервер временно недоступен. Попробуйте через минуту."
          : "Что-то пошло не так";
    throw new ApiError(response.status, message);
  }
  return body as T;
}

const json = (method: string, payload?: unknown): RequestInit => ({
  method,
  body: payload === undefined ? undefined : JSON.stringify(payload),
});

export const api = {
  register: (payload: { email: string; password: string; name: string; headline?: string; telegram?: string }) =>
    request<{ access_token: string; user: Me }>("/auth/register", json("POST", payload)),
  login: (email: string, password: string) =>
    request<{ access_token: string; user: Me }>("/auth/login", json("POST", { email, password })),
  me: () => request<Me>("/auth/me"),
  updateProfile: (payload: Partial<ProfilePayload>) => request<Me>("/auth/me", json("PATCH", payload)),

  feed: (params: { kind?: Kind; q?: string; limit?: number; offset?: number }, signal?: AbortSignal) => {
    const search = new URLSearchParams();
    if (params.kind) search.set("kind", params.kind);
    if (params.q) search.set("q", params.q);
    search.set("limit", String(params.limit ?? 12));
    search.set("offset", String(params.offset ?? 0));
    return request<Feed>(`/posts?${search}`, {}, signal);
  },
  post: (id: number, signal?: AbortSignal) => request<Post>(`/posts/${id}`, {}, signal),
  myPosts: () => request<Post[]>("/posts/mine"),
  createPost: (payload: PostPayload) => request<Post>("/posts", json("POST", payload)),
  updatePost: (id: number, payload: Partial<PostPayload> & { status?: PostStatus }) =>
    request<Post>(`/posts/${id}`, json("PATCH", payload)),

  apply: (postId: number, message: string) =>
    request<Application>(`/posts/${postId}/applications`, json("POST", { message })),
  withdraw: (id: number) => request<Application>(`/applications/${id}/withdraw`, json("POST")),
  sent: () => request<Application[]>("/me/applications"),
  received: () => request<Application[]>("/me/applications/received"),
  summary: () => request<Summary>("/me/summary"),
  decide: (id: number, status: "accepted" | "declined") =>
    request<Application>(`/applications/${id}`, json("PATCH", { status })),
};
