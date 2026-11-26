"""ctypes binding to the C search engine (engine/build/libtitlesearch.so).

TitleEngine owns one TSIndex. Titles are added in insertion order, then the
indexes are built exactly once; every later query reuses them.
"""

from __future__ import annotations

import ctypes
import os
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path

TS_NO_MATCH = -1
TS_INVALID = -2
TS_BUILT = -3
TS_MAX_TITLE = 256

_ROOT = Path(__file__).resolve().parents[3]
_LIBNAME = "libtitlesearch.dylib" if sys.platform == "darwin" else "libtitlesearch.so"


def _load() -> ctypes.CDLL:
    path = os.environ.get("TITLESEARCH_LIB") or str(_ROOT / "engine" / "build" / _LIBNAME)
    if not Path(path).exists():
        raise RuntimeError(
            f"C engine not found at {path}. Build it first: `make -C engine` "
            "(or set TITLESEARCH_LIB)."
        )
    lib = ctypes.CDLL(path)
    P, I, L, S = ctypes.c_void_p, ctypes.c_int, ctypes.c_long, ctypes.c_char_p
    IP = ctypes.POINTER(ctypes.c_int)
    SA = ctypes.POINTER(ctypes.c_char_p)
    sigs = {
        "ts_create": ([], P),
        "ts_create_ex": ([I], P),
        "ts_last_path": ([P], I),
        "ts_max_affix": ([P], I),
        "ts_bench_hash": ([P, SA, SA, I, IP, ctypes.POINTER(ctypes.c_double), ctypes.POINTER(ctypes.c_long)],
                          ctypes.c_double),
        "ts_destroy": ([P], None),
        "ts_add": ([P, S], I),
        "ts_build": ([P], I),
        "ts_is_built": ([P], I),
        "ts_size": ([P], I),
        "ts_title": ([P, I], S),
        "ts_normalize": ([S, S, I], I),
        "ts_query": ([P, S, S], I),
        "ts_query_linear": ([P, S, S], I),
        "ts_multi": ([P, S, SA, I, S, IP, I, IP], I),
        "ts_multi_linear": ([P, S, SA, I, S, IP, I, IP], I),
        "ts_prefix_ids": ([P, S, IP, I], I),
        "ts_suffix_ids": ([P, S, IP, I], I),
        "ts_longest_prefix": ([P, S], I),
        "ts_longest_suffix": ([P, S], I),
        "ts_fuzzy": ([P, S, I, I, I, S, I], I),
        "ts_bench_exact": ([P, SA, SA, I, I, IP], ctypes.c_double),
        "ts_bench_multi": ([P, SA, SA, SA, I, I, IP], ctypes.c_double),
    }
    for name in ("ts_ps_nodes", "ts_ps_keys", "ts_ps_combinations", "ts_ps_distinct",
                 "ts_aux_nodes", "ts_ngram_keys", "ts_memory_bytes", "ts_build_count",
                 "ts_query_count"):
        sigs[name] = ([P], L)
    for name, (args, res) in sigs.items():
        fn = getattr(lib, name)
        fn.argtypes = args
        fn.restype = res
    return lib


_lib: ctypes.CDLL | None = None


def lib() -> ctypes.CDLL:
    global _lib
    if _lib is None:
        _lib = _load()
    return _lib


def _b(s: str | None) -> bytes:
    return (s or "").encode("utf-8")


def normalize(text: str | None) -> str:
    buf = ctypes.create_string_buffer(TS_MAX_TITLE)
    lib().ts_normalize(_b(text), buf, TS_MAX_TITLE)
    return buf.value.decode("ascii")


@dataclass
class MultiResult:
    total: int
    ids: list[int]
    examined: int


@dataclass
class FuzzyVariant:
    text: str
    count: int
    distance: int


