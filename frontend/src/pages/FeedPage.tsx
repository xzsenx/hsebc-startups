import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ClosedBadge, Empty, ErrorBox, KindBadge, Loader, StatusBadge, formatDate } from "../components/ui";
import { api, type Feed, type Kind } from "../lib/api";

const FILTERS: { value: Kind | "all"; label: string }[] = [
  { value: "all", label: "Всё" },
  { value: "startup", label: "Стартапы" },
  { value: "vacancy", label: "Вакансии" },
];

export default function FeedPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .feed({ kind: kind === "all" ? undefined : kind, q: query || undefined })
        .then((data) => {
          setFeed(data);
          setError("");
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [kind, query]);

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">Стартапы и вакансии Клуба</h1>
        <p className="page__subtitle">Найдите команду в проект или присоединитесь к чужому</p>
      </div>

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={kind === f.value}
              className={`tab ${kind === f.value ? "tab--active" : ""}`}
              onClick={() => setKind(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="input input--search"
          placeholder="Поиск по названию или навыкам"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Поиск"
        />
      </div>

      {error && <ErrorBox message={error} />}
      {loading && !feed && <Loader />}

      {feed && feed.items.length === 0 && (
        <Empty
          title={query ? "Ничего не нашли" : "Пока здесь пусто"}
          hint={query ? "Попробуйте другой запрос" : "Станьте первым, кто разместит предложение"}
        />
      )}

      <div className="cards">
        {feed?.items.map((post) => (
          <Link key={post.id} to={`/posts/${post.id}`} className="card">
            <div className="card__top">
              <KindBadge kind={post.kind} />
              <ClosedBadge status={post.status} />
              {post.my_application_status && <StatusBadge status={post.my_application_status} />}
              {post.is_mine && <span className="badge badge--mine">Моя</span>}
            </div>
            <h3 className="card__title">{post.title}</h3>
            {post.summary && <p className="card__summary">{post.summary}</p>}
            {post.looking_for && (
              <p className="card__looking">
                <span>Ищет:</span> {post.looking_for}
              </p>
            )}
            <div className="card__foot">
              <span>{post.author.name}</span>
              <span className="card__dot">·</span>
              <span>{formatDate(post.created_at)}</span>
              <span className="card__spacer" />
              <span>{post.applications_count} откликов</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
