from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession, OptionalUser
from app.models import Application, Post, PostKind, PostStatus, User
from app.schemas import FeedOut, PostIn, PostOut, PostUpdate, hide_contact

router = APIRouter(prefix="/api/posts", tags=["posts"])


def to_out(post: Post, viewer: User | None, counts: dict[int, int], mine: dict[int, str]) -> PostOut:
    out = PostOut.model_validate(post)
    out.author = hide_contact(out.author)
    out.applications_count = counts.get(post.id, 0)
    out.is_mine = viewer is not None and post.author_id == viewer.id
    status_value = mine.get(post.id)
    out.my_application_status = status_value
    return out


def _decorate(db, posts: list[Post], viewer: User | None) -> tuple[dict, dict]:
    ids = [p.id for p in posts]
    if not ids:
        return {}, {}
    rows = db.execute(
        select(Application.post_id, func.count(Application.id))
        .where(Application.post_id.in_(ids))
        .group_by(Application.post_id)
    ).all()
    counts = {post_id: total for post_id, total in rows}
    mine: dict[int, str] = {}
    if viewer is not None:
        rows = db.execute(
            select(Application.post_id, Application.status).where(
                Application.post_id.in_(ids), Application.applicant_id == viewer.id
            )
        ).all()
        mine = {post_id: value for post_id, value in rows}
    return counts, mine


@router.get("", response_model=FeedOut)
def feed(
    db: DbSession,
    viewer: OptionalUser,
    kind: PostKind | None = None,
    q: str | None = Query(default=None, max_length=120),
    include_closed: bool = False,
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
) -> FeedOut:
    stmt = select(Post).options(selectinload(Post.author))
    if not include_closed:
        stmt = stmt.where(Post.status == PostStatus.open)
    if kind is not None:
        stmt = stmt.where(Post.kind == kind)
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Post.title.ilike(pattern), Post.summary.ilike(pattern), Post.looking_for.ilike(pattern))
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    posts = list(
        db.scalars(stmt.order_by(Post.created_at.desc(), Post.id.desc()).limit(limit).offset(offset))
    )
    counts, mine = _decorate(db, posts, viewer)
    return FeedOut(
        items=[to_out(p, viewer, counts, mine) for p in posts],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(payload: PostIn, db: DbSession, user: CurrentUser) -> PostOut:
    post = Post(author_id=user.id, **payload.model_dump())
    db.add(post)
    db.commit()
    db.refresh(post)
    return to_out(post, user, {}, {})


@router.get("/mine", response_model=list[PostOut])
def my_posts(db: DbSession, user: CurrentUser) -> list[PostOut]:
    posts = list(
        db.scalars(
            select(Post)
            .options(selectinload(Post.author))
            .where(Post.author_id == user.id)
            .order_by(Post.created_at.desc())
        )
    )
    counts, mine = _decorate(db, posts, user)
    return [to_out(p, user, counts, mine) for p in posts]


@router.get("/{post_id}", response_model=PostOut)
def get_post(post_id: int, db: DbSession, viewer: OptionalUser) -> PostOut:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Публикация не найдена")
    counts, mine = _decorate(db, [post], viewer)
    return to_out(post, viewer, counts, mine)


@router.patch("/{post_id}", response_model=PostOut)
def update_post(post_id: int, payload: PostUpdate, db: DbSession, user: CurrentUser) -> PostOut:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Публикация не найдена")
    # Право на изменение проверяем на сервере, а не прятанием кнопки в интерфейсе.
    if post.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Это не ваша публикация")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    db.commit()
    db.refresh(post)
    counts, mine = _decorate(db, [post], user)
    return to_out(post, user, counts, mine)
