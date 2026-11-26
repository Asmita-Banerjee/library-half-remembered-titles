"""The C engine through its Python binding: prefix-suffix Trie semantics."""

import random

import pytest

from app.core.engine import TS_INVALID, TS_NO_MATCH, TitleEngine, normalize
from app.data.dsa_catalog import (MAX_LEN, MAX_NAMES, MAX_QUERIES, CatalogConstraintError,
                                  generate_dsa_names, validate_names)


def brute_latest(words, p, s):
    for i in range(len(words) - 1, -1, -1):
        if words[i].startswith(p) and words[i].endswith(s):
            return i
    return -1


def test_prefix_suffix_matching():
    e = TitleEngine("t", ["apple", "apply", "ample", "maple"])
    assert e.query("app", "le") == 0
    assert e.query("app", "y") == 1
    assert e.query("m", "e") == 3
    assert e.query("apple", "apple") == 0


def test_latest_matching_id():
    e = TitleEngine("t", ["apple", "apply", "ample", "maple"])
    assert e.query("a", "e") == 2  # apple (0) and ample (2) match; latest wins


def test_duplicate_titles_are_separate_records():
    words = ["emma", "dune", "emma", "emma"]
    e = TitleEngine("t", words)
    assert e.size == 4
    assert e.query("em", "ma") == 3
    r = e.multi("emma", [], "emma")
    assert r.total == 3 and r.ids == [3, 2, 0]


def test_no_match_and_empty_inputs():
    e = TitleEngine("t", ["rebecca"])
    assert e.query("x", "a") == TS_NO_MATCH
    assert e.query("rebeccax", "a") == TS_NO_MATCH
    assert e.query("", "a") == TS_INVALID
    assert e.query("r", "   ") == TS_INVALID
    assert e.multi("", [], "").total == TS_INVALID


def test_prefix_and_suffix_may_overlap():
    e = TitleEngine("t", ["abc"])
    assert e.query("ab", "bc") == 0
    assert e.query("abc", "abc") == 0
    assert e.query("abcd", "c") == TS_NO_MATCH


def test_normalisation_is_case_and_punctuation_insensitive():
    assert normalize("  The Lion, the  Witch!  ") == "the lion the witch"
    e = TitleEngine("t", ["The Lion, the Witch and the Wardrobe"])
    assert e.query("THE LION", "Wardrobe") == 0


def test_index_built_once_and_reused():
    e = TitleEngine("t", ["hamlet", "macbeth"])
    for _ in range(250):
        assert e.query("mac", "beth") == 1
    st = e.stats()
    assert st["build_count"] == 1
    assert st["indexed_queries"] == 250


def test_combination_counts():
    e = TitleEngine("t", ["abc", "de"])
    st = e.stats()
    assert st["combined_keys"] == 3 + 2  # one "suffix|word" key per suffix
    assert st["prefix_suffix_combinations"] == 9 + 4  # L*L pairs


def test_maximum_catalog_size_and_title_length():
    names = generate_dsa_names(MAX_NAMES)
    assert len(names) == MAX_NAMES
    assert max(map(len, names)) == MAX_LEN
    validate_names(names)
    e = TitleEngine("max", names)
    rng = random.Random(3)
    for _ in range(MAX_QUERIES):
        w = names[rng.randrange(len(names))]
        p = w[: rng.randint(1, len(w))]
        s = w[len(w) - rng.randint(1, len(w)):]
        if rng.random() < 0.3:
            p = "q" + p
        assert e.query(p, s) == brute_latest(names, p, s)
    assert e.stats()["build_count"] == 1


def test_constraints_are_enforced():
    with pytest.raises(CatalogConstraintError):
        validate_names(["toolongname"])
    with pytest.raises(CatalogConstraintError):
        validate_names(["Upper"])
    with pytest.raises(CatalogConstraintError):
        validate_names(["a"] * (MAX_NAMES + 1))
    with pytest.raises(CatalogConstraintError):
        validate_names(["two words"])


def test_indexed_and_linear_agree():
    names = generate_dsa_names()
    e = TitleEngine("agree", names)
    from app.services.performance import make_queries
    qs = make_queries(names, 2000)
    _, a = e.bench_exact(qs, linear=False)
    _, b = e.bench_exact(qs, linear=True)
    assert a == b
