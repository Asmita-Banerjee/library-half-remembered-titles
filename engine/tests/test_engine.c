/* Unit tests for the C engine. Run with `make test`. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "titlesearch.h"

static int failures = 0, checks = 0;
#define CHECK(cond)                                                              \
    do {                                                                         \
        checks++;                                                                \
        if (!(cond)) {                                                           \
            failures++;                                                          \
            fprintf(stderr, "  FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);   \
        }                                                                        \
    } while (0)

static TSIndex *make(const char **words, int n) {
    TSIndex *idx = ts_create();
    for (int i = 0; i < n; i++) ts_add(idx, words[i]);
    ts_build(idx);
    return idx;
}

static void test_basic_prefix_suffix(void) {
    const char *w[] = {"apple", "apply", "ample", "maple"};
    TSIndex *idx = make(w, 4);
    CHECK(ts_query(idx, "a", "e") == 2);      /* ample is the latest a..e */
    CHECK(ts_query(idx, "app", "le") == 0);
    CHECK(ts_query(idx, "app", "y") == 1);
    CHECK(ts_query(idx, "m", "e") == 3);
    CHECK(ts_query(idx, "apple", "apple") == 0); /* whole word both sides */
    CHECK(ts_query(idx, "ap", "pl") == TS_NO_MATCH);
    ts_destroy(idx);
}

static void test_latest_and_duplicates(void) {
    const char *w[] = {"emma", "dracula", "emma", "emmet", "emma"};
    TSIndex *idx = make(w, 5);
    CHECK(ts_size(idx) == 5);                  /* duplicates kept as records */
    CHECK(ts_query(idx, "em", "ma") == 4);
    CHECK(ts_query(idx, "emm", "t") == 3);
    int out[8], ex;
    CHECK(ts_multi(idx, "emma", NULL, 0, "emma", out, 8, &ex) == 3);
    CHECK(out[0] == 4 && out[1] == 2 && out[2] == 0);
    ts_destroy(idx);
}

static void test_no_match_and_empty(void) {
    const char *w[] = {"rebecca"};
    TSIndex *idx = make(w, 1);
    CHECK(ts_query(idx, "x", "a") == TS_NO_MATCH);
    CHECK(ts_query(idx, "rebeccaa", "a") == TS_NO_MATCH);
    CHECK(ts_query(idx, "", "a") == TS_INVALID);
    CHECK(ts_query(idx, "r", "") == TS_INVALID);
    CHECK(ts_query(idx, "   ", "a") == TS_INVALID);
    CHECK(ts_multi(idx, "", NULL, 0, "", NULL, 0, NULL) == TS_INVALID);
    ts_destroy(idx);
}

static void test_build_once(void) {
    const char *w[] = {"hamlet"};
    TSIndex *idx = make(w, 1);
    CHECK(ts_build(idx) == TS_BUILT);
    CHECK(ts_add(idx, "othello") == TS_BUILT);
    for (int i = 0; i < 100; i++) ts_query(idx, "ham", "let");
    CHECK(ts_build_count(idx) == 1);
    CHECK(ts_query_count(idx) == 100);
    ts_destroy(idx);
}

static void test_multi_clue(void) {
    const char *w[] = {"harry potter and the philosopher's stone",
                       "harry potter and the chamber of secrets",
                       "harry potter and the prisoner of azkaban",
                       "the hobbit", "the time machine", "the invisible man", "invisible man"};
    TSIndex *idx = make(w, 7);
    int out[16], ex;
    const char *c1[] = {"potter", "of"};
    CHECK(ts_multi(idx, "harry", c1, 2, NULL, out, 16, &ex) == 2);
    CHECK(out[0] == 2 && out[1] == 1);         /* descending ids */
    const char *c2[] = {"ma"};
    CHECK(ts_multi(idx, "the", c2, 1, NULL, out, 16, &ex) == 2);
    CHECK(ts_multi(idx, NULL, NULL, 0, "man", out, 16, &ex) == 2);
    CHECK(out[0] == 6 && out[1] == 5);
    const char *c3[] = {"visible", "zzz"};
    CHECK(ts_multi(idx, NULL, c3, 2, NULL, out, 16, &ex) == 0);
    const char *c4[] = {"ston"};                /* trigram candidates then verify */
    CHECK(ts_multi(idx, NULL, c4, 1, NULL, out, 16, &ex) == 1 && out[0] == 0);
    CHECK(ts_multi(idx, "The ", NULL, 0, "MAN", out, 16, &ex) == 1 && out[0] == 5); /* case */
    ts_destroy(idx);
}

