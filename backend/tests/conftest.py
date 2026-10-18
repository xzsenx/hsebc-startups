import os
import tempfile

import pytest

# Тесты гоняем на SQLite в файле: это позволяет запускать их без Docker и Postgres.
# Схема одна и та же (SQLAlchemy-модели), уникальные ограничения SQLite тоже соблюдает.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{_tmp.name}"
os.environ["JWT_SECRET"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register(client, email: str, name: str = "Тест Тестов") -> dict:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "demo1234", "name": name, "telegram": "@demo"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
