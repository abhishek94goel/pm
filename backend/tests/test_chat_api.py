import json

from fastapi.testclient import TestClient

from app import database, main
from app.main import require_user


def sign_in(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "password"},
    )
    assert response.status_code == 200


def test_chat_uses_current_users_board_and_history(
    client: TestClient, monkeypatch
) -> None:
    sign_in(client)
    first_board = client.get("/api/board").json()
    second_board = database.get_or_create_board("second-user")
    captured_messages: list[dict[str, str]] = []

    def fake_openrouter(messages: list[dict[str, str]]) -> str:
        captured_messages.extend(messages)
        return json.dumps({"answer": "Here is an answer.", "boardUpdate": None})

    monkeypatch.setattr(main.openrouter, "ask_openrouter_messages", fake_openrouter)

    with monkeypatch.context() as patch:
        patch.setitem(
            client.app.dependency_overrides,
            require_user,
            lambda: "second-user",
        )
        response = client.post(
            "/api/chat",
            json={
                "message": "Summarize my board",
                "history": [
                    {"role": "user", "content": "What changed?"},
                    {"role": "assistant", "content": "The board is active."},
                ],
            },
        )

    assert response.status_code == 200
    assert response.json()["answer"] == "Here is an answer."
    assert response.json()["board"] == second_board.model_dump(by_alias=True)
    assert response.json()["board"] != first_board
    assert [message["role"] for message in captured_messages] == [
        "system",
        "user",
        "assistant",
        "user",
    ]
    assert captured_messages[1]["content"] == "What changed?"
    assert "Summarize my board" in captured_messages[-1]["content"]
    assert second_board.columns[0].id in captured_messages[-1]["content"]
    assert first_board["columns"][0]["id"] not in captured_messages[-1]["content"]


def test_chat_saves_valid_board_update(client: TestClient, monkeypatch) -> None:
    sign_in(client)
    board = client.get("/api/board").json()
    moved_card_id = board["columns"][0]["cardIds"].pop()
    board["columns"][3]["cardIds"].append(moved_card_id)
    board["cards"][moved_card_id]["title"] = "AI edited this"
    board["cards"][moved_card_id]["details"] = "Updated by chat."
    board["columns"][2]["cardIds"].append("card-ai-created")
    board["cards"]["card-ai-created"] = {
        "id": "card-ai-created",
        "title": "AI created this",
        "details": "Created by chat.",
    }
    monkeypatch.setattr(
        main.openrouter,
        "ask_openrouter_messages",
        lambda _messages: json.dumps(
            {"answer": "Renamed the column.", "boardUpdate": board}
        ),
    )

    response = client.post(
        "/api/chat", json={"message": "Edit, move, and create cards"}
    )

    assert response.status_code == 200
    updated = response.json()["board"]
    assert moved_card_id not in updated["columns"][0]["cardIds"]
    assert moved_card_id in updated["columns"][3]["cardIds"]
    assert updated["cards"][moved_card_id]["title"] == "AI edited this"
    assert "card-ai-created" in updated["columns"][2]["cardIds"]
    assert client.get("/api/board").json() == updated


def test_chat_rejects_invalid_update_without_changing_board(
    client: TestClient, monkeypatch
) -> None:
    sign_in(client)
    board = client.get("/api/board").json()
    invalid_update = {
        **board,
        "columns": [{**column} for column in board["columns"]],
    }
    invalid_update["columns"][0]["id"] = "not-a-board-column"

    provider_responses = iter(
        [
            "not-json",
            json.dumps(
                {"answer": "Attempted an invalid update.", "boardUpdate": invalid_update}
            ),
        ]
    )
    monkeypatch.setattr(
        main.openrouter,
        "ask_openrouter_messages",
        lambda _messages: next(provider_responses),
    )

    for expected_detail in ("invalid response", "invalid board update"):
        response = client.post("/api/chat", json={"message": "Change the board"})
        assert response.status_code == 502
        assert expected_detail in response.json()["detail"]
        assert client.get("/api/board").json() == board


def test_chat_requires_authentication(client: TestClient) -> None:
    response = client.post("/api/chat", json={"message": "Summarize my board"})

    assert response.status_code == 401


def test_chat_surfaces_provider_errors_without_changing_board(
    client: TestClient, monkeypatch
) -> None:
    sign_in(client)
    board = client.get("/api/board").json()

    def raise_provider_error(_messages: list[dict[str, str]]) -> str:
        raise main.openrouter.OpenRouterError("Unable to connect to OpenRouter.")

    monkeypatch.setattr(
        main.openrouter, "ask_openrouter_messages", raise_provider_error
    )
    response = client.post("/api/chat", json={"message": "Summarize my board"})

    assert response.status_code == 502
    assert "Unable to connect" in response.json()["detail"]
    assert client.get("/api/board").json() == board
