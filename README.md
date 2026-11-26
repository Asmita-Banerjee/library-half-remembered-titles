# The Library's Half-Remembered Titles

> **Forgot the book? Remember the clues. We'll find the story.**

A full-stack digital-library search app for half-remembered books. Users can search by the beginning and ending of a title, by several fragments at once, by author, or by describing characters and plot in plain words.

The core data-structures work is a **search engine written in C**: a prefix-suffix Trie, prefix and suffix Tries, and an n-gram index. A FastAPI backend calls it through `ctypes`, stores the catalog in SQLite, and serves a React + TypeScript + Tailwind frontend.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Algorithms & complexity](#algorithms--complexity)
- [Datasets](#datasets)
- [Installation](#installation)
- [Testing](#testing)
- [API](#api)
- [Deployment](#deployment)
- [Limitations](#limitations)

---

## Features

| Page | What it does |
|---|---|
| **Home** | Introduction, catalog size, indexed records, total and successful searches, and links to every search method. |
| **Catalog** | Every record in insertion order with its record ID. Duplicate titles are flagged and kept as separate records. Pagination and filters for title, genre, author and year. You can switch between the book catalog and the constrained DSA test catalog. |
| **Title search: beginning + ending** | Prefix and suffix inputs. Returns the **latest inserted** matching record, its ID, the clues you entered, and how many records match in total. Shows a clear no-match message and validates empty input. |
| **Title search: multi-clue** | Add or remove clues of three kinds: *beginning*, *contains* (more than one allowed) and *ending*. Every clue must fit the same title. Lists **all** matches, highest ID first, with each matched clue highlighted. |
| **Live adaptive search** | Catalog-backed suggestions update as you type in any clue. Requests are debounced (200 ms) and stale ones cancelled. Answered from the indexes, never by a full scan. |
| **Adaptive clue refinement** | When an exact search finds nothing, the app suggests alternative beginnings and endings that do exist, and explains each one. Every suggestion is re-checked against the index. Suggestions appear in a separate panel, your query is left unchanged, and nothing runs until you pick one. |
| **Authors** | Author search with keyboard-navigable autocomplete. Matching ignores case and accents. Shows every book by the author, and co-authored books appear under each author. |
| **Characters & story** | Natural-language search over characters, plot, genre, setting and themes. Results are ranked and each one says why it matched (term, field and source text). |
| **History** | The last five searches, stored by the backend, with type, clues, result and status. You can repeat a search or clear the history. |
| **Performance** | Catalog size, indexed combinations, index build time, per-type search times, success and failure counts, measured **linear vs indexed** benchmarks with charts, a scaling chart, and 8 live scenario tests. |

Every control calls a real API endpoint. There are no hardcoded results.

## Tech stack

- **Search engine:** C11 (`engine/`), compiled to `libtitlesearch.so`, plus a CLI and unit tests
- **Backend:** Python 3.12+, FastAPI, SQLite (stdlib `sqlite3`), `ctypes` binding
- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Vite, React Router, Lucide icons, Recharts
- **Tests:** C unit tests (built with AddressSanitizer and UndefinedBehaviorSanitizer), pytest, TypeScript strict mode
- **Ops:** Dockerfile (multi-stage), `render.yaml`, GitHub Actions CI

## Architecture

```
library-half-remembered-titles/
├── engine/                     C search engine
│   ├── include/titlesearch.h   public API
│   ├── src/titlesearch.c       Tries, n-gram index, multi-clue, fuzzy, benchmarks
│   ├── cli/main.c              solves the original problem from stdin
│   ├── tests/                  unit tests + CLI sample I/O
│   └── Makefile
├── backend/
│   ├── app/
│   │   ├── core/engine.py      ctypes binding (TitleEngine)
│   │   ├── data/books.py       metadata-rich catalog (60 records)
│   │   ├── data/dsa_catalog.py constrained catalog generator + validator
│   │   ├── db.py               SQLite schema, seeding, history, stats
│   │   ├── search/             author Trie, story inverted index, tokenizer
│   │   ├── services/           title / catalog / performance services, app state
│   │   ├── api/routes.py       HTTP endpoints
│   │   └── main.py             FastAPI app; builds every index once at startup
│   └── tests/                  pytest suite
├── frontend/src/
│   ├── pages/                  Home, Catalog, TitleSearch, Authors, Story, History, Performance
│   ├── components/             Layout, UI primitives
│   └── lib/                    typed API client, hooks, types
├── Dockerfile · render.yaml · Makefile · .github/workflows/ci.yml
```

At startup, `init_state()` seeds SQLite if needed, loads both catalogs in insertion order, and builds the indexes **once**:

1. the C `TSIndex` for the library catalog,
2. the C `TSIndex` for the DSA test catalog,
3. the author-name Trie, and
4. the story inverted index.

Every later request reuses them. The Performance page shows `build_count = 1` next to a growing indexed-query count, which shows the index is reused.

## Algorithms & complexity

Notation: *N* = records, *L* = title length, *σ* = alphabet size (≤ 40 after normalisation: `a-z 0-9 space ' -` and the separator), *|p|*, *|s|*, *|c|* = clue lengths.

Titles and clues are normalised identically in C (`ts_normalize`): lowercased, punctuation runs collapsed to one space, and trimmed. The separator `|` can never occur in a normalised title, so the prefix and suffix halves of a key can never be confused.

### 1. Prefix-suffix Trie: exact latest-match search

For each title *w* and each non-empty suffix *s* of it, the engine inserts the **combined key** `s | w` into one Trie. Every node after `|` spells one non-empty prefix *p* of *w*, so that node is the key `s|p` for one (prefix, suffix) combination. Inserting *L* keys therefore creates all *L²* combinations. Each combination node stores the **latest id**. Records are inserted in increasing id order, so overwriting leaves the latest match, which also handles duplicate titles correctly.

A query walks `s`, then `|`, then `p`, and reads the stored id. It never looks at a full title. If the walk falls off the Trie, the answer is −1.

| | Cost |
|---|---|
| Build | O(Σ L²) time and space. Worst case for the original constraints: 1,000 × 8² = 64,000 combinations. Measured: 5,046 combined keys, 30,330 combinations and 33,521 nodes for the 1,000-name catalog, built in about 2 ms. |
| Query | O((\|p\| + \|s\|) · σ). σ is a constant, so this is O(\|p\| + \|s\|), independent of *N*. |
| Linear baseline | O(N · (\|p\| + \|s\|)), scanning newest to oldest |

Nodes use a left-child/right-sibling layout in one growable array: about 16 bytes plus an id list per node, with indices instead of pointers.

### 2. Multi-clue search: indexed candidate intersection

Multi-clue search does **not** use the prefix-suffix Trie, because it needs *all* matches and any number of *contains* clues. It uses three more indexes built in the same pass:

- a **prefix Trie** whose nodes hold the ascending ids of titles below them,
- a **suffix Trie** over reversed titles, with the same id lists,
- an **n-gram index** (open-addressing hash map) from every 1-, 2- and 3-gram to an ascending id list.

How each clue becomes a sorted id list:

- **beginning:** the id list at the end of the prefix-Trie walk
- **ending:** the id list at the end of the suffix-Trie walk
- **contains, |c| ≤ 3:** the n-gram list itself, which is exact because containing a short clue means containing that gram
- **contains, |c| > 3:** one list for each of its trigrams. Containing every trigram is necessary but not sufficient, so these clues are flagged for verification.

The lists are sorted by length and intersected smallest-first with two-pointer merges. Then `strstr` verifies only the surviving candidates for long contains clues. Results are emitted newest-first.

| | Cost |
|---|---|
| Build | O(Σ L) Trie nodes and ids, O(3 Σ L) postings |
| Query | O(Σ\|clue\| + Σ\|list\| + V · Σ\|c\|), where V = candidates verified (reported by the API) |

### 3. Adaptive clue refinement

Each rule builds alternative clues from the indexes:

- **Change the ending.** If titles begin with *p* but none also end with *s*, the engine offers the real endings of the newest such titles. "Change the beginning" is the mirror case.
- **Shorten.** It walks the prefix or suffix Trie to find the longest part of the clue that exists, in O(|clue|).
- **Spelling.** It runs a depth-first search over the prefix or suffix Trie, carrying one Levenshtein DP row per depth. Branches whose row minimum exceeds the edit budget (1, or 2 as a fallback) are pruned. Cost: O(visited nodes × |clue|).
- **Drop a fragment.** A contains clue with an empty n-gram intersection can be removed.

Every candidate is re-run through the multi-clue engine. Only candidates that really match are returned, each with its match count and a preview.

### 4. Author retrieval

A Python Trie holds every token of every folded author name, plus the full name with and without spaces. Each node keeps the set of author ids below it. A query matches an author if every query word is a prefix of one of that author's name tokens, so `"conan d"`, `"AGATHA"` and `"bronte"` all work. Cost: O(|q| + k). Books with several authors are linked to each author in the `book_authors` table.

### 5. Character & story retrieval

A field-weighted **inverted index** maps `term → {book → {field → tf}}` over title, character names, character descriptions, plot, genre, themes and settings. Field weights range from 1.0 for plot to 3.0 for character names. Scoring is a simplified **BM25F** (k1 = 1.2, b = 0.6) with a bonus for covering more of the query.

Tokenisation uses a small stop-word list and a light rule-based stemmer (`mysteries` / `mysterious` / `mystery` → `myster`). A short, explicit related-terms table (for example `hat ↔ cap`) contributes at half weight, and the UI labels those matches as *related*.

Query cost: O(Σ df(t)) plus a sort. The `Retriever` protocol in `story_index.py` is the extension point for a semantic (embedding) retriever. No paid API is used.

### 6. Search history

SQLite keeps the last five searches: each insert trims older rows. Aggregate success, failure and timing counters live in a separate `search_stats` table, so clearing the history does not reset them.

## Datasets

**Library catalog** (`backend/app/data/books.py`): 60 records of real, published books. Each has its author(s), first-publication year, genre, main characters, a short plot summary, themes and settings. Details are kept to well-documented facts. The catalog deliberately includes:

- **Duplicate titles:** *Frankenstein* (1818 first edition and the revised 1831 edition) and a second copy of *Pride and Prejudice*.
- **Similar titles:** *The Invisible Man* (Wells) and *Invisible Man* (Ellison), three *Harry Potter and the …* titles, and several *The Adventures of …* titles.
- **Prolific authors:** Doyle, Christie, Dickens, Austen, Wells, Verne and others.
- **Co-authored books:** *Good Omens* (Pratchett & Gaiman) and *The Talisman* (King & Straub).
- **Recognisable characters:** Sherlock Holmes, Hercule Poirot, Captain Ahab, Bilbo Baggins and others.

**DSA test catalog** (`backend/app/data/dsa_catalog.py`): the original problem, kept separate. It has exactly 1,000 lowercase single-word names of length 1–8 in fixed order. It is generated deterministically (seed 2026) from 29 real one-word titles plus syllable names, and every 25th name repeats an earlier one to create duplicates. `validate_names` enforces the constraints (≤ 1,000 names, `^[a-z]{1,8}$`), and benchmarks use the maximum of 2,000 queries.

## Installation

Requirements: **gcc** (or clang) and **make**, **Python 3.11+**, **Node 20+**.

```bash
git clone https://github.com/Asmita-Banerjee/library-half-remembered-titles.git
cd library-half-remembered-titles
cp .env.example .env           # optional; defaults work as-is

make install                   # pip + npm dependencies
make run                       # builds C engine + frontend, serves everything on :8000
```

Open <http://localhost:8000>. The SQLite database is created and seeded automatically on first start.

**Development with hot reload:**

```bash
make dev                       # terminal 1: C engine + FastAPI on :8000 (reload)
cd frontend && npm run dev     # terminal 2: Vite on :5173, proxies /api to :8000
```

**The original problem in pure C:**

```bash
make -C engine
./engine/build/titlesearch_cli --stats < engine/tests/sample_input.txt
```

Input format: `N`, then the N names, then `Q`, then Q lines of `prefix suffix`. Output: one id per query, or −1. Add `--loose` to lift the original constraints.

**Docker:**

```bash
docker build -t half-remembered . && docker run -p 8000:8000 half-remembered
```

## Testing

```bash
make test
```

This runs three suites:

1. **C unit tests** (`engine/tests/test_engine.c`), built with `-fsanitize=address,undefined`. They cover:
   - prefix/suffix matching, latest id and duplicates
   - no-match and empty input
   - build-once behaviour (`ts_build` and `ts_add` are rejected after building)
   - multiple contains clues, plus case and punctuation handling
   - fuzzy search and longest-affix walks
   - a **1,000-name × 2,000-query** run where every indexed answer is compared with the linear scan, for both exact and multi-clue search
   - the CLI's sample input and output
2. **pytest** (`backend/tests/`, 37 tests). They cover:
   - prefix-suffix matching, latest matching id and duplicate titles
   - no-match and empty inputs (HTTP 422 with a message)
   - multiple contains clues, any clue combination, and the same-title rule
   - multi-clue results compared with a linear scan
   - live suggestions, which narrow as you type and are not logged
   - refinement: every suggestion is verified, the original query is unchanged, and impossible fragments can be dropped
   - authors: case, accents and co-authors
   - character and story ranking, including the README example
   - catalog order and pagination, and the five-item history limit
   - index reuse across API queries, maximum catalog size and title length, and constraint validation
3. **TypeScript** strict type checking of the frontend.

Latest local run:

```
1040 checks, 0 failures          (C engine, ASan/UBSan)
CLI sample: OK
37 passed                        (pytest)
tsc -b: no errors
```

The Performance page also runs **8 live scenario checks** against the running indexes: duplicates, ambiguity, no match, empty input, repeated queries, maximum catalog size, and 2,000-query agreement with the linear scan.

### Benchmark results

These are typical figures from this machine: 2,000 queries on the 1,000-name catalog, timed inside C, best of 5 runs. Re-run them on the Performance page.

| | Indexed | Linear scan |
|---|---|---|
| Exact prefix + suffix, per query | ~0.25 µs | ~0.9 µs |
| Multi-clue (prefix + contains), 2,000 queries | ~0.6 ms | ~4.1 ms |

Indexed lookup time stays nearly flat as the catalog grows, while the linear scan grows with *N*; the scaling chart shows both. The exact-search gap is modest at this size because the names are at most 8 characters and the linear scan stops at the newest match. On misses it reads all 1,000 names.

## API

All endpoints are under `/api`. Interactive docs are at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/overview` | Counts for the home page |
| GET | `/catalog?dataset=&page=&page_size=&q=&genre=&author=&year_from=&year_to=` | Catalog page in insertion order |
| GET | `/books/{id}` | Full book record |
| POST | `/search/title` | `{dataset, prefix, suffix}` → latest match |
| POST | `/search/multi` | `{dataset, prefix, contains[], suffix}` → all matches |
| POST | `/search/live` | Same body plus `limit`; as-you-type suggestions (not logged) |
| POST | `/search/refine` | Alternative clues after a miss |
| GET | `/authors/autocomplete?q=` | Author suggestions |
| POST | `/search/author` | `{name}` → authors and their books |
| POST | `/search/story` | `{query, limit}` → ranked books with match reasons |
| GET / DELETE | `/history` | Last five searches / clear them |
| GET | `/stats/performance` | Index and search statistics |
| GET | `/stats/benchmark?dataset=&queries=` | Linear vs indexed benchmark |
| GET | `/stats/scaling` | Benchmark across catalog sizes |
| GET | `/stats/selfcheck` | Live scenario tests |

## Deployment

The app runs as **one service**: FastAPI serves the API and the built React app from the same origin.

- **Render (free):** push the repo, then *New → Blueprint* and select it. `render.yaml` builds the Dockerfile, compiling the C engine and running its tests during the build.
- **Any Docker host:** use the Dockerfile above and set `PORT` if needed.

The SQLite file lives inside the container. On free hosts without a persistent disk, search history and counters reset when the service restarts. The catalog is reseeded automatically.

## Limitations

- Story search is keyword-based (BM25F plus a small related-terms table), not semantic. A paraphrase that shares no words with the metadata will not match. The `Retriever` protocol is where an embedding model would plug in.
- The library catalog is intentionally small (60 records) so its facts could be checked by hand. The C engine itself handles any size.
- The C index is immutable after `ts_build`, as the problem requires (no live insertions). Adding books means rebuilding at startup.
- Normalisation is ASCII-oriented. Accented letters in titles are dropped rather than folded; author search folds accents in Python.
- Each index is guarded by a lock because the C engine is single-threaded. This is fine at demo scale.
- Benchmark timings depend on the machine and the current load.

## License

MIT
