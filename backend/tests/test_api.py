"""API-level tests for every retrieval capability."""


def titles(results):
    return [r["title"] for r in results]


# --- basic prefix + suffix ---------------------------------------------------

def test_basic_search_returns_latest_record(client):
    r = client.post("/api/search/title", json={"prefix": "frank", "suffix": "stein"}).json()
    assert r["status"] == "match"
    assert r["record"]["title"] == "Frankenstein" and r["record"]["year"] == 1831
    assert r["matching_records"] == 2


def test_basic_search_no_match(client):
    r = client.post("/api/search/title", json={"prefix": "zzz", "suffix": "qqq"}).json()
    assert r["status"] == "no_match" and r["record"] is None


def test_basic_search_empty_input_is_rejected(client):
    for body in ({"prefix": "", "suffix": "x"}, {"prefix": "x", "suffix": ""}, {"prefix": " ", "suffix": " "}):
        res = client.post("/api/search/title", json=body)
        assert res.status_code == 422
        assert "Enter" in res.json()["detail"]


def test_basic_search_on_dsa_catalog(client, state):
    names = state.dsa_names
    r = client.post("/api/search/title", json={"dataset": "dsa", "prefix": "em", "suffix": "ma"}).json()
    expected = max(i for i, n in enumerate(names) if n.startswith("em") and n.endswith("ma"))
    assert r["record"]["id"] == expected


# --- multi-clue --------------------------------------------------------------

def test_multi_clue_multiple_contains(client):
    r = client.post("/api/search/multi", json={"prefix": "harry", "contains": ["potter", "of"], "suffix": ""}).json()
    assert titles(r["results"]) == ["Harry Potter and the Prisoner of Azkaban",
                                    "Harry Potter and the Chamber of Secrets"]
    ids = [x["id"] for x in r["results"]]
    assert ids == sorted(ids, reverse=True)
    spans = r["results"][0]["matched_clues"]
    assert {s["type"] for s in spans} == {"prefix", "contains"}
    assert all(s["start"] >= 0 for s in spans)


def test_multi_clue_any_combination(client):
    only_suffix = client.post("/api/search/multi", json={"suffix": "man"}).json()
    assert set(titles(only_suffix["results"])) == {"The Invisible Man", "Invisible Man", "The Talisman"}
    only_contains = client.post("/api/search/multi", json={"contains": ["visible"]}).json()
    assert only_contains["total"] == 2
    all_three = client.post("/api/search/multi", json={"prefix": "the", "contains": ["visible"], "suffix": "man"}).json()
    assert titles(all_three["results"]) == ["The Invisible Man"]


def test_multi_clue_all_clues_must_match_same_title(client):
    r = client.post("/api/search/multi", json={"prefix": "harry", "contains": ["hobbit"]}).json()
    assert r["status"] == "no_match" and r["total"] == 0


def test_multi_clue_duplicates_listed_separately(client):
    r = client.post("/api/search/multi", json={"prefix": "pride", "suffix": "prejudice"}).json()
    assert r["total"] == 2 and [x["id"] for x in r["results"]] == sorted([x["id"] for x in r["results"]], reverse=True)


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
    c = client.post("/api/search/live", json={"prefix": "the", "contains": ["visible"]}).json()
    assert a["total"] > b["total"] > c["total"] == 1
    assert c["suggestions"][0]["title"] == "The Invisible Man"
    assert len(a["suggestions"]) <= 6
    assert client.get("/api/history").json()["items"] == before
    assert client.post("/api/search/live", json={}).json()["total"] == 0


def test_refinement_suggestions_are_verified_and_separate(client):
    r = client.post("/api/search/refine", json={"prefix": "hary", "suffix": "stone"}).json()
    assert r["original_matches"] == 0
    assert r["original"] == {"prefix": "hary", "contains": [], "suffix": "stone"}
    assert r["suggestions"], "expected alternative clues"
    for s in r["suggestions"]:
        assert s["exact"] is False and s["reason"] and s["match_count"] > 0
        # retrying a suggestion really matches
        m = client.post("/api/search/multi", json={"prefix": s["prefix"], "contains": s["contains"],
                                                   "suffix": s["suffix"]}).json()
        assert m["total"] == s["match_count"]
    assert any(s["prefix"] == "harry" for s in r["suggestions"])


def test_refinement_offers_existing_suffixes(client):
    r = client.post("/api/search/refine", json={"prefix": "harry", "suffix": "xyz"}).json()
    kinds = {s["kind"] for s in r["suggestions"]}
    assert "change_suffix" in kinds
    assert {"secrets", "azkaban", "stone"} <= {s["suffix"] for s in r["suggestions"]}


def test_refinement_drops_impossible_contains(client):
    r = client.post("/api/search/refine", json={"prefix": "the", "contains": ["qqqq"], "suffix": ""}).json()
    assert any(s["kind"] == "drop_contains" and s["contains"] == [] for s in r["suggestions"])


# --- author ------------------------------------------------------------------

def test_author_retrieval_case_insensitive(client):
    for q in ("agatha christie", "AGATHA", "christie", "Christie"):
        r = client.post("/api/search/author", json={"name": q}).json()
        assert [a["name"] for a in r["authors"]] == ["Agatha Christie"]
        assert r["total_books"] == 5


