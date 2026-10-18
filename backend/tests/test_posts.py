from tests.conftest import auth, register
from tests.test_applications import make_post


def test_feed_hides_closed_and_filters_by_kind(client):
    author = register(client, "author@test.ru")
    token = author["access_token"]
    make_post(client, token, "Вакансия в активный проект")
    startup = client.post(
        "/api/posts",
        json={"kind": "startup", "title": "Стартап про логистику", "summary": "s"},
        headers=auth(token),
    ).json()

    feed = client.get("/api/posts").json()
    assert feed["total"] == 2

    only_startups = client.get("/api/posts", params={"kind": "startup"}).json()
    assert [i["id"] for i in only_startups["items"]] == [startup["id"]]

    client.patch(f"/api/posts/{startup['id']}", json={"status": "closed"}, headers=auth(token))
    assert client.get("/api/posts").json()["total"] == 1


def test_search_by_query(client):
    author = register(client, "author@test.ru")
    make_post(client, author["access_token"], "Ищу дизайнера интерфейсов")
    found = client.get("/api/posts", params={"q": "дизайнер"}).json()
    assert found["total"] == 1
    assert client.get("/api/posts", params={"q": "биология"}).json()["total"] == 0


def test_stranger_cannot_edit_post(client):
    author = register(client, "author@test.ru")
    stranger = register(client, "stranger@test.ru")
    post = make_post(client, author["access_token"])
    response = client.patch(
        f"/api/posts/{post['id']}", json={"title": "Взломанный заголовок"}, headers=auth(stranger["access_token"])
    )
    assert response.status_code == 403


def test_viewer_sees_own_application_status_in_feed(client):
    author = register(client, "author@test.ru")
    applicant = register(client, "applicant@test.ru")
    post = make_post(client, author["access_token"])
    client.post(f"/api/posts/{post['id']}/applications", json={}, headers=auth(applicant["access_token"]))

    feed = client.get("/api/posts", headers=auth(applicant["access_token"])).json()
    item = next(i for i in feed["items"] if i["id"] == post["id"])
    assert item["my_application_status"] == "pending"
    assert item["is_mine"] is False
