import {
  ArrowLeft,
  CalendarDays,
  Check,
  FileText,
  Lock,
  LockOpen,
  MessageSquare,
  Pencil,
  Send,
  UserRoundSearch,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "../components/ConfirmDialog";
import { Field } from "../components/Field";
import { Alert, ClosedBadge, EmptyState, KindBadge, Person, Spinner, StatusBadge } from "../components/ui";
import { ApiError, api, type Post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatWhen, plural } from "../lib/format";
import { usePage } from "../lib/hooks";
import { haptic } from "../lib/telegram";
import { useToast } from "../lib/toast";

const MESSAGE_MAX = 2000;

function ApplicationSteps({ status }: { status: Post["my_application_status"] }) {
  const decided = status === "accepted" || status === "declined";
  return (
    <ol className="steps" aria-label="Этапы отклика">
      <li className="steps__item" data-state="done">
        <Check size={14} aria-hidden /> Отправлен
      </li>
      <li className="steps__sep" aria-hidden />
      <li className="steps__item" data-state={decided ? "done" : "current"} aria-current={decided ? undefined : "step"}>
        {decided && <Check size={14} aria-hidden />} Рассмотрение
      </li>
      <li className="steps__sep" aria-hidden />
      <li className="steps__item" data-state={decided ? "current" : undefined} aria-current={decided ? "step" : undefined}>
        Решение
      </li>
    </ol>
  );
}

export default function PostPage() {
  const { id } = useParams();
  const postId = Number(id);
  const { user, refreshSummary } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [post, setPost] = useState<Post | null>(null);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"withdraw" | "close" | null>(null);
  const heading = usePage(post?.title ?? "Публикация");

  const load = useCallback(
    (signal?: AbortSignal) =>
      api
        .post(postId, signal)
        .then((p) => {
          setPost(p);
          setLoadError(null);
        })
        .catch((e: Error) => {
          if (e.name === "AbortError") return;
          setLoadError(e instanceof ApiError ? { status: e.status, message: e.message } : { status: 0, message: e.message });
        }),
    [postId],
  );

  useEffect(() => {
    if (!Number.isInteger(postId) || postId <= 0) {
      setLoadError({ status: 404, message: "Публикация не найдена" });
      return;
    }
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [postId, load, user?.id]);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (message.length > MESSAGE_MAX) return;
    setBusy(true);
    setActionError("");
    try {
      await api.apply(postId, message.trim());
      haptic.success();
      toast("Отклик отправлен — автор увидит его в своём кабинете");
      setMessage("");
      await load();
    } catch (err) {
      haptic.error();
      // 409 — «уже откликались» или «набор закрыли»: обновляем карточку, чтобы показать актуальное состояние.
      if (err instanceof ApiError && err.status === 409) {
        toast(err.message);
        await load();
      } else {
        setActionError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function runConfirmed() {
    if (!post) return;
    setBusy(true);
    try {
      if (confirm === "withdraw" && post.my_application_id) {
        await api.withdraw(post.my_application_id);
        toast("Отклик отозван. Можно откликнуться снова, пока набор открыт");
      } else if (confirm === "close") {
        await api.updatePost(post.id, { status: "closed" });
        toast("Набор закрыт — публикация пропала из ленты");
      }
      await load();
      void refreshSummary();
    } catch (err) {
      toast((err as Error).message);
      await load();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function reopen() {
    if (!post) return;
    setBusy(true);
    try {
      await api.updatePost(post.id, { status: "open" });
      toast("Набор снова открыт");
      await load();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const backButton = (
    <button
      type="button"
      className="back-link"
      onClick={() => (location.key !== "default" ? navigate(-1) : navigate("/"))}
    >
      <ArrowLeft size={18} aria-hidden />
      Назад
    </button>
  );

  if (loadError) {
    return (
      <main id="main" className="main main--reading">
        {backButton}
        {loadError.status === 404 ? (
          <EmptyState
            icon={FileText}
            title="Публикация не найдена"
            hint="Возможно, ссылка устарела или в ней опечатка."
            action={<Link to="/" className="btn btn--primary">Открыть ленту</Link>}
          />
        ) : (
          <Alert
            tone="error"
            title="Не удалось загрузить публикацию"
            action={<button type="button" className="btn btn--secondary" onClick={() => void load()}>Повторить</button>}
          >
            {loadError.message}
          </Alert>
        )}
      </main>
    );
  }

  if (!post) {
    return (
      <main id="main" className="main main--reading" aria-busy>
        {backButton}
        <div className="stack" aria-hidden>
          <div className="skeleton" style={{ width: 100, height: 26, borderRadius: 999 }} />
          <div className="skeleton" style={{ width: "80%", height: 36 }} />
          <div className="skeleton" style={{ width: "100%", height: 18 }} />
          <div className="skeleton" style={{ width: "100%", height: 160, borderRadius: 16 }} />
        </div>
        <span className="sr-only">Загружаем публикацию</span>
      </main>
    );
  }

  const status = post.my_application_status;
  const canApply = !post.is_mine && post.status === "open" && (!status || status === "withdrawn");
  const tooLong = message.length > MESSAGE_MAX;

  return (
    <main id="main" className="main main--reading">
      {backButton}

      <article className="post">
        <header className="post__head">
          <div className="card__top">
            <KindBadge kind={post.kind} />
            {post.status === "closed" && <ClosedBadge />}
            {post.is_mine && <span className="badge badge--mine">Ваша публикация</span>}
          </div>
          <h1 className="post__title" ref={heading} tabIndex={-1} data-route-focus>
            {post.title}
          </h1>
          {post.summary && <p className="post__lead">{post.summary}</p>}
          <div className="post__meta">
            <span>
              <CalendarDays size={15} aria-hidden />
              <time dateTime={post.created_at}>{formatWhen(post.created_at)}</time>
            </span>
            <span>
              <MessageSquare size={15} aria-hidden />
              {plural(post.applications_count, ["отклик", "отклика", "откликов"])}
            </span>
          </div>
        </header>

        <section className="panel" aria-labelledby="looking-title">
          <h2 id="looking-title" className="section-title">
            <UserRoundSearch size={15} aria-hidden />
            Кого ищет автор
          </h2>
          <p className="prose">{post.looking_for}</p>
        </section>

        {post.description && (
          <section aria-labelledby="about-title">
            <h2 id="about-title" className="section-title">
              {post.kind === "startup" ? "О проекте" : "Подробности"}
            </h2>
            <p className="prose">{post.description}</p>
          </section>
        )}

        <section aria-labelledby="author-title">
          <h2 id="author-title" className="section-title">
            Автор
          </h2>
          <div className="stack">
            <Person name={post.author.name} headline={post.author.headline} size="lg" />
            {post.author.bio && <p className="muted">{post.author.bio}</p>}
          </div>
        </section>

        <hr className="divider" />

        {/* --- Действия: зависят от того, кто смотрит --- */}

        {post.is_mine && (
          <section className="panel" aria-label="Управление публикацией">
            <p className="panel__title">
              {post.pending_count
                ? `Ждут решения: ${plural(post.pending_count, ["отклик", "отклика", "откликов"])}`
                : post.applications_count
                  ? "Все отклики разобраны"
                  : "Откликов пока нет"}
            </p>
            <div className="form-actions">
              <Link to="/cabinet?tab=received" className="btn btn--primary">
                <MessageSquare size={18} aria-hidden />
                Отклики
              </Link>
              <Link to={`/posts/${post.id}/edit`} className="btn btn--secondary">
                <Pencil size={18} aria-hidden />
                Изменить
              </Link>
              {post.status === "open" ? (
                <button type="button" className="btn btn--ghost" onClick={() => setConfirm("close")} disabled={busy}>
                  <Lock size={18} aria-hidden />
                  Закрыть набор
                </button>
              ) : (
                <button type="button" className="btn btn--ghost" onClick={reopen} disabled={busy}>
                  <LockOpen size={18} aria-hidden />
                  Открыть снова
                </button>
              )}
            </div>
          </section>
        )}

        {!post.is_mine && status && status !== "withdrawn" && (
          <section className={`panel ${status === "accepted" ? "panel--accent" : ""}`} aria-label="Ваш отклик">
            <div className="card__top">
              <StatusBadge status={status} prefix="Ваш отклик" />
            </div>
            <ApplicationSteps status={status} />
            {status === "pending" && (
              <>
                <p className="muted">Автор ещё не принял решение. Результат появится здесь и в вашем кабинете.</p>
                <div>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirm("withdraw")} disabled={busy}>
                    Отозвать отклик
                  </button>
                </div>
              </>
            )}
            {status === "accepted" && (
              <p>Автор принял ваш отклик. Контакт для связи — в кабинете, во вкладке «Мои отклики».</p>
            )}
            {status === "declined" && <p className="muted">Автор выбрал другого кандидата. Посмотрите другие публикации в ленте.</p>}
            {status === "accepted" && (
              <div>
                <Link to="/cabinet?tab=sent" className="btn btn--primary">
                  Открыть контакт
                </Link>
              </div>
            )}
          </section>
        )}

        {!post.is_mine && post.status === "closed" && (!status || status === "withdrawn") && (
          <Alert tone="neutral" title="Набор закрыт">
            Автор больше не принимает отклики на эту публикацию.
          </Alert>
        )}

        {canApply && !user && (
          <section className="panel panel--accent" aria-label="Отклик">
            <p className="panel__title">Заинтересовало?</p>
            <p className="muted">Войдите, чтобы откликнуться: автор увидит ваш профиль и сообщение.</p>
            <div>
              <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="btn btn--primary btn--lg">
                Войти и откликнуться
              </Link>
            </div>
          </section>
        )}

        {canApply && user && (
          <form className="panel panel--accent" onSubmit={apply} aria-labelledby="apply-title" noValidate>
            <h2 id="apply-title" className="panel__title">
              {status === "withdrawn" ? "Откликнуться снова" : "Откликнуться"}
            </h2>
            {status === "withdrawn" && (
              <p className="subtle">Вы отзывали отклик. Если передумали — отправьте новый.</p>
            )}
            <Field
              multiline
              label="Сообщение автору"
              rows={4}
              value={message}
              maxLength={MESSAGE_MAX}
              error={tooLong ? `Максимум ${MESSAGE_MAX} символов` : undefined}
              hint="Коротко: чем можете быть полезны и что хотите уточнить. Необязательно."
              placeholder="Например: делал похожий сервис на FastAPI, готов взять бэкенд. Какие сроки у MVP?"
              onChange={(e) => setMessage(e.target.value)}
            />
            {actionError && <Alert tone="error">{actionError}</Alert>}
            <div>
              <button type="submit" className="btn btn--primary btn--lg" disabled={busy || tooLong} aria-busy={busy}>
                {busy ? <Spinner /> : <Send size={18} aria-hidden />}
                {busy ? "Отправляем…" : "Отправить отклик"}
              </button>
            </div>
          </form>
        )}
      </article>

      <ConfirmDialog
        open={confirm === "withdraw"}
        title="Отозвать отклик?"
        confirmLabel="Отозвать"
        tone="danger"
        busy={busy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      >
        Автор больше не увидит ваш отклик. Пока набор открыт, вы сможете откликнуться снова.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "close"}
        title="Закрыть набор?"
        confirmLabel="Закрыть набор"
        tone="danger"
        busy={busy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      >
        Публикация пропадёт из ленты, новые отклики приходить перестанут. Уже полученные останутся, набор можно открыть снова.
      </ConfirmDialog>
    </main>
  );
}
