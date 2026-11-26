"""Performance statistics, linear-vs-indexed benchmarks and live self-checks.

All timings are real measurements. Benchmark loops run inside the C engine
(ts_bench_exact / ts_bench_multi) so the Python binding's overhead is not
mixed into the comparison.
"""

from __future__ import annotations

import random
import time

from .. import db
from ..core.engine import TitleEngine
from ..data.dsa_catalog import MAX_LEN, MAX_NAMES, MAX_QUERIES, generate_dsa_names
from .state import LibraryState


def overview(state: LibraryState) -> dict:
    stats = db.get_search_stats()
    success = sum(s["success"] for s in stats)
    failure = sum(s["failure"] for s in stats)
    return {
        "catalog_records": len(state.books),
        "dsa_records": len(state.dsa_names),
        "indexed_records": state.library_engine.size + state.dsa_engine.size,
        "total_searches": success + failure,
        "successful_searches": success,
        "failed_searches": failure,
        "authors": len(state.authors.names),
        "genres": len({b["genre"] for b in state.books}),
    }


def performance(state: LibraryState) -> dict:
    by_type = []
    for s in db.get_search_stats():
        n = s["success"] + s["failure"]
        by_type.append(s | {"count": n, "avg_ms": round(s["total_ms"] / n, 4) if n else 0})
    return {
        "engines": [state.library_engine.stats(), state.dsa_engine.stats()],
        "build_times_ms": {k: round(v, 4) for k, v in state.build_times_ms.items()},
        "story_index": {"documents": state.story.n_docs, "vocabulary": state.story.vocabulary_size},
        "searches": by_type,
        "overview": overview(state),
    }


def make_queries(titles: list[str], n: int, seed: int = 7, max_affix: int = 10) -> list[tuple[str, str]]:
    """Deterministic mix: ~70% clues taken from real titles, ~30% random misses."""
    rng = random.Random(seed)
    qs = []
    letters = "abcdefghijklmnopqrstuvwxyz"
    for i in range(n):
        if i % 10 < 7:
            t = titles[rng.randrange(len(titles))]
            L = len(t)
            qs.append((t[: rng.randint(1, min(L, max_affix))], t[L - rng.randint(1, min(L, max_affix)):]))
        else:
            qs.append(("".join(rng.choice(letters) for _ in range(rng.randint(1, 4))),
                       "".join(rng.choice(letters) for _ in range(rng.randint(1, 4)))))
    return qs


REPEATS = 5


def _best(fn, *args):
    """Run a timed batch REPEATS times and keep the fastest (least disturbed) run."""
    best_ns, out = float("inf"), []
    for _ in range(REPEATS):
        ns, res = fn(*args)
        if ns < best_ns:
            best_ns, out = ns, res
    return best_ns, out


