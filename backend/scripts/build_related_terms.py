"""Precompute WordNet synonyms for the story-search vocabulary.

    pip install nltk   # plus the WordNet 3.0 corpus (corpora/wordnet.zip in nltk_data)
    python scripts/build_related_terms.py

For every word that appears in the indexed book metadata, collect the
single-word lemmas of its first WordNet synsets. The output inverts that
relation: alias -> [indexed words it can stand for], so a query word that is
NOT in the catalogue ("closet") can still reach one that is ("wardrobe").
Writes app/data/wordnet_related.json.gz. WordNet 3.0 (c) Princeton
University, used under the WordNet licence (see app/data/WORDNET_LICENSE).
"""

from __future__ import annotations

import gzip
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from nltk.corpus import wordnet as wn  # noqa: E402

from app.data.books import BOOKS  # noqa: E402
from app.db import read_goodbooks  # noqa: E402
from app.search.text import STOPWORDS, stem  # noqa: E402

OUT = ROOT / "app" / "data" / "wordnet_related.json.gz"
WORD = re.compile(r"[a-z]+")
MAX_SYNSETS = 3
MAX_TARGETS = 4


def vocabulary() -> set[str]:
    texts = []
    for b in BOOKS:
        texts += [b["title"], b["genre"], b["plot"], *b["themes"], *b["settings"]]
        texts += [c["description"] for c in b["characters"]]
    for r in read_goodbooks():
        texts += [r["title"], r["genre"], r["tags"].replace("|", " ").replace("-", " ")]
    words = set()
    for t in texts:
        words.update(w for w in WORD.findall(t.lower()) if len(w) >= 3 and w not in STOPWORDS)
    return words


def main() -> None:
    vocab = vocabulary()
    related: dict[str, set[str]] = defaultdict(set)
    for w in sorted(vocab):
        target = stem(w)
        for syn in wn.synsets(w)[:MAX_SYNSETS]:
            for lemma in syn.lemma_names():
                a = lemma.lower()
                if not a.isalpha() or a == w or a in STOPWORDS or len(a) < 3:
                    continue
                sa = stem(a)
                if sa == target:
                    continue
                related[sa].add(target)
    table = {k: sorted(v)[:MAX_TARGETS] for k, v in sorted(related.items())}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8") as f:
        json.dump({"source": "WordNet 3.0", "aliases": table}, f, separators=(",", ":"))
    print(f"{len(vocab)} vocabulary words -> {len(table)} aliases written to {OUT}")


if __name__ == "__main__":
    main()
