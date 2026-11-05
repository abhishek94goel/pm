# Project plan

## Goal and scope

Turn the existing frontend-only Kanban demo into a locally run Project Management MVP. The finished app will serve a statically built Next.js interface from a FastAPI backend in Docker, provide a simple single-user sign-in, persist one board per user in SQLite, and offer an OpenRouter-powered assistant that can propose and apply board changes.

Keep the implementation focused on the MVP and the technical decisions in the root [AGENTS.md](../AGENTS.md). Do not add production authentication, multi-board support, cloud hosting, or unrelated features.

## Starting point before implementation

The `frontend/` directory contains a Next.js App Router demo. `/` renders a client-side Kanban board with five columns, in-memory sample data, drag-and-drop via `@dnd-kit`, editable column titles, and card creation/removal. Board state is lost on reload; cards cannot yet be edited. The frontend has Vitest/Testing Library unit tests and Playwright browser tests. There is not yet a backend, Docker setup, or run/stop scripts.

## Current status

Implementation is complete through Part 10. Board persistence, authenticated board-aware AI chat, the responsive chat sidebar, and the Docker container are verified with backend, frontend, and browser tests. Outstanding checks are the optional live OpenRouter request and Windows script validation.

The Docker container is hosted at `http://localhost:8000`; its frontend, health endpoint, authenticated board API, runtime OpenRouter key forwarding, and browser save/reload flow are verified. The stop script was not invoked so the requested service stays hosted; Windows scripts have not been tested on Windows.

## Decisions recorded during implementation

- Sign-in uses the hardcoded `user` / `password` credentials and a signed Starlette session cookie named `pm_session` (`HttpOnly`, `SameSite=Lax`). `SESSION_SECRET` can be supplied at runtime; the local fallback is for development only. Passwords are not stored in SQLite.
- SQLite uses the approved normalized `users`, `boards`, `columns`, and `cards` schema. A unique `boards.user_id` enforces one board per user; columns remain fixed in count and order but can be renamed; cards can be created, edited, removed, and moved.
- The backend exposes the frontend's `BoardData` shape and validates card references. SQLite foreign keys are enabled per connection, board writes use a transaction, and seed data is inserted only when a user's board is first created.
- Column and card IDs are board-qualified in seeded data to avoid ID collisions across users. Card positions are temporarily shifted during reorder writes so the unique `(column_id, position)` constraint does not reject valid moves while positions are updated.
- The container is designed as a multi-stage build: Next.js static export, then FastAPI with `uv`; SQLite data is stored at `/data/pm.sqlite3` on the Compose named volume. API credentials are runtime environment values, not frontend build-time values.

## Working agreements

- Work through the phases in order. Keep the existing frontend behavior intact as each layer is added.
- Run the smallest relevant automated checks during each phase and the phase's full acceptance checks before calling it done.
- Never commit `.env`, API keys, database files, or other generated/local-only data. Pass secrets to the container at runtime.
- Keep external OpenRouter calls out of automated tests; mock the provider and offer a separate, explicit live connectivity check.
- Ask for user approval at the gates below before proceeding past them. In particular, agree on the data model before implementing it.
- Update this plan's checkboxes as work is completed. A checked item means implemented and verified, not merely attempted.

## Part 1: Plan and frontend guidance

### Tasks

- [x] Expand this document with ordered phases, concrete implementation tasks, verification, and acceptance criteria.
- [x] Add `frontend/AGENTS.md` describing the current frontend structure, behavior, commands, and constraints for future changes.
- [x] Have the user review and approve this plan before starting the scaffolding phase.

### Verification

- Review the plan against the business requirements and technical decisions in the root `AGENTS.md`.
- Confirm the frontend guidance reflects the code that exists today and does not claim that backend, auth, persistence, or AI features are already implemented.

### Success criteria

- Every remaining phase has a bounded checklist, explicit tests, and observable completion criteria.
- Approval-dependent decisions are clearly called out before implementation depends on them.

## Part 2: Docker and service scaffolding

### Tasks

- [x] Add a Docker build for the static frontend and Python/FastAPI service, using `uv` for Python dependency management.
- [x] Configure FastAPI to serve a temporary hello-world page at `/` and a small health/API endpoint.
- [x] Add Mac, Linux, and Windows start/stop scripts under `scripts/`; make their behavior and prerequisites clear.
- [x] Add ignore rules for build output, local databases, `.env`, and other generated files. Ensure secrets are supplied at runtime and are not copied into the image.
- [x] Provide the minimum configuration needed to run one local container, including persistent storage for the SQLite database.

