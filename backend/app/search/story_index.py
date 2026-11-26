"""Character & story retrieval: field-weighted inverted index with BM25F scoring.

Each book is split into fields (title, character names, character
descriptions, plot, genre, themes, settings). The inverted index maps a
stemmed term to the books and fields where it occurs:

    term -> {book_id -> {field -> term frequency}}

Scoring is a simplified BM25F: per-field term frequencies are combined with
field weights, length-normalised, and multiplied by the term's IDF. Every
matched term is recorded so the UI can say *why* a book ranked.

The Retriever protocol keeps the architecture open for a semantic
(embedding) retriever later; nothing here needs a paid API.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Protocol

from .text import RELATED_TERMS, stem, tokenize

FIELD_WEIGHTS: dict[str, float] = {
    "title": 2.0,
    "character_name": 3.0,
    "character_description": 2.0,
    "plot": 1.0,
    "genre": 2.5,
    "theme": 2.0,
    "setting": 2.0,
}
FIELD_LABELS = {
    "title": "title",
    "character_name": "character name",
    "character_description": "character description",
    "plot": "plot summary",
    "genre": "genre",
    "theme": "themes",
    "setting": "setting",
}
RELATED_WEIGHT = 0.5
K1 = 1.2
B = 0.6


@dataclass
class Doc:
    book_id: int
    fields: dict[str, list[tuple[str, str, str]]]  # field -> [(stem, surface, context)]
    length: float = 0.0


@dataclass
class MatchReason:
    term: str
    field: str
    context: str
    related_to: str | None = None


@dataclass
class StoryHit:
    book_id: int
    score: float
    reasons: list[MatchReason] = field(default_factory=list)
    matched_terms: list[str] = field(default_factory=list)


class Retriever(Protocol):
    def search(self, query: str, limit: int = 10) -> tuple[list[StoryHit], list[str]]: ...


class KeywordStoryIndex:
    """Built once from the catalog; read-only afterwards."""

    def __init__(self, books: list[dict]):
        self.docs: dict[int, Doc] = {}
        self.postings: dict[str, dict[int, dict[str, int]]] = defaultdict(lambda: defaultdict(dict))
        for b in books:
            self._add(b)
        self.n_docs = len(self.docs)
        self.avg_len = sum(d.length for d in self.docs.values()) / max(1, self.n_docs)
        self.postings = {t: dict(v) for t, v in self.postings.items()}

    def _add(self, b: dict) -> None:
        fields: dict[str, list[tuple[str, str, str]]] = defaultdict(list)

        def put(fname: str, text: str, context: str) -> None:
            for st, surface in tokenize(text):
                fields[fname].append((st, surface, context))

        put("title", b["title"], b["title"])
        put("genre", b["genre"], b["genre"])
        put("plot", b["plot"], b["plot"])
        for ch in b.get("characters", []):
            put("character_name", ch["name"], ch["name"])
            put("character_description", ch["description"], f"{ch['name']}: {ch['description']}")
        for t in b.get("themes", []):
            put("theme", t, t)
        for s in b.get("settings", []):
            put("setting", s, s)

        doc = Doc(b["id"], dict(fields))
        for fname, toks in fields.items():
            doc.length += FIELD_WEIGHTS[fname] * len(toks)
            for st, _, _ in toks:
                tf = self.postings[st][b["id"]]
                tf[fname] = tf.get(fname, 0) + 1
        self.docs[b["id"]] = doc

    @property
    def vocabulary_size(self) -> int:
        return len(self.postings)

    def _idf(self, term: str) -> float:
        df = len(self.postings.get(term, {}))
        return math.log(1 + (self.n_docs - df + 0.5) / (df + 0.5))

    def _context(self, book_id: int, fname: str, term: str) -> str:
        for st, _, ctx in self.docs[book_id].fields.get(fname, []):
            if st == term:
                return ctx
        return ""

    def search(self, query: str, limit: int = 10) -> tuple[list[StoryHit], list[str]]:
        """Return ranked hits and the list of query terms actually used."""
        q_terms: dict[str, tuple[float, str, str | None]] = {}  # stem -> (weight, surface, related_to)
        for st, surface in tokenize(query):
            q_terms[st] = (1.0, surface, None)
        for st, surface in list(tokenize(query)):
            for rel in RELATED_TERMS.get(surface, ()):
                rs = stem(rel)
                if rs not in q_terms:
                    q_terms[rs] = (RELATED_WEIGHT, rel, surface)

        scores: dict[int, float] = defaultdict(float)
        reasons: dict[int, list[MatchReason]] = defaultdict(list)
        matched: dict[int, list[str]] = defaultdict(list)
        for term, (qw, surface, related_to) in q_terms.items():
            plist = self.postings.get(term)
            if not plist:
                continue
            idf = self._idf(term)
            for book_id, ftf in plist.items():
                doc = self.docs[book_id]
                wtf = sum(FIELD_WEIGHTS[f] * tf for f, tf in ftf.items())
                norm = K1 * (1 - B + B * doc.length / self.avg_len)
                scores[book_id] += qw * idf * (wtf * (K1 + 1)) / (wtf + norm)
                matched[book_id].append(surface)
                best = max(ftf, key=lambda f: FIELD_WEIGHTS[f])
                reasons[book_id].append(
                    MatchReason(surface, FIELD_LABELS[best], self._context(book_id, best, term), related_to)
                )

        # Coverage bonus: books matching more distinct query terms rank higher.
        direct_terms = sum(1 for v in q_terms.values() if v[2] is None) or 1
        hits = []
        for book_id, sc in scores.items():
            direct = sum(1 for r in reasons[book_id] if r.related_to is None)
            sc *= 1 + direct / direct_terms
            hits.append(StoryHit(book_id, round(sc, 4), reasons[book_id], matched[book_id]))
        hits.sort(key=lambda h: (-h.score, -h.book_id))
        used = [v[1] for v in q_terms.values() if v[2] is None]
        return hits[:limit], used
