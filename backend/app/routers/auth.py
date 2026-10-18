from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.deps import CurrentUser, DbSession
from app.models import User
from app.ratelimit import login_limiter
from app.schemas import LoginIn, ProfileUpdate, RegisterIn, TokenOut, UserMe
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    # За nginx адрес клиента приходит через X-Forwarded-For; uvicorn запущен с
    # --proxy-headers, а сам бэкенд наружу не опубликован, поэтому заголовок не подделать.
    return request.client.host if request.client else "unknown"


def _throttle(request: Request, email: str, scope: str) -> None:
    settings = get_settings()
    ip = _client_ip(request)
    # Два счётчика: на пару «IP + почта» (перебор пароля одного аккаунта) и на IP целиком
    # (перебор по многим аккаунтам). Блокировать только по почте нельзя — тогда любой
    # сможет заблокировать вход чужому аккаунту.
    for key, limit in (
        (f"{scope}:pair:{ip}:{email}", settings.login_attempts_per_window),
        (f"{scope}:ip:{ip}", settings.login_attempts_per_window * 5),
    ):
        retry_after = login_limiter.hit(key, limit, settings.login_window_seconds)
        if retry_after is not None:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Слишком много попыток. Попробуйте через {int(retry_after) + 1} с",
                headers={"Retry-After": str(int(retry_after) + 1)},
            )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, request: Request, db: DbSession) -> TokenOut:
    email = payload.email.lower()
    _throttle(request, email, "register")
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        headline=payload.headline,
        telegram=payload.telegram,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Уникальный индекс на email ловит и гонку двух одновременных регистраций.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь с такой почтой уже есть")
    db.refresh(user)
    return TokenOut(access_token=create_access_token(user.id), user=UserMe.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: DbSession) -> TokenOut:
    email = payload.email.lower()
    _throttle(request, email, "login")
    user = db.scalar(select(User).where(User.email == email))
    # verify_password выполняет bcrypt и для несуществующей почты — время ответа одинаковое.
    # Текст ошибки тоже одинаковый: форма входа не должна подтверждать, кто зарегистрирован.
    if not verify_password(payload.password, user.password_hash if user else None) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверная почта или пароль")
    login_limiter.reset(f"login:pair:{_client_ip(request)}:{email}")
    return TokenOut(access_token=create_access_token(user.id), user=UserMe.model_validate(user))


@router.get("/me", response_model=UserMe)
def me(user: CurrentUser) -> UserMe:
    return UserMe.model_validate(user)


@router.patch("/me", response_model=UserMe)
def update_me(payload: ProfileUpdate, db: DbSession, user: CurrentUser) -> UserMe:
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None and field == "name":
            continue
        setattr(user, field, value if value is not None else "")
    db.commit()
    db.refresh(user)
    return UserMe.model_validate(user)