### Tests and verification

- [x] Run backend unit tests for the health/API route and static hello-world response.
- [x] Check Unix start/stop script syntax and executable permissions.
- [x] Build the container successfully.
- [x] Start it using the documented local command; verify the page and API response over HTTP, and leave the requested service running.
- [x] Confirm the container can receive the API key without baking it into the image or exposing it in logs.

### Success criteria

- A fresh checkout can build and run the container with the documented commands.
- `/` returns the hello-world placeholder and the API route returns its expected response.
- Start/stop scripts work on their documented platforms, and local data/configuration are not included in the image.

## Part 3: Static frontend delivery

### Tasks

- [x] Configure Next.js for static export and make the FastAPI service serve the generated site at `/`.
- [x] Remove the temporary hello-world page once the built Kanban frontend is available at the same route.
- [x] Preserve the current board layout, sample data, column renaming, card add/remove, and drag-and-drop behavior.
- [x] Keep frontend build output out of source control unless the selected container build requires it as an intermediate artifact.

### Tests and verification

- [x] Run frontend lint, unit tests, and production static build.
- [x] Run browser tests against FastAPI serving the static frontend locally.
- [x] Run a browser smoke against the app served by FastAPI in the container.
- [x] Verify `/` and static assets load successfully from the service root.

### Success criteria

- The container serves the built Kanban app at `/` without requiring a separate Next.js server.
- Existing board behavior and frontend tests remain functional after static export.

## Part 4: MVP sign-in and sign-out

### Tasks

- [x] Add the sign-in screen for the fixed MVP credentials `user` / `password`.
- [x] Add a simple session mechanism appropriate for the local MVP; keep authentication decisions centralized so backend board routes can enforce the same signed-in user.
- [x] Protect the board and board APIs from unauthenticated access; provide a clear sign-out action.
- [x] Do not persist the password or introduce account-management features.

### Tests and verification

- [x] Test successful and failed sign-in, session persistence for the selected mechanism, protected access, and sign-out.
- [x] Test the authentication endpoint without credentials and with a valid session.
- [x] Add browser tests for sign-in, board visibility, reload behavior, and sign-out.

### Success criteria

- Unauthenticated users see sign-in rather than board data.
- Only the configured dummy credentials grant access; sign-out removes access.
- The same authenticated identity is used by subsequent board APIs.

## Part 5: Database model proposal and approval

### Tasks

- [x] Propose a JSON schema/model for users, one board per user, ordered/renamable columns, and cards with ordering and editable content.
- [x] Document the SQLite persistence and initialization approach in `docs/`, including ownership relationships and how the first board is created.
- [x] Check that the model supports multiple users in the future while maintaining one board per user for the MVP.
- [x] Present the proposal and obtain user approval before implementing the schema or data APIs.

### Tests and verification

- [x] Validate the proposed schema JSON with a JSON parser/schema validator.
- [x] Review representative board data for empty columns, renamed columns, and cards in each column.
- [x] Confirm the proposal has no secrets or machine-specific paths.

### Success criteria

- The approved model represents the current board and the MVP user limitation without losing column/card ordering.
- The JSON proposal and documentation agree; implementation does not begin until the user signs off.

## Part 6: SQLite-backed board API

### Tasks

- [x] Implement database configuration and initialization so a missing SQLite database and required tables are created automatically.
- [x] Implement authenticated API operations to read and update the signed-in user's board.
- [x] Enforce one board per user, validate incoming board structures, and preserve column/card relationships and ordering.
- [x] Seed a user's initial board when needed; avoid resetting existing user data on service restart.
- [x] Keep database access and API validation small and consistent with existing backend conventions.

### Tests and verification

- [x] Use a temporary database for backend tests; verify initialization from a nonexistent path.
- [x] Test initial board creation, read/update round trip, isolation between users, and persistence after reopening the database.
- [x] Test invalid references/board data and unauthenticated requests.
- [x] Run the complete backend unit test suite.

### Success criteria

- Board data survives service restarts and is isolated by user.
- A fresh database is initialized automatically, and invalid or unauthorized updates are rejected clearly.

## Part 7: Frontend and persistent API integration

### Tasks

