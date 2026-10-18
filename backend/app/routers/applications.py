from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.deps import CurrentUser, DbSession
from app.models import Application, ApplicationStatus, Post, PostStatus
from app.schemas import (
    ApplicationDecision,
    ApplicationIn,
    ApplicationOut,
    SummaryOut,
    hide_contact,
)

router = APIRouter(prefix="/api", tags=["applications"])

_LOADERS = (
    selectinload(Application.applicant),
    selectinload(Application.post).selectinload(Post.author),
)

_FINAL = {ApplicationStatus.accepted, ApplicationStatus.declined}


def _out(application: Application) -> ApplicationOut:
    out = ApplicationOut.model_validate(application)
    # Обмен контактами — следствие принятого отклика, а не самого факта отклика.
    if application.status is not ApplicationStatus.accepted:
        out.applicant = hide_contact(out.applicant)
        out.post.author = hide_contact(out.post.author)
    return out


def _load(db: Session, application_id: int) -> ApplicationOut:
    db.expire_all()
    application = db.scalar(
        select(Application).options(*_LOADERS).where(Application.id == application_id)
    )
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Отклик не найден")
    return _out(application)


@router.post(
    "/posts/{post_id}/applications",
    response_model=ApplicationOut,
    status_code=status.HTTP_201_CREATED,
)
def apply(post_id: int, payload: ApplicationIn, db: DbSession, user: CurrentUser) -> ApplicationOut:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Публикация не найдена")
    if post.author_id == user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нельзя откликнуться на свою публикацию")
    if post.status is PostStatus.closed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Автор закрыл набор")

    # Повторный отклик после отзыва переиспользует ту же запись: так история
    # остаётся одной строкой, а уникальное ограничение не приходится обходить.
    revived = db.execute(
        update(Application)
        .where(
            Application.post_id == post_id,
            Application.applicant_id == user.id,
            Application.status == ApplicationStatus.withdrawn,
        )
        .values(
            status=ApplicationStatus.pending,
            message=payload.message,
            created_at=func.now(),
            decided_at=None,
        )
        .returning(Application.id)
    ).scalar_one_or_none()
    if revived is not None:
        db.commit()
        return _load(db, revived)

    application = Application(post_id=post_id, applicant_id=user.id, message=payload.message)
    db.add(application)
    try:
        db.commit()
    except IntegrityError:
        # Сработало уникальное ограничение (post_id, applicant_id): отклик уже есть.
        # Это же покрывает двойной клик и параллельные запросы.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Вы уже откликнулись на эту публикацию")
    return _load(db, application.id)


@router.get("/me/applications", response_model=list[ApplicationOut])
def my_applications(db: DbSession, user: CurrentUser) -> list[ApplicationOut]:
    """Отправленные отклики: здесь откликнувшийся видит решение автора."""
    rows = db.scalars(
        select(Application)
        .options(*_LOADERS)
        .where(Application.applicant_id == user.id)
        .order_by(Application.created_at.desc())
    )
    return [_out(a) for a in rows]


@router.get("/me/applications/received", response_model=list[ApplicationOut])
def received_applications(db: DbSession, user: CurrentUser) -> list[ApplicationOut]:
    """Полученные отклики на все публикации пользователя. Отозванные автору не показываем."""
    rows = db.scalars(
        select(Application)
        .options(*_LOADERS)
        .join(Post, Post.id == Application.post_id)
        .where(Post.author_id == user.id, Application.status != ApplicationStatus.withdrawn)
        .order_by(Application.status, Application.created_at.desc())
    )
    return [_out(a) for a in rows]


@router.get("/me/summary", response_model=SummaryOut)
def summary(db: DbSession, user: CurrentUser) -> SummaryOut:
    """Счётчики для бейджа в навигации — без загрузки самих списков."""
    pending = db.scalar(
        select(func.count())
        .select_from(Application)
        .join(Post, Post.id == Application.post_id)
        .where(Post.author_id == user.id, Application.status == ApplicationStatus.pending)
    )
    my_posts = db.scalar(select(func.count()).select_from(Post).where(Post.author_id == user.id))
    sent = db.scalar(
        select(func.count())
        .select_from(Application)
        .where(Application.applicant_id == user.id, Application.status != ApplicationStatus.withdrawn)
    )
    return SummaryOut(pending_received=pending or 0, my_posts=my_posts or 0, sent=sent or 0)


@router.get("/posts/{post_id}/applications", response_model=list[ApplicationOut])
def post_applications(post_id: int, db: DbSession, user: CurrentUser) -> list[ApplicationOut]:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Публикация не найдена")
    if post.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Отклики видит только автор публикации")
    rows = db.scalars(
        select(Application)
        .options(*_LOADERS)
        .where(Application.post_id == post_id, Application.status != ApplicationStatus.withdrawn)
        .order_by(Application.created_at.desc())
    )
    return [_out(a) for a in rows]


@router.patch("/applications/{application_id}", response_model=ApplicationOut)
def decide(
    application_id: int,
    payload: ApplicationDecision,
    db: DbSession,
    user: CurrentUser,
) -> ApplicationOut:
    if payload.status not in _FINAL:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Решение — только «принять» или «отклонить»"
        )
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Отклик не найден")
    post = db.get(Post, application.post_id)
    if post is None or post.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Решение принимает только автор публикации")

    # Условный UPDATE атомарен на уровне БД: из двух одновременных решений
    # («принять» и «отклонить» с разных вкладок) применится ровно одно.
    changed = db.execute(
        update(Application)
        .where(Application.id == application_id, Application.status == ApplicationStatus.pending)
        .values(status=payload.status, decided_at=datetime.now(timezone.utc))
    ).rowcount
    db.commit()

    if not changed:
        db.refresh(application)
        if application.status is payload.status:
            # Повторное нажатие той же кнопки — тот же результат, а не ошибка.
            return _load(db, application_id)
        if application.status is ApplicationStatus.withdrawn:
            raise HTTPException(status.HTTP_409_CONFLICT, "Кандидат отозвал отклик")
        raise HTTPException(status.HTTP_409_CONFLICT, "Решение по этому отклику уже принято")
    return _load(db, application_id)


@router.post("/applications/{application_id}/withdraw", response_model=ApplicationOut)
def withdraw(application_id: int, db: DbSession, user: CurrentUser) -> ApplicationOut:
    application = db.get(Application, application_id)
    # Чужой отклик и несуществующий отвечают одинаково: не раскрываем, что id существует.
    if application is None or application.applicant_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Отклик не найден")

    changed = db.execute(
        update(Application)
        .where(Application.id == application_id, Application.status == ApplicationStatus.pending)
        .values(status=ApplicationStatus.withdrawn)
    ).rowcount
    db.commit()

    if not changed:
        db.refresh(application)
        if application.status is ApplicationStatus.withdrawn:
            return _load(db, application_id)
        raise HTTPException(status.HTTP_409_CONFLICT, "Автор уже принял решение — отозвать нельзя")
    return _load(db, application_id)
