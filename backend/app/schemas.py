import re
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

from app.models import ApplicationStatus, PostKind, PostStatus

_TELEGRAM_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{4,31}$")


def _check_password(value: str) -> str:
    # bcrypt учитывает только первые 72 байта. Кириллица занимает 2 байта на символ,
    # поэтому ограничение по символам не спасает — проверяем именно байты.
    if len(value.encode()) > 72:
        raise ValueError("Пароль слишком длинный: максимум 72 байта (около 36 символов кириллицей)")
    if not value.strip():
        raise ValueError("Пароль не может состоять из пробелов")
    return value


def _normalize_telegram(value: str) -> str:
    value = value.strip().removeprefix("https://t.me/").removeprefix("@")
    if not value:
        return ""
    if not _TELEGRAM_RE.match(value):
        raise ValueError("Ник в Telegram: 5–32 символа, латиница, цифры и подчёркивание")
    return f"@{value}"


Password = Annotated[str, Field(min_length=8, max_length=72), AfterValidator(_check_password)]
Telegram = Annotated[str, Field(max_length=64), AfterValidator(_normalize_telegram)]


class StrictModel(BaseModel):
    # Обрезаем пробелы по краям до проверки длины: заголовок из пробелов не пройдёт min_length.
    # extra=forbid — лишние поля в запросе считаются ошибкой, а не молча игнорируются.
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    headline: str
    bio: str
    telegram: str


def hide_contact(user: UserPublic) -> UserPublic:
    """Телеграм — личный контакт, он открывается только после принятия отклика."""
    return user.model_copy(update={"telegram": ""})


class UserMe(UserPublic):
    email: EmailStr


class RegisterIn(StrictModel):
    email: EmailStr
    password: Password
    name: str = Field(min_length=2, max_length=120)
    headline: str = Field(default="", max_length=160)
    telegram: Telegram = ""


class LoginIn(StrictModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class ProfileUpdate(StrictModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    headline: str | None = Field(default=None, max_length=160)
    bio: str | None = Field(default=None, max_length=1000)
    telegram: Telegram | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserMe


class PostIn(StrictModel):
    kind: PostKind
    title: str = Field(min_length=4, max_length=160)
    summary: str = Field(default="", max_length=280)
    description: str = Field(default="", max_length=5000)
    looking_for: str = Field(min_length=3, max_length=2000)


class PostUpdate(StrictModel):
    title: str | None = Field(default=None, min_length=4, max_length=160)
    summary: str | None = Field(default=None, max_length=280)
    description: str | None = Field(default=None, max_length=5000)
    looking_for: str | None = Field(default=None, min_length=3, max_length=2000)
    status: PostStatus | None = None


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: PostKind
    title: str
    summary: str
    description: str
    looking_for: str
    status: PostStatus
    created_at: datetime
    updated_at: datetime
    author: UserPublic
    applications_count: int = 0
    pending_count: int = 0
    # Заполняется только для авторизованного читателя: что он уже сделал с публикацией.
    my_application_status: ApplicationStatus | None = None
    my_application_id: int | None = None
    is_mine: bool = False


class FeedOut(BaseModel):
    items: list[PostOut]
    total: int
    limit: int
    offset: int


class ApplicationIn(StrictModel):
    message: str = Field(default="", max_length=2000)


class ApplicationDecision(StrictModel):
    status: ApplicationStatus


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: ApplicationStatus
    message: str
    created_at: datetime
    decided_at: datetime | None
    applicant: UserPublic
    post: PostOut


class SummaryOut(BaseModel):
    pending_received: int
    my_posts: int
    sent: int