- [x] Replace in-memory-only board initialization with loading and saving through the authenticated backend API.
- [x] Persist column renames, card creation/edit/removal, and drag-and-drop moves.
- [x] Add card editing while retaining the existing create/remove interactions.
- [x] Show straightforward loading and actionable error states; avoid silently reporting a failed save as successful.
- [x] Keep API calls in a focused frontend data-access layer and use the established `BoardData` model where appropriate.

### Tests and verification

- [x] Unit-test API/data-access behavior for successful responses and failures.
- [x] Test board actions persist after reload, including moving a card and renaming a column.
- [x] Run a browser save/reload/delete check against the container's SQLite-backed board.
- [x] Verify a second user cannot see or overwrite the first user's board.

### Success criteria

- Board changes are stored by the backend and reappear after reload/restart.
- Existing board interactions continue to work and save errors are visible to the user.

## Part 8: OpenRouter connectivity

### Tasks

- [x] Add backend OpenRouter client configuration using `OPENROUTER_API_KEY` from runtime environment and the agreed model `openai/gpt-oss-120b`.
- [x] Add a minimal backend connectivity operation or script that submits a simple `2+2` prompt.
- [x] Keep provider setup isolated from board/API code and never return or log the API key.
- [x] Document how to run the optional live connectivity check using the root `.env` locally.

### Tests and verification

- [x] Unit-test request construction, model selection, successful responses, and provider/API errors with a mocked HTTP client.
- [x] Run backend tests without requiring a real key or network request.
- [ ] When a key is available, run the explicit live check and verify a valid answer to `2+2`.

### Success criteria

- The backend can call the configured OpenRouter model when a valid key is provided.
- Automated checks are deterministic and never require or expose a real credential.

## Part 9: Structured board-aware AI chat API

### Tasks

- [x] Define and validate a structured response containing a user-facing answer and an optional board update.
- [x] Send the current user's board JSON, latest question, and relevant conversation history to the model.
- [x] Validate proposed board updates before saving; leave the stored board unchanged when no update is proposed.
- [x] Return the assistant answer and resulting board state in a predictable API response.
- [x] Handle invalid structured output and provider errors explicitly without applying a partial or malformed update.

### Tests and verification

- [x] Cover answer-only responses, valid create/edit/move updates, malformed updates, and provider failure with focused mocked API tests.
- [x] Verify the model receives the authenticated user's board and conversation history.
- [x] Verify valid updates persist and are returned; absent/invalid updates do not alter board data.
- [x] Test unauthorized access and ensure one user's board is never sent in another user's request.

### Success criteria

- Every chat response is schema-validated and has a user answer.
- Only a valid optional update changes the authenticated user's persisted board.

## Part 10: AI chat sidebar

### Tasks

- [x] Add a sidebar chat interface that fits the existing visual system and works alongside the Kanban board.
- [x] Display the conversation, send messages to the chat API, and show clear loading and error states.
- [x] Apply a returned board update to the UI immediately and keep the client state consistent with the server.
- [x] Preserve board usability at smaller viewport sizes and provide accessible labels and keyboard-operable controls.

### Tests and verification

- [x] Add focused unit tests for chat submission, error states, and applying returned board data.
- [x] Add a browser test for applying an AI board update and persisting it after reload.
- [x] Verify board changes from AI are visible immediately and survive reload.
- [x] Run frontend lint, unit tests, browser tests, and backend tests; the container build remains pending Docker availability.

### Success criteria

- A signed-in user can chat in the sidebar and see AI board updates reflected immediately.
- Errors do not leave the UI claiming an unapplied update succeeded.
- The complete app builds and passes its automated test suites in the Docker setup.

## Approval gates

1. User reviews and approves this plan before Part 2.
2. User approves the database proposal before Part 6. **Approved; Part 6 is implemented.**
3. Any material change to MVP scope or agreed technical decisions is raised for approval before implementation.

## Environment validation notes

- The backend routes and exported frontend pass unit checks; the browser suite passes against FastAPI serving the static app locally.
- Parts 7–10 pass frontend lint, 14 frontend unit tests, production static build, 7 local FastAPI-backed browser tests, and 24 backend tests. The live OpenRouter check was not run; automated provider tests use mocks.
- Docker build and local acceptance checks pass; the service is running at `http://localhost:8000`. macOS scripts now add Docker Desktop's bundled CLI path when needed. The OpenRouter key was verified present in the container environment without printing it.
- Unix script syntax and executable permissions are verified. The macOS start script successfully starts the container; its stop script was not run to leave the service available. Windows scripts have not been run on Windows.
