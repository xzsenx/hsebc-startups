import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ClosedBadge, Empty, ErrorBox, KindBadge, Loader, Section, StatusBadge, formatDate } from "../components/ui";
import { api, type Application, type Post } from "../lib/api";
import { useAuth } from "../lib/auth";

type Tab = "posts" | "received" | "sent";

const TABS: { value: Tab; label: string }[] = [
  { value: "posts", label: "Мои публикации" },
  { value: "received", label: "Полученные отклики" },
  { value: "sent", label: "Мои отклики" },
];

export default function CabinetPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<Post[]>([]);
  const [received, setReceived] = useState<Application[]>([]);
  const [sent, setSent] = useState<Application[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, s] = await Promise.all([api.myPosts(), api.received(), api.sent()]);
      setPosts(p);
      setReceived(r);
      setSent(s);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: number, status: "accepted" | "declined") {
    try {
      await api.decide(id, status);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleStatus(post: Post) {
    try {
      await api.setPostStatus(post.id, post.status === "open" ? "closed" : "open");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <Loader />;

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">Личный кабинет</h1>
        <p className="page__subtitle">
          {user?.name}
          {user?.headline && ` · ${user.headline}`}
        </p>
      </div>

      <div className="tabs tabs--wide" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            className={`tab ${tab === t.value ? "tab--active" : ""}`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} />}

      {tab === "posts" && (
        <Section title="">
          {posts.length === 0 && (
            <Empty title="Вы ещё ничего не публиковали" hint="Разместите стартап или вакансию" />
          )}
          <div className="cards">
            {posts.map((post) => (
              <div key={post.id} className="card card--static">
                <div className="card__top">
                  <KindBadge kind={post.kind} />
                  <ClosedBadge status={post.status} />
                </div>
                <Link to={`/posts/${post.id}`} className="card__title card__title--link">
                  {post.title}
                </Link>
                <div className="card__foot">
                  <span>{post.applications_count} откликов</span>
                  <span className="card__spacer" />
                  <button className="btn btn--ghost btn--small" onClick={() => toggleStatus(post)}>
                    {post.status === "open" ? "Закрыть набор" : "Открыть снова"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === "received" && (
        <Section title="">
          {received.length === 0 && (
            <Empty title="Откликов пока нет" hint="Они появятся здесь, когда кто-то заинтересуется" />
          )}
          <div className="cards">
            {received.map((application) => (
              <div key={application.id} className="card card--static">
                <div className="card__top">
                  <StatusBadge status={application.status} />
                  <span className="card__meta">{formatDate(application.created_at)}</span>
                </div>
                <Link to={`/posts/${application.post.id}`} className="card__title card__title--link">
                  {application.post.title}
                </Link>
                <p className="card__person">
                  <strong>{application.applicant.name}</strong>
                  {application.applicant.headline && ` · ${application.applicant.headline}`}
                </p>
                {application.message && <p className="card__summary">«{application.message}»</p>}
                {application.status === "accepted" && application.applicant.telegram && (
                  <p className="card__contact">Контакт: {application.applicant.telegram}</p>
                )}
                {application.status === "pending" && (
                  <div className="card__actions">
                    <button className="btn btn--primary btn--small" onClick={() => decide(application.id, "accepted")}>
                      Принять
                    </button>
                    <button className="btn btn--ghost btn--small" onClick={() => decide(application.id, "declined")}>
                      Отклонить
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === "sent" && (
        <Section title="">
          {sent.length === 0 && (
            <Empty title="Вы ещё не откликались" hint="Найдите подходящее предложение в ленте" />
          )}
          <div className="cards">
            {sent.map((application) => (
              <div key={application.id} className="card card--static">
                <div className="card__top">
                  <StatusBadge status={application.status} />
                  <span className="card__meta">{formatDate(application.created_at)}</span>
                </div>
                <Link to={`/posts/${application.post.id}`} className="card__title card__title--link">
                  {application.post.title}
                </Link>
                <p className="card__person">Автор: {application.post.author.name}</p>
                {application.status === "accepted" && application.post.author.telegram && (
                  <p className="card__contact">
                    Отклик принят. Контакт автора: {application.post.author.telegram}
                  </p>
                )}
                {application.status === "declined" && (
                  <p className="card__meta">Автор отклонил отклик</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
