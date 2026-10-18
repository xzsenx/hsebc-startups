from tests.conftest import PASSWORD, auth, register


def test_register_and_me(client):
    data = register(client, "a@test.ru", "Анна")
    me = client.get("/api/auth/me", headers=auth(data["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == "a@test.ru"


def test_email_is_case_insensitive(client):
    register(client, "Anna@Test.ru")
    login = client.post("/api/auth/login", json={"email": "anna@test.RU", "password": PASSWORD})
    assert login.status_code == 200


def test_duplicate_email_rejected(client):
    register(client, "a@test.ru")
    again = client.post(
        "/api/auth/register",
        json={"email": "a@test.ru", "password": PASSWORD, "name": "Другой"},
    )
    assert again.status_code == 409


def test_wrong_password_and_unknown_email_look_the_same(client):
    register(client, "a@test.ru")
    wrong = client.post("/api/auth/login", json={"email": "a@test.ru", "password": "nope12345"})
    unknown = client.post("/api/auth/login", json={"email": "nobody@test.ru", "password": "nope12345"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]


def test_protected_route_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=auth("garbage")).status_code == 401


def test_profile_update(client):
    data = register(client, "a@test.ru")
    response = client.patch(
        "/api/auth/me",
        json={"headline": "  Бэкенд, 2 курс  ", "bio": "О себе", "telegram": "https://t.me/new_nick"},
        headers=auth(data["access_token"]),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["headline"] == "Бэкенд, 2 курс"  # пробелы по краям обрезаны
    assert body["telegram"] == "@new_nick"  # ссылка нормализована в ник


def test_profile_rejects_unknown_fields(client):
    data = register(client, "a@test.ru")
    # Попытка подсунуть служебное поле — массовое присваивание не проходит.
    response = client.patch(
        "/api/auth/me", json={"email": "evil@test.ru", "id": 999}, headers=auth(data["access_token"])
    )
    assert response.status_code == 422
