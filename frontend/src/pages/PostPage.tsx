import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ClosedBadge, ErrorBox, KindBadge, Loader, StatusBadge, formatDate } from "../components/ui";
import { ApiError, api, type Post } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function PostPage() {
  const { id } = useParams();
  const postId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState<Post | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .post(postId)
      .then(setPost)
      .catch((e: Error) => setError(e.message));
  }, [postId]);

  async function apply() {
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.apply(postId, message);
      setNotice("Отклик отправлен — автор увидит его у себя в кабинете");
      setPost(await api.post(postId));
    } catch (err) {
      // 409 означает «уже откликались»: это не ошибка пользователя, объясняем спокойно.
      if (err instanceof ApiError && err.status === 409) {
        setNotice(err.message);
        setPost(await api.post(postId));
      } else {
        setError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (error && !post) return <ErrorBox message={error} />;
  if (!post) return <Loader />;

  const canApply = post.status === "open" && !post.is_mine && !post.my_application_status;

  return (
    <div className="page page--narrow">
      <button className="link-button" onClick={() => navigate(-1)}>
        ← Назад
      </button>

      <div className="card__top">
        <KindBadge kind={post.kind} />
        <ClosedBadge status={post.status} />
        {post.my_application_status && <StatusBadge status={post.my_application_status} />}
      </div>

      <h1 className="page__title">{post.title}</h1>
      <p className="post__author">
        {post.author.name}
        {post.author.headline && ` · ${post.author.headline}`} · {formatDate(post.created_at)}
      </p>

      {post.summary && <p className="post__summary">{post.summary}</p>}
      {post.description && <p className="post__text">{post.description}</p>}
      {post.looking_for && (
        <div className="post__block">
          <h2 className="post__block-title">Кого ищет автор</h2>
          <p className="post__text">{post.looking_for}</p>
        </div>
      )}

      {notice && <div className="notice">{notice}</div>}
      {error && <ErrorBox message={error} />}

      {post.is_mine && (
        <div className="notice">Это ваша публикация. Отклики на неё — в личном кабинете.</div>
      )}
      {post.status === "closed" && !post.is_mine && (
        <div className="notice">Автор закрыл набор — откликнуться уже нельзя.</div>
      )}

      {canApply && (
        <div className="post__block">
          <h2 className="post__block-title">Откликнуться</h2>
          <textarea
            className="input input--area"
            rows={4}
            placeholder="Коротко: чем можете быть полезны и что хотите узнать"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button className="btn btn--primary btn--wide" onClick={apply} disabled={busy}>
            {busy ? "Отправляем…" : "Отправить отклик"}
          </button>
        </div>
      )}
    </div>
  );
}
