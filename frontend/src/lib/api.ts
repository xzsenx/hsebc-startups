const BASE = import.meta.env.VITE_API_BASE ?? "";

export type Kind = "startup" | "vacancy";
export type PostStatus = "open" | "closed";
export type ApplicationStatus = "pending" | "accepted" | "declined";

export interface UserPublic {
  id: number;
  name: string;
  headline: string;
  telegram: string;
}

export interface Me extends UserPublic {
  email: string;
  bio: string;
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
  author: UserPublic;
  applications_count: number;
  my_application_status: ApplicationStatus | null;
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

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function token(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const t = token();
  if (t) headers.set("Authorization", `Bearer ${t}`);

  const response = await fetch(`${BASE}/api${path}`, { ...options, headers });
  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg: string }) => d.msg).join(", ")
          : "Что-то пошло не так";
    throw new ApiError(response.status, message);
  }
  return body as T;
}

export const api = {
  register: (payload: Record<string, string>) =>
    request<{ access_token: string; user: Me }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (email: string, password: string) =>
    request<{ access_token: string; user: Me }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<Me>("/auth/me"),

  feed: (params: { kind?: Kind; q?: string; limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params.kind) search.set("kind", params.kind);
    if (params.q) search.set("q", params.q);
    search.set("limit", String(params.limit ?? 20));
    search.set("offset", String(params.offset ?? 0));
    return request<Feed>(`/posts?${search}`);
  },
  post: (id: number) => request<Post>(`/posts/${id}`),
  myPosts: () => request<Post[]>("/posts/mine"),
  createPost: (payload: Record<string, string>) =>
    request<Post>("/posts", { method: "POST", body: JSON.stringify(payload) }),
  setPostStatus: (id: number, status: PostStatus) =>
    request<Post>(`/posts/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  apply: (postId: number, message: string) =>
    request<Application>(`/posts/${postId}/applications`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  sent: () => request<Application[]>("/me/applications"),
  received: () => request<Application[]>("/me/applications/received"),
  decide: (id: number, status: "accepted" | "declined") =>
    request<Application>(`/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};

export const saveToken = (value: string) => localStorage.setItem("token", value);
export const clearToken = () => localStorage.removeItem("token");
export const hasToken = () => Boolean(token());
