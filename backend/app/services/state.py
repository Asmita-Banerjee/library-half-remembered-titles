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
# Prefix-suffix Trie depth for the 10,060-title library: prefixes and
# suffixes up to 12 characters are answered by one Trie walk; longer clues
# by intersecting the prefix- and suffix-Trie id lists (still indexed).
# Measured: 59 MB with a cap of 12 vs 294 MB uncapped.
LIBRARY_MAX_AFFIX = 12


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
        """Public summary of one record of either catalogue."""
        if dataset == "dsa":
            name = self.dsa_names[rid]
            return {"id": rid, "title": name, "normalized_title": name, "dataset": "dsa"}
        b = self.books[rid]
        return {
            "id": rid,
            "title": b["title"],
            "normalized_title": b["normalized_title"],
            "authors": b["authors"],
            "genre": b["genre"],
            "year": b["year"],
            "note": b.get("note"),
            "source": b["source"],
            "audience": b["audience"],
            "series": b.get("series"),
            "cover_isbn": cover_isbn(self, b),
            "dataset": "library",
        }


def cover_isbn(state: LibraryState, b: dict) -> str | None:
    if b.get("isbn"):
        return b["isbn"]
    for lid in b.get("linked_ids", []):
        if state.books[lid].get("isbn"):
            return state.books[lid]["isbn"]
    return None


def _link_duplicates(books: list[dict]) -> None:
    """Curated records point at the extended-catalogue record of the same work
    (same normalised title + a shared author surname) and vice versa."""
    by_title: dict[str, list[int]] = {}
    for b in books:
        by_title.setdefault(b["normalized_title"], []).append(b["id"])
    for b in books:
        b["linked_ids"] = []
    for ids in by_title.values():
        if len(ids) < 2:
            continue
        for i in ids:
            si = {db.author_key(a).split(" ")[-1] for a in books[i]["authors"]}
            for j in ids:
                if i != j and books[i]["source"] != books[j]["source"]:
                    sj = {db.author_key(a).split(" ")[-1] for a in books[j]["authors"]}
                    if si & sj:
                        books[i]["linked_ids"].append(j)


_state: LibraryState | None = None


def build_state() -> LibraryState:
    db.init_db()
    books = db.load_books()
    dsa_names = db.load_dsa_names()
    validate_names(dsa_names)
    for b in books:
        b["normalized_title"] = normalize(b["title"])
    _link_duplicates(books)

    times: dict[str, float] = {}
    lib_engine = TitleEngine("library", [b["title"] for b in books], max_affix=LIBRARY_MAX_AFFIX)
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
