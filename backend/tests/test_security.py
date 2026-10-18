"""Тесты на найденные при аудите уязвимости — по одному на каждую, чтобы исправление
нельзя было незаметно откатить."""

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from pydantic import ValidationError

from app.config import DEV_JWT_SECRET, Settings
from tests.conftest import PASSWORD, auth, make_post, register

SECRET = "test-secret-that-is-long-enough-for-hs256"


# --- Токены --------------------------------------------------------------------------


def _token(payload: dict, key: str = SECRET, algorithm: str = "HS256") -> str:
    return jwt.encode(payload, key, algorithm=algorithm)


def test_token_with_alg_none_is_rejected(client):
    # Классическая атака: токен без подписи с alg=none.
    user = register(client, "a@test.ru")["user"]
    forged = jwt.encode({"sub": str(user["id"]), "iat": 0, "exp": 9_999_999_999}, None, algorithm="none")
    assert client.get("/api/auth/me", headers=auth(forged)).status_code == 401


def test_token_signed_with_other_key_is_rejected(client):
    user = register(client, "a@test.ru")["user"]
    now = datetime.now(timezone.utc)
    forged = _token({"sub": str(user["id"]), "iat": now, "exp": now + timedelta(hours=1)}, key="x" * 40)
    assert client.get("/api/auth/me", headers=auth(forged)).status_code == 401


def test_expired_token_is_rejected(client):
    user = register(client, "a@test.ru")["user"]
    past = datetime.now(timezone.utc) - timedelta(days=2)
    expired = _token({"sub": str(user["id"]), "iat": past, "exp": past + timedelta(hours=1)})
    assert client.get("/api/auth/me", headers=auth(expired)).status_code == 401


def test_token_without_exp_is_rejected(client):
    user = register(client, "a@test.ru")["user"]
    eternal = _token({"sub": str(user["id"]), "iat": datetime.now(timezone.utc)})
    assert client.get("/api/auth/me", headers=auth(eternal)).status_code == 401


def test_token_of_deleted_user_is_rejected(client):
    now = datetime.now(timezone.utc)
    ghost = _token({"sub": "999999", "iat": now, "exp": now + timedelta(hours=1)})
    assert client.get("/api/auth/me", headers=auth(ghost)).status_code == 401


# --- Перебор паролей -----------------------------------------------------------------


def test_login_is_rate_limited(client):
    register(client, "a@test.ru")
    codes = [
        client.post("/api/auth/login", json={"email": "a@test.ru", "password": "wrong-pass"}).status_code
        for _ in range(11)
    ]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429


def test_rate_limit_does_not_lock_out_other_accounts(client):
    register(client, "victim@test.ru")
    for _ in range(10):
        client.post("/api/auth/login", json={"email": "victim@test.ru", "password": "wrong-pass"})
    # Перебор одного аккаунта не мешает входу в другой.
    register(client, "other@test.ru")
    ok = client.post("/api/auth/login", json={"email": "other@test.ru", "password": PASSWORD})
    assert ok.status_code == 200


def test_successful_login_resets_counter(client):
    register(client, "a@test.ru")
    for _ in range(9):
        client.post("/api/auth/login", json={"email": "a@test.ru", "password": "wrong-pass"})
    assert client.post("/api/auth/login", json={"email": "a@test.ru", "password": PASSWORD}).status_code == 200
    # После успешного входа счётчик пары сброшен — опечатка не блокирует сразу.
    assert client.post("/api/auth/login", json={"email": "a@test.ru", "password": "wrong-pass"}).status_code == 401


# --- Пароли --------------------------------------------------------------------------


def test_password_over_72_bytes_rejected(client):
    # bcrypt молча обрезает пароль до 72 байт: два разных длинных пароля с общим
    # началом стали бы равны. 40 кириллических символов = 80 байт.
    response = client.post(
        "/api/auth/register",
        json={"email": "a@test.ru", "password": "п" * 40, "name": "Тест"},
    )
    assert response.status_code == 422


def test_whitespace_password_rejected(client):
    response = client.post(
        "/api/auth/register", json={"email": "a@test.ru", "password": " " * 10, "name": "Тест"}
    )
    assert response.status_code == 422


def test_password_hash_never_leaks(client):
    data = register(client, "a@test.ru")
    me = client.get("/api/auth/me", headers=auth(data["access_token"])).json()
    assert "password" not in str(me).lower()
    assert "password" not in str(data).lower()


# --- Ввод ----------------------------------------------------------------------------


def test_like_wildcards_are_escaped(client):
    author = register(client, "a@test.ru")
    make_post(client, author["access_token"], "Обычная публикация")
    # Без экранирования «%» совпал бы со всем, а «_» — с любым символом.
    assert client.get("/api/posts", params={"q": "%"}).json()["total"] == 0
    assert client.get("/api/posts", params={"q": "_"}).json()["total"] == 0


def test_telegram_handle_validated(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "a@test.ru", "password": PASSWORD, "name": "Тест", "telegram": "<script>"},
    )
    assert response.status_code == 422


def test_unknown_fields_rejected_on_post_create(client):
    author = register(client, "a@test.ru")
    response = client.post(
        "/api/posts",
        json={"kind": "startup", "title": "Проект", "looking_for": "Дизайнер", "author_id": 999},
        headers=auth(author["access_token"]),
    )
    assert response.status_code == 422


def test_html_is_stored_as_text_not_executed(client):
    # Сервер хранит как есть; экранирование — на стороне React, который не использует
    # dangerouslySetInnerHTML. Проверяем, что сервер ничего не «чистит» молча.
    author = register(client, "a@test.ru")
    response = client.post(
        "/api/posts",
        json={"kind": "startup", "title": "<img src=x onerror=alert(1)>", "looking_for": "Кто-то"},
        headers=auth(author["access_token"]),
    )
    assert response.json()["title"] == "<img src=x onerror=alert(1)>"


def test_oversized_pagination_rejected(client):
    assert client.get("/api/posts", params={"limit": 1000}).status_code == 422
    assert client.get("/api/posts", params={"offset": 10_000_000}).status_code == 422


# --- Заголовки и конфигурация --------------------------------------------------------


def test_security_headers_on_api(client):
    response = client.get("/api/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["referrer-policy"] == "no-referrer"


def test_production_refuses_default_secret():
    with pytest.raises(ValidationError):
        Settings(environment="production", jwt_secret=DEV_JWT_SECRET, seed_demo=False)


def test_production_refuses_short_secret():
    with pytest.raises(ValidationError):
        Settings(environment="production", jwt_secret="short", seed_demo=False)


def test_production_refuses_demo_accounts():
    with pytest.raises(ValidationError):
        Settings(environment="production", jwt_secret="x" * 48, seed_demo=True)


def test_production_accepts_safe_config():
    settings = Settings(environment="production", jwt_secret="x" * 48, seed_demo=False)
    assert settings.environment == "production"
