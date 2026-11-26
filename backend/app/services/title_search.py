"""Title-based retrieval: exact prefix+suffix, multi-clue, live and refinement.

Which algorithm serves which request (reported back in every response):
  * basic   -> prefix-suffix Trie lookup, O(|p| + |s|), latest id only
  * multi   -> posting-list intersection over the prefix Trie, suffix Trie
               and n-gram index, then verification of surviving candidates
  * live    -> the same multi-clue engine, capped to a few results
  * refine  -> Trie walks (longest existing affix), Trie + Levenshtein
               search for near-miss clues, and affixes of partial matches;
               every suggestion is re-checked against the index.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from .. import db
from ..core.engine import normalize
from ..search.story_index import Facets
from ..search.vocab_fuzzy import typo_budget
from .state import LibraryState


class ClueError(ValueError):
    def __init__(self, message: str, field: str | None = None):
        super().__init__(message)
        self.field = field


ALGO_BASIC = "Prefix-suffix Trie lookup (C engine): one walk of 'suffix|prefix', O(|p|+|s|)"
ALGO_BASIC_LONG = ("Prefix-Trie and suffix-Trie id lists intersected from the newest end (C engine), "
                   "used because a clue is longer than the {cap}-character Trie depth; no title is scanned")
ALGO_MULTI = ("Indexed candidate intersection (C engine): prefix Trie + suffix Trie + n-gram "
              "postings, smallest list first, then verification of survivors only")


def _ms(t0: float) -> float:
    return round((time.perf_counter() - t0) * 1000, 4)


def _spans(title: str, prefix: str, contains: list[str], suffix: str) -> list[dict]:
    spans = []
    if prefix:
        spans.append({"type": "prefix", "value": prefix, "start": 0, "end": len(prefix)})
    for c in contains:
        i = title.find(c)
        spans.append({"type": "contains", "value": c, "start": i, "end": i + len(c)})
    if suffix:
        spans.append({"type": "suffix", "value": suffix, "start": len(title) - len(suffix), "end": len(title)})
    return spans


# --------------------------------------------------------------------------
# Basic prefix + suffix
# --------------------------------------------------------------------------

def basic_search(state: LibraryState, dataset: str, prefix: str, suffix: str, record: bool = True) -> dict:
    p, s = normalize(prefix), normalize(suffix)
    if not p and not s:
        raise ClueError("Enter both the beginning and the ending of the title.", "both")
    if not p:
        raise ClueError("Enter the beginning (prefix) of the title.", "prefix")
    if not s:
        raise ClueError("Enter the ending (suffix) of the title.", "suffix")
    eng = state.engine(dataset)
    t0 = time.perf_counter()
    with eng.lock:
        rid = eng.query(p, s)
        path = eng.last_path()
    elapsed = _ms(t0)
    # Ambiguity report: how many records share these clues (multi-clue engine).
    with eng.lock:
        total = eng.multi(p, [], s, cap=1).total if rid >= 0 else 0
    out = {
        "dataset": dataset,
        "clues": {"prefix": prefix, "suffix": suffix},
        "normalized": {"prefix": p, "suffix": s},
        "status": "match" if rid >= 0 else "no_match",
        "record": state.record(dataset, rid) if rid >= 0 else None,
        "matching_records": total,
        "elapsed_ms": elapsed,
        "algorithm": ALGO_BASIC if path == "prefix-suffix-trie" else ALGO_BASIC_LONG.format(cap=eng.max_affix),
        "index_path": path,
        "search_id": None,
        "message": (
            f"Latest inserted of {total} matching record{'s' if total != 1 else ''}."
            if rid >= 0 else f"No title begins with '{p}' and ends with '{s}'."
        ),
    }
    if record:
        summary = f"#{rid} {out['record']['title']}" if rid >= 0 else "No match"
        out["search_id"] = db.record_search("basic", dataset, {"prefix": prefix, "suffix": suffix}, summary,
                                            1 if rid >= 0 else 0, "success" if rid >= 0 else "no_match", elapsed)
    return out


# --------------------------------------------------------------------------
# Multi-clue
# --------------------------------------------------------------------------

def _clean_contains(contains: list[str]) -> list[str]:
    return [c for c in (normalize(x) for x in contains) if c]


def multi_search(state: LibraryState, dataset: str, prefix: str, contains: list[str], suffix: str,
                 limit: int = 200, record: bool = True, kind: str = "multi",
                 facets: Facets | None = None) -> dict:
    p, s = normalize(prefix), normalize(suffix)
    cs = _clean_contains(contains)
    if not p and not s and not cs:
        raise ClueError("Add at least one non-empty clue.", "clues")
    if len(cs) > 8:
        raise ClueError("Use at most 8 'contains' clues.", "contains")
    eng = state.engine(dataset)
    use_facets = facets is not None and facets.active() and dataset == "library"
    t0 = time.perf_counter()
    with eng.lock:
        res = eng.multi(p, cs, s, cap=eng.size if use_facets else limit)
    ids = res.ids
    total = res.total
    if use_facets:
        ids = [i for i in ids if facets.allows(state.books[i])]
        total = len(ids)
        ids = ids[:limit]
    elapsed = _ms(t0)
    results = []
    for rid in ids:
        rec = state.record(dataset, rid)
        rec["matched_clues"] = _spans(rec["normalized_title"], p, cs, s)
        results.append(rec)
    out = {
        "dataset": dataset,
        "clues": {"prefix": prefix, "contains": contains, "suffix": suffix},
        "normalized": {"prefix": p, "contains": cs, "suffix": s},
        "status": "match" if total > 0 else "no_match",
        "total": total,
        "unfiltered_total": res.total,
        "facets_applied": use_facets,
        "results": results,
        "search_id": None,
        "candidates_verified": res.examined,
        "catalog_size": eng.size,
        "elapsed_ms": elapsed,
        "algorithm": ALGO_MULTI,
    }
    if record:
        summary = (", ".join(f"#{r['id']} {r['title']}" for r in results[:3]) +
                   (f" (+{total - 3} more)" if total > 3 else "")) if results else "No match"
        out["search_id"] = db.record_search(kind, dataset, {"prefix": prefix, "contains": contains, "suffix": suffix},
                                            summary, total, "success" if total else "no_match", elapsed)
    return out


def live_suggestions(state: LibraryState, dataset: str, prefix: str, contains: list[str], suffix: str,
                     limit: int = 6) -> dict:
    """As-you-type suggestions. Not written to history; never scans the catalogue.

    When nothing matches exactly, typo-tolerant *approximate* matches are
    returned separately: the prefix/suffix clue is looked up in the prefix or
    suffix Trie with an edit budget of 0 (1-4 letters), 1 (5-8) or 2 (9+).
    """
    p, s = normalize(prefix), normalize(suffix)
    cs = _clean_contains(contains)
    empty = {"dataset": dataset, "total": 0, "suggestions": [], "approximate": [], "elapsed_ms": 0.0,
             "algorithm": ALGO_MULTI, "normalized": {"prefix": p, "contains": cs, "suffix": s}}
    if not p and not s and not cs:
        return empty
    out = multi_search(state, dataset, prefix, contains, suffix, limit=limit, record=False)
    approx: list[dict] = []
    if out["total"] == 0:
        eng = state.engine(dataset)
        seen: set[int] = set()
        t0 = time.perf_counter()
        with eng.lock:
            for clue_type, clue in (("prefix", p), ("suffix", s)):
                budget = typo_budget(clue.replace(" ", "")) if clue else 0
                if not budget:
                    continue
                for v in eng.fuzzy(clue, clue_type == "suffix", maxdist=budget, limit=8):
                    if len(v.text) < len(clue) - budget:
                        continue
                    np_, ns_ = (v.text, s) if clue_type == "prefix" else (p, v.text)
                    r = eng.multi(np_, cs, ns_, cap=limit)
                    for rid in r.ids:
                        if rid in seen:
                            continue
                        seen.add(rid)
                        rec = state.record(dataset, rid)
                        rec["matched_clues"] = _spans(rec["normalized_title"], np_, cs, ns_)
                        rec["approximation"] = {"clue": clue_type, "typed": clue, "matched": v.text,
                                                "distance": v.distance}
                        approx.append(rec)
                        if len(approx) >= limit:
                            break
                    if len(approx) >= limit:
                        break
        out["elapsed_ms"] = round(out["elapsed_ms"] + _ms(t0), 4)
    return {
        "dataset": dataset,
        "total": out["total"],
        "suggestions": out["results"],
        "approximate": approx,
        "elapsed_ms": out["elapsed_ms"],
        "candidates_verified": out["candidates_verified"],
        "algorithm": out["algorithm"],
        "normalized": out["normalized"],
    }


# --------------------------------------------------------------------------
# Adaptive clue refinement
# --------------------------------------------------------------------------

@dataclass
class _Sugg:
    prefix: str
    contains: list[str]
    suffix: str
    kind: str
    reason: str
    rank: float


def _titles(n: int) -> str:
    return f"{n} title" if n == 1 else f"{n} titles"


def _tail(title: str, n: int) -> str:
    """A suffix of roughly the user's length, extended to a word boundary when cheap."""
    n = max(1, min(n, len(title)))
    cut = title[-n:]
    sp = title.rfind(" ", 0, len(title) - n)
    word = title[sp + 1:] if sp >= 0 else title
    return word if len(word) <= n + 4 else cut


