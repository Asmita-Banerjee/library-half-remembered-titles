"""Catalog listing, author retrieval and character/story retrieval."""

from __future__ import annotations

import time

from .. import db
from ..search.author_index import fold_name
from .state import LibraryState


def _ms(t0: float) -> float:
    return round((time.perf_counter() - t0) * 1000, 4)


def list_catalog(state: LibraryState, dataset: str, page: int, page_size: int, q: str = "",
                 genre: str = "", author: str = "", year_from: int | None = None,
                 year_to: int | None = None) -> dict:
    """Insertion-ordered catalog page. Filtering here is a plain browse filter
    over the in-memory list (not one of the indexed title searches)."""
    ql = q.strip().lower()
    if dataset == "dsa":
        rows = [{"id": i, "title": n} for i, n in enumerate(state.dsa_names)]
        if ql:
            rows = [r for r in rows if ql in r["title"]]
        counts: dict[str, int] = {}
        for n in state.dsa_names:
            counts[n] = counts.get(n, 0) + 1
        for r in rows:
            r["duplicate_count"] = counts[r["title"]]
        genres: list[str] = []
    else:
        rows = []
        counts = {}
        for b in state.books:
            counts[b["normalized_title"]] = counts.get(b["normalized_title"], 0) + 1
        al = fold_name(author)
        for b in state.books:
            if ql and ql not in b["title"].lower():
                continue
            if genre and b["genre"] != genre:
                continue
            if al and not any(al in fold_name(a) for a in b["authors"]):
                continue
            if year_from is not None and b["year"] < year_from:
                continue
            if year_to is not None and b["year"] > year_to:
                continue
            rows.append({
                "id": b["id"], "title": b["title"], "authors": b["authors"], "genre": b["genre"],
                "year": b["year"], "note": b.get("note"),
                "duplicate_count": counts[b["normalized_title"]],
            })
        genres = sorted({b["genre"] for b in state.books})
    total = len(rows)
    page_size = max(1, min(page_size, 100))
    pages = max(1, -(-total // page_size))
    page = max(1, min(page, pages))
    start = (page - 1) * page_size
    return {
        "dataset": dataset, "page": page, "page_size": page_size, "pages": pages, "total": total,
        "catalog_size": len(state.dsa_names) if dataset == "dsa" else len(state.books),
        "items": rows[start:start + page_size], "genres": genres,
    }


def get_book(state: LibraryState, book_id: int) -> dict | None:
    if not 0 <= book_id < len(state.books):
        return None
    b = dict(state.books[book_id])
    b.pop("author_ids", None)
    return b


def _book_card(b: dict) -> dict:
    return {"id": b["id"], "title": b["title"], "authors": b["authors"], "genre": b["genre"],
            "year": b["year"], "note": b.get("note")}


def author_autocomplete(state: LibraryState, q: str, limit: int = 8) -> list[dict]:
    ids = state.authors.autocomplete(q, limit)
    return [{"id": a, "name": state.authors.names[a],
             "book_count": len(state.authors.books_by_author.get(a, []))} for a in ids]


def author_search(state: LibraryState, q: str, record: bool = True) -> dict:
    t0 = time.perf_counter()
    ids = state.authors.match(q)
    authors = []
    for a in ids:
        books = sorted((state.books[b] for b in state.authors.books_by_author.get(a, [])),
                       key=lambda b: b["id"], reverse=True)
        authors.append({"id": a, "name": state.authors.names[a], "books": [_book_card(b) for b in books]})
    elapsed = _ms(t0)
    total = sum(len(a["books"]) for a in authors)
    out = {"query": q, "authors": authors, "total_books": total, "elapsed_ms": elapsed,
           "status": "match" if authors else "no_match",
           "algorithm": "Author-name Trie (every name token + full name), case- and accent-insensitive"}
    if record:
        summary = "; ".join(f"{a['name']} ({len(a['books'])})" for a in authors[:3]) or "No match"
        db.record_search("author", "library", {"author": q}, summary, total,
                         "success" if authors else "no_match", elapsed)
    return out


def story_search(state: LibraryState, q: str, limit: int = 10, record: bool = True) -> dict:
    t0 = time.perf_counter()
    hits, used = state.story.search(q, limit)
    elapsed = _ms(t0)
    results = []
    for h in hits:
        b = state.books[h.book_id]
        reasons = []
        for r in h.reasons:
            reasons.append({"term": r.term, "field": r.field, "context": r.context,
                            "related_to": r.related_to})
        results.append(_book_card(b) | {
            "score": h.score,
            "characters": b["characters"],
            "plot": b["plot"],
            "themes": b["themes"],
            "settings": b["settings"],
            "reasons": reasons,
        })
    out = {"query": q, "terms": used, "results": results, "status": "match" if results else "no_match",
           "elapsed_ms": elapsed,
           "algorithm": "Field-weighted inverted keyword index with BM25F relevance scoring"}
    if record:
        summary = ", ".join(f"#{r['id']} {r['title']}" for r in results[:3]) or "No match"
        db.record_search("story", "library", {"description": q}, summary, len(results),
                         "success" if results else "no_match", elapsed)
    return out
