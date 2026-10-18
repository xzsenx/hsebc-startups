import { Check, FilePlus2, Inbox, Lock, LockOpen, MessageSquare, Pencil, Send, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ConfirmDialog } from "../components/ConfirmDialog";
import { Alert, Avatar, ClosedBadge, EmptyState, KindBadge, Person, SkeletonCards, Spinner, StatusBadge } from "../components/ui";
import { api, type Application, type Post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatWhen, plural, telegramUrl } from "../lib/format";
import { usePage } from "../lib/hooks";
import { haptic } from "../lib/telegram";
import { useToast } from "../lib/toast";

type Tab = "posts" | "received" | "sent";
type Pending =
  | { kind: "decline"; application: Application }
  | { kind: "withdraw"; application: Application }
  | { kind: "close"; post: Post }
  | null;

function TelegramContact({ handle, label }: { handle: string; label: string }) {
  if (!handle) return <p className="subtle">Контакт не указан в профиле.</p>;
  return (
    <Alert tone="success" title={label}>
      <a className="contact" href={telegramUrl(handle)} target="_blank" rel="noopener noreferrer">
        <Send size={16} aria-hidden />
        {handle}
      </a>
    </Alert>
  );
}

export default function CabinetPage() {
  const heading = usePage("Кабинет");
  const { user, refreshSummary } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = (["posts", "received", "sent"].includes(params.get("tab") ?? "") ? params.get("tab") : "posts") as Tab;

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [received, setReceived] = useState<Application[] | null>(null);
  const [sent, setSent] = useState<Application[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const load = useCallback(async () => {
    try {
      const [p, r, s] = await Promise.all([api.myPosts(), api.received(), api.sent()]);
      setPosts(p);
      setReceived(r);
      setSent(s);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingReceived = received?.filter((a) => a.status === "pending") ?? [];
  const decidedReceived = received?.filter((a) => a.status !== "pending") ?? [];

  const TABS: { value: Tab; label: string; count?: number }[] = [
    { value: "posts", label: "Публикации" },
    { value: "received", label: "Входящие", count: pendingReceived.length },
    { value: "sent", label: "Мои отклики" },
  ];

  async function act(id: number, action: () => Promise<unknown>, success: string) {
    setBusyId(id);
    try {
      await action();
      haptic.success();
      toast(success);
      await load();
      void refreshSummary();
    } catch (e) {
      haptic.error();
      toast((e as Error).message);
      await load();
    } finally {
      setBusyId(null);
      setPending(null);
    }
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.kind === "decline")
      void act(pending.application.id, () => api.decide(pending.application.id, "declined"), "Отклик отклонён");
    if (pending.kind === "withdraw")
      void act(pending.application.id, () => api.withdraw(pending.application.id), "Отклик отозван");
    if (pending.kind === "close")
      void act(pending.post.id, () => api.updatePost(pending.post.id, { status: "closed" }), "Набор закрыт");
  }

  function selectTab(value: Tab) {
    setParams(value === "posts" ? {} : { tab: value }, { replace: true });
  }

  function onTabKey(e: React.KeyboardEvent, index: number) {
    // Стрелки переключают вкладки — стандартное поведение tablist (WAI-ARIA).
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    selectTab(TABS[next].value);
    document.getElementById(`tab-${TABS[next].value}`)?.focus();
  }

  const loading = posts === null && !error;

  return (
    <main id="main" className="main">
      <section className="profile" aria-label="Профиль">
        <Avatar name={user?.name ?? ""} size="lg" />
        <div>
          <h1 className="profile__name" ref={heading} tabIndex={-1} data-route-focus>
            {user?.name}
          </h1>
          {user?.headline && <p className="muted">{user.headline}</p>}
        </div>
        <div className="profile__actions">
          <Link to="/profile" className="btn btn--secondary">
            <Pencil size={16} aria-hidden />
            Профиль
          </Link>
        </div>
        {user?.bio && <p className="profile__bio">{user.bio}</p>}
      </section>

      <div className="tabs-row">
        <div className="segmented segmented--block" role="tablist" aria-label="Разделы кабинета">
          {TABS.map((t, index) => (
            <button
              key={t.value}
              id={`tab-${t.value}`}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              aria-controls={`panel-${t.value}`}
              tabIndex={tab === t.value ? 0 : -1}
              className="segmented__item"
              onClick={() => selectTab(t.value)}
              onKeyDown={(e) => onTabKey(e, index)}
            >
              {t.label}
              {!!t.count && (
                <span className="counter-pill" aria-label={`${t.count} ждут решения`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Alert tone="error" title="Не удалось загрузить кабинет" action={<button type="button" className="btn btn--secondary" onClick={load}>Повторить</button>}>
          {error}
        </Alert>
      )}

      {loading && <SkeletonCards count={2} />}

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "posts" && posts && (
          posts.length === 0 ? (
            <EmptyState
              icon={FilePlus2}
              title="Вы ещё ничего не публиковали"
              hint="Расскажите о своём стартапе или найдите человека на конкретную роль."
              action={<Link to="/new" className="btn btn--primary">Разместить публикацию</Link>}
            />
          ) : (
            <div className="grid grid--2">
              {posts.map((post) => (
                <article key={post.id} className="card">
                  <div className="card__top">
                    <KindBadge kind={post.kind} />
                    {post.status === "closed" && <ClosedBadge />}
                    {post.pending_count > 0 && (
                      <span className="badge badge--pending">
                        {plural(post.pending_count, ["новый отклик", "новых отклика", "новых откликов"])}
                      </span>
                    )}
                  </div>
                  <h2 className="card__title">
                    <Link to={`/posts/${post.id}`} className="card__link">
                      {post.title}
                    </Link>
                  </h2>
                  <div className="card__foot">
                    <span className="card__meta">
                      <MessageSquare size={14} aria-hidden />
                      {plural(post.applications_count, ["отклик", "отклика", "откликов"])}
                    </span>
                    <span aria-hidden>·</span>
                    <time dateTime={post.created_at}>{formatWhen(post.created_at)}</time>
                  </div>
                  <div className="card__actions">
                    <Link to={`/posts/${post.id}/edit`} className="btn btn--secondary">
                      <Pencil size={16} aria-hidden />
                      Изменить
                    </Link>
                    {post.status === "open" ? (
                      <button type="button" className="btn btn--ghost" onClick={() => setPending({ kind: "close", post })} disabled={busyId === post.id}>
                        <Lock size={16} aria-hidden />
                        Закрыть набор
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => act(post.id, () => api.updatePost(post.id, { status: "open" }), "Набор снова открыт")}
                        disabled={busyId === post.id}
                      >
                        <LockOpen size={16} aria-hidden />
                        Открыть снова
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )
        )}

        {tab === "received" && received && (
          received.length === 0 ? (
            <EmptyState icon={Inbox} title="Откликов пока нет" hint="Когда кто-то откликнется на вашу публикацию, отклик появится здесь." />
          ) : (
            <div className="stack stack--lg">
              {[
                { title: "Ждут решения", items: pendingReceived },
                { title: "Разобранные", items: decidedReceived },
              ]
                .filter((group) => group.items.length)
                .map((group) => (
                  <section key={group.title} className="stack" aria-label={group.title}>
                    <h2 className="group-title">
                      {group.title}
                      <span className="subtle">{group.items.length}</span>
                    </h2>
                    <div className="grid grid--2">
                      {group.items.map((application) => (
                        <article key={application.id} className="card">
                          <div className="card__top">
                            <StatusBadge status={application.status} />
                            <span className="subtle">
                              <time dateTime={application.created_at}>{formatWhen(application.created_at)}</time>
                            </span>
                          </div>
                          <Person name={application.applicant.name} headline={application.applicant.headline} />
                          <p className="subtle">
                            на «<Link to={`/posts/${application.post.id}`}>{application.post.title}</Link>»
                          </p>
                          {application.message ? (
                            <p className="quote">{application.message}</p>
                          ) : (
                            <p className="subtle">Без сообщения</p>
                          )}
                          {application.applicant.bio && <p className="subtle">{application.applicant.bio}</p>}
                          {application.status === "accepted" && (
                            <TelegramContact handle={application.applicant.telegram} label="Контакт кандидата" />
                          )}
                          {application.status === "pending" && (
                            <div className="card__actions">
                              <button
                                type="button"
                                className="btn btn--primary"
                                onClick={() => act(application.id, () => api.decide(application.id, "accepted"), "Отклик принят — контакты открыты обеим сторонам")}
                                disabled={busyId === application.id}
                                aria-busy={busyId === application.id}
                              >
                                {busyId === application.id ? <Spinner /> : <Check size={16} aria-hidden />}
                                Принять
                              </button>
                              <button
                                type="button"
                                className="btn btn--danger"
                                onClick={() => setPending({ kind: "decline", application })}
                                disabled={busyId === application.id}
                              >
                                <X size={16} aria-hidden />
                                Отклонить
                              </button>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          )
        )}

        {tab === "sent" && sent && (
          sent.length === 0 ? (
            <EmptyState
              icon={Send}
              title="Вы ещё не откликались"
              hint="Найдите проект, который вам интересен, — в ленте есть стартапы и вакансии участников."
              action={<Link to="/" className="btn btn--primary">Открыть ленту</Link>}
            />
          ) : (
            <div className="grid grid--2">
              {sent.map((application) => (
                <article key={application.id} className="card">
                  <div className="card__top">
                    <StatusBadge status={application.status} />
                    <span className="subtle">
                      <time dateTime={application.created_at}>{formatWhen(application.created_at)}</time>
                    </span>
                  </div>
                  <h2 className="card__title">
                    <Link to={`/posts/${application.post.id}`} className="card__link">
                      {application.post.title}
                    </Link>
                  </h2>
                  <p className="subtle">Автор: {application.post.author.name}</p>
                  {application.status === "accepted" && (
                    <TelegramContact handle={application.post.author.telegram} label="Отклик принят — напишите автору" />
                  )}
                  {application.status === "declined" && <p className="subtle">Автор выбрал другого кандидата.</p>}
                  {application.status === "withdrawn" && <p className="subtle">Вы отозвали этот отклик.</p>}
                  {application.status === "pending" && (
                    <div className="card__actions">
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => setPending({ kind: "withdraw", application })}
                        disabled={busyId === application.id}
                      >
                        Отозвать
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )
        )}
      </div>

      <ConfirmDialog
        open={pending?.kind === "decline"}
        title="Отклонить отклик?"
        confirmLabel="Отклонить"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === "decline" && `${pending.application.applicant.name} увидит, что вы выбрали другого кандидата. Решение нельзя изменить.`}
      </ConfirmDialog>
      <ConfirmDialog
        open={pending?.kind === "withdraw"}
        title="Отозвать отклик?"
        confirmLabel="Отозвать"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        Автор больше не увидит отклик. Пока набор открыт, можно будет откликнуться снова.
      </ConfirmDialog>
      <ConfirmDialog
        open={pending?.kind === "close"}
        title="Закрыть набор?"
        confirmLabel="Закрыть набор"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        Публикация пропадёт из ленты. Полученные отклики останутся, набор можно открыть снова.
      </ConfirmDialog>
    </main>
  );
}
