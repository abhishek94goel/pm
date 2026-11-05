# Frontend guidance

## Current frontend

This directory is a Next.js App Router application. `src/app/page.tsx` renders the client-side `KanbanBoard`; the root layout and global styles are in `src/app/`.

The demo board currently:

- Loads the signed-in user's seeded or persisted board from the backend; `src/lib/kanban.ts` defines the frontend board model and movement logic.
- Has five columns with editable titles and drag-and-drop card ordering/movement, implemented with `@dnd-kit`.
- Loads and saves the signed-in user's board through the focused API helper in `src/lib/board-api.ts`. Board changes are saved automatically; load and save failures are shown in the board UI.
- Supports adding, editing, and removing cards. The sign-in screen calls backend session endpoints. `AIChatSidebar` sends the conversation to the authenticated chat API and applies the returned board immediately.
- Uses Tailwind CSS and project color/font variables in `src/app/globals.css`.

Reusable board UI is in `src/components/`: `KanbanColumn`, `KanbanCard`, `KanbanCardPreview`, and `NewCardForm`. Pure board types and movement logic are in `src/lib/kanban.ts`.
Board and chat API access is in `src/lib/board-api.ts` and `src/lib/chat-api.ts`.

## Commands and tests

Run these from `frontend/`:

- `npm run dev` starts the Next.js development server.
- `npm run lint` runs ESLint.
- `npm run test:unit` runs Vitest/Testing Library tests under `src/`.
- `npm run test:e2e` runs Playwright tests under `tests/`.
- `npm run build` makes the production build.

Add or update unit tests beside the code under test. Use browser tests for user-visible flows and integration with the backend. Do not rely on a live OpenRouter request in automated tests.

## Change guidelines

- Follow the root `AGENTS.md` for product requirements, color palette, and coding standards.
- Keep components and state handling simple; preserve existing board interactions unless a requested feature intentionally changes them.
- Keep API access separate from presentation components, and handle failed loads/saves explicitly rather than showing success-shaped fallbacks.
- Keep chat errors visible and update the board only from the validated board returned by the API.
- Keep credentials and `.env` values on the backend; never place secrets in browser code or `NEXT_PUBLIC_*` variables.
- Keep the frontend compatible with the project's planned static export and FastAPI hosting. Confirm any Next.js feature or dependency works with static output before relying on it.
- Update tests and directly related documentation when frontend behavior changes.