static unsigned rng = 12345u;
static unsigned next(void) { return rng = rng * 1103515245u + 12345u, (rng >> 16) & 0x7fff; }

static void test_max_size_agrees_with_linear(void) {
    TSIndex *idx = ts_create();
    char w[1000][9];
    for (int i = 0; i < 1000; i++) {
        int L = 1 + (int)(next() % 8);
        if (i % 10 == 0) L = 8;                      /* plenty of max-length names */
        for (int j = 0; j < L; j++) w[i][j] = (char)('a' + next() % 4); /* small alphabet => collisions */
        w[i][L] = '\0';
        CHECK(ts_add(idx, w[i]) == i);
    }
    CHECK(ts_build(idx) == 0);
    CHECK(ts_ps_combinations(idx) > 0);
    int mismatch = 0;
    for (int qi = 0; qi < 2000; qi++) {
        const char *src = w[next() % 1000];
        int L = (int)strlen(src);
        char p[9], s[9];
        int pl = 1 + (int)(next() % L), sl = 1 + (int)(next() % L);
        memcpy(p, src, (size_t)pl); p[pl] = 0;
        memcpy(s, src + L - sl, (size_t)sl); s[sl] = 0;
        if (qi % 5 == 0) p[0] = 'z';                 /* guaranteed misses */
        if (ts_query(idx, p, s) != ts_query_linear(idx, p, s)) mismatch++;
        int a[1000], b[1000], e1, e2;
        const char *c[] = {"ab"};
        int ra = ts_multi(idx, p, c, qi % 2, s, a, 1000, &e1);
        int rb = ts_multi_linear(idx, p, c, qi % 2, s, b, 1000, &e2);
        if (ra != rb || (ra > 0 && memcmp(a, b, (size_t)ra * sizeof(int)))) mismatch++;
    }
    CHECK(mismatch == 0);
    CHECK(ts_build_count(idx) == 1);
    ts_destroy(idx);
}

static void test_fuzzy_and_longest(void) {
    const char *w[] = {"dracula", "dragon", "emma"};
    TSIndex *idx = make(w, 3);
    char buf[1024];
    int n = ts_fuzzy(idx, "drx", 0, 1, 10, buf, sizeof buf);
    CHECK(n > 0 && strstr(buf, "dr\t2\t1") != NULL);   /* deletion of last char */
    CHECK(strstr(buf, "dra\t2\t1") != NULL);           /* substitution */
    n = ts_fuzzy(idx, "ulx", 1, 1, 10, buf, sizeof buf);
    CHECK(n > 0);
    CHECK(ts_longest_prefix(idx, "draxyz") == 3);
    CHECK(ts_longest_suffix(idx, "zzla") == 2);
    ts_destroy(idx);
}

static void test_normalize(void) {
    char out[64];
    CHECK(ts_normalize("  The Lion, the  Witch!  ", out, 64) == 18 && !strcmp(out, "the lion the witch"));
    CHECK(ts_normalize("Philosopher's|Stone", out, 64) && !strcmp(out, "philosopher'sstone"));
}

