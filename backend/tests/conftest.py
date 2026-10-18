import os
import tempfile

import pytest

# Тесты гоняем на SQLite в файле: это позволяет запускать их без Docker и Postgres.
# Схема одна и та же (SQLAlchemy-модели), уникальные ограничения SQLite тоже соблюдает.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{_tmp.name}"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256"
os.environ["ENVIRONMENT"] = "test"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.ratelimit import login_limiter  # noqa: E402

PASSWORD = "demo1234"
TELEGRAM = "@demo_user"


@pytest.fixture(autouse=True)
def clean_state():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    login_limiter.reset()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register(client, email: str, name: str = "Тест Тестов") -> dict:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": PASSWORD, "name": name, "telegram": TELEGRAM},
    )
    assert response.status_code == 201, response.text
    return response.json()


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def make_post(client, token, title="Ищу бэкенд-разработчика в проект", kind="vacancy"):
    response = client.post(
        "/api/posts",
        json={"kind": kind, "title": title, "summary": "Коротко", "looking_for": "Python"},
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()


def apply(client, post_id: int, token: str, message: str = ""):
    return client.post(f"/api/posts/{post_id}/applications", json={"message": message}, headers=auth(token))
