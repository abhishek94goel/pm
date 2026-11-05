# Database approach

The MVP uses one local SQLite database. The container stores it at `/data/pm.sqlite3` on the named `app_data` volume so stopping or rebuilding the container does not remove board data. The backend creates the database and tables when they are first needed.

The proposed schema is in [kanban-schema.json](./kanban-schema.json). It uses four normalized tables:

- `users` can hold multiple users in the future. The MVP's fixed `user` / `password` credentials are validated by the backend and are not saved as a password in the database.
- `boards` has a unique `user_id`, enforcing one board per user.
- `columns` stores the board's fixed stages, their editable titles, and display order.
- `cards` belongs to one column and stores editable title/details and its order. Moving a card updates its column and position.

IDs are text values to match the current frontend model. Position values are integers unique within a board or column. Foreign keys cascade when a parent is deleted; the application must enable SQLite foreign-key enforcement on every connection. Timestamps are UTC ISO 8601 strings.

The backend exposes the board using the current frontend representation (`columns` with `cardIds`, plus a `cards` object keyed by ID), translating to and from the normalized tables. A new user's board is seeded once with demo columns and cards; service restarts do not reseed or overwrite an existing board. Multi-row board changes are written in one transaction. Seeded column and card IDs include the board ID so separate users do not collide on globally unique primary keys. Card positions are shifted temporarily within the transaction before rearrangement to satisfy the unique position constraint.

## Approval and implementation status

The user approved the proposed schema before implementation. The backend initializes SQLite automatically, enforces one board per user, and provides authenticated board read/update routes. The frontend persistence integration is still in progress; until it is complete, the board UI remains in-memory.
