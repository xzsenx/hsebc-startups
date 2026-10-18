from tests.conftest import apply, auth, make_post, register


def test_feed_hides_closed_and_filters_by_kind(client):
    author = register(client, "author@test.ru")
    token = author["access_token"]
    make_post(client, token, "Вакансия в активный проект")
    startup = make_post(client, token, "Стартап про логистику", kind="startup")

    assert client.get("/api/posts").json()["total"] == 2
    only_startups = client.get("/api/posts", params={"kind": "startup"}).json()
    assert [i["id"] for i in only_startups["items"]] == [startup["id"]]

    client.patch(f"/api/posts/{startup['id']}", json={"status": "closed"}, headers=auth(token))
    assert client.get("/api/posts").json()["total"] == 1
    # По прямой ссылке закрытая публикация открывается — со статусом closed.
    assert client.get(f"/api/posts/{startup['id']}").json()["status"] == "closed"


def test_search_by_query(client):
    author = register(client, "author@test.ru")
    make_post(client, author["access_token"], "Ищу дизайнера интерфейсов")
    assert client.get("/api/posts", params={"q": "дизайнер"}).json()["total"] == 1
    assert client.get("/api/posts", params={"q": "биология"}).json()["total"] == 0


def test_pagination(client):
    author = register(client, "author@test.ru")
    for i in range(5):
        make_post(client, author["access_token"], f"Публикация номер {i}")
    page = client.get("/api/posts", params={"limit": 2, "offset": 4}).json()
    assert page["total"] == 5
    assert len(page["items"]) == 1


def test_stranger_cannot_edit_post(client):
    author = register(client, "author@test.ru")
    stranger = register(client, "stranger@test.ru")
    post = make_post(client, author["access_token"])
    response = client.patch(
        f"/api/posts/{post['id']}", json={"title": "Взломанный заголовок"}, headers=auth(stranger["access_token"])
    )
    assert response.status_code == 403


def test_author_can_edit_post(client):
    author = register(client, "author@test.ru")
    post = make_post(client, author["access_token"])
    response = client.patch(
        f"/api/posts/{post['id']}", json={"title": "Новый заголовок публикации"}, headers=auth(author["access_token"])
    )
    assert response.json()["title"] == "Новый заголовок публикации"


def test_blank_fields_rejected(client):
    author = register(client, "author@test.ru")
    response = client.post(
        "/api/posts",
        json={"kind": "startup", "title": "       ", "looking_for": "   "},
        headers=auth(author["access_token"]),
    )
    assert response.status_code == 422


def test_viewer_sees_own_application_in_feed_and_author_sees_pending(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    post = make_post(client, author["access_token"])
    applied = apply(client, post["id"], applicant["access_token"]).json()

    item = client.get("/api/posts", headers=auth(applicant["access_token"])).json()["items"][0]
    assert item["my_application_status"] == "pending"
    assert item["my_application_id"] == applied["id"]
    assert item["is_mine"] is False
    assert item["pending_count"] == 0  # кандидату не показываем внутреннюю кухню автора

    mine = client.get("/api/posts/mine", headers=auth(author["access_token"])).json()[0]
    assert mine["pending_count"] == 1
