# The Library's Half-Remembered Titles

> **Forgot the book? Remember the clues. We'll find the story.**

A full-stack digital-library search app for half-remembered books. Readers fill in a "request slip" with whatever they remember: how the title begins or ends, a fragment from the middle, the author's name, or a few sentences about the characters and plot. The catalogue holds **10,060 real books**.

The core data-structures work is a **search engine written in C**: a prefix-suffix Trie, prefix and suffix Tries, an n-gram index, Trie + Levenshtein spelling suggestions, and accent folding. A FastAPI backend calls it through `ctypes`, stores everything in SQLite, and serves a React + TypeScript + Tailwind frontend styled like a library card catalogue.

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
| **Home** | A request slip with three tabs: *what happens in it*, *part of the title* and *who wrote it*. It shows a live count of matching titles as you type, and Ctrl+Enter sends it. Also on the page: example requests, live collection stats, the five most recent requests, four random books "pulled from the stacks", and an FAQ. |
| **Describe the story** | Natural-language search over characters, plot, settings, themes and readers' Goodreads shelves. Results come back as ranked index cards with covers, and each one says why it matched. Close spellings ("vampyre" → vampire) and synonyms ("closet" → wardrobe) are tried and labelled as such. You can filter by genre, readership (children / young adult / general), publication years and record type. |
| **Title clues: beginning + ending** | Returns the **latest inserted** matching record and how many records match in total. Shows a clear message when nothing matches and validates empty input. Clues longer than the Trie depth use an indexed fallback. |
| **Title clues: any clues** | Add or remove beginning, contains (more than one allowed) and ending clues. Every clue must fit the same title. Lists **all** matches newest-first with each clue highlighted, and takes optional filters. |
| **Live adaptive search** | Debounced, cancellable suggestions as you type, all answered from the indexes. When nothing matches exactly, **approximate** matches are shown separately and labelled. The typo budget follows word length: none for 1–4 letters, 1 for 5–8, 2 for 9+. |
| **Adaptive clue refinement** | After a miss you get a "librarian's note" with alternative clues: a real ending for your beginning, the longest beginning that exists, near spellings, or a fragment to drop. Each suggestion comes with its reason and match count and is re-checked against the index. Your query is never changed. |
| **Authors** | Keyboard-navigable autocomplete. Matching ignores case and accents, and the same author is merged across sources ("J.K. Rowling" = "J. K. Rowling"). Co-authored books are listed under each author. |
| **Book page** | The full catalogue card: cover (Open Library, by ISBN), plot, characters, settings, themes, reader shelf tags and rating. "Find a copy" links go to Open Library, WorldCat and Goodreads, plus Project Gutenberg for books published before 1930. |
| **Catalogue** | All 10,060 records (or the 1,000 DSA test names) in insertion order, with record numbers, duplicate-title flags, pagination and filters. |
| **Your requests** | The last five searches, stored by the server, with type, clues, result, status and whether you confirmed the find. You can repeat a search or clear the list. |
| **"Did this find your book?"** | Every search can be confirmed or rejected. Confirmed finds give an honest success rate on the home page and in the stats. |
| **Under the hood** | Index sizes, build times and memory, plus measured **Trie vs hash-map vs linear-scan** benchmarks and a scaling chart for each catalogue. Also 9 live scenario checks and search statistics per type. |

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
│   │   ├── data/books.py       hand-written detailed records (60)
│   │   ├── data/goodbooks/     10,000-book extended catalogue (CC BY-SA 4.0)
│   │   ├── data/wordnet_related.json.gz  precomputed WordNet synonyms
│   │   ├── data/dsa_catalog.py constrained catalog generator + validator
│   │   ├── db.py               SQLite schema, seeding, history, stats
│   │   ├── search/             author Trie, story inverted index, tokenizer
│   │   ├── services/           title / catalog / performance services, app state
│   │   ├── api/routes.py       HTTP endpoints
│   │   └── main.py             FastAPI app; builds every index once at startup
│   ├── scripts/                build_goodbooks.py, build_related_terms.py (offline data builders)
│   └── tests/                  pytest suite
├── frontend/src/
│   ├── pages/                  Home, Story, TitleSearch, Authors, Catalog, Book, History, Performance
│   ├── components/             Layout, request-slip UI, Cover, FacetPanel, Feedback, Accordion
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

