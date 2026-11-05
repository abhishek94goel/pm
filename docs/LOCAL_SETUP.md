# Local setup

## Requirements

- Docker with Docker Compose

## Start

Run the matching script from the repository:

- macOS: `./scripts/start-mac.sh`
- Linux: `./scripts/start-linux.sh`
- Windows PowerShell: `./scripts/start-windows.ps1`

The app starts at <http://localhost:8000>. The Kanban app is served at `/`, and the health endpoint is <http://localhost:8000/api/health>.

## Stop

Run `./scripts/stop-mac.sh`, `./scripts/stop-linux.sh`, or `./scripts/stop-windows.ps1` for the matching platform. Stopping the app preserves the named Docker volume for application data.

The OpenRouter key is optional for the board app, but required to use AI chat. If present in the root `.env`, Compose passes it to the container at runtime; it is not copied into the image. `SESSION_SECRET` may also be set in `.env`; its default is for local development only.

## Check OpenRouter connectivity

From the repository root, load the key from `.env` into the shell and run the backend check:

```sh
set -a
. ./.env
set +a
uv run --directory backend python -m app.openrouter
```

The command sends a `2+2` prompt to `openai/gpt-oss-120b` and prints the model's answer. It exits with an error if the key is missing or the provider request fails.
