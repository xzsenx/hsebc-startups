from tests.conftest import TELEGRAM, apply, auth, make_post, register


def test_main_scenario_publish_apply_decide(client):
    author = register(client, "author@test.ru", "Автор")
    applicant = register(client, "applicant@test.ru", "Кандидат")
    post = make_post(client, author["access_token"])

    applied = apply(client, post["id"], applicant["access_token"], "Хочу участвовать")
    assert applied.status_code == 201

    received = client.get("/api/me/applications/received", headers=auth(author["access_token"]))
    assert len(received.json()) == 1

    decided = client.patch(
        f"/api/applications/{applied.json()['id']}",
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
    assert apply(client, post["id"], applicant["access_token"], "раз").status_code == 201
    assert apply(client, post["id"], applicant["access_token"], "два").status_code == 409


def test_cannot_apply_to_own_post(client):
    author = register(client, "author@test.ru")
    post = make_post(client, author["access_token"])
    assert apply(client, post["id"], author["access_token"]).status_code == 403


def test_cannot_apply_to_closed_post(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    post = make_post(client, author["access_token"])
    client.patch(f"/api/posts/{post['id']}", json={"status": "closed"}, headers=auth(author["access_token"]))
    assert apply(client, post["id"], applicant["access_token"]).status_code == 409


def test_only_author_sees_and_decides_applications(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    stranger = register(client, "stranger@test.ru")
    post = make_post(client, author["access_token"])
    applied = apply(client, post["id"], applicant["access_token"]).json()

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
    applied = apply(client, post["id"], applicant["access_token"]).json()
    headers = auth(author["access_token"])
    url = f"/api/applications/{applied['id']}"

    assert client.patch(url, json={"status": "accepted"}, headers=headers).status_code == 200
    assert client.patch(url, json={"status": "accepted"}, headers=headers).status_code == 200
    assert client.patch(url, json={"status": "declined"}, headers=headers).status_code == 409


def test_cannot_set_application_back_to_pending(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    post = make_post(client, author["access_token"])
    applied = apply(client, post["id"], applicant["access_token"]).json()
    response = client.patch(
        f"/api/applications/{applied['id']}", json={"status": "pending"}, headers=auth(author["access_token"])
    )
    assert response.status_code == 422


def test_withdraw_and_reapply(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    post = make_post(client, author["access_token"])
    applied = apply(client, post["id"], applicant["access_token"], "первый").json()

    withdrawn = client.post(f"/api/applications/{applied['id']}/withdraw", headers=auth(applicant["access_token"]))
    assert withdrawn.json()["status"] == "withdrawn"
    # Повторный отзыв — тот же результат.
    again = client.post(f"/api/applications/{applied['id']}/withdraw", headers=auth(applicant["access_token"]))
    assert again.status_code == 200

    # Автор отозванный отклик не видит и решить по нему не может.
    received = client.get("/api/me/applications/received", headers=auth(author["access_token"])).json()
    assert received == []
    decision = client.patch(
        f"/api/applications/{applied['id']}", json={"status": "accepted"}, headers=auth(author["access_token"])
    )
    assert decision.status_code == 409

    # Откликнуться снова можно — запись переиспользуется, а не дублируется.
    reapplied = apply(client, post["id"], applicant["access_token"], "передумал")
    assert reapplied.status_code == 201
    assert reapplied.json()["id"] == applied["id"]
    assert reapplied.json()["status"] == "pending"
    assert reapplied.json()["message"] == "передумал"


def test_cannot_withdraw_after_decision_or_someone_elses(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    stranger = register(client, "stranger@test.ru")
    post = make_post(client, author["access_token"])
    applied = apply(client, post["id"], applicant["access_token"]).json()
    url = f"/api/applications/{applied['id']}/withdraw"

    # Чужой отклик выглядит как несуществующий.
    assert client.post(url, headers=auth(stranger["access_token"])).status_code == 404

    client.patch(f"/api/applications/{applied['id']}", json={"status": "declined"}, headers=auth(author["access_token"]))
    assert client.post(url, headers=auth(applicant["access_token"])).status_code == 409


def test_contact_is_hidden_until_accepted(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    post = make_post(client, author["access_token"])
    applied = apply(client, post["id"], applicant["access_token"]).json()

    # Пока решения нет — контакты скрыты у обеих сторон.
    sent = client.get("/api/me/applications", headers=auth(applicant["access_token"])).json()
    received = client.get("/api/me/applications/received", headers=auth(author["access_token"])).json()
    assert sent[0]["post"]["author"]["telegram"] == ""
    assert received[0]["applicant"]["telegram"] == ""

    # Лента и карточка публикации вообще не раздают контакты авторов.
    assert all(i["author"]["telegram"] == "" for i in client.get("/api/posts").json()["items"])
    assert client.get(f"/api/posts/{post['id']}").json()["author"]["telegram"] == ""

    client.patch(
        f"/api/applications/{applied['id']}", json={"status": "accepted"}, headers=auth(author["access_token"])
    )
    sent = client.get("/api/me/applications", headers=auth(applicant["access_token"])).json()
    received = client.get("/api/me/applications/received", headers=auth(author["access_token"])).json()
    assert sent[0]["post"]["author"]["telegram"] == TELEGRAM
    assert received[0]["applicant"]["telegram"] == TELEGRAM


def test_summary_counts(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    post = make_post(client, author["access_token"])
    apply(client, post["id"], applicant["access_token"])
    summary = client.get("/api/me/summary", headers=auth(author["access_token"])).json()
    assert summary == {"pending_received": 1, "my_posts": 1, "sent": 0}
