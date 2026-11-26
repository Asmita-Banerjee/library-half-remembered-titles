"""Character & story retrieval: field-weighted inverted index with BM25F scoring.

Each book is split into fields (title, character names, character
descriptions, plot, genre, themes, settings, reader shelf tags). The inverted
index maps a stemmed term to the books and fields where it occurs:

    term -> {book_id -> {field -> term frequency}}

Query terms are matched in three tiers, each reported back as a reason:
  1. direct       - the stemmed word itself                     (weight 1.0)
  2. spelling     - Trie + Levenshtein over the vocabulary       (weight 0.7)
                    (1 edit for 5-8 letters, 2 for 9+)
  3. related      - curated table + precomputed WordNet synonyms (weight 0.5 / 0.4)

Scoring is BM25F (per-field tf x weight, length-normalised, x IDF), plus a
bonus for covering more query words and a small popularity prior (Goodreads
rating count) for the extended catalogue. Facets (genre, audience, year
range, source) filter candidates before ranking.

The Retriever protocol keeps the architecture open for a semantic
(embedding) re-ranker; nothing here needs a paid API.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Protocol

from .text import RELATED_TERMS, stem, tokenize, wordnet_aliases
from .vocab_fuzzy import VocabTrie, typo_budget

FIELD_WEIGHTS: dict[str, float] = {
    "title": 2.0,
    "character_name": 3.0,
    "character_description": 2.0,
    "plot": 1.0,
    "genre": 2.5,
    "theme": 2.0,
    "setting": 2.0,
    "tag": 1.5,
}
FIELD_LABELS = {
    "title": "title",
    "character_name": "character name",
    "character_description": "character description",
    "plot": "plot summary",
    "genre": "genre",
    "theme": "themes",
    "setting": "setting",
    "tag": "reader shelf tags",
}
# Expansion weights. A word that is missing from the catalogue vocabulary is
# what the reader actually meant, so its spelling / synonym stand-ins weigh
# almost as much as a direct hit; synonyms of words that DO match are kept
# weak so they cannot outrank the reader's own words.
TIER_WEIGHT = {"direct": 1.0, "spelling": 0.85, "related": 0.8, "wordnet": 0.75, "related_extra": 0.6}
K1 = 1.2
B = 0.6
POPULARITY = 0.04  # score multiplier per order of magnitude of ratings


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
    kind: str = "direct"  # direct | spelling | related | wordnet


@dataclass
class StoryHit:
    book_id: int
    score: float
    reasons: list[MatchReason] = field(default_factory=list)
    matched_terms: list[str] = field(default_factory=list)


@dataclass
class Facets:
    genre: str = ""
    audience: str = ""
    source: str = ""
    year_from: int | None = None
    year_to: int | None = None

    def active(self) -> bool:
        return bool(self.genre or self.audience or self.source or self.year_from is not None
                    or self.year_to is not None)

    def allows(self, b: dict) -> bool:
        if self.genre and b["genre"] != self.genre:
            return False
        if self.audience and b.get("audience") != self.audience:
            return False
        if self.source and b.get("source") != self.source:
            return False
        y = b.get("year")
        if self.year_from is not None and (y is None or y < self.year_from):
            return False
        if self.year_to is not None and (y is None or y > self.year_to):
            return False
        return True


class Retriever(Protocol):
    def search(self, query: str, limit: int = 10, facets: Facets | None = None,
               books: list[dict] | None = None) -> tuple[list[StoryHit], list[dict]]: ...


class KeywordStoryIndex:
    """Built once from the catalogue; read-only afterwards."""

    def __init__(self, books: list[dict]):
        self.docs: dict[int, Doc] = {}
        self.surface: dict[str, str] = {}  # stem -> a real word that produced it (for display)
        self.popularity: dict[int, float] = {}
        postings: dict[str, dict[int, dict[str, int]]] = defaultdict(lambda: defaultdict(dict))
        for b in books:
            self._add(b, postings)
            rc = b.get("ratings_count") or 0
            self.popularity[b["id"]] = 1 + POPULARITY * math.log10(1 + rc)
        self.n_docs = len(self.docs)
        self.avg_len = sum(d.length for d in self.docs.values()) / max(1, self.n_docs)
        self.postings = {t: dict(v) for t, v in postings.items()}
        self.vocab = VocabTrie(self.postings.keys())
        self.wordnet = wordnet_aliases()

    def _add(self, b: dict, postings) -> None:
        fields: dict[str, list[tuple[str, str, str]]] = defaultdict(list)

        def put(fname: str, text: str, context: str) -> None:
            for st, surface in tokenize(text):
                fields[fname].append((st, surface, context))
                self.surface.setdefault(st, surface)

        put("title", b["title"], b["title"])
        if b.get("series"):
            put("title", b["series"], f"series: {b['series']}")
        put("genre", b["genre"], b["genre"])
        if b.get("plot"):
            put("plot", b["plot"], b["plot"])
        for ch in b.get("characters", []):
            put("character_name", ch["name"], ch["name"])
            put("character_description", ch["description"], f"{ch['name']}: {ch['description']}")
        for t in b.get("themes", []):
            put("theme", t, t)
        for s in b.get("settings", []):
            put("setting", s, s)
        for t in b.get("tags", []):
            words = t.replace("-", " ")
            put("tag", words, words)

        doc = Doc(b["id"], dict(fields))
        for fname, toks in fields.items():
            doc.length += FIELD_WEIGHTS[fname] * len(toks)
            for st, _, _ in toks:
                tf = postings[st][b["id"]]
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

    def expand(self, query: str) -> tuple[dict[str, tuple[float, str, str | None, str]], list[dict]]:
        """Query stems -> (weight, shown word, original word, tier), plus a log of expansions."""
        terms: dict[str, tuple[float, str, str | None, str]] = {}
        notes: list[dict] = []
        tokens = tokenize(query)
        for st, surface in tokens:
            if st in self.postings:
                terms[st] = (TIER_WEIGHT["direct"], surface, None, "direct")
        for st, surface in tokens:
            if st in self.postings:
                continue
            budget = typo_budget(surface)
            for cand, dist in self.vocab.search(st, budget, limit=2):
                if cand not in terms:
                    shown = self.surface.get(cand, cand)
                    terms[cand] = (TIER_WEIGHT["spelling"], shown, surface, "spelling")
                    notes.append({"kind": "spelling", "from": surface, "to": shown, "distance": dist})
        for st, surface in tokens:
            missing = st not in self.postings
            for rel in RELATED_TERMS.get(surface, ()):
                rs = stem(rel)
                if rs in self.postings and rs not in terms:
                    w = TIER_WEIGHT["related"] if missing else TIER_WEIGHT["related_extra"]
                    terms[rs] = (w, rel, surface, "related")
                    notes.append({"kind": "related", "from": surface, "to": rel})
            if missing:  # WordNet only fills gaps: it is too broad for words we already match
                for rs in self.wordnet.get(st, [])[:3]:
                    if rs in self.postings and rs not in terms:
                        shown = self.surface.get(rs, rs)
                        terms[rs] = (TIER_WEIGHT["wordnet"], shown, surface, "wordnet")
                        notes.append({"kind": "wordnet", "from": surface, "to": shown})
        return terms, notes

    def search(self, query: str, limit: int = 10, facets: Facets | None = None,
               books: list[dict] | None = None) -> tuple[list[StoryHit], list[dict], list[str]]:
        """Ranked hits, the expansion notes, and the direct query words used."""
        q_terms, notes = self.expand(query)
        allowed = None
        if facets is not None and facets.active() and books is not None:
            allowed = facets

        scores: dict[int, float] = defaultdict(float)
        reasons: dict[int, list[MatchReason]] = defaultdict(list)
        matched: dict[int, list[str]] = defaultdict(list)
        for term, (qw, surface, related_to, tier) in q_terms.items():
            plist = self.postings.get(term)
            if not plist:
                continue
            idf = self._idf(term)
            for book_id, ftf in plist.items():
                if allowed is not None and not allowed.allows(books[book_id]):
                    continue
                doc = self.docs[book_id]
                wtf = sum(FIELD_WEIGHTS[f] * tf for f, tf in ftf.items())
                norm = K1 * (1 - B + B * doc.length / self.avg_len)
                scores[book_id] += qw * idf * (wtf * (K1 + 1)) / (wtf + norm)
                matched[book_id].append(surface)
                best = max(ftf, key=lambda f: FIELD_WEIGHTS[f])
                reasons[book_id].append(
                    MatchReason(surface, FIELD_LABELS[best], self._context(book_id, best, term), related_to, tier)
                )

        direct_terms = sum(1 for v in q_terms.values() if v[3] == "direct") or 1
        hits = []
        for book_id, sc in scores.items():
            covered = {r.related_to or r.term for r in reasons[book_id]}
            # Books that match more of the reader's words rank higher, quadratically.
            sc *= (1 + len(covered) / direct_terms) ** 2 * self.popularity.get(book_id, 1.0)
            hits.append(StoryHit(book_id, round(sc, 4), reasons[book_id], matched[book_id]))
        hits.sort(key=lambda h: (-h.score, h.book_id))
        used = [v[1] for v in q_terms.values() if v[3] == "direct"]
        return hits[: limit * 3], notes, used
