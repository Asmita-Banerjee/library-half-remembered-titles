"""API-level tests for every retrieval capability.

Expected answers are computed by brute force over the loaded catalogue
(an oracle), so the tests stay correct as the data grows.
"""

from app.core.engine import normalize


def titles(results):
    return [r["title"] for r in results]


def oracle(state, prefix="", contains=(), suffix="", dataset="library"):
    names = state.dsa_names if dataset == "dsa" else [b["normalized_title"] for b in state.books]
    p, s, cs = normalize(prefix), normalize(suffix), [normalize(c) for c in contains if normalize(c)]
    ids = [i for i, t in enumerate(names)
           if t and t.startswith(p) and t.endswith(s) and all(c in t for c in cs)]
    return sorted(ids, reverse=True)


# --- basic prefix + suffix ---------------------------------------------------

def test_basic_search_returns_latest_record(client, state):
    r = client.post("/api/search/title", json={"prefix": "frank", "suffix": "stein"}).json()
    expected = oracle(state, "frank", (), "stein")
    assert r["status"] == "match"
    assert r["record"]["id"] == expected[0]
    assert r["matching_records"] == len(expected) >= 3   # 1818 + 1831 editions + extended record
    assert r["index_path"] == "prefix-suffix-trie"
    assert isinstance(r["search_id"], int)


def test_long_clue_uses_indexed_fallback(client, state):
    r = client.post("/api/search/title", json={"prefix": "harry potter and the", "suffix": "azkaban"}).json()
    assert r["index_path"] == "affix-intersection"
    assert r["record"]["id"] == oracle(state, "harry potter and the", (), "azkaban")[0]


def test_basic_search_no_match(client):
    r = client.post("/api/search/title", json={"prefix": "zzzq", "suffix": "qqqz"}).json()
    assert r["status"] == "no_match" and r["record"] is None


def test_basic_search_empty_input_is_rejected(client):
    for body in ({"prefix": "", "suffix": "x"}, {"prefix": "x", "suffix": ""}, {"prefix": " ", "suffix": " "}):
        res = client.post("/api/search/title", json=body)
        assert res.status_code == 422
        assert "Enter" in res.json()["detail"]


def test_accented_titles_are_searchable(client):
    r = client.post("/api/search/title", json={"prefix": "Les Mis", "suffix": "RABLES"}).json()
    assert r["status"] == "match" and "Mis" in r["record"]["title"]
    r2 = client.post("/api/search/title", json={"prefix": "les mise", "suffix": "rables"}).json()
    assert r2["record"]["id"] == r["record"]["id"]


def test_basic_search_on_dsa_catalog(client, state):
    r = client.post("/api/search/title", json={"dataset": "dsa", "prefix": "em", "suffix": "ma"}).json()
    assert r["record"]["id"] == oracle(state, "em", (), "ma", "dsa")[0]


# --- multi-clue --------------------------------------------------------------

def test_multi_clue_multiple_contains(client, state):
    r = client.post("/api/search/multi", json={"prefix": "harry", "contains": ["potter", "of"], "suffix": ""}).json()
    expected = oracle(state, "harry", ("potter", "of"))
    assert r["total"] == len(expected) and [x["id"] for x in r["results"]] == expected[:len(r["results"])]
    spans = r["results"][0]["matched_clues"]
    assert {s["type"] for s in spans} == {"prefix", "contains"} and all(s["start"] >= 0 for s in spans)


def test_multi_clue_any_combination(client, state):
    for body in ({"suffix": "invisible man"}, {"contains": ["visible"]},
                 {"prefix": "the", "contains": ["visible"], "suffix": "man"}):
        r = client.post("/api/search/multi", json=body).json()
        exp = oracle(state, body.get("prefix", ""), tuple(body.get("contains", [])), body.get("suffix", ""))
        assert r["total"] == len(exp) > 0
        assert [x["id"] for x in r["results"]] == exp[:len(r["results"])]


def test_multi_clue_all_clues_must_match_same_title(client):
    r = client.post("/api/search/multi", json={"prefix": "harry potter", "contains": ["hobbit"]}).json()
    assert r["status"] == "no_match" and r["total"] == 0