Titles and clues are normalised identically in C (`ts_normalize`). The function decodes UTF-8 and folds Latin accents to ASCII (é → e, ß → ss, œ → oe). It turns curly apostrophes into `'`, lowercases, collapses runs of punctuation and dashes to one space, and trims. *Les Misérables* and *Shōgun* are therefore found from plain typing. Titles in other scripts normalise to an empty string; they keep their record id but aren't title-indexed. The separator `|` can never occur in a normalised title, so the prefix and suffix halves of a key can never be confused.

### 1. Prefix-suffix Trie: exact latest-match search

For each title *w* and each non-empty suffix *s* of it, the engine inserts the **combined key** `s | w` into one Trie. Every node after `|` spells one non-empty prefix *p* of *w*, so that node is the key `s|p` for one (prefix, suffix) combination. Inserting *L* keys therefore creates all *L²* combinations. Each combination node stores the **latest id**. Records are inserted in increasing id order, so overwriting leaves the latest match, which also handles duplicate titles correctly.

A query walks `s`, then `|`, then `p`, and reads the stored id. It never looks at a full title. If the walk falls off the Trie, the answer is −1.

| | Cost |
|---|---|
| Build | O(Σ L²) time and space. Worst case for the original constraints: 1,000 × 8² = 64,000 combinations. Measured: 5,046 combined keys, 30,330 combinations and 33,521 nodes for the 1,000-name catalog, built in about 2 ms. |
| Query | O((\|p\| + \|s\|) · σ). σ is a constant, so this is O(\|p\| + \|s\|), independent of *N*. |
| Linear baseline | O(N · (\|p\| + \|s\|)), scanning newest to oldest |

Nodes use a left-child/right-sibling layout in one growable array: 16 bytes per node, with indices instead of pointers. Id lists live in a parallel array that only the prefix and suffix Tries allocate.

**Bounded depth for large catalogues.** An uncapped prefix-suffix Trie over the 10,060 library titles (average 23 characters, longest 196) would take about 294 MB. `ts_create_ex(max_affix)` stores only prefixes and suffixes of up to *A* characters, giving O(Σ min(L, A)²) nodes. The library uses A = 12, which measures **59 MB**, or about 5.9 MB per 1,000 titles.

A query whose clue is longer than *A* intersects the prefix-Trie and suffix-Trie id lists from their newest ends. That costs O(|p| + |s| + |list|) and is still indexed: no title is ever scanned. The C tests check that the capped index gives exactly the same answers as the uncapped one on 3,000 queries. The 1,000-name DSA catalogue is uncapped.

**Hash-map baseline.** For the viva question "why not just a hash map?", `ts_bench_hash` builds the classic alternative: every (prefix, suffix) pair stored as a key mapping to the latest id, which is O(N·L²) keys of O(L) characters each. It is the fastest lookup (about 0.07 µs on the DSA catalogue). But its size grows with L³, so it only fits short names. The benchmark page times all three methods on the same queries and checks that their answers agree.

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

### 3b. Live typo tolerance

When the as-you-type clues match nothing, the prefix (or suffix) clue is fuzzy-matched against the prefix (or suffix) Trie. The edit budget follows word length, as in Meilisearch: 0 edits for 1–4 letters, 1 for 5–8 and 2 for 9+. The results are returned in a separate `approximate` list and labelled with the typed and matched text.

### 4. Author retrieval

A Python Trie holds every token of every folded author name, plus the full name with and without spaces. Authors from both sources are merged on a folded key, so "J.K. Rowling" and "J. K. Rowling" are one person. Each node keeps the set of author ids below it. A query matches an author if every query word is a prefix of one of that author's name tokens, so `"conan d"`, `"AGATHA"` and `"bronte"` all work. Cost: O(|q| + k). Books with several authors are linked to each author in the `book_authors` table.

### 5. Character & story retrieval

A field-weighted **inverted index** maps `term → {book → {field → tf}}`. The fields are title and series, character names, character descriptions, plot, genre, themes, settings and readers' shelf tags. Weights range from 1.0 (plot) to 3.0 (character names).

Query words are matched in tiers, and every result lists which tier each match came from:

1. **Direct:** the stemmed word itself (weight 1.0).
2. **Spelling:** a word missing from the vocabulary is matched against a vocabulary Trie with Levenshtein pruning, using the same edit budget as above ("vampyre" → vampire). Weight 0.85.
3. **Related / synonym:** a small curated table (`hat ↔ cap`, `closet → wardrobe`) and a precomputed **WordNet 3.0** table of 10,162 aliases. WordNet only fills gaps, meaning words absent from the catalogue, because it is too broad to apply to words that already match.

