import { MessageSquare, UserRoundSearch } from "lucide-react";
import { Link } from "react-router-dom";

import type { Post } from "../lib/api";
import { formatWhen, plural } from "../lib/format";
import { Avatar, ClosedBadge, KindBadge, StatusBadge } from "./ui";

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="card card--interactive">
      <div className="card__top">
        <KindBadge kind={post.kind} />
        {post.status === "closed" && <ClosedBadge />}
        {post.is_mine && <span className="badge badge--mine">Ваша публикация</span>}
        {post.my_application_status && <StatusBadge status={post.my_application_status} prefix="Отклик" />}
      </div>

      <h2 className="card__title">
        <Link to={`/posts/${post.id}`} className="card__link">
          {post.title}
        </Link>
      </h2>

      {post.summary && <p className="card__text">{post.summary}</p>}

      <div className="card__looking">
        <UserRoundSearch size={16} aria-hidden />
        <span>
          <span className="sr-only">Ищет: </span>
          {post.looking_for}
        </span>
      </div>

      <div className="card__foot">
        <span className="card__meta">
          <Avatar name={post.author.name} size="sm" />
          {post.author.name}
        </span>
        <span aria-hidden>·</span>
        <time dateTime={post.created_at}>{formatWhen(post.created_at)}</time>
        <span className="card__spacer" />
        <span className="card__meta">
          <MessageSquare size={14} aria-hidden />
          {plural(post.applications_count, ["отклик", "отклика", "откликов"])}
        </span>
      </div>
    </article>
  );
}
