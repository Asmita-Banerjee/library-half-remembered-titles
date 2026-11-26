"""HTTP API. Every route delegates to a service; no results are hardcoded."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from .. import db
from ..data.dsa_catalog import MAX_QUERIES
from ..services import catalog, performance, title_search
from ..services.state import get_state

router = APIRouter(prefix="/api")

Dataset = Literal["library", "dsa"]
Clue = Field(default="", max_length=120)


class BasicRequest(BaseModel):
    dataset: Dataset = "library"
    prefix: str = Clue
    suffix: str = Clue


class MultiRequest(BaseModel):
    dataset: Dataset = "library"
    prefix: str = Clue
    contains: list[str] = Field(default_factory=list, max_length=8)
    suffix: str = Clue


class LiveRequest(MultiRequest):
    limit: int = Field(default=6, ge=1, le=20)


class AuthorRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class StoryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=10, ge=1, le=60)


@router.get("/health")
def health():
    s = get_state()
    return {"status": "ok", "library_records": s.library_engine.size, "dsa_records": s.dsa_engine.size}


@router.get("/overview")
def overview():
    return performance.overview(get_state())


@router.get("/catalog")
def list_catalog(
    dataset: Dataset = "library",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    q: str = Query("", max_length=120),
    genre: str = Query("", max_length=60),
    author: str = Query("", max_length=120),
    year_from: int | None = None,
    year_to: int | None = None,
):
    return catalog.list_catalog(get_state(), dataset, page, page_size, q, genre, author, year_from, year_to)


@router.get("/books/{book_id}")
def get_book(book_id: int):
    b = catalog.get_book(get_state(), book_id)
    if b is None:
        raise HTTPException(404, "Book not found")
    return b


@router.post("/search/title")
def search_title(req: BasicRequest):
    return title_search.basic_search(get_state(), req.dataset, req.prefix, req.suffix)


@router.post("/search/multi")
def search_multi(req: MultiRequest):
    return title_search.multi_search(get_state(), req.dataset, req.prefix, req.contains, req.suffix)


@router.post("/search/live")
def search_live(req: LiveRequest):
    return title_search.live_suggestions(get_state(), req.dataset, req.prefix, req.contains, req.suffix, req.limit)


@router.post("/search/refine")
def search_refine(req: MultiRequest):
    return title_search.refine(get_state(), req.dataset, req.prefix, req.suffix, req.contains)


@router.get("/authors/autocomplete")
def authors_autocomplete(q: str = Query("", max_length=120), limit: int = Query(8, ge=1, le=20)):
    return {"query": q, "authors": catalog.author_autocomplete(get_state(), q, limit)}


@router.post("/search/author")
def search_author(req: AuthorRequest):
    if not req.name.strip():
        raise HTTPException(422, "Enter an author's name.")
    return catalog.author_search(get_state(), req.name)


@router.post("/search/story")
def search_story(req: StoryRequest):
    if not req.query.strip():
        raise HTTPException(422, "Describe a character, plot, setting or theme.")
    return catalog.story_search(get_state(), req.query, req.limit)


@router.get("/history")
def history():
    return {"limit": db.HISTORY_LIMIT, "items": db.get_history()}


@router.delete("/history")
def clear_history():
    return {"cleared": db.clear_history()}


@router.get("/stats/performance")
def stats_performance():
    return performance.performance(get_state())


@router.get("/stats/benchmark")
def stats_benchmark(dataset: Dataset = "dsa", queries: int = Query(MAX_QUERIES, ge=1, le=MAX_QUERIES)):
    return performance.benchmark(get_state(), dataset, queries)


@router.get("/stats/scaling")
def stats_scaling(queries: int = Query(MAX_QUERIES, ge=1, le=MAX_QUERIES)):
    return performance.scaling(queries)


@router.get("/stats/selfcheck")
def stats_selfcheck():
    return performance.self_check(get_state())
