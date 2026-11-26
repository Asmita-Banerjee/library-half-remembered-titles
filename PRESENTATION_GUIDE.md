# The Library's Half-Remembered Titles: Hackathon Guide

**Tagline:** Forgot the book? Remember the clues. We'll find the story.
**Repo:** https://github.com/Asmita-Banerjee/library-half-remembered-titles

---

## 1. The 30-second pitch

People rarely forget a book completely. They remember "it starts with *The* and ends with *Ring*", or "a girl, a wardrobe, a lion". Normal search needs the exact title. We built a search engine for **half-remembered** books: you type what you remember, and it finds the book.

Three ways to search:
1. **By title fragments**: a beginning, an ending, or words from the middle (a Trie-based engine written in C).
2. **By plot or characters**: describe the story in your own words.
3. **By author**: partial names work.

---

## 2. The problem

- Title search fails when you only remember part of a title.
- Memory is fuzzy: wrong spelling, missing accents, a half-remembered plot.
- Plain `LIKE '%text%'` scans every row, which is slow, and it can't combine "starts with X and ends with Y".
- Library catalogues are large, so memory and speed both matter.

## 3. What we built

| Feature | What it does |
|---|---|
| Title search | Prefix + suffix + "contains" clues combined, latest-ID match rule |
| Live suggestions | Suggestions update as you type; shows close spellings if nothing matches (labelled approximate) |
| Clue refinement | Add more clues to narrow results |
| Story search | Describe the plot; handles typos and synonyms, ranks by how many of your words match |
| Author search | Partial names, accent-insensitive |
| Filters | Genre, audience (children / young adult / general), years, record type |
| Book pages | Cover, details, links to Open Library, WorldCat, Goodreads (Project Gutenberg for pre-1930 books) |
| History | Last 5 searches |
| "Did this find your book?" | Real feedback, which gives a real success rate |
| Benchmark API | Benchmarks and 9 live self-checks (backend endpoints, no page) |

Catalogue: **10,060 books** = 60 hand-written detailed records + 10,000 from goodbooks-10k.

---

## 4. Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| Search engine | **C11** (Trie, inverted indexes), built as a shared library | Fast, tight control over memory; the DSA is the core of the project |
| Bridge | Python `ctypes` | Calls the C engine without a separate service |
| Backend | **FastAPI** + Pydantic | Typed API, automatic validation |
| Database | **SQLite** | Simple, no setup, enough for this size |
| Frontend | **React 19 + TypeScript (strict) + Tailwind 4 + Vite** | Typed, fast builds |
| Charts | Recharts | Performance dashboard |
| Tests | C test suite (ASan/UBSan), pytest, live self-checks | Correctness at each layer |
| CI | GitHub Actions | Runs the tests on every push |
| Deploy | Docker + `render.yaml` (Render) | Not yet deployed |

---

## 5. How the DSA works

### Prefix-suffix Trie
- Each title word is stored under the key `suffix|word`, so a single walk down the Trie answers "starts with A and ends with B".
- Built **once** at startup. Lookups cost O(length of clue), not O(number of books).
- If several titles match, the rule is to return the **latest ID**.
- Nodes use a compact left-child / right-sibling layout (16 bytes each).

### Contains-clues
- 1-, 2- and 3-gram postings (hash map). For longer clues, intersect the smallest lists first, then verify with `strstr`.

### Memory control
- Uncapped Trie on 10,060 books: about **294 MB**.
- We cap the stored prefix/suffix depth at **12 characters**: about **59 MB** for the Trie.
- Longer clues still work: we intersect the prefix-Trie and suffix-Trie id lists, and a test proves the answers match the uncapped version.

### Typo tolerance (fuzzy)
- Trie + Levenshtein distance. Edit budget: 0 for 1-4 letters, 1 for 5-8, 2 for 9+.

### Story search
- Inverted index with **BM25F** (weights per field: title, plot, characters, tags).
- Match tiers: exact word 1.0, spelling fix 0.85, related word 0.8, WordNet synonym 0.75.
- A bonus for matching more of the query words, plus a small popularity prior.

### Author search
- Trie over normalised name tokens.

### Complexity cheat-sheet
| Operation | Cost |
|---|---|
| Build Trie | O(total characters), once |
| Prefix + suffix lookup | O(clue length) |
| Contains (≤3 chars) | O(postings) |
| Fuzzy | Trie walk pruned by edit budget |

---

## 6. Problems we faced and how we solved them