def test_author_multiple_authors_per_book(client):
    for q in ("gaiman", "pratchett"):
        r = client.post("/api/search/author", json={"name": q}).json()
        assert "Good Omens" in titles(r["authors"][0]["books"])
    good_omens = client.post("/api/search/author", json={"name": "neil gaiman"}).json()["authors"][0]["books"][0]
    assert good_omens["authors"] == ["Terry Pratchett", "Neil Gaiman"]


def test_author_autocomplete_and_accents(client):
    r = client.get("/api/authors/autocomplete", params={"q": "bro"}).json()
    assert {"Charlotte Brontë", "Emily Brontë"} <= {a["name"] for a in r["authors"]}
    r = client.get("/api/authors/autocomplete", params={"q": "conan d"}).json()
    assert r["authors"][0]["name"] == "Arthur Conan Doyle"


def test_author_no_match(client):
    r = client.post("/api/search/author", json={"name": "zzzz"}).json()
    assert r["status"] == "no_match" and r["authors"] == []


# --- character & story -------------------------------------------------------

def test_story_detective_example(client):
    r = client.post("/api/search/story", json={"query": "A detective who wears a hat and solves mysteries."}).json()
    top = titles(r["results"][:3])
    assert any("Sherlock" in t or "Scarlet" in t for t in top)
    first = r["results"][0]
    assert first["reasons"] and first["characters"] and first["plot"]


def test_story_by_character_setting_theme(client):
    cases = {
        "boy wizard at a school of magic": "Harry Potter",
        "whaling captain obsessed with a white whale": "Moby-Dick",
        "firemen burn books censorship": "Fahrenheit 451",
        "vampire count in transylvania": "Dracula",
        "submarine captain under the sea": "Twenty Thousand Leagues Under the Seas",
    }
    for q, expected in cases.items():
        r = client.post("/api/search/story", json={"query": q}).json()
        assert expected in r["results"][0]["title"], (q, titles(r["results"][:3]))


def test_story_related_terms_are_labelled(client):
    r = client.post("/api/search/story", json={"query": "detective hat"}).json()
    related = [x for res in r["results"] for x in res["reasons"] if x["related_to"]]
    assert related and related[0]["related_to"] == "hat"


def test_story_no_match(client):
    r = client.post("/api/search/story", json={"query": "xylophone quasar"}).json()
    assert r["status"] == "no_match"


# --- catalog, history, stats ---------------------------------------------------

def test_catalog_preserves_insertion_order_and_paginates(client, state):
    p1 = client.get("/api/catalog", params={"page": 1, "page_size": 10}).json()
    p2 = client.get("/api/catalog", params={"page": 2, "page_size": 10}).json()
    ids = [x["id"] for x in p1["items"] + p2["items"]]
    assert ids == list(range(20))
    assert p1["total"] == len(state.books)
    f = client.get("/api/catalog", params={"genre": "Mystery"}).json()
    assert f["total"] > 0 and all(x["genre"] == "Mystery" for x in f["items"])
    d = client.get("/api/catalog", params={"q": "frankenstein"}).json()
    assert d["total"] == 2 and all(x["duplicate_count"] == 2 for x in d["items"])


def test_history_keeps_last_five_and_clears(client):
    client.delete("/api/history")
    for i in range(7):
        client.post("/api/search/title", json={"prefix": "the", "suffix": f"{'abcdefg'[i]}"})
    items = client.get("/api/history").json()["items"]
    assert len(items) == 5
    assert items[0]["clues"]["suffix"] == "g" and items[-1]["clues"]["suffix"] == "c"
    assert {"search_type", "clues", "result_summary", "status"} <= set(items[0])
    client.delete("/api/history")
    assert client.get("/api/history").json()["items"] == []


def test_stats_and_selfcheck(client):
    before = client.get("/api/overview").json()["total_searches"]
    client.post("/api/search/title", json={"prefix": "emma", "suffix": "emma"})
    client.post("/api/search/title", json={"prefix": "zz", "suffix": "zz"})
    ov = client.get("/api/overview").json()
    assert ov["total_searches"] == before + 2
    perf = client.get("/api/stats/performance").json()
    assert perf["engines"][1]["records"] == 1000 and perf["engines"][1]["build_count"] == 1
    sc = client.get("/api/stats/selfcheck").json()
    assert sc["passed"] == sc["total"]
    bm = client.get("/api/stats/benchmark", params={"dataset": "dsa", "queries": 2000}).json()
    assert bm["exact"]["results_agree"] and bm["multi"]["results_agree"]
    sc2 = client.get("/api/stats/scaling", params={"queries": 200}).json()
    assert [r["catalog_size"] for r in sc2["rows"]][-1] == 1000


def test_index_reused_across_api_queries(client, state):
    before = state.library_engine.stats()
    for _ in range(20):
        client.post("/api/search/title", json={"prefix": "dra", "suffix": "ula"})
    after = state.library_engine.stats()
    assert after["build_count"] == before["build_count"] == 1
    assert after["indexed_queries"] >= before["indexed_queries"] + 20
