import { PlusCircle, SearchX, Search, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { PostCard } from "../components/PostCard";
import { Alert, EmptyState, SkeletonCards, Spinner } from "../components/ui";
import { ApiError, api, type Feed, type Kind } from "../lib/api";
import { useAuth } from "../lib/auth";
import { plural } from "../lib/format";
import { useDebounced, usePage } from "../lib/hooks";

const PAGE = 12;
const FILTERS: { value: Kind | ""; label: string }[] = [
  { value: "", label: "Все" },
  { value: "startup", label: "Стартапы" },
  { value: "vacancy", label: "Вакансии" },
];

export default function FeedPage() {
  const heading = usePage("Стартапы и вакансии");
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const kind = (params.get("kind") as Kind | null) ?? "";
  const urlQuery = params.get("q") ?? "";

  const [query, setQuery] = useState(urlQuery);
  const debouncedQuery = useDebounced(query.trim(), 300);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // Поиск попадает в URL с задержкой — история браузера не засоряется каждой буквой.
  useEffect(() => {
    if (debouncedQuery === urlQuery) return;
    const next = new URLSearchParams(params);
    if (debouncedQuery) next.set("q", debouncedQuery);
    else next.delete("q");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- реагируем только на ввод
  }, [debouncedQuery]);

  // Обратная синхронизация: «Назад» в браузере меняет URL — поле поиска следует за ним.
  useEffect(() => {
    setQuery((current) => (current.trim() === urlQuery ? current : urlQuery));
  }, [urlQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .feed({ kind: kind || undefined, q: urlQuery || undefined, limit: PAGE }, controller.signal)
      .then(setFeed)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e instanceof ApiError ? e.message : "Не удалось загрузить ленту");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    // Отмена устаревшего запроса: при быстром переключении фильтров ответы не перепутаются.
    return () => controller.abort();
  }, [kind, urlQuery, reloadKey, user?.id]);

  function setKind(value: Kind | "") {
    const next = new URLSearchParams(params);
    if (value) next.set("kind", value);
    else next.delete("kind");
    setParams(next);
  }

  async function loadMore() {
    if (!feed) return;
    setLoadingMore(true);
    try {
      const page = await api.feed({ kind: kind || undefined, q: urlQuery || undefined, limit: PAGE, offset: feed.items.length });
      setFeed({ ...page, items: [...feed.items, ...page.items] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  function resetFilters() {
    setQuery("");
    setParams(new URLSearchParams());
    searchRef.current?.focus();
  }

  const filtered = Boolean(kind || urlQuery);
  const resultText = feed
    ? filtered
      ? `Нашлось: ${plural(feed.total, ["публикация", "публикации", "публикаций"])}`
      : `${plural(feed.total, ["открытая публикация", "открытые публикации", "открытых публикаций"])}`
    : "";

  return (
    <main id="main" className="main">
      <div className="page-head">
        <div>
          <h1 className="page-head__title" ref={heading} tabIndex={-1} data-route-focus>
            Стартапы и вакансии
          </h1>
          <p className="page-head__lead">Найдите команду в свой проект или присоединитесь к проекту участника Клуба.</p>
        </div>
        {user && (
          <Link to="/new" className="btn btn--primary desktop-only">
            <PlusCircle size={18} aria-hidden />
            Разместить
          </Link>
        )}
      </div>

      <div className="toolbar" role="search">
        <div className="segmented" role="radiogroup" aria-label="Тип публикации">
          {FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              type="button"
              role="radio"
              aria-checked={kind === f.value}
              className="segmented__item"
              onClick={() => setKind(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="search">
          <Search size={18} className="search__icon" aria-hidden />
          <label htmlFor="feed-search" className="sr-only">
            Поиск по названию и навыкам
          </label>
          <input
            id="feed-search"
            ref={searchRef}
            className="input"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Поиск по названию и навыкам"
            maxLength={120}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="search__clear" onClick={() => setQuery("")} aria-label="Очистить поиск">
              <X size={18} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Количество результатов объявляется диктору после каждого изменения фильтра. */}
      <p className="result-line" aria-live="polite">
        {loading ? "" : resultText}
      </p>

      {error && (
        <Alert
          tone="error"
          title="Лента не загрузилась"
          action={
            <button type="button" className="btn btn--secondary" onClick={() => setReloadKey((k) => k + 1)}>
              Повторить
            </button>
          }
        >
          {error}
        </Alert>
      )}

      {loading && <SkeletonCards />}

      {!loading && feed && feed.items.length === 0 && !error && (
        filtered ? (
          <EmptyState
            icon={SearchX}
            title="Ничего не нашли"
            hint="Попробуйте другое слово или уберите фильтр по типу публикации."
            action={
              <button type="button" className="btn btn--secondary" onClick={resetFilters}>
                Сбросить фильтры
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Пока ни одной публикации"
            hint="Расскажите о своём проекте первым — участники Клуба увидят его в ленте."
            action={
              <Link to={user ? "/new" : "/login?next=%2Fnew"} className="btn btn--primary">
                <PlusCircle size={18} aria-hidden />
                Разместить публикацию
              </Link>
            }
          />
        )
      )}

      {!loading && feed && feed.items.length > 0 && (
        <>
          <div className="grid grid--2">
            {feed.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
          {feed.items.length < feed.total && (
            <div className="load-more">
              <button type="button" className="btn btn--secondary btn--lg" onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore}>
                {loadingMore && <Spinner />}
                Показать ещё {Math.min(PAGE, feed.total - feed.items.length)}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