def test_multi_clue_duplicates_listed_separately(client):
    r = client.post("/api/search/multi", json={"prefix": "pride and", "suffix": "prejudice"}).json()
    ids = [x["id"] for x in r["results"]]
    assert r["total"] >= 3 and ids == sorted(ids, reverse=True)


def test_multi_clue_facets(client, state):
    body = {"contains": ["dragon"], "facets": {"audience": "Children", "year_to": 2000}}
    r = client.post("/api/search/multi", json=body).json()
    assert r["facets_applied"] and r["total"] <= r["unfiltered_total"]
    for x in r["results"]:
        b = state.books[x["id"]]
        assert b["audience"] == "Children" and b["year"] is not None and b["year"] <= 2000


def test_multi_clue_requires_a_clue(client):
    assert client.post("/api/search/multi", json={"contains": ["", " "]}).status_code == 422


def test_multi_matches_linear_scan(state):
    eng = state.library_engine
    for p, cs, s in [("the", ["of"], ""), ("", ["an", "the"], "s"), ("a", [], "e"), ("", ["ston"], "")]:
        assert eng.multi(p, cs, s).ids == eng.multi_linear(p, cs, s).ids


# --- adaptive ------------------------------------------------------------------

def test_live_suggestions_update_and_are_not_logged(client):
    before = client.get("/api/history").json()["items"]
    a = client.post("/api/search/live", json={"prefix": "t"}).json()
    b = client.post("/api/search/live", json={"prefix": "the"}).json()
    c = client.post("/api/search/live", json={"prefix": "the", "contains": ["invisible"]}).json()
    assert a["total"] > b["total"] > c["total"] >= 1
    assert len(a["suggestions"]) <= 6
    assert client.get("/api/history").json()["items"] == before
    assert client.post("/api/search/live", json={}).json()["total"] == 0


def test_live_approximate_matches_are_labelled(client):
    r = client.post("/api/search/live", json={"prefix": "harry poter"}).json()
    assert r["total"] == 0 and r["suggestions"] == []
    assert r["approximate"], "a 1-edit spelling of 'harry potter' should be offered"
    for x in r["approximate"]:
        assert x["approximation"]["distance"] <= 2
        assert x["normalized_title"].startswith(x["approximation"]["matched"])
    short = client.post("/api/search/live", json={"prefix": "hxry"}).json()   # 4 letters: no typos allowed
    assert short["approximate"] == []


def test_refinement_suggestions_are_verified_and_separate(client):
    r = client.post("/api/search/refine", json={"prefix": "hary", "suffix": "azkaban"}).json()
    assert r["original_matches"] == 0
    assert r["original"] == {"prefix": "hary", "contains": [], "suffix": "azkaban"}
    assert r["suggestions"]
    for s in r["suggestions"]:
        assert s["exact"] is False and s["reason"] and s["match_count"] > 0
        m = client.post("/api/search/multi", json={"prefix": s["prefix"], "contains": s["contains"],
                                                   "suffix": s["suffix"]}).json()
        assert m["total"] == s["match_count"]
    assert any(s["prefix"] == "harry" for s in r["suggestions"])


def test_refinement_offers_existing_suffixes(client, state):
    r = client.post("/api/search/refine", json={"prefix": "the hobbit", "suffix": "xyzq"}).json()
    assert "change_suffix" in {s["kind"] for s in r["suggestions"]}
    for s in r["suggestions"]:
        if s["kind"] == "change_suffix":
            assert oracle(state, s["prefix"], (), s["suffix"])


def test_refinement_drops_impossible_contains(client):
    r = client.post("/api/search/refine", json={"prefix": "the", "contains": ["qqqzz"], "suffix": ""}).json()
    assert any(s["kind"] == "drop_contains" and s["contains"] == [] for s in r["suggestions"])


# --- author ------------------------------------------------------------------

def test_author_retrieval_case_insensitive(client, state):
    results = [client.post("/api/search/author", json={"name": q}).json()
               for q in ("agatha christie", "AGATHA CHRISTIE", "Agatha Christie")]
    for r in results:
        assert [a["name"] for a in r["authors"]] == ["Agatha Christie"]
    expected = sum(1 for b in state.books if "Agatha Christie" in b["authors"])
    assert all(r["total_books"] == expected for r in results) and expected >= 5