class TitleEngine:
    """One fixed catalog of titles + its C indexes."""

    def __init__(self, name: str, titles: list[str], max_affix: int = 0):
        self.name = name
        self.lock = threading.Lock()  # the C index is single-threaded
        self._lib = lib()
        self._idx = self._lib.ts_create_ex(max_affix)
        for i, t in enumerate(titles):
            rid = self._lib.ts_add(self._idx, _b(t))
            if rid != i:
                raise ValueError(f"title {i} {t!r} could not be indexed (code {rid})")
        start = time.perf_counter()
        if self._lib.ts_build(self._idx) != 0:
            raise RuntimeError("index build failed")
        self.build_ms = (time.perf_counter() - start) * 1000.0
        self.size = len(titles)

    def __del__(self):  # pragma: no cover - interpreter shutdown order varies
        try:
            if getattr(self, "_idx", None):
                self._lib.ts_destroy(self._idx)
                self._idx = None
        except Exception:
            pass

    # -- exact ---------------------------------------------------------
    def query(self, prefix: str, suffix: str) -> int:
        return self._lib.ts_query(self._idx, _b(prefix), _b(suffix))

    def last_path(self) -> str:
        """Which structure answered the last query()."""
        return "affix-intersection" if self._lib.ts_last_path(self._idx) == 1 else "prefix-suffix-trie"

    @property
    def max_affix(self) -> int:
        return self._lib.ts_max_affix(self._idx)

    def query_linear(self, prefix: str, suffix: str) -> int:
        return self._lib.ts_query_linear(self._idx, _b(prefix), _b(suffix))

    # -- multi-clue ----------------------------------------------------
    def _multi(self, fn, prefix, contains, suffix, cap) -> MultiResult:
        cap = max(1, min(cap, self.size))
        arr = (ctypes.c_char_p * max(1, len(contains)))(*[_b(c) for c in contains])
        out = (ctypes.c_int * cap)()
        examined = ctypes.c_int(0)
        total = fn(self._idx, _b(prefix), arr, len(contains), _b(suffix), out, cap,
                   ctypes.byref(examined))
        if total < 0:
            return MultiResult(total, [], 0)
        return MultiResult(total, list(out[: min(total, cap)]), examined.value)

    def multi(self, prefix: str, contains: list[str], suffix: str, cap: int = 10_000) -> MultiResult:
        return self._multi(self._lib.ts_multi, prefix, contains, suffix, cap)

    def multi_linear(self, prefix: str, contains: list[str], suffix: str,
                     cap: int = 10_000) -> MultiResult:
        return self._multi(self._lib.ts_multi_linear, prefix, contains, suffix, cap)

    # -- helpers for suggestions ----------------------------------------
    def prefix_ids(self, prefix: str, cap: int = 50) -> tuple[int, list[int]]:
        out = (ctypes.c_int * cap)()
        total = self._lib.ts_prefix_ids(self._idx, _b(prefix), out, cap)
        return (max(total, 0), list(out[: max(0, min(total, cap))]))

    def suffix_ids(self, suffix: str, cap: int = 50) -> tuple[int, list[int]]:
        out = (ctypes.c_int * cap)()
        total = self._lib.ts_suffix_ids(self._idx, _b(suffix), out, cap)
        return (max(total, 0), list(out[: max(0, min(total, cap))]))

    def longest_prefix(self, prefix: str) -> int:
        return self._lib.ts_longest_prefix(self._idx, _b(prefix))

    def longest_suffix(self, suffix: str) -> int:
        return self._lib.ts_longest_suffix(self._idx, _b(suffix))

    def fuzzy(self, clue: str, is_suffix: bool, maxdist: int = 1, limit: int = 8) -> list[FuzzyVariant]:
        buf = ctypes.create_string_buffer(16_384)
        n = self._lib.ts_fuzzy(self._idx, _b(clue), int(is_suffix), maxdist, limit, buf, len(buf))
        res: list[FuzzyVariant] = []
        if n <= 0:
            return res
        for line in buf.value.decode("ascii").splitlines():
            text, count, dist = line.split("\t")
            res.append(FuzzyVariant(text, int(count), int(dist)))
        return res

    # -- benchmarks (timed inside C) ------------------------------------
    def bench_exact(self, pairs: list[tuple[str, str]], linear: bool) -> tuple[float, list[int]]:
        n = len(pairs)
        P = (ctypes.c_char_p * max(1, n))(*[_b(p) for p, _ in pairs])
        S = (ctypes.c_char_p * max(1, n))(*[_b(s) for _, s in pairs])
        out = (ctypes.c_int * max(1, n))()
        ns = self._lib.ts_bench_exact(self._idx, P, S, n, int(linear), out)
        return ns, list(out[:n])

    def bench_multi(self, triples: list[tuple[str, str, str]], linear: bool) -> tuple[float, list[int]]:
        n = len(triples)
        P = (ctypes.c_char_p * max(1, n))(*[_b(t[0]) for t in triples])
        C = (ctypes.c_char_p * max(1, n))(*[_b(t[1]) for t in triples])
        S = (ctypes.c_char_p * max(1, n))(*[_b(t[2]) for t in triples])
        out = (ctypes.c_int * max(1, n))()
        ns = self._lib.ts_bench_multi(self._idx, P, C, S, n, int(linear), out)
        return ns, list(out[:n])

    def bench_hash(self, pairs: list[tuple[str, str]]) -> dict | None:
        """Hash-map-of-all-pairs baseline; None when the index has an affix cap."""
        n = len(pairs)
        P = (ctypes.c_char_p * max(1, n))(*[_b(p) for p, _ in pairs])
        S = (ctypes.c_char_p * max(1, n))(*[_b(s) for _, s in pairs])
        out = (ctypes.c_int * max(1, n))()
        build = ctypes.c_double(0)
        nbytes = ctypes.c_long(0)
        ns = self._lib.ts_bench_hash(self._idx, P, S, n, out, ctypes.byref(build), ctypes.byref(nbytes))
        if ns < 0:
            return None
        return {"query_ns": ns, "build_ns": build.value, "bytes": nbytes.value, "out": list(out[:n])}

    def title(self, rid: int) -> str:
        v = self._lib.ts_title(self._idx, rid)
        return v.decode("ascii") if v else ""

    # -- stats -----------------------------------------------------------
    def stats(self) -> dict:
        L = self._lib
        i = self._idx
        return {
            "name": self.name,
            "records": self.size,
            "max_affix": L.ts_max_affix(i),
            "build_ms": round(self.build_ms, 4),
            "build_count": L.ts_build_count(i),
            "indexed_queries": L.ts_query_count(i),
            "ps_trie_nodes": L.ts_ps_nodes(i),
            "combined_keys": L.ts_ps_keys(i),
            "prefix_suffix_combinations": L.ts_ps_combinations(i),
            "distinct_combinations": L.ts_ps_distinct(i),
            "affix_trie_nodes": L.ts_aux_nodes(i),
            "ngram_keys": L.ts_ngram_keys(i),
            "memory_bytes": L.ts_memory_bytes(i),
        }
