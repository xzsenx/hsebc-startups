from tests.conftest import auth, register


def test_register_and_me(client):
    data = register(client, "a@test.ru", "Анна")
    me = client.get("/api/auth/me", headers=auth(data["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == "a@test.ru"


def test_duplicate_email_rejected(client):
    register(client, "a@test.ru")
    again = client.post(
        "/api/auth/register",
        json={"email": "a@test.ru", "password": "demo1234", "name": "Другой"},
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
