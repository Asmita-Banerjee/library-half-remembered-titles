"""SQLite schema, seeding and small data-access helpers.

Two sources feed one insertion-ordered library catalogue:
  * ids 0..59     - the curated, metadata-rich records (app/data/books.py)
  * ids 60..10059 - the goodbooks-10k extended catalogue (CC BY-SA 4.0),
                    real Goodreads metadata + readers' shelf tags.
The constrained DSA catalogue lives in its own table.
"""

from __future__ import annotations

import csv
import gzip
import hashlib
import json
import os
import re
import sqlite3
import threading
import unicodedata
from contextlib import contextmanager
from pathlib import Path

from .data.books import BOOKS
from .data.dsa_catalog import generate_dsa_names

DEFAULT_DB = Path(__file__).resolve().parents[1] / "data" / "library.db"
GOODBOOKS = Path(__file__).resolve().parent / "data" / "goodbooks" / "goodbooks_catalog.csv.gz"
HISTORY_LIMIT = 5

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY,              -- insertion order, 0-based
    title TEXT NOT NULL,
    genre TEXT NOT NULL,
    year INTEGER,                        -- NULL when unknown
    plot TEXT NOT NULL DEFAULT '',
    note TEXT,
    source TEXT NOT NULL,                -- curated | goodbooks
    audience TEXT NOT NULL DEFAULT 'General',
    series TEXT,
    original_title TEXT,
    isbn TEXT,
    goodreads_id TEXT,
    average_rating REAL,
    ratings_count INTEGER,
    language TEXT
);
CREATE TABLE IF NOT EXISTS authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL, key TEXT NOT NULL UNIQUE);
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
CREATE TABLE IF NOT EXISTS book_tags (book_id INTEGER NOT NULL REFERENCES books(id), tag TEXT NOT NULL);
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
    feedback TEXT,                       -- NULL | found | not_found
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE TABLE IF NOT EXISTS search_stats (
    search_type TEXT PRIMARY KEY,
    success INTEGER NOT NULL DEFAULT 0,
    failure INTEGER NOT NULL DEFAULT 0,
    total_ms REAL NOT NULL DEFAULT 0,
    last_ms REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    search_id INTEGER,
    search_type TEXT NOT NULL,
    found INTEGER NOT NULL,              -- 1 = reader confirmed the book, 0 = not found
    record_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
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


def author_key(name: str) -> str:
    """Same person, same key: 'J.K. Rowling' == 'J. K. Rowling', 'Brontë' == 'Bronte'."""
    folded = "".join(c for c in unicodedata.normalize("NFKD", name.lower()) if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", folded))


def read_goodbooks() -> list[dict]:
    if not GOODBOOKS.exists():
        return []
    with gzip.open(GOODBOOKS, "rt", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _dataset_hash() -> str:
    h = hashlib.sha256(json.dumps([BOOKS, generate_dsa_names()], sort_keys=True).encode())
    if GOODBOOKS.exists():
        h.update(GOODBOOKS.read_bytes())
    h.update(b"schema-v2")
    return h.hexdigest()[:16]


def init_db() -> None:
    """Create tables and (re)seed the catalogues if the bundled data changed."""
    with _write_lock, connect() as conn:
        row = None
        try:
            row = conn.execute("SELECT value FROM meta WHERE key='dataset_hash'").fetchone()
        except sqlite3.OperationalError:
            pass
        h = _dataset_hash()
        if row and row["value"] == h:
            return
        # Catalogue tables are rebuilt from the bundled data; history survives.
        for t in ("book_themes", "book_settings", "book_tags", "characters", "book_authors", "authors", "books",
                  "dsa_names"):
            conn.execute(f"DROP TABLE IF EXISTS {t}")
        for col in ("feedback",):
            try:
                conn.execute(f"ALTER TABLE search_history ADD COLUMN {col} TEXT")
            except sqlite3.OperationalError:
                pass
        conn.executescript(SCHEMA)

        authors: dict[str, int] = {}

        def author_id(name: str) -> int:
            k = author_key(name)
            if k not in authors:
                authors[k] = len(authors)
                conn.execute("INSERT INTO authors (id, name, key) VALUES (?,?,?)", (authors[k], name, k))
            return authors[k]

        for bid, b in enumerate(BOOKS):
            conn.execute(
                "INSERT INTO books (id, title, genre, year, plot, note, source, audience) VALUES (?,?,?,?,?,?,?,?)",
                (bid, b["title"], b["genre"], b["year"], b["plot"], b.get("note"), "curated", b["audience"]),
            )
            for pos, name in enumerate(b["authors"]):
                conn.execute("INSERT INTO book_authors VALUES (?,?,?)", (bid, author_id(name), pos))
            conn.executemany("INSERT INTO characters (book_id, name, description) VALUES (?,?,?)",
                             [(bid, c["name"], c["description"]) for c in b["characters"]])
            conn.executemany("INSERT INTO book_themes VALUES (?,?)", [(bid, t) for t in b["themes"]])
            conn.executemany("INSERT INTO book_settings VALUES (?,?)", [(bid, s) for s in b["settings"]])

        base = len(BOOKS)
        book_rows, ba_rows, tag_rows = [], [], []
        for i, r in enumerate(read_goodbooks()):
            bid = base + i
            book_rows.append((
                bid, r["title"], r["genre"], int(r["year"]) if r["year"] else None, "", None, "goodbooks",
                r["audience"], r["series"] or None, r["original_title"] or None, r["isbn"] or None,
                r["goodreads_id"], float(r["average_rating"]), int(r["ratings_count"]), r["language"] or None,
            ))
            seen = set()
            for pos, name in enumerate(n for n in r["authors"].split("|") if n):
                aid = author_id(name)
                if aid not in seen:
                    seen.add(aid)
                    ba_rows.append((bid, aid, pos))
            tag_rows.extend((bid, t) for t in r["tags"].split("|") if t)
        conn.executemany(
            "INSERT INTO books (id, title, genre, year, plot, note, source, audience, series, original_title, isbn, "
            "goodreads_id, average_rating, ratings_count, language) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            book_rows,
        )
        conn.executemany("INSERT INTO book_authors VALUES (?,?,?)", ba_rows)
        conn.executemany("INSERT INTO book_tags VALUES (?,?)", tag_rows)
        conn.executemany("INSERT INTO dsa_names (id, name) VALUES (?,?)", list(enumerate(generate_dsa_names())))
        conn.execute("INSERT OR REPLACE INTO meta VALUES ('dataset_hash', ?)", (h,))


def load_books() -> list[dict]:
    """Full book records in insertion order."""
    with connect() as conn:
        books = {
            r["id"]: dict(r) | {"authors": [], "author_ids": [], "characters": [], "themes": [], "settings": [],
                                "tags": []}
            for r in conn.execute("SELECT * FROM books ORDER BY id")
        }
        for r in conn.execute(
            "SELECT ba.book_id, a.id AS author_id, a.name FROM book_authors ba "
            "JOIN authors a ON a.id = ba.author_id ORDER BY ba.book_id, ba.position"
        ):
            books[r["book_id"]]["authors"].append(r["name"])
            books[r["book_id"]]["author_ids"].append(r["author_id"])
        for r in conn.execute("SELECT book_id, name, description FROM characters ORDER BY id"):
            books[r["book_id"]]["characters"].append({"name": r["name"], "description": r["description"]})
        for table, col, key in (("book_themes", "theme", "themes"), ("book_settings", "setting", "settings"),
                                ("book_tags", "tag", "tags")):
            for r in conn.execute(f"SELECT book_id, {col} FROM {table} ORDER BY rowid"):
                books[r["book_id"]][key].append(r[col])
    return [books[k] for k in sorted(books)]


def load_authors() -> dict[int, str]:
    with connect() as conn:
        return {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM authors")}


def load_dsa_names() -> list[str]:
    with connect() as conn:
        return [r["name"] for r in conn.execute("SELECT name FROM dsa_names ORDER BY id")]


# --- search history, statistics and reader feedback ------------------------

def record_search(search_type: str, dataset: str | None, clues: dict, summary: str,
                  count: int, status: str, elapsed_ms: float) -> int:
    """Store one search; returns its id (used for "Found it?" feedback)."""
    with _write_lock, connect() as conn:
        cur = conn.execute(
            "INSERT INTO search_history (search_type, dataset, clues, result_summary, result_count, status, elapsed_ms) "
            "VALUES (?,?,?,?,?,?,?)",
            (search_type, dataset, json.dumps(clues), summary[:300], count, status, elapsed_ms),
        )
        sid = cur.lastrowid
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
        return int(sid)


def record_feedback(search_id: int | None, search_type: str, found: bool, record_id: int | None) -> dict:
    with _write_lock, connect() as conn:
        if search_id is not None:
            prev = conn.execute("SELECT id FROM feedback WHERE search_id = ?", (search_id,)).fetchone()
            if prev:
                conn.execute("UPDATE feedback SET found = ?, record_id = ? WHERE id = ?",
                             (int(found), record_id, prev["id"]))
            else:
                conn.execute("INSERT INTO feedback (search_id, search_type, found, record_id) VALUES (?,?,?,?)",
                             (search_id, search_type, int(found), record_id))
            conn.execute("UPDATE search_history SET feedback = ? WHERE id = ?",
                         ("found" if found else "not_found", search_id))
        else:
            conn.execute("INSERT INTO feedback (search_id, search_type, found, record_id) VALUES (?,?,?,?)",
                         (None, search_type, int(found), record_id))
    return feedback_stats()


def feedback_stats() -> dict:
    with connect() as conn:
        rows = conn.execute("SELECT search_type, SUM(found) AS found, COUNT(*) AS total FROM feedback "
                            "GROUP BY search_type").fetchall()
    by_type = {r["search_type"]: {"found": r["found"] or 0, "total": r["total"]} for r in rows}
    found = sum(v["found"] for v in by_type.values())
    total = sum(v["total"] for v in by_type.values())
    return {"found": found, "not_found": total - found, "total": total, "by_type": by_type}


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
