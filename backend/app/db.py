"""SQLite schema, seeding and small data-access helpers."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

from .data.books import BOOKS
from .data.dsa_catalog import generate_dsa_names

DEFAULT_DB = Path(__file__).resolve().parents[1] / "data" / "library.db"
HISTORY_LIMIT = 5

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY,              -- insertion order, 0-based
    title TEXT NOT NULL,
    genre TEXT NOT NULL,
    year INTEGER NOT NULL,
    plot TEXT NOT NULL,
    note TEXT
);
CREATE TABLE IF NOT EXISTS authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS book_authors (
    book_id INTEGER NOT NULL REFERENCES books(id),
    author_id INTEGER NOT NULL REFERENCES authors(id),
    position INTEGER NOT NULL,
    PRIMARY KEY (book_id, author_id)
);
CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES books(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS book_themes (book_id INTEGER NOT NULL REFERENCES books(id), theme TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS book_settings (book_id INTEGER NOT NULL REFERENCES books(id), setting TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS dsa_names (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    search_type TEXT NOT NULL,
    dataset TEXT,
    clues TEXT NOT NULL,                 -- JSON
    result_summary TEXT NOT NULL,
    result_count INTEGER NOT NULL,
    status TEXT NOT NULL,                -- success | no_match | error
    elapsed_ms REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE TABLE IF NOT EXISTS search_stats (
    search_type TEXT PRIMARY KEY,
    success INTEGER NOT NULL DEFAULT 0,
    failure INTEGER NOT NULL DEFAULT 0,
    total_ms REAL NOT NULL DEFAULT 0,
    last_ms REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_book_authors_author ON book_authors(author_id);
CREATE INDEX IF NOT EXISTS idx_characters_book ON characters(book_id);
"""


def db_path() -> Path:
    return Path(os.environ.get("DATABASE_PATH", str(DEFAULT_DB)))


_write_lock = threading.Lock()


@contextmanager
def connect():
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _dataset_hash() -> str:
    payload = json.dumps([BOOKS, generate_dsa_names()], sort_keys=True).encode()
    return hashlib.sha256(payload).hexdigest()[:16]


def init_db() -> None:
    """Create tables and (re)seed the catalogs if the bundled data changed."""
    with _write_lock, connect() as conn:
        conn.executescript(SCHEMA)
        row = conn.execute("SELECT value FROM meta WHERE key='dataset_hash'").fetchone()
        h = _dataset_hash()
        if row and row["value"] == h:
            return
        for t in ("book_themes", "book_settings", "characters", "book_authors", "authors", "books", "dsa_names"):
            conn.execute(f"DELETE FROM {t}")
        author_ids: dict[str, int] = {}
        for bid, b in enumerate(BOOKS):
            conn.execute(
                "INSERT INTO books (id, title, genre, year, plot, note) VALUES (?,?,?,?,?,?)",
                (bid, b["title"], b["genre"], b["year"], b["plot"], b.get("note")),
            )
            for pos, name in enumerate(b["authors"]):
                if name not in author_ids:
                    author_ids[name] = len(author_ids)
                    conn.execute("INSERT INTO authors (id, name) VALUES (?,?)", (author_ids[name], name))
                conn.execute("INSERT INTO book_authors VALUES (?,?,?)", (bid, author_ids[name], pos))
            for ch in b["characters"]:
                conn.execute("INSERT INTO characters (book_id, name, description) VALUES (?,?,?)",
                             (bid, ch["name"], ch["description"]))
            conn.executemany("INSERT INTO book_themes VALUES (?,?)", [(bid, t) for t in b["themes"]])
            conn.executemany("INSERT INTO book_settings VALUES (?,?)", [(bid, s) for s in b["settings"]])
        conn.executemany("INSERT INTO dsa_names (id, name) VALUES (?,?)", list(enumerate(generate_dsa_names())))
        conn.execute("INSERT OR REPLACE INTO meta VALUES ('dataset_hash', ?)", (h,))


def load_books() -> list[dict]:
    """Full book records in insertion order."""
    with connect() as conn:
        books = {r["id"]: dict(r) | {"authors": [], "characters": [], "themes": [], "settings": []}
                 for r in conn.execute("SELECT * FROM books ORDER BY id")}
        for r in conn.execute(
            "SELECT ba.book_id, a.id AS author_id, a.name FROM book_authors ba "
            "JOIN authors a ON a.id = ba.author_id ORDER BY ba.book_id, ba.position"
        ):
            books[r["book_id"]]["authors"].append(r["name"])
            books[r["book_id"]].setdefault("author_ids", []).append(r["author_id"])
        for r in conn.execute("SELECT book_id, name, description FROM characters ORDER BY id"):
            books[r["book_id"]]["characters"].append({"name": r["name"], "description": r["description"]})
        for r in conn.execute("SELECT book_id, theme FROM book_themes ORDER BY rowid"):
            books[r["book_id"]]["themes"].append(r["theme"])
        for r in conn.execute("SELECT book_id, setting FROM book_settings ORDER BY rowid"):
            books[r["book_id"]]["settings"].append(r["setting"])
    return [books[k] for k in sorted(books)]


def load_authors() -> dict[int, str]:
    with connect() as conn:
        return {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM authors")}


def load_dsa_names() -> list[str]:
    with connect() as conn:
        return [r["name"] for r in conn.execute("SELECT name FROM dsa_names ORDER BY id")]


# --- search history & statistics -------------------------------------------

def record_search(search_type: str, dataset: str | None, clues: dict, summary: str,
                  count: int, status: str, elapsed_ms: float) -> None:
    with _write_lock, connect() as conn:
        conn.execute(
            "INSERT INTO search_history (search_type, dataset, clues, result_summary, result_count, status, elapsed_ms) "
            "VALUES (?,?,?,?,?,?,?)",
            (search_type, dataset, json.dumps(clues), summary[:300], count, status, elapsed_ms),
        )
        conn.execute(
            "DELETE FROM search_history WHERE id NOT IN "
            "(SELECT id FROM search_history ORDER BY id DESC LIMIT ?)", (HISTORY_LIMIT,)
        )
        ok = status == "success"
        conn.execute(
            "INSERT INTO search_stats (search_type, success, failure, total_ms, last_ms) VALUES (?,?,?,?,?) "
            "ON CONFLICT(search_type) DO UPDATE SET success = success + excluded.success, "
            "failure = failure + excluded.failure, total_ms = total_ms + excluded.total_ms, last_ms = excluded.last_ms",
            (search_type, int(ok), int(not ok), elapsed_ms, elapsed_ms),
        )


def get_history() -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM search_history ORDER BY id DESC LIMIT ?", (HISTORY_LIMIT,)).fetchall()
    return [dict(r) | {"clues": json.loads(r["clues"])} for r in rows]


def clear_history() -> int:
    with _write_lock, connect() as conn:
        return conn.execute("DELETE FROM search_history").rowcount


def get_search_stats() -> list[dict]:
    with connect() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM search_stats ORDER BY search_type")]


def reset_stats() -> None:
    with _write_lock, connect() as conn:
        conn.execute("DELETE FROM search_stats")
