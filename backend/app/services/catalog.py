"""Catalogue browsing, book details, author retrieval and character/story retrieval."""

from __future__ import annotations

import random
import time
from urllib.parse import quote_plus

from .. import db
from ..search.author_index import fold_name
from ..search.story_index import Facets
from .state import LibraryState, cover_isbn

PUBLIC_DOMAIN_BEFORE = 1930  # US public-domain cut-off for works published before 1930 (as of 2026)


def _ms(t0: float) -> float:
    return round((time.perf_counter() - t0) * 1000, 4)


def card(state: LibraryState, b: dict) -> dict:
    return {
        "id": b["id"], "title": b["title"], "authors": b["authors"], "genre": b["genre"], "year": b["year"],
        "note": b.get("note"), "source": b["source"], "audience": b["audience"], "series": b.get("series"),
        "average_rating": b.get("average_rating"), "ratings_count": b.get("ratings_count"),
        "cover_isbn": cover_isbn(state, b),
    }


def facet_options(state: LibraryState) -> dict:
    years = [b["year"] for b in state.books if b["year"] is not None]
    return {
        "genres": sorted({b["genre"] for b in state.books}),
        "audiences": ["General", "Young Adult", "Children"],
        "sources": [{"value": "curated", "label": "Detailed records (60)"},
                    {"value": "goodbooks", "label": "Extended catalogue (10,000)"}],
        "year_min": min(years), "year_max": max(years),
    }