Scoring is **BM25F** (k1 = 1.2, b = 0.6). On top of that, books that match more of the reader's own words get a quadratic coverage bonus, and a small popularity prior applies: +4% per order of magnitude of Goodreads ratings.

Facets (genre, readership, year range, record source) filter candidates before ranking. When the same work exists as a detailed record and an extended-catalogue record, results show it once and link the other copy.

Query cost: O(Σ df(t)) plus a sort. The `Retriever` protocol in `story_index.py` is the extension point for an embedding re-ranker. No paid API is used, and nothing needs network access at runtime.

### 6. Search history

SQLite keeps the last five searches: each insert trims older rows. Aggregate success, failure and timing counters live in a separate `search_stats` table, so clearing the history does not reset them. Reader feedback ("Did this find your book?") goes to a `feedback` table and is linked back to its history row.

## Datasets

The library has 10,060 records in one insertion order, from two sources:

- **ids 0–59: detailed records** (`backend/app/data/books.py`). These were written by hand: author(s), first-publication year, genre, readership, main characters, a short plot summary, themes and settings, limited to well-documented facts. They include:
  - duplicate titles: *Frankenstein* in its 1818 and 1831 editions, and a second copy of *Pride and Prejudice*
  - similar titles: *The Invisible Man* / *Invisible Man*
  - co-authored books: *Good Omens*, *The Talisman*
- **ids 60–10,059: the extended catalogue**, the 10,000 most-rated books on Goodreads from the open [goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k) dataset (**CC BY-SA 4.0**; the derived file in `backend/app/data/goodbooks/` is shared under the same licence).
  - Title, authors, original year, ISBN, language and rating are copied as given.
  - Genre and readership are derived mechanically from each book's most-used reader shelf tags.
  - Junk shelves such as `to-read` are dropped.
  - Nothing is invented: there are no plot summaries for these records.
  - `backend/scripts/build_goodbooks.py` regenerates the file from the raw CSVs.

Where both sources hold the same work, the two records stay separate (they are real duplicates for title search) but are linked to each other. The detailed record borrows the extended record's ISBN for its cover.

**DSA test catalogue** (`backend/app/data/dsa_catalog.py`): the original problem, kept separate. It has exactly 1,000 lowercase single-word names of length 1–8 in fixed order. It is generated deterministically (seed 2026) from 29 real one-word titles plus syllable names, and every 25th name repeats an earlier one. `validate_names` enforces the constraints, and benchmarks use the maximum of 2,000 queries.

**Synonyms:** `backend/app/data/wordnet_related.json.gz` is precomputed from WordNet 3.0 (© Princeton University; licence in `backend/app/data/WORDNET_LICENSE`) by `backend/scripts/build_related_terms.py`.

**Covers** are loaded in the reader's browser from the [Open Library Covers API](https://openlibrary.org/dev/docs/api/covers) by ISBN. When there's no cover, a cloth-bound placeholder is drawn.

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
   - UTF-8 accent folding, the capped Trie matching the uncapped one on 3,000 queries, and the hash-map baseline agreeing with the Trie
   - the CLI's sample input and output
2. **pytest** (`backend/tests/`, 45 tests). Expected answers are computed by brute force over the real catalogue, so they stay correct as data changes. They cover:
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
   - accented titles, the long-clue fallback, approximate live matches, facets, author merging across sources, story spelling and synonym tiers, duplicate collapsing, book pages and links, and reader feedback
3. **TypeScript** strict type checking of the frontend.

Latest local run:

```
1062 checks, 0 failures          (C engine, ASan/UBSan)
CLI sample: OK
45 passed                        (pytest)
tsc -b: no errors
```

The "Under the hood" page also runs **9 live scenario checks** against the running indexes: duplicates, ambiguity, the long-clue fallback, no match, empty input, repeated queries, maximum catalog size, and 2,000-query agreement with the linear scan and the hash map.

### Benchmark results

Typical figures from this machine: 2,000 queries, timed inside C, best of 5 runs. Re-run them on the "Under the hood" page.

| Catalogue | Trie | Hash map of all pairs | Linear scan |
|---|---|---|---|
| DSA, 1,000 names, exact search per query | ~0.2 µs, 1.5 MB | ~0.07 µs, 1.6 MB | ~0.9 µs |
| Library, 10,060 titles, exact search per query | ~1.0 µs, 59 MB (depth 12) | not feasible (L³ growth) | ~11 µs |
| Library, multi-clue, 2,000 queries | ~11 ms | — | ~62 ms |

