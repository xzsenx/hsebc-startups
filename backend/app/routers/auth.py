from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import User
from app.schemas import LoginIn, RegisterIn, TokenOut, UserMe
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: DbSession) -> TokenOut:
    email = payload.email.lower()
    exists = db.scalar(select(User).where(User.email == email))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь с такой почтой уже есть")
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        headline=payload.headline,
        telegram=payload.telegram,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_access_token(user.id), user=UserMe.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: DbSession) -> TokenOut:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    # Одинаковый ответ на «нет такой почты» и «неверный пароль»:
    # иначе форма логина превращается в проверку, кто зарегистрирован.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверная почта или пароль")
    return TokenOut(access_token=create_access_token(user.id), user=UserMe.model_validate(user))


@router.get("/me", response_model=UserMe)
def me(user: CurrentUser) -> UserMe:
    return UserMe.model_validate(user)
