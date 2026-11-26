"""Application state: every index is built once at startup and reused."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from .. import db
from ..core.engine import TitleEngine, normalize
from ..data.dsa_catalog import validate_names
from ..search.author_index import AuthorIndex
from ..search.story_index import KeywordStoryIndex

DATASETS = ("library", "dsa")


@dataclass
class LibraryState:
    books: list[dict]
    dsa_names: list[str]
    library_engine: TitleEngine
    dsa_engine: TitleEngine
    authors: AuthorIndex
    story: KeywordStoryIndex
    build_times_ms: dict[str, float] = field(default_factory=dict)
    initialized_at: float = field(default_factory=time.time)

    def engine(self, dataset: str) -> TitleEngine:
        if dataset == "library":
            return self.library_engine
        if dataset == "dsa":
            return self.dsa_engine
        raise KeyError(dataset)

    def record(self, dataset: str, rid: int) -> dict:
        """Public view of one record of either catalog."""
        if dataset == "dsa":
            name = self.dsa_names[rid]
            return {"id": rid, "title": name, "normalized_title": name, "dataset": "dsa"}
        b = self.books[rid]
        return {
            "id": rid,
            "title": b["title"],
            "normalized_title": self.library_engine.title(rid),
            "authors": b["authors"],
            "genre": b["genre"],
            "year": b["year"],
            "note": b.get("note"),
            "dataset": "library",
        }


_state: LibraryState | None = None


def build_state() -> LibraryState:
    db.init_db()
    books = db.load_books()
    dsa_names = db.load_dsa_names()
    validate_names(dsa_names)

    times: dict[str, float] = {}
    lib_engine = TitleEngine("library", [b["title"] for b in books])
    times["library_trie"] = lib_engine.build_ms
    dsa_engine = TitleEngine("dsa", dsa_names)
    times["dsa_trie"] = dsa_engine.build_ms

    t0 = time.perf_counter()
    books_by_author: dict[int, list[int]] = {}
    for b in books:
        for aid in b.get("author_ids", []):
            books_by_author.setdefault(aid, []).append(b["id"])
    authors = AuthorIndex(db.load_authors(), books_by_author)
    times["author_trie"] = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    story = KeywordStoryIndex(books)
    times["story_inverted_index"] = (time.perf_counter() - t0) * 1000

    for b in books:
        b["normalized_title"] = normalize(b["title"])
    return LibraryState(books, dsa_names, lib_engine, dsa_engine, authors, story, times)


def init_state() -> LibraryState:
    global _state
    if _state is None:
        _state = build_state()
    return _state


def get_state() -> LibraryState:
    if _state is None:
        return init_state()
    return _state
