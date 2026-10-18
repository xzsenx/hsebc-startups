from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.deps import CurrentUser, DbSession, OptionalUser
from app.models import Application, ApplicationStatus, Post, PostKind, PostStatus, User
from app.schemas import FeedOut, PostIn, PostOut, PostUpdate, hide_contact

router = APIRouter(prefix="/api/posts", tags=["posts"])


def _escape_like(value: str) -> str:
    # Параметризованный запрос защищает от SQL-инъекции, но не от спецсимволов LIKE:
    # без экранирования поиск «%» вернул бы всю ленту, а «_» совпадал бы с любым символом.
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _decorate(db: Session, posts: list[Post], viewer: User | None) -> list[PostOut]:
    ids = [p.id for p in posts]
    counts: dict[int, tuple[int, int]] = {}
    mine: dict[int, tuple[ApplicationStatus, int]] = {}
    if ids:
        rows = db.execute(
            select(
                Application.post_id,
                func.count(Application.id),
                func.sum(case((Application.status == ApplicationStatus.pending, 1), else_=0)),
            )
            .where(Application.post_id.in_(ids), Application.status != ApplicationStatus.withdrawn)
            .group_by(Application.post_id)
        ).all()
        counts = {post_id: (total, int(pending or 0)) for post_id, total, pending in rows}
        if viewer is not None:
            rows = db.execute(
                select(Application.post_id, Application.status, Application.id).where(
                    Application.post_id.in_(ids), Application.applicant_id == viewer.id
                )
            ).all()
            mine = {post_id: (value, app_id) for post_id, value, app_id in rows}

    result = []
    for post in posts:
        out = PostOut.model_validate(post)
        out.author = hide_contact(out.author)
        total, pending = counts.get(post.id, (0, 0))
        out.applications_count = total
        out.is_mine = viewer is not None and post.author_id == viewer.id
        # Сколько откликов ждут решения — это видит только автор.
        out.pending_count = pending if out.is_mine else 0
        if post.id in mine:
            out.my_application_status, out.my_application_id = mine[post.id]
        result.append(out)
    return result


def _get_post(db: Session, post_id: int) -> Post:
    post = db.scalar(select(Post).options(selectinload(Post.author)).where(Post.id == post_id))
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Публикация не найдена")
    return post


@router.get("", response_model=FeedOut)
def feed(
    db: DbSession,
    viewer: OptionalUser,
    kind: PostKind | None = None,
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=12, ge=1, le=50),
    offset: int = Query(default=0, ge=0, le=10_000),
) -> FeedOut:
    stmt = select(Post).options(selectinload(Post.author)).where(Post.status == PostStatus.open)
    if kind is not None:
        stmt = stmt.where(Post.kind == kind)
    if q and q.strip():
        pattern = f"%{_escape_like(q.strip())}%"
        stmt = stmt.where(
            or_(
                Post.title.ilike(pattern, escape="\\"),
                Post.summary.ilike(pattern, escape="\\"),
                Post.looking_for.ilike(pattern, escape="\\"),
            )
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    posts = list(
        db.scalars(stmt.order_by(Post.created_at.desc(), Post.id.desc()).limit(limit).offset(offset))
    )
    return FeedOut(items=_decorate(db, posts, viewer), total=total, limit=limit, offset=offset)


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(payload: PostIn, db: DbSession, user: CurrentUser) -> PostOut:
    post = Post(author_id=user.id, **payload.model_dump())
    db.add(post)
    db.commit()
    return _decorate(db, [_get_post(db, post.id)], user)[0]


@router.get("/mine", response_model=list[PostOut])
def my_posts(db: DbSession, user: CurrentUser) -> list[PostOut]:
    posts = list(
        db.scalars(
            select(Post)
            .options(selectinload(Post.author))
            .where(Post.author_id == user.id)
            .order_by(Post.status, Post.created_at.desc())
        )
    )
    return _decorate(db, posts, user)


@router.get("/{post_id}", response_model=PostOut)
def get_post(post_id: int, db: DbSession, viewer: OptionalUser) -> PostOut:
    # Закрытая публикация доступна по прямой ссылке: в интерфейсе она помечена
    # «набор закрыт», а кнопки отклика нет. Из ленты она пропадает.
    post = _get_post(db, post_id)
    return _decorate(db, [post], viewer)[0]


@router.patch("/{post_id}", response_model=PostOut)
def update_post(post_id: int, payload: PostUpdate, db: DbSession, user: CurrentUser) -> PostOut:
    post = _get_post(db, post_id)
    # Право на изменение проверяем на сервере, а не прятанием кнопки в интерфейсе.
    if post.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Это не ваша публикация")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None:
            continue
        setattr(post, field, value)
    db.commit()
    return _decorate(db, [_get_post(db, post_id)], user)[0]
