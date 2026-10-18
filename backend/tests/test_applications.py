from tests.conftest import auth, register


def make_post(client, token, title="Ищу бэкенд-разработчика в проект"):
    response = client.post(
        "/api/posts",
        json={"kind": "vacancy", "title": title, "summary": "Коротко", "looking_for": "Python"},
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_main_scenario_publish_apply_decide(client):
    author = register(client, "author@test.ru", "Автор")
    applicant = register(client, "applicant@test.ru", "Кандидат")
    post = make_post(client, author["access_token"])

    applied = client.post(
        f"/api/posts/{post['id']}/applications",
        json={"message": "Хочу участвовать"},
        headers=auth(applicant["access_token"]),
    )
    assert applied.status_code == 201
    application_id = applied.json()["id"]

    received = client.get("/api/me/applications/received", headers=auth(author["access_token"]))
    assert len(received.json()) == 1

    decided = client.patch(
        f"/api/applications/{application_id}",
        json={"status": "accepted"},
        headers=auth(author["access_token"]),
    )
    assert decided.status_code == 200

    # Результат виден откликнувшемуся в личном кабинете.
    mine = client.get("/api/me/applications", headers=auth(applicant["access_token"]))
    assert mine.json()[0]["status"] == "accepted"


def test_second_application_is_rejected(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    post = make_post(client, author["access_token"])
    headers = auth(applicant["access_token"])

    first = client.post(f"/api/posts/{post['id']}/applications", json={"message": "раз"}, headers=headers)
    second = client.post(f"/api/posts/{post['id']}/applications", json={"message": "два"}, headers=headers)
    assert first.status_code == 201
    assert second.status_code == 409


def test_cannot_apply_to_own_post(client):
    author = register(client, "author@test.ru")
    post = make_post(client, author["access_token"])
    response = client.post(
        f"/api/posts/{post['id']}/applications", json={}, headers=auth(author["access_token"])
    )
    assert response.status_code == 403


def test_cannot_apply_to_closed_post(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    post = make_post(client, author["access_token"])
    client.patch(f"/api/posts/{post['id']}", json={"status": "closed"}, headers=auth(author["access_token"]))
    response = client.post(
        f"/api/posts/{post['id']}/applications", json={}, headers=auth(applicant["access_token"])
    )
    assert response.status_code == 409


def test_only_author_sees_and_decides_applications(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    stranger = register(client, "stranger@test.ru")
    post = make_post(client, author["access_token"])
    applied = client.post(
        f"/api/posts/{post['id']}/applications", json={}, headers=auth(applicant["access_token"])
    ).json()

    assert client.get(
        f"/api/posts/{post['id']}/applications", headers=auth(stranger["access_token"])
    ).status_code == 403
    assert client.patch(
        f"/api/applications/{applied['id']}",
        json={"status": "accepted"},
        headers=auth(stranger["access_token"]),
    ).status_code == 403


def test_repeated_same_decision_is_idempotent_but_change_conflicts(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    post = make_post(client, author["access_token"])
    applied = client.post(
        f"/api/posts/{post['id']}/applications", json={}, headers=auth(applicant["access_token"])
    ).json()
    headers = auth(author["access_token"])

    first = client.patch(f"/api/applications/{applied['id']}", json={"status": "accepted"}, headers=headers)
    same = client.patch(f"/api/applications/{applied['id']}", json={"status": "accepted"}, headers=headers)
    other = client.patch(f"/api/applications/{applied['id']}", json={"status": "declined"}, headers=headers)

    assert first.status_code == 200
    assert same.status_code == 200
    assert other.status_code == 409


def test_contact_is_hidden_until_accepted(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    post = make_post(client, author["access_token"])
    applied = client.post(
        f"/api/posts/{post['id']}/applications", json={}, headers=auth(applicant["access_token"])
    ).json()

    # Пока решения нет — контакты скрыты у обеих сторон.
    sent = client.get("/api/me/applications", headers=auth(applicant["access_token"])).json()
    received = client.get("/api/me/applications/received", headers=auth(author["access_token"])).json()
    assert sent[0]["post"]["author"]["telegram"] == ""
    assert received[0]["applicant"]["telegram"] == ""

    # Лента вообще не раздаёт контакты авторов.
    feed = client.get("/api/posts").json()
    assert all(item["author"]["telegram"] == "" for item in feed["items"])

    client.patch(
        f"/api/applications/{applied['id']}",
        json={"status": "accepted"},
        headers=auth(author["access_token"]),
    )
    sent = client.get("/api/me/applications", headers=auth(applicant["access_token"])).json()
    received = client.get("/api/me/applications/received", headers=auth(author["access_token"])).json()
    assert sent[0]["post"]["author"]["telegram"] == "@demo"
    assert received[0]["applicant"]["telegram"] == "@demo"
