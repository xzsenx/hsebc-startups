from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import ApplicationStatus, PostKind, PostStatus


def hide_contact(user: "UserPublic") -> "UserPublic":
    """Телеграм — личный контакт, он открывается только после принятия отклика."""
    return user.model_copy(update={"telegram": ""})


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    headline: str
    telegram: str


class UserMe(UserPublic):
    email: EmailStr
    bio: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=120)
    headline: str = Field(default="", max_length=160)
    telegram: str = Field(default="", max_length=64)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserMe


class PostIn(BaseModel):
    kind: PostKind
    title: str = Field(min_length=4, max_length=160)
    summary: str = Field(default="", max_length=280)
    description: str = Field(default="", max_length=5000)
    looking_for: str = Field(default="", max_length=2000)


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=4, max_length=160)
    summary: str | None = Field(default=None, max_length=280)
    description: str | None = Field(default=None, max_length=5000)
    looking_for: str | None = Field(default=None, max_length=2000)
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
    author: UserPublic
    applications_count: int = 0
    # Заполняется только для авторизованного читателя: что он уже сделал с этой публикацией.
    my_application_status: ApplicationStatus | None = None
    is_mine: bool = False


class FeedOut(BaseModel):
    items: list[PostOut]
    total: int
    limit: int
    offset: int


class ApplicationIn(BaseModel):
    message: str = Field(default="", max_length=2000)


class ApplicationDecision(BaseModel):
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