Scaling on the library from 1,000 to 10,060 titles:

- **Trie:** 0.31 → 0.74 µs per query.
- **Linear scan:** 1.0 → 10.8 µs per query.
- **Memory:** a steady ~5.9 MB per 1,000 titles.
- **Build time:** 8 → 139 ms.

## API

All endpoints are under `/api`. Interactive docs are at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/overview` | Counts for the home page |
| GET | `/catalog?dataset=&page=&page_size=&q=&genre=&author=&year_from=&year_to=&audience=&source=` | Catalogue page in insertion order |
| GET | `/books/{id}` | Full book record with links and linked copies |
| GET | `/facets` | Filter options (genres, readerships, year range) |
| GET | `/random?n=` | Random books for "pulled from the stacks" |
| POST | `/search/title` | `{dataset, prefix, suffix}` → latest match |
| POST | `/search/multi` | `{dataset, prefix, contains[], suffix, facets?}` → all matches |
| POST | `/search/live` | Same body plus `limit`; as-you-type suggestions plus approximate matches (not logged) |
| POST | `/search/refine` | Alternative clues after a miss |
| GET | `/authors/autocomplete?q=` | Author suggestions |
| POST | `/search/author` | `{name}` → authors and their books |
| POST | `/search/story` | `{query, limit, facets?}` → ranked books with match reasons and expansions |
| POST | `/feedback` | `{search_id, search_type, found, record_id?}` → reader confirmation |
| GET / DELETE | `/history` | Last five searches / clear them |
| GET | `/stats/performance` | Index and search statistics |
| GET | `/stats/benchmark?dataset=&queries=` | Trie vs hash map vs linear benchmark |
| GET | `/stats/scaling?dataset=` | Benchmark and memory across catalogue sizes |
| GET | `/stats/selfcheck` | Live scenario tests |

## Deployment

The app runs as **one service**: FastAPI serves the API and the built React app from the same origin.

- **Render (free):** push the repo, then *New → Blueprint* and select it. `render.yaml` builds the Dockerfile, compiling the C engine and running its tests during the build.
- **Any Docker host:** use the Dockerfile above and set `PORT` if needed.

The SQLite file lives inside the container. On free hosts without a persistent disk, search history, counters and feedback reset when the service restarts. The catalogue is reseeded automatically (first start takes about 2 s). The server uses about 290 MB of RAM (measured), with a short extra ~60 MB while the library scaling benchmark builds temporary indexes. That fits a 512 MB free instance.

## Limitations

- **Story search is keyword-based.** Spelling tolerance, a curated related-terms table and WordNet synonyms close many gaps ("closet" finds the wardrobe, "vampyre" finds vampires, "physician" finds Dr Jekyll). A description that shares no words, synonyms or shelf tags with a book's record can still miss it. Two examples: "girl volunteers for a deadly televised fight" doesn't rank *The Hunger Games* first, and "bloodsucker from Eastern Europe" doesn't reach *Dracula*. The `Retriever` interface is where a local embedding re-ranker would plug in; none is bundled, so the app needs no model downloads.
- **Only the 60 detailed records have plots and characters.** The 10,000 extended records have title, authors, year, genre and readers' shelf tags only. Their genre and readership are derived from those tags, so they reflect how readers shelve a book, not an editorial classification.
- **Memory grows with title length.** The library's prefix-suffix Trie is capped at a depth of 12 characters, about 5.9 MB per 1,000 titles; longer clues use the indexed intersection fallback. The hash-map baseline is benchmarked only on the short DSA names, because its size grows with L³. In-memory indexes for about 100,000 titles would need around 600 MB, which is past free hosting tiers.
- **The C index is immutable after `ts_build`,** as the problem requires (no live insertions). Adding books means updating the data files and restarting.
- **Titles in non-Latin scripts** (a few Arabic and Japanese originals in the extended catalogue) are stored but not title-searchable. Latin accents are folded.
- **Covers come from Open Library at view time.** Books without an ISBN, or without a cover there, show a drawn placeholder.
- **Each index is guarded by a lock** because the C engine is single-threaded. This is fine at demo scale.
- **Benchmark timings** depend on the machine and the current load.

## License

Code: MIT. Extended-catalogue data derived from goodbooks-10k: CC BY-SA 4.0. WordNet 3.0: © Princeton University, under the WordNet licence (`backend/app/data/WORDNET_LICENSE`).