def _head(title: str, n: int) -> str:
    n = max(1, min(n, len(title)))
    sp = title.find(" ", n)
    word = title[:sp] if sp >= 0 else title
    return word if len(word) <= n + 4 else title[:n]


def refine(state: LibraryState, dataset: str, prefix: str, suffix: str,
           contains: list[str] | None = None, limit: int = 8) -> dict:
    p, s = normalize(prefix), normalize(suffix)
    cs = _clean_contains(contains or [])
    if not p and not s and not cs:
        raise ClueError("Add at least one non-empty clue to refine.", "clues")
    eng = state.engine(dataset)
    t0 = time.perf_counter()
    cands: list[_Sugg] = []

    with eng.lock:
        exact = eng.multi(p, cs, s, cap=1).total
        pre_total, pre_ids = eng.prefix_ids(p, cap=12) if p else (0, [])
        suf_total, suf_ids = eng.suffix_ids(s, cap=12) if s else (0, [])

        # 1. Prefix alone matches -> offer endings that exist among those titles.
        if p and s and pre_total:
            seen = set()
            for rid in pre_ids:
                t = eng.title(rid)
                alt = _tail(t, len(s))
                if alt and alt != s and alt not in seen:
                    seen.add(alt)
                    cands.append(_Sugg(p, cs, alt, "change_suffix",
                                       f"{_titles(pre_total)} {'begins' if pre_total == 1 else 'begin'} with '{p}', "
                                       f"but none end with '{s}'. '{t}' ends with '{alt}'.", 1.0))
        # 2. Suffix alone matches -> offer beginnings that exist among those titles.
        if p and s and suf_total:
            seen = set()
            for rid in suf_ids:
                t = eng.title(rid)
                alt = _head(t, len(p))
                if alt and alt != p and alt not in seen:
                    seen.add(alt)
                    cands.append(_Sugg(alt, cs, s, "change_prefix",
                                       f"{_titles(suf_total)} {'ends' if suf_total == 1 else 'end'} with '{s}', "
                                       f"but none begin with '{p}'. '{t}' begins with '{alt}'.", 1.1))
        # 3. Shorten clues to the longest part that exists in the Tries.
        if p and not pre_total:
            k = eng.longest_prefix(p)
            if k > 0:
                cands.append(_Sugg(p[:k], cs, s, "shorten_prefix",
                                   f"No title begins with '{p}'. The longest beginning that exists in the "
                                   f"catalog is '{p[:k]}' (the next letter '{p[k]}' breaks the match).", 1.5))
        if s and not suf_total:
            k = eng.longest_suffix(s)
            if k > 0:
                cands.append(_Sugg(p, cs, s[-k:], "shorten_suffix",
                                   f"No title ends with '{s}'. The longest ending that exists in the "
                                   f"catalog is '{s[-k:]}'.", 1.5))
        # 4. Near-miss spellings (Trie + Levenshtein distance).
        for is_suffix, clue in ((False, p), (True, s)):
            if not clue or (pre_total if not is_suffix else suf_total):
                continue
            variants = eng.fuzzy(clue, is_suffix, maxdist=1, limit=6) or \
                eng.fuzzy(clue, is_suffix, maxdist=2, limit=6)
            for v in variants:
                if len(v.text) < max(1, len(clue) - 2):
                    continue  # plain truncation is covered by rule 3
                verb = ("ends" if is_suffix else "begins") if v.count == 1 else ("end" if is_suffix else "begin")
                reason = (f"'{v.text}' is {v.distance} edit{'s' if v.distance > 1 else ''} away from "
                          f"'{clue}'; {_titles(v.count)} {verb} with it.")
                if is_suffix:
                    cands.append(_Sugg(p, cs, v.text, "spelling_suffix", reason, 2 + v.distance))
                else:
                    cands.append(_Sugg(v.text, cs, s, "spelling_prefix", reason, 2 + v.distance))
        # 5. A contains clue that matches nothing at all can be dropped.
        for c in cs:
            if eng.multi("", [c], "", cap=1).total == 0:
                rest = [x for x in cs if x != c]
                if p or s or rest:
                    cands.append(_Sugg(p, rest, s, "drop_contains",
                                       f"No title in the catalog contains '{c}' anywhere.", 1.2))

        # Verify every suggestion against the index; keep only ones that match.
        out, seen_q = [], set()
        for sg in sorted(cands, key=lambda x: x.rank):
            key = (sg.prefix, tuple(sg.contains), sg.suffix)
            if key in seen_q or key == (p, tuple(cs), s):
                continue
            seen_q.add(key)
            r = eng.multi(sg.prefix, sg.contains, sg.suffix, cap=1)
            if r.total <= 0:
                continue
            latest = r.ids[0]
            out.append({
                "prefix": sg.prefix,
                "contains": sg.contains,
                "suffix": sg.suffix,
                "kind": sg.kind,
                "reason": sg.reason,
                "match_count": r.total,
                "preview": state.record(dataset, latest)["title"],
                "exact": False,
            })
            if len(out) >= limit:
                break

    elapsed = _ms(t0)
    return {
        "dataset": dataset,
        "original": {"prefix": prefix, "contains": contains or [], "suffix": suffix},
        "normalized": {"prefix": p, "contains": cs, "suffix": s},
        "original_matches": exact,
        "suggestions": out,
        "elapsed_ms": elapsed,
        "note": "Suggestions are alternative clues, not results. The original query was not changed; "
                "select one to run it as a new exact search.",
    }