def test_author_multiple_authors_per_book(client):
    for q in ("neil gaiman", "terry pratchett"):
        r = client.post("/api/search/author", json={"name": q}).json()
        assert "Good Omens" in titles(r["authors"][0]["books"])
    books = client.post("/api/search/author", json={"name": "neil gaiman"}).json()["authors"][0]["books"]
    go = next(b for b in books if b["title"] == "Good Omens" and b["source"] == "curated")
    assert go["authors"] == ["Terry Pratchett", "Neil Gaiman"]


def test_author_names_merge_across_sources(client):
    r = client.post("/api/search/author", json={"name": "j k rowling"}).json()
    assert len(r["authors"]) == 1
    assert {b["source"] for b in r["authors"][0]["books"]} == {"curated", "goodbooks"}


def test_author_autocomplete_and_accents(client):
    r = client.get("/api/authors/autocomplete", params={"q": "bronte", "limit": 20}).json()
    assert {"Charlotte Brontë", "Emily Brontë"} <= {a["name"] for a in r["authors"]}
    r = client.get("/api/authors/autocomplete", params={"q": "arthur conan d"}).json()
    assert r["authors"][0]["name"] == "Arthur Conan Doyle"


def test_author_no_match(client):
    r = client.post("/api/search/author", json={"name": "zzzzqq"}).json()
    assert r["status"] == "no_match" and r["authors"] == []


# --- character & story -------------------------------------------------------

def test_story_detective_example(client):
    r = client.post("/api/search/story", json={"query": "A detective who wears a hat and solves mysteries."}).json()
    assert any("Sherlock" in t or "Scarlet" in t for t in titles(r["results"][:3]))
    first = r["results"][0]
    assert first["reasons"] and first["characters"] and first["plot"]


def test_story_by_character_setting_theme(client):
    cases = {
        "whaling captain obsessed with a white whale": "Moby-Dick",
        "firemen burn books censorship": "Fahrenheit 451",
        "vampire count in transylvania": "Dracula",
        "submarine captain nemo under the sea": "Twenty Thousand Leagues Under the Seas",
        "physician who transforms into an evil alter ego": "Strange Case of Dr Jekyll and Mr Hyde",
    }
    for q, expected in cases.items():
        r = client.post("/api/search/story", json={"query": q}).json()
        assert expected in titles(r["results"][:2]), (q, titles(r["results"][:3]))


def test_story_typos_and_synonyms_are_labelled(client):
    r = client.post("/api/search/story", json={"query": "vampyre romance"}).json()
    assert any(x["kind"] == "spelling" and x["from"] == "vampyre" for x in r["expansions"])
    assert any(x["to"] == "vampire" for x in r["expansions"])          # shown as a real word, not a stem
    r = client.post("/api/search/story", json={"query": "detective hat"}).json()
    assert any(x["kind"] == "related" and x["to"] == "cap" for x in r["expansions"])
    related = [x for res in r["results"] for x in res["reasons"] if x["related_to"]]
    assert related and all(x["kind"] != "direct" for x in related)
    r = client.post("/api/search/story", json={"query": "lion witch closet"}).json()
    assert any(x["to"] == "wardrobe" for x in r["expansions"])
    assert any("Wardrobe" in t for t in titles(r["results"][:3]))


def test_story_facets_and_dedupe(client):
    r = client.post("/api/search/story", json={"query": "dragons", "facets": {"audience": "Children"}}).json()
    assert r["facets_applied"] and r["results"]
    assert all(x["audience"] == "Children" for x in r["results"])
    r = client.post("/api/search/story", json={"query": "frankenstein creature"}).json()
    shown = [x["id"] for x in r["results"]]
    for x in r["results"]:
        assert not set(x["also_catalogued_as"]) & (set(shown) - {x["id"]})


def test_story_no_match(client):
    assert client.post("/api/search/story", json={"query": "qxzv wbbq"}).json()["status"] == "no_match"


# --- catalogue, book page, feedback, history, stats --------------------------

