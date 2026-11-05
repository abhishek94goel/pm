# Backend guidance

## Current backend

The backend is a FastAPI application in `app/main.py`. It serves the statically exported Next.js site at `/`, provides a JSON health response at `/api/health`, handles signed-session endpoints under `/api/auth/`, and exposes authenticated board read/update endpoints at `/api/board`. `/api/chat` sends the authenticated user's board and conversation history to OpenRouter, validates structured responses, and persists valid board updates. SQLite initialization, seeding, and persistence are in `app/database.py`; request/response validation is in `app/schemas.py`. `app/openrouter.py` contains the isolated OpenRouter client and connectivity check, runnable from the repository root with `uv run --directory backend python -m app.openrouter` after setting `OPENROUTER_API_KEY`.

Python dependencies are declared in `pyproject.toml` and locked in `uv.lock`. Use `uv` for dependency management and run backend commands from `backend/`.

## Change guidelines

- Follow the repository-root `AGENTS.md` for product requirements and coding standards.
- Keep HTTP route behavior small and explicit. Add tests for new routes and error behavior.
- Keep secrets in runtime environment variables; never commit `.env` or log credentials.
- Backend tests use temporary SQLite databases; do not make tests depend on local data. Run them with `uv run pytest` from `backend/`.
- Mock OpenRouter in automated tests; live provider checks must be explicit and optional.
- Chat tests should use a mocked provider and verify that malformed responses never modify the board.
- Update this guidance when the backend structure or test commands materially change.