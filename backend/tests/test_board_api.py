from fastapi.testclient import TestClient

from app import database
from app.main import require_user


def sign_in(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "password"},
    )
    assert response.status_code == 200


def test_board_routes_require_authentication(client: TestClient) -> None:
    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json={"columns": [], "cards": {}}).status_code == 401


def test_get_creates_and_persists_initial_board(client: TestClient) -> None:
    sign_in(client)

    response = client.get("/api/board")
    assert response.status_code == 200
    board = response.json()
    assert [column["title"] for column in board["columns"]] == [
        "Backlog",
        "Discovery",
        "In Progress",
        "Review",
        "Done",
    ]
    assert sum(len(column["cardIds"]) for column in board["columns"]) == 8
    assert len(board["cards"]) == 8
    assert client.get("/api/board").json() == board


def test_initializes_sqlite_file_and_schema(client: TestClient) -> None:
    assert database.DATABASE_PATH.exists()
    with database.DATABASE_PATH.open("rb") as database_file:
        assert database_file.read(16) == b"SQLite format 3\x00"


def test_update_round_trip_renames_moves_adds_and_removes_cards(
    client: TestClient,
) -> None:
    sign_in(client)
    board = client.get("/api/board").json()
    columns = board["columns"]
    first_card_id = columns[0]["cardIds"].pop(0)
    removed_card_id = columns[0]["cardIds"].pop()
    columns[0]["title"] = "Planning"
    columns[0]["cardIds"].append("card-new")
    columns[3]["cardIds"].append(first_card_id)
    del board["cards"][removed_card_id]
    board["cards"][first_card_id]["title"] = "Updated task"
    board["cards"]["card-new"] = {
        "id": "card-new",
        "title": "New task",
        "details": "Created through the API.",
    }

    response = client.put("/api/board", json=board)
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["columns"][0]["title"] == "Planning"
    assert updated["columns"][0]["cardIds"] == ["card-new"]
    assert first_card_id in updated["columns"][3]["cardIds"]
    assert updated["cards"][first_card_id]["title"] == "Updated task"
    assert removed_card_id not in updated["cards"]
    database.initialize_database()
    assert client.get("/api/board").json() == updated


def test_reorders_cards_without_violating_unique_positions(
    client: TestClient,
) -> None:
    sign_in(client)
    board = client.get("/api/board").json()
    original_order = board["columns"][0]["cardIds"]
    board["columns"][0]["cardIds"] = list(reversed(original_order))

    response = client.put("/api/board", json=board)
    assert response.status_code == 200, response.text
    assert response.json()["columns"][0]["cardIds"] == list(reversed(original_order))


def test_saves_an_empty_column(client: TestClient) -> None:
    sign_in(client)
    board = client.get("/api/board").json()
    empty_column = board["columns"][3]
    removed_card_ids = empty_column["cardIds"]
    empty_column["cardIds"] = []
    for card_id in removed_card_ids:
        board["cards"].pop(card_id)

    response = client.put("/api/board", json=board)
    assert response.status_code == 200
    assert response.json()["columns"][3]["cardIds"] == []


def test_rejects_duplicate_card_references(client: TestClient) -> None:
    sign_in(client)
    board = client.get("/api/board").json()
    board["columns"][1]["cardIds"].append(board["columns"][0]["cardIds"][0])

    response = client.put("/api/board", json=board)
    assert response.status_code == 422


def test_rejects_column_changes(client: TestClient) -> None:
    sign_in(client)
    board = client.get("/api/board").json()
    board["columns"].reverse()

    response = client.put("/api/board", json=board)
    assert response.status_code == 422
    assert "cannot be added, removed, or reordered" in response.json()["detail"]


def test_database_isolates_each_users_board(client: TestClient) -> None:
    sign_in(client)
    first_board = client.get("/api/board").json()
    second_board = database.get_or_create_board("second-user")

    assert {column["id"] for column in first_board["columns"]}.isdisjoint(
        column.id for column in second_board.columns
    )
    assert set(first_board["cards"]).isdisjoint(second_board.cards)

    second_board.columns[0].title = "Other user's board"
    database.save_board("second-user", second_board)
    assert client.get("/api/board").json() == first_board


def test_board_api_isolates_authenticated_users(
    client: TestClient, monkeypatch
) -> None:
    sign_in(client)
    first_board = client.get("/api/board").json()

    with monkeypatch.context() as patch:
        patch.setitem(
            client.app.dependency_overrides,
            require_user,
            lambda: "second-user",
        )
        second_board = client.get("/api/board").json()
        assert set(first_board["cards"]).isdisjoint(second_board["cards"])

        second_board["columns"][0]["title"] = "Second user's board"
        response = client.put("/api/board", json=second_board)
        assert response.status_code == 200

    assert client.get("/api/board").json() == first_board
