import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator
from uuid import uuid4

from app.schemas import BoardData

DATABASE_PATH = Path(
    os.environ.get(
        "DATABASE_PATH",
        str(Path(__file__).resolve().parents[2] / "pm.sqlite3"),
    )
)

DEFAULT_COLUMNS = [
    ("col-backlog", "Backlog", ["card-1", "card-2"]),
    ("col-discovery", "Discovery", ["card-3"]),
    ("col-progress", "In Progress", ["card-4", "card-5"]),
    ("col-review", "Review", ["card-6"]),
    ("col-done", "Done", ["card-7", "card-8"]),
]

DEFAULT_CARDS = {
    "card-1": (
        "Align roadmap themes",
        "Draft quarterly themes with impact statements and metrics.",
    ),
    "card-2": (
        "Gather customer signals",
        "Review support tags, sales notes, and churn feedback.",
    ),
    "card-3": (
        "Prototype analytics view",
        "Sketch initial dashboard layout and key drill-downs.",
    ),
    "card-4": (
        "Refine status language",
        "Standardize column labels and tone across the board.",
    ),
    "card-5": (
        "Design card layout",
        "Add hierarchy and spacing for scanning dense lists.",
    ),
    "card-6": (
        "QA micro-interactions",
        "Verify hover, focus, and loading states.",
    ),
    "card-7": (
        "Ship marketing page",
        "Final copy approved and asset pack delivered.",
    ),
    "card-8": (
        "Close onboarding sprint",
        "Document release notes and share internally.",
    ),
}


@contextmanager
def _connection() -> Iterator[sqlite3.Connection]:
    path = Path(DATABASE_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database() -> None:
    with _connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS boards (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS columns (
                id TEXT PRIMARY KEY,
                board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                position INTEGER NOT NULL,
                UNIQUE (board_id, position)
            );
            CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY,
                column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                details TEXT NOT NULL,
                position INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE (column_id, position)
            );
            """
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_board(connection: sqlite3.Connection, user_id: str) -> str:
    now = _now()
    connection.execute(
        "INSERT INTO users (id, username, created_at) VALUES (?, ?, ?) "
        "ON CONFLICT(id) DO NOTHING",
        (user_id, user_id, now),
    )
    row = connection.execute(
        "SELECT id FROM boards WHERE user_id = ?", (user_id,)
    ).fetchone()
    if row:
        return row["id"]

    board_id = str(uuid4())
    connection.execute(
        "INSERT INTO boards (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (board_id, user_id, now, now),
    )
    for column_position, (column_key, title, card_keys) in enumerate(DEFAULT_COLUMNS):
        column_id = f"{board_id}:{column_key}"
        connection.execute(
            "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
            (column_id, board_id, title, column_position),
        )
        for card_position, card_key in enumerate(card_keys):
            card_id = f"{board_id}:{card_key}"
            card_title, details = DEFAULT_CARDS[card_key]
            connection.execute(
                """
                INSERT INTO cards
                    (id, column_id, title, details, position, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    card_id,
                    column_id,
                    card_title,
                    details,
                    card_position,
                    now,
                    now,
                ),
            )
    return board_id


def _read_board(connection: sqlite3.Connection, board_id: str) -> BoardData:
    column_rows = connection.execute(
        "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position",
        (board_id,),
    ).fetchall()
    columns = [
        {"id": row["id"], "title": row["title"], "cardIds": []}
        for row in column_rows
    ]
    columns_by_id = {column["id"]: column for column in columns}
    card_rows = connection.execute(
        """
        SELECT cards.id, cards.column_id, cards.title, cards.details
        FROM cards
        JOIN columns ON columns.id = cards.column_id
        WHERE columns.board_id = ?
        ORDER BY columns.position, cards.position
        """,
        (board_id,),
    ).fetchall()
    cards = {}
    for row in card_rows:
        cards[row["id"]] = {
            "id": row["id"],
            "title": row["title"],
            "details": row["details"],
        }
        columns_by_id[row["column_id"]]["cardIds"].append(row["id"])
    return BoardData.model_validate({"columns": columns, "cards": cards})


def get_or_create_board(user_id: str) -> BoardData:
    with _connection() as connection:
        board_id = _ensure_board(connection, user_id)
        return _read_board(connection, board_id)


def save_board(user_id: str, board: BoardData) -> BoardData:
    with _connection() as connection:
        board_id = _ensure_board(connection, user_id)
        columns = connection.execute(
            "SELECT id FROM columns WHERE board_id = ? ORDER BY position", (board_id,)
        ).fetchall()
        column_ids = [row["id"] for row in columns]
        payload_column_ids = [column.id for column in board.columns]
        if payload_column_ids != column_ids:
            raise ValueError("The fixed board columns cannot be added, removed, or reordered.")

        existing_cards = connection.execute(
            """
            SELECT cards.id
            FROM cards
            JOIN columns ON columns.id = cards.column_id
            WHERE columns.board_id = ?
            """,
            (board_id,),
        ).fetchall()
        existing_card_ids = {row["id"] for row in existing_cards}
        requested_card_ids = set(board.cards)
        new_card_ids = requested_card_ids - existing_card_ids
        for card_id in new_card_ids:
            if connection.execute(
                "SELECT 1 FROM cards WHERE id = ?", (card_id,)
            ).fetchone():
                raise ValueError("A card ID is already in use.")

        now = _now()
        for column_position, column in enumerate(board.columns):
            connection.execute(
                "UPDATE columns SET title = ?, position = ? "
                "WHERE id = ? AND board_id = ?",
                (column.title, column_position, column.id, board_id),
            )

        connection.execute(
            """
            UPDATE cards
            SET position = -position - 1
            WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?)
            """,
            (board_id,),
        )
        for column in board.columns:
            for card_position, card_id in enumerate(column.card_ids):
                card = board.cards[card_id]
                if card_id in existing_card_ids:
                    connection.execute(
                        """
                        UPDATE cards
                        SET column_id = ?, title = ?, details = ?, position = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (
                            column.id,
                            card.title,
                            card.details,
                            card_position,
                            now,
                            card_id,
                        ),
                    )
                else:
                    connection.execute(
                        """
                        INSERT INTO cards
                            (id, column_id, title, details, position, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            card_id,
                            column.id,
                            card.title,
                            card.details,
                            card_position,
                            now,
                            now,
                        ),
                    )

        removed_card_ids = existing_card_ids - requested_card_ids
        for card_id in removed_card_ids:
            connection.execute("DELETE FROM cards WHERE id = ?", (card_id,))
        connection.execute(
            "UPDATE boards SET updated_at = ? WHERE id = ?", (now, board_id)
        )
        return _read_board(connection, board_id)
