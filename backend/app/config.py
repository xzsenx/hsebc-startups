from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "production", "test"] = "development"
    database_url: str = "postgresql+psycopg://app:app@db:5432/app"

    # Алгоритм намеренно не настраивается из окружения: фиксированный HS256
    # исключает атаки с подменой алгоритма в заголовке токена.
    jwt_secret: str = DEV_JWT_SECRET
    access_token_ttl_minutes: int = 60 * 24

    cors_origins: str = "http://localhost:8080,http://localhost:5173"

    seed_demo: bool = True
    seed_password: str = "demo1234"

    login_attempts_per_window: int = 10
    login_window_seconds: int = 300

    docs_enabled: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _refuse_unsafe_production(self) -> "Settings":
        # Лучше упасть на старте, чем тихо подписывать токены известным всем ключом.
        if self.environment == "production":
            if self.jwt_secret == DEV_JWT_SECRET or len(self.jwt_secret) < 32:
                raise ValueError("В production нужен JWT_SECRET длиной от 32 символов")
            if self.seed_demo:
                raise ValueError("В production демо-аккаунты отключаются: SEED_DEMO=false")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
