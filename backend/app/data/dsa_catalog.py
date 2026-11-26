"""The original constrained DSA test catalog, kept separate from the rich catalog.

Constraints from the problem statement:
  * at most 1,000 names, fixed insertion order, no live insertions
  * each name is a single lowercase word (a-z) of length 1..8
  * at most 2,000 queries

The catalog is generated deterministically (fixed seed) so every run, test
and benchmark sees the same data. It mixes real one-word book titles that fit
the constraints with generated syllable names, and deliberately repeats some
names so duplicate records and latest-match behaviour can be demonstrated.
"""

from __future__ import annotations

import random
import re

MAX_NAMES = 1000
MAX_LEN = 8
MAX_QUERIES = 2000

_NAME_RE = re.compile(r"^[a-z]{1,8}$")

# Real one-word titles that satisfy the constraints (lowercased).
SEED_TITLES = [
    "emma", "dracula", "rebecca", "beloved", "ulysses", "hamlet", "macbeth", "othello",
    "dune", "carrie", "matilda", "holes", "wonder", "coraline", "heidi", "ivanhoe",
    "walden", "candide", "beowulf", "kim", "she", "it", "room", "speak", "nausea",
    "sula", "jazz", "paradise", "shogun",
]

_SYLLABLES = [
    "an", "ar", "be", "ca", "da", "el", "em", "fa", "ha", "in", "ka", "la", "li", "ma",
    "mo", "na", "ne", "or", "ra", "ri", "sa", "se", "ta", "ti", "to", "va", "wo", "ze",
]


class CatalogConstraintError(ValueError):
    pass


def validate_names(names: list[str]) -> None:
    """Raise CatalogConstraintError if the list breaks the original constraints."""
    if not names:
        raise CatalogConstraintError("catalog must contain at least one name")
    if len(names) > MAX_NAMES:
        raise CatalogConstraintError(f"catalog has {len(names)} names; maximum is {MAX_NAMES}")
    for i, name in enumerate(names):
        if not _NAME_RE.match(name):
            raise CatalogConstraintError(
                f"name {i} {name!r} must be a single lowercase word of length 1..{MAX_LEN}"
            )


def generate_dsa_names(size: int = MAX_NAMES, seed: int = 2026) -> list[str]:
    """Deterministic constrained catalog with duplicates and shared affixes."""
    if not 1 <= size <= MAX_NAMES:
        raise CatalogConstraintError(f"size must be 1..{MAX_NAMES}")
    rng = random.Random(seed)
    names: list[str] = []
    for i in range(size):
        if i < len(SEED_TITLES):
            names.append(SEED_TITLES[i])
        elif i % 25 == 0:
            names.append(names[rng.randrange(len(names))])  # deliberate duplicate
        else:
            word = ""
            for _ in range(rng.randint(1, 4)):
                word += rng.choice(_SYLLABLES)
            names.append(word[: rng.randint(1, MAX_LEN)] if len(word) > MAX_LEN else word)
    validate_names(names)
    return names