def list_catalog(state: LibraryState, dataset: str, page: int, page_size: int, q: str = "",
                 genre: str = "", author: str = "", year_from: int | None = None,
                 year_to: int | None = None, audience: str = "", source: str = "") -> dict:
    """Insertion-ordered catalogue page. These filters are a plain browse filter
    over the in-memory list, not one of the indexed title searches."""
    ql = q.strip().lower()
    counts: dict[str, int] = {}
    if dataset == "dsa":
        for n in state.dsa_names:
            counts[n] = counts.get(n, 0) + 1
        rows = [{"id": i, "title": n, "duplicate_count": counts[n]}
                for i, n in enumerate(state.dsa_names) if not ql or ql in n]
    else:
        for b in state.books:
            counts[b["normalized_title"]] = counts.get(b["normalized_title"], 0) + 1
        al = fold_name(author)
        facets = Facets(genre, audience, source, year_from, year_to)
        rows = []
        for b in state.books:
            if ql and ql not in b["title"].lower() and ql not in b["normalized_title"]:
                continue
            if al and not any(al in fold_name(a) for a in b["authors"]):
                continue
            if not facets.allows(b):
                continue
            rows.append(card(state, b) | {"duplicate_count": counts[b["normalized_title"]]})
    total = len(rows)
    page_size = max(1, min(page_size, 100))
    pages = max(1, -(-total // page_size))
    page = max(1, min(page, pages))
    start = (page - 1) * page_size
    return {
        "dataset": dataset, "page": page, "page_size": page_size, "pages": pages, "total": total,
        "catalog_size": len(state.dsa_names) if dataset == "dsa" else len(state.books),
        "items": rows[start:start + page_size],
        "genres": sorted({b["genre"] for b in state.books}) if dataset == "library" else [],
    }


def get_book(state: LibraryState, book_id: int) -> dict | None:
    if not 0 <= book_id < len(state.books):
        return None
    b = state.books[book_id]
    out = card(state, b) | {
        "plot": b.get("plot") or "", "characters": b["characters"], "themes": b["themes"],
        "settings": b["settings"], "tags": b["tags"], "original_title": b.get("original_title"),
        "isbn": b.get("isbn"), "language": b.get("language"), "normalized_title": b["normalized_title"],
        "linked": [card(state, state.books[i]) for i in b.get("linked_ids", [])],
    }
    title_q = quote_plus(b["title"])
    author_q = quote_plus(b["authors"][0]) if b["authors"] else ""
    links = [
        {"label": "Open Library", "kind": "borrow",
         "url": f"https://openlibrary.org/search?title={title_q}&author={author_q}"},
        {"label": "WorldCat (find it in a library)", "kind": "library",
         "url": f"https://search.worldcat.org/search?q={title_q}+{author_q}"},
    ]
    if b.get("goodreads_id"):
        links.append({"label": "Goodreads", "kind": "info",
                      "url": f"https://www.goodreads.com/book/show/{b['goodreads_id']}"})
    if b["year"] is not None and b["year"] < PUBLIC_DOMAIN_BEFORE:
        links.append({"label": "Project Gutenberg (free e-book, if available)", "kind": "free",
                      "url": f"https://www.gutenberg.org/ebooks/search/?query={title_q}+{author_q}"})
    out["links"] = links
    return out


def random_books(state: LibraryState, n: int = 4, seed: int | None = None) -> list[dict]:
    rng = random.Random(seed)
    pool = [b for b in state.books if b["source"] == "curated" or (b.get("ratings_count") or 0) > 50_000]
    return [card(state, b) | {"plot": b.get("plot") or "", "tags": b["tags"][:5]} for b in rng.sample(pool, n)]


def author_autocomplete(state: LibraryState, q: str, limit: int = 8) -> list[dict]:
    ids = state.authors.autocomplete(q, limit)
    return [{"id": a, "name": state.authors.names[a],
             "book_count": len(state.authors.books_by_author.get(a, []))} for a in ids]


def author_search(state: LibraryState, q: str, record: bool = True) -> dict:
    t0 = time.perf_counter()
    ids = state.authors.match(q)[:20]
    authors = []
    for a in ids:
        books = sorted((state.books[b] for b in state.authors.books_by_author.get(a, [])),
                       key=lambda b: b["id"], reverse=True)
        authors.append({"id": a, "name": state.authors.names[a], "books": [card(state, b) for b in books]})
    elapsed = _ms(t0)
    total = sum(len(a["books"]) for a in authors)
    out = {"query": q, "authors": authors, "total_books": total, "elapsed_ms": elapsed,
           "status": "match" if authors else "no_match", "search_id": None,
           "algorithm": "Author-name Trie (every name token + full name), case- and accent-insensitive"}
    if record:
        summary = "; ".join(f"{a['name']} ({len(a['books'])})" for a in authors[:3]) or "No match"
        out["search_id"] = db.record_search("author", "library", {"author": q}, summary, total,
                                            "success" if authors else "no_match", elapsed)
    return out


def story_search(state: LibraryState, q: str, limit: int = 10, record: bool = True,
                 facets: Facets | None = None) -> dict:
    t0 = time.perf_counter()
    hits, notes, used = state.story.search(q, limit, facets, state.books)
    # The same work can exist as a detailed record and an extended-catalogue
    # record: show it once (the higher-ranked copy) and mention the other.
    results, shown = [], set()
    for h in hits:
        if h.book_id in shown:
            continue
        b = state.books[h.book_id]
        shown.add(h.book_id)
        shown.update(b.get("linked_ids", []))
        results.append(card(state, b) | {
            "score": h.score,
            "characters": b["characters"],
            "plot": b.get("plot") or "",
            "themes": b["themes"],
            "settings": b["settings"],
            "tags": b["tags"][:8],
            "also_catalogued_as": b.get("linked_ids", []),
            "reasons": [{"term": r.term, "field": r.field, "context": r.context, "related_to": r.related_to,
                         "kind": r.kind} for r in h.reasons],
        })
        if len(results) >= limit:
            break
    elapsed = _ms(t0)
    out = {"query": q, "terms": used, "expansions": notes, "results": results,
           "status": "match" if results else "no_match", "elapsed_ms": elapsed, "search_id": None,
           "facets_applied": bool(facets and facets.active()),
           "algorithm": "Field-weighted inverted keyword index with BM25F relevance scoring, typo-tolerant "
                        "vocabulary Trie, and WordNet synonym expansion"}
    if record:
        summary = ", ".join(f"#{r['id']} {r['title']}" for r in results[:3]) or "No match"
        out["search_id"] = db.record_search("story", "library", {"description": q}, summary, len(results),
                                            "success" if results else "no_match", elapsed)
    return out
