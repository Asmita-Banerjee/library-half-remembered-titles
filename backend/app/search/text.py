"""Tokenising helpers shared by the story and author indexes."""

from __future__ import annotations

import re
import unicodedata

_TOKEN_RE = re.compile(r"[a-z0-9]+")

STOPWORDS = frozenset(
    """a about after again all also an and any are as at be been before being but by can
    could did do does doing for from had has have having he her here hers him his how i if
    in into is it its just me more most my no nor not of off on once only or other our out
    over own same she should so some such than that the their them then there these they
    this those through to too under until up very was we were what when where which while
    who whom why will with would you your book story novel about someone somebody one
    who's whose wears wear wearing""".split()
)

# Small, explicit query-expansion table (surface words; stemmed at use).
# Expanded terms are scored at a lower weight and every use is reported to the
# user as a "related term" reason, never as a direct match.
RELATED_TERMS: dict[str, tuple[str, ...]] = {
    "hat": ("cap",),
    "cap": ("hat",),
    "sleuth": ("detective",),
    "investigator": ("detective",),
    "murder": ("killed", "stabbed", "poisoned"),
    "killer": ("murder",),
    "ghost": ("spirits",),
    "boat": ("ship", "steamer"),
    "ship": ("boat",),
    "wizard": ("magic",),
    "witch": ("magic",),
    "robot": ("android",),
    "alien": ("martians",),
    "aliens": ("martians",),
    "monster": ("creature",),
    "creature": ("monster",),
    "space": ("galaxy",),
    "galaxy": ("space",),
    "dystopia": ("dystopian", "totalitarianism", "surveillance"),
    "kid": ("boy", "child"),
    "girl": ("daughter", "sister"),
    "bloodsucker": ("vampire",),
    "vampyre": ("vampire",),
    "corpse": ("dead", "bodies"),
    "corpses": ("dead", "bodies"),
    "closet": ("wardrobe",),
    "spaceship": ("space",),
    "teenager": ("teen", "young"),
    "wizards": ("magic", "wizard"),
}


_WORDNET: dict[str, list[str]] | None = None


def wordnet_aliases() -> dict[str, list[str]]:
    """Precomputed WordNet table: stemmed alias -> stemmed catalogue terms."""
    global _WORDNET
    if _WORDNET is None:
        import gzip
        import json
        from pathlib import Path
        path = Path(__file__).resolve().parents[1] / "data" / "wordnet_related.json.gz"
        try:
            with gzip.open(path, "rt", encoding="utf-8") as f:
                _WORDNET = json.load(f)["aliases"]
        except FileNotFoundError:
            _WORDNET = {}
    return _WORDNET


def fold(text: str) -> str:
    """Lowercase and strip accents (Brontë -> bronte)."""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch)).replace("'s", "")


def stem(word: str) -> str:
    """Deliberately light suffix stripping (no external NLP dependency).

    mystery / mysteries / mysterious -> myster, detective(s) -> detectiv,
    solve / solves / solved -> solv.
    """
    for suffix, min_len in (("ious", 7), ("ies", 5), ("ing", 6), ("ed", 5),
                            ("es", 5), ("ly", 5), ("s", 4), ("e", 5), ("y", 5)):
        if len(word) >= min_len and word.endswith(suffix):
            return word[: -len(suffix)]
    return word


def tokenize(text: str, keep_stopwords: bool = False) -> list[tuple[str, str]]:
    """Return (stem, surface word) pairs."""
    out = []
    for w in _TOKEN_RE.findall(fold(text)):
        if not keep_stopwords and (w in STOPWORDS or len(w) < 2):
            continue
        out.append((stem(w), w))
    return out
