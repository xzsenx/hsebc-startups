from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DbSession
from app.models import Application, ApplicationStatus, Post, PostStatus
from app.schemas import ApplicationDecision, ApplicationIn, ApplicationOut, hide_contact

router = APIRouter(prefix="/api", tags=["applications"])

_LOADERS = (
    selectinload(Application.applicant),
    selectinload(Application.post).selectinload(Post.author),
)


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
        raise HTTPException(status.HTTP_409_CONFLICT, "Публикация закрыта")

    application = Application(post_id=post_id, applicant_id=user.id, message=payload.message)
    db.add(application)
    try:
        db.commit()
    except IntegrityError:
        # Сработало уникальное ограничение (post_id, applicant_id): отклик уже есть.
        # Это же покрывает случай двойного клика по кнопке.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Вы уже откликнулись на эту публикацию")
    db.refresh(application)
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
    """Полученные отклики на все публикации текущего пользователя."""
    rows = db.scalars(
        select(Application)
        .options(*_LOADERS)
        .join(Post, Post.id == Application.post_id)
        .where(Post.author_id == user.id)
        .order_by(Application.created_at.desc())
    )
    return [_out(a) for a in rows]


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
        .where(Application.post_id == post_id)
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
    application = db.get(Application, application_id)
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Отклик не найден")
    post = db.get(Post, application.post_id)
    if post is None or post.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Решение принимает только автор публикации")
    if payload.status is ApplicationStatus.pending:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Нельзя вернуть отклик в ожидание")

    if application.status is not ApplicationStatus.pending:
        # Повторное нажатие той же кнопки отдаёт тот же результат, а не ошибку;
        # попытка поменять уже принятое решение — конфликт.
        if application.status is payload.status:
            return _load(db, application.id)
        raise HTTPException(status.HTTP_409_CONFLICT, "Решение по этому отклику уже принято")

    application.status = payload.status
    application.decided_at = datetime.now(timezone.utc)
    db.commit()
    return _load(db, application.id)


def _out(application: Application) -> ApplicationOut:
    out = ApplicationOut.model_validate(application)
    # Обмен контактами — следствие принятого отклика, а не самого факта отклика.
    if application.status is not ApplicationStatus.accepted:
        out.applicant = hide_contact(out.applicant)
        out.post.author = hide_contact(out.post.author)
    return out


def _load(db, application_id: int) -> ApplicationOut:
    application = db.scalar(
        select(Application).options(*_LOADERS).where(Application.id == application_id)
    )
    return _out(application)
