import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openai/gpt-oss-120b"


class OpenRouterError(RuntimeError):
    pass


def ask_openrouter(prompt: str) -> str:
    return ask_openrouter_messages([{"role": "user", "content": prompt}])


def ask_openrouter_messages(messages: list[dict[str, str]]) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise OpenRouterError("OPENROUTER_API_KEY is not configured.")

    request = Request(
        OPENROUTER_URL,
        data=json.dumps(
            {
                "model": OPENROUTER_MODEL,
                "messages": messages,
            }
        ).encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            result = json.loads(response.read())
    except HTTPError as error:
        raise OpenRouterError(
            f"OpenRouter request failed with status {error.code}."
        ) from error
    except URLError as error:
        raise OpenRouterError("Unable to connect to OpenRouter.") from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise OpenRouterError("OpenRouter returned invalid JSON.") from error

    try:
        answer = result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise OpenRouterError("OpenRouter returned an invalid chat response.") from error
    if not isinstance(answer, str) or not answer.strip():
        raise OpenRouterError("OpenRouter returned an empty answer.")
    return answer.strip()


def main() -> int:
    try:
        print(ask_openrouter("What is 2+2? Reply with the number only."))
    except OpenRouterError as error:
        print(f"OpenRouter check failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