def _bench_engine(eng: TitleEngine, titles: list[str], n: int) -> dict:
    qs = make_queries(titles, n)
    rng = random.Random(11)
    triples = []
    for p, _ in qs:
        t = titles[rng.randrange(len(titles))]
        mid = t[len(t) // 3: len(t) // 3 + 2] if len(t) > 3 else ""
        triples.append((p[:2], mid, ""))
    with eng.lock:
        idx_ns, idx_out = _best(eng.bench_exact, qs, False)
        lin_ns, lin_out = _best(eng.bench_exact, qs, True)
        midx_ns, midx_out = _best(eng.bench_multi, triples, False)
        mlin_ns, mlin_out = _best(eng.bench_multi, triples, True)
    hits = sum(1 for r in idx_out if r >= 0)
    return {
        "dataset": eng.name,
        "catalog_size": eng.size,
        "queries": n,
        "hits": hits,
        "misses": n - hits,
        "exact": {
            "indexed_total_ms": round(idx_ns / 1e6, 4),
            "linear_total_ms": round(lin_ns / 1e6, 4),
            "indexed_avg_us": round(idx_ns / 1e3 / max(1, n), 4),
            "linear_avg_us": round(lin_ns / 1e3 / max(1, n), 4),
            "speedup": round(lin_ns / idx_ns, 2) if idx_ns > 0 else None,
            "results_agree": idx_out == lin_out,
        },
        "multi": {
            "indexed_total_ms": round(midx_ns / 1e6, 4),
            "linear_total_ms": round(mlin_ns / 1e6, 4),
            "speedup": round(mlin_ns / midx_ns, 2) if midx_ns > 0 else None,
            "results_agree": midx_out == mlin_out,
        },
    }


def benchmark(state: LibraryState, dataset: str, n: int = MAX_QUERIES) -> dict:
    eng = state.engine(dataset)
    titles = state.dsa_names if dataset == "dsa" else [b["normalized_title"] for b in state.books]
    t0 = time.perf_counter()
    out = _bench_engine(eng, titles, n)
    out["wall_ms"] = round((time.perf_counter() - t0) * 1000, 3)
    out["note"] = f"Timed inside the C engine with CLOCK_MONOTONIC (best of {REPEATS} runs); both methods answer the same queries."
    return out


def scaling(n_queries: int = MAX_QUERIES, sizes: tuple[int, ...] = (125, 250, 500, 750, 1000)) -> dict:
    """Build temporary indexes over growing prefixes of the DSA catalog."""
    names = generate_dsa_names(MAX_NAMES)
    rows = []
    for size in sizes:
        sub = names[:size]
        eng = TitleEngine(f"dsa-{size}", sub)
        b = _bench_engine(eng, sub, n_queries)
        st = eng.stats()
        rows.append({
            "catalog_size": size,
            "build_ms": round(eng.build_ms, 4),
            "trie_nodes": st["ps_trie_nodes"],
            "combinations": st["prefix_suffix_combinations"],
            "indexed_avg_us": b["exact"]["indexed_avg_us"],
            "linear_avg_us": b["exact"]["linear_avg_us"],
            "speedup": b["exact"]["speedup"],
            "results_agree": b["exact"]["results_agree"],
        })
        del eng
    return {"queries_per_size": n_queries, "rows": rows}


def self_check(state: LibraryState) -> dict:
    """Live scenario checks against the running indexes."""
    checks = []

    def add(name: str, passed: bool, detail: str) -> None:
        checks.append({"name": name, "passed": bool(passed), "detail": detail})

    dsa, lib = state.dsa_engine, state.library_engine
    names = state.dsa_names
    with dsa.lock, lib.lock:
        # Duplicates
        seen: dict[str, list[int]] = {}
        for i, n in enumerate(names):
            seen.setdefault(n, []).append(i)
        dup_name, dup_ids = next(((k, v) for k, v in seen.items() if len(v) > 1), ("", []))
        r = dsa.query(dup_name, dup_name) if dup_name else -1
        add("Duplicate titles kept as separate records",
            bool(dup_ids) and r == dup_ids[-1] and dsa.multi(dup_name, [], dup_name).total >= len(dup_ids),
            f"'{dup_name}' stored at ids {dup_ids}; exact search returns latest id {r}.")
        fr = lib.multi("frankenstein", [], "frankenstein")
        add("Duplicate book records (library)", fr.total == 2 and lib.query("frank", "stein") == fr.ids[0],
            f"'Frankenstein' records {fr.ids} (newest first); exact search returns {lib.query('frank', 'stein')}.")
        # Ambiguity
        amb = lib.multi("the", [], "e", cap=50)
        latest = lib.query("the", "e")
        add("Ambiguous clues return the latest inserted match",
            amb.total >= 2 and latest == amb.ids[0],
            f"{amb.total} titles begin with 'the' and end with 'e' (ids {amb.ids}); "
            f"exact search returns the latest, id {latest}.")
        # No match
        nm = lib.query("zzq", "qqz")
        add("No-match returns -1", nm == -1, f"query('zzq','qqz') = {nm}")
        add("Empty clue rejected", lib.query("", "a") == -2 and dsa.query("a", "") == -2,
            "Empty prefix or suffix -> TS_INVALID (-2).")
        # Repeated queries reuse the index
        before = dsa.stats()["build_count"]
        res = {dsa.query("ma", "a") for _ in range(500)}
        after = dsa.stats()
        add("Repeated queries reuse the index", len(res) == 1 and after["build_count"] == before == 1,
            f"500 identical queries -> {res}; index built {after['build_count']} time(s), "
            f"{after['indexed_queries']} indexed queries served so far.")
        # Maximum catalog size and title length
        add("Maximum catalog size and title length",
            len(names) == MAX_NAMES and max(map(len, names)) <= MAX_LEN and all(n.isalpha() and n.islower() for n in names),
            f"{len(names)} names (max {MAX_NAMES}); longest = {max(map(len, names))} (max {MAX_LEN}).")
    # Maximum query count, indexed vs linear agreement
    b = _bench_engine(dsa, names, MAX_QUERIES)
    add("2,000 queries: indexed answers equal linear scan", b["exact"]["results_agree"] and b["multi"]["results_agree"],
        f"{b['queries']} queries, {b['hits']} hits; indexed {b['exact']['indexed_total_ms']} ms vs "
        f"linear {b['exact']['linear_total_ms']} ms.")
    return {"passed": sum(c["passed"] for c in checks), "total": len(checks), "checks": checks}
