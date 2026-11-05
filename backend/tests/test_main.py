def test_home_serves_static_frontend(client) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "Kanban Studio" in response.text


def test_health_endpoint_returns_ok(client) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_authentication_requires_a_valid_session(client) -> None:
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_login_logout_and_session_check(client) -> None:
    invalid_login = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "wrong"},
    )
    assert invalid_login.status_code == 401

    login = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "password"},
    )
    assert login.status_code == 200
    assert login.json() == {"username": "user"}
    assert client.get("/api/auth/me").json() == {"username": "user"}

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200
    assert client.get("/api/auth/me").status_code == 401
