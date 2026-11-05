import io
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request

import pytest

from app import openrouter


class FakeResponse:
    def __init__(self, body: bytes):
        self.body = body

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_: object) -> None:
        pass

    def read(self) -> bytes:
        return self.body


def test_builds_openrouter_request_and_returns_answer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    captured: dict[str, Request] = {}

    def fake_urlopen(request: Request, timeout: int) -> FakeResponse:
        captured["request"] = request
        assert timeout == 30
        return FakeResponse(
            json.dumps(
                {"choices": [{"message": {"content": "4"}}]}
            ).encode()
        )

    monkeypatch.setattr(openrouter, "urlopen", fake_urlopen)

    assert openrouter.ask_openrouter("What is 2+2?") == "4"
    request = captured["request"]
    assert request.full_url == openrouter.OPENROUTER_URL
    assert request.get_method() == "POST"
    assert request.get_header("Authorization") == "Bearer test-key"
    assert request.get_header("Content-type") == "application/json"
    assert json.loads(request.data) == {
        "model": "openai/gpt-oss-120b",
        "messages": [{"role": "user", "content": "What is 2+2?"}],
    }


def test_requires_an_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    with pytest.raises(openrouter.OpenRouterError, match="not configured"):
        openrouter.ask_openrouter("What is 2+2?")


def test_reports_provider_http_errors_without_response_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def raise_http_error(*_args: object, **_kwargs: object) -> FakeResponse:
        raise HTTPError(
            openrouter.OPENROUTER_URL,
            429,
            "Too Many Requests",
            None,
            io.BytesIO(b"provider error"),
        )

    monkeypatch.setattr(openrouter, "urlopen", raise_http_error)

    with pytest.raises(openrouter.OpenRouterError, match="status 429") as error:
        openrouter.ask_openrouter("What is 2+2?")
    assert "test-key" not in str(error.value)
    assert "provider error" not in str(error.value)


def test_reports_connection_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def raise_connection_error(*_args: object, **_kwargs: object) -> FakeResponse:
        raise URLError("network unavailable")

    monkeypatch.setattr(openrouter, "urlopen", raise_connection_error)

    with pytest.raises(openrouter.OpenRouterError, match="Unable to connect"):
        openrouter.ask_openrouter("What is 2+2?")


def test_rejects_malformed_provider_responses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        openrouter, "urlopen", lambda *_args, **_kwargs: FakeResponse(b"not-json")
    )

    with pytest.raises(openrouter.OpenRouterError, match="invalid JSON"):
        openrouter.ask_openrouter("What is 2+2?")