static void test_accents_and_unicode(void) {
    char out[64];
    CHECK(ts_normalize("Les Mis\xc3\xa9rables", out, 64) && !strcmp(out, "les miserables"));
    CHECK(ts_normalize("Sh\xc5\x8dgun", out, 64) && !strcmp(out, "shogun"));
    CHECK(ts_normalize("Miss Peregrine\xe2\x80\x99s Home", out, 64) && !strcmp(out, "miss peregrine's home"));
    CHECK(ts_normalize("School's Out\xe2\x80\x94" "Forever", out, 64) && !strcmp(out, "school's out forever"));
    CHECK(ts_normalize("Stra\xc3\x9f" "e", out, 64) && !strcmp(out, "strasse"));
    CHECK(ts_normalize("\xd8\xb9\xd8\xb2", out, 64) == 0);          /* Arabic: nothing to index */
    const char *w[] = {"Les Mis\xc3\xa9rables", "\xd8\xb9\xd8\xb2", "Emma"};
    TSIndex *idx = make(w, 3);
    CHECK(ts_size(idx) == 3);                     /* unindexable title keeps its id */
    CHECK(ts_query(idx, "les mis\xc3\xa9", "rables") == 0);
    CHECK(ts_query(idx, "les mise", "rables") == 0);
    CHECK(ts_query(idx, "em", "ma") == 2);
    ts_destroy(idx);
}

static void test_affix_cap_matches_uncapped(void) {
    TSIndex *full = ts_create(), *capped = ts_create_ex(4);
    char w[400][24];
    for (int i = 0; i < 400; i++) {
        int L = 1 + (int)(next() % 20);
        for (int j = 0; j < L; j++) w[i][j] = (char)('a' + next() % 3);
        w[i][L] = '\0';
        ts_add(full, w[i]);
        ts_add(capped, w[i]);
    }
    ts_build(full);
    ts_build(capped);
    CHECK(ts_ps_nodes(capped) < ts_ps_nodes(full));
    int mismatch = 0, fallback = 0;
    for (int q = 0; q < 3000; q++) {
        const char *src = w[next() % 400];
        int L = (int)strlen(src);
        char p[24], s[24];
        int pl = 1 + (int)(next() % L), sl = 1 + (int)(next() % L);
        memcpy(p, src, (size_t)pl); p[pl] = 0;
        memcpy(s, src + L - sl, (size_t)sl); s[sl] = 0;
        if (q % 7 == 0) p[0] = 'c';
        int a = ts_query(full, p, s), b = ts_query(capped, p, s);
        fallback += ts_last_path(capped);
        if (a != b || a != ts_query_linear(full, p, s)) mismatch++;
    }
    CHECK(mismatch == 0);
    CHECK(fallback > 0);
    ts_destroy(full);
    ts_destroy(capped);
}

static void test_hash_baseline_agrees(void) {
    const char *w[] = {"apple", "apply", "ample", "maple", "apple"};
    TSIndex *idx = make(w, 5);
    const char *P[] = {"a", "app", "m", "ap", "x", "apple"};
    const char *S[] = {"e", "y", "le", "pl", "x", "apple"};
    int out[6];
    double build_ns = 0;
    long bytes = 0;
    CHECK(ts_bench_hash(idx, P, S, 6, out, &build_ns, &bytes) >= 0);
    for (int i = 0; i < 6; i++) CHECK(out[i] == ts_query(idx, P[i], S[i]));
    CHECK(bytes > 0);
    TSIndex *capped = ts_create_ex(3);
    ts_add(capped, "apple");
    ts_build(capped);
    CHECK(ts_bench_hash(capped, P, S, 1, out, NULL, NULL) < 0);   /* full pair set only */
    ts_destroy(capped);
    ts_destroy(idx);
}

int main(void) {
    test_basic_prefix_suffix();
    test_latest_and_duplicates();
    test_no_match_and_empty();
    test_build_once();
    test_multi_clue();
    test_max_size_agrees_with_linear();
    test_fuzzy_and_longest();
    test_normalize();
    test_accents_and_unicode();
    test_affix_cap_matches_uncapped();
    test_hash_baseline_agrees();
    printf("%d checks, %d failures\n", checks, failures);
    return failures ? 1 : 0;
}