| Problem | Fix |
|---|---|
| Trie used too much memory at 10k books (294 MB) | Capped the depth at 12, with exact fallback for longer clues (59 MB) |
| "les miserables" didn't find *Les Misérables* | UTF-8 accent folding in the C normaliser |
| "detective hat" ranked *The Cat in the Hat* first | Added a coverage bonus so books matching more query words win |
| Story search missed paraphrases ("closet" vs "wardrobe") | Added WordNet synonyms and spelling correction |
| Stems like "vampir" showed up in the UI | Kept a map back to real surface words |
| Empty normalised titles crashed the benchmark | Filtered them out |
| Tests broke when the catalogue grew | Rewrote tests to compare against a brute-force oracle |
| README claimed ~150 MB | Measured it: ~290 MB, so the README was corrected |
| Git push returned 403 | Granted the GitHub App write access, and pushed with `push.negotiate=true` |
| C engine is single-threaded | One lock per engine instance |

---

## 7. Testing and results

- C engine: **1,062 checks**, 0 failures (AddressSanitizer + UBSan)
- Backend: **45 pytest tests** pass
- Live self-checks: **9/9**
- Frontend: TypeScript compiles with no errors
- CI on GitHub passed

---

## 8. Honest limitations (say these before the judges ask)

- **Not deployed yet**: it needs a Render deploy; the Dockerfile has not been built in our environment.
- **Story search is keyword-based**: it can still miss paraphrases (e.g. "girl volunteers for a deadly televised fight" doesn't rank *The Hunger Games* first). Semantic embeddings would fix this.
- **Only 60 books have plots and characters**; the other 10,000 have title, author, year, genres and reader tags only.
- **The C index is immutable**: adding a book means a rebuild.
- **Non-Latin titles** are stored but not title-searchable.
- **Covers** load from Open Library at the visitor's end; I couldn't verify them in my workspace.
- **Typo tolerance** is off for clues of 4 letters or fewer, by design.

---

## 9. Likely judge Q&A

**Why a Trie and not a database `LIKE` query?**
`LIKE '%x%'` scans every row. The Trie is built once, and a lookup depends only on the clue length. It also answers prefix + suffix together.

**Why C?**
Control over memory layout and speed. The compact 16-byte nodes and the depth cap come from that control.

**Why not a hash map of all (prefix, suffix) pairs?**
We benchmarked it. It is faster on short names, but its size grows far faster with title length, so it doesn't fit long titles. The Trie is the better trade-off for the library data.

**What does "latest-ID match" mean?**
If several titles fit the clues, return the one with the highest ID, the most recently added.

**How do you keep memory bounded?**
Depth cap of 12 characters (294 MB down to 59 MB), plus an indexed fallback so longer clues stay exact.

**How do you handle spelling mistakes?**
Levenshtein search over the Trie, with an edit budget that grows with word length.

**Is it using AI or an LLM?**
No. Story search is a classic BM25F inverted index plus WordNet synonyms. It runs offline and costs nothing. We name semantic embeddings as the next step.

**Where does the data come from? Any copyright issue?**
goodbooks-10k (CC BY-SA 4.0, credited in the README) and WordNet 3.0 (Princeton licence). The 60 detailed records are hand-written. We did not copy book text or invent book details.

**How do you know the results are correct?**
Tests compare the engine against a brute-force oracle, the C engine is checked under ASan/UBSan, and the backend runs 9 live checks against the running server.

**How do you measure success?**
Every search can be marked "found it / didn't". The history and stats pages show the real rate.

**What would you do with more time?**
Add semantic search (embeddings) for story queries, plot summaries for all 10,000 books, an updatable index, and non-Latin title support.

**Is it deployed?**
Deployment config (Dockerfile + `render.yaml`) is in the repo and the server needs about 290 MB RAM, which fits Render's 512 MB free tier. State the current status honestly in the demo.

---

## 10. Demo script (about 2 minutes)

1. **Title clues:** start "the", end "ring" → show the match and the suggestions updating while typing.
2. **Typo:** type a misspelt word → show the labelled "approximate" suggestions.
3. **Story search:** "boy wizard school" → then "vampyre" to show typo tolerance.
4. **Filters:** narrow by genre / audience.
5. **Book page:** cover and external links.

---

## 11. Run it locally

```bash
make            # build the C engine
make test       # C + backend tests
# backend
cd backend && uvicorn app.main:app
# frontend
cd frontend && npm install && npm run dev
```
(See the README for exact commands and options.)