def test_catalog_preserves_insertion_order_and_paginates(client, state):
    p1 = client.get("/api/catalog", params={"page": 1, "page_size": 10}).json()
    p2 = client.get("/api/catalog", params={"page": 2, "page_size": 10}).json()
    assert [x["id"] for x in p1["items"] + p2["items"]] == list(range(20))
    assert p1["total"] == len(state.books) == 10060
    f = client.get("/api/catalog", params={"genre": "Mystery", "audience": "General", "source": "goodbooks"}).json()
    assert f["total"] > 0 and all(x["genre"] == "Mystery" and x["source"] == "goodbooks" for x in f["items"])
    d = client.get("/api/catalog", params={"q": "frankenstein"}).json()
    assert d["total"] >= 3


def test_book_detail_and_links(client):
    b = client.get("/api/books/9").json()
    assert b["title"] == "Frankenstein" and b["plot"] and b["characters"]
    assert any("Gutenberg" in l["label"] for l in b["links"])   # published before 1930
    assert b["linked"] and all(x["source"] == "goodbooks" for x in b["linked"])
    assert b["cover_isbn"]                                        # borrowed from the linked record
    assert client.get("/api/books/999999").status_code == 404
    assert client.get("/api/facets").json()["genres"]


def test_feedback_is_recorded(client):
    r = client.post("/api/search/title", json={"prefix": "dra", "suffix": "ula"}).json()
    before = client.get("/api/overview").json()["confirmed_found"]
    fb = client.post("/api/feedback", json={"search_id": r["search_id"], "search_type": "basic", "found": True,
                                            "record_id": r["record"]["id"]}).json()
    assert fb["found"] >= 1
    assert client.get("/api/overview").json()["confirmed_found"] == before + 1
    hist = client.get("/api/history").json()["items"]
    assert any(h["id"] == r["search_id"] and h["feedback"] == "found" for h in hist)
    assert client.post("/api/feedback", json={"search_type": "nope", "found": True}).status_code == 422


def test_history_keeps_last_five_and_clears(client):
    client.delete("/api/history")
    for i in range(7):
        client.post("/api/search/title", json={"prefix": "the", "suffix": f"{'abcdefg'[i]}"})
    items = client.get("/api/history").json()["items"]
    assert len(items) == 5
    assert items[0]["clues"]["suffix"] == "g" and items[-1]["clues"]["suffix"] == "c"
    client.delete("/api/history")
    assert client.get("/api/history").json()["items"] == []


def test_stats_and_selfcheck(client):
    before = client.get("/api/overview").json()["total_searches"]
    client.post("/api/search/title", json={"prefix": "emma", "suffix": "emma"})
    client.post("/api/search/title", json={"prefix": "zz", "suffix": "zz"})
    assert client.get("/api/overview").json()["total_searches"] == before + 2
    perf = client.get("/api/stats/performance").json()
    assert perf["engines"][1]["records"] == 1000 and perf["engines"][1]["build_count"] == 1
    assert perf["engines"][0]["max_affix"] == 12
    sc = client.get("/api/stats/selfcheck").json()
    assert sc["passed"] == sc["total"], [c for c in sc["checks"] if not c["passed"]]
    bm = client.get("/api/stats/benchmark", params={"dataset": "dsa", "queries": 2000}).json()
    assert bm["exact"]["results_agree"] and bm["multi"]["results_agree"] and bm["hash_baseline"]["results_agree"]
    lb = client.get("/api/stats/benchmark", params={"dataset": "library", "queries": 500}).json()
    assert lb["exact"]["results_agree"] and lb["hash_baseline"] is None
    sc2 = client.get("/api/stats/scaling", params={"queries": 200, "dataset": "library"}).json()
    assert sc2["rows"][-1]["catalog_size"] == 10060 and all(r["results_agree"] for r in sc2["rows"])


def test_index_reused_across_api_queries(client, state):
    before = state.library_engine.stats()
    for _ in range(20):
        client.post("/api/search/title", json={"prefix": "dra", "suffix": "ula"})
    after = state.library_engine.stats()
    assert after["build_count"] == before["build_count"] == 1
    assert after["indexed_queries"] >= before["indexed_queries"] + 20
