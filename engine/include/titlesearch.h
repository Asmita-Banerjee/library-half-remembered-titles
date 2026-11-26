/*
 * titlesearch.h - C search engine for "The Library's Half-Remembered Titles"
 *
 * One TSIndex holds a fixed, insertion-ordered list of titles and, after
 * ts_build(), four indexes built exactly once:
 *
 *   1. Prefix-suffix Trie   keys  "<suffix>|<word>"  -> latest id per (prefix, suffix)
 *   2. Prefix Trie          title chars               -> sorted id list per node
 *   3. Suffix Trie          reversed title chars      -> sorted id list per node
 *   4. N-gram postings      every 1/2/3-gram          -> sorted id list
 *
 * Exact prefix+suffix queries use (1) only and never scan titles.
 * Multi-clue queries intersect posting lists from (2), (3), (4) and verify
 * only the surviving candidates for "contains" clues longer than 3 chars.
 *
 * Record ids are 0-based insertion positions. All functions are
 * single-threaded; callers must serialise access to one index.
 */
#ifndef TITLESEARCH_H
#define TITLESEARCH_H

#ifdef __cplusplus
extern "C" {
#endif

#define TS_MAX_TITLE 256      /* max normalised title / clue length (bytes) */
#define TS_SEPARATOR '|'      /* never produced by ts_normalize            */

/* Return codes */
#define TS_NO_MATCH   (-1)
#define TS_INVALID    (-2)    /* empty clue, not built, or bad argument     */
#define TS_BUILT      (-3)    /* ts_add after ts_build                       */

typedef struct TSIndex TSIndex;

/* Lifecycle */
TSIndex *ts_create(void);
/* max_affix > 0 limits the prefix-suffix trie to prefixes and suffixes of at
 * most that many characters (bounds memory for large catalogues). Longer
 * clues are answered by intersecting the prefix- and suffix-trie id lists. */
TSIndex *ts_create_ex(int max_affix);
void     ts_destroy(TSIndex *idx);
int      ts_add(TSIndex *idx, const char *title);   /* returns new id or error */
int      ts_build(TSIndex *idx);                    /* 0 ok, TS_BUILT if repeated */
int      ts_is_built(const TSIndex *idx);
int      ts_size(const TSIndex *idx);
const char *ts_title(const TSIndex *idx, int id);   /* normalised title or NULL */

/* UTF-8 in. Folds Latin accents to ASCII (é->e, ß->ss, œ->oe), curly
 * apostrophes to ', lowercases, keeps a-z 0-9 ' -, collapses whitespace,
 * dashes and punctuation runs to one space, trims, and drops anything else
 * (other scripts). Returns resulting length (truncated to cap-1). A title
 * that normalises to "" is still stored (its id is kept) but not indexed. */
int ts_normalize(const char *in, char *out, int cap);

/* Exact latest-match query (indexed). Both clues must be non-empty. */
int ts_query(TSIndex *idx, const char *prefix, const char *suffix);
/* Which structure answered the last ts_query: 0 = prefix-suffix trie,
 * 1 = prefix/suffix-trie intersection (clue longer than max_affix). */
int ts_last_path(const TSIndex *idx);
int ts_max_affix(const TSIndex *idx);
/* Same answer by scanning every title from newest to oldest (baseline). */
int ts_query_linear(TSIndex *idx, const char *prefix, const char *suffix);

/* Multi-clue query. prefix / suffix may be NULL or "" (ignored); contains is
 * an array of ncontains strings (empty entries ignored). At least one clue
 * must be non-empty. Writes up to cap ids into out, newest first. Returns the
 * total number of matches (may exceed cap) or TS_INVALID.
 * *examined receives how many titles were looked at (verification work). */
int ts_multi(TSIndex *idx, const char *prefix, const char *const *contains,
             int ncontains, const char *suffix, int *out, int cap, int *examined);
int ts_multi_linear(TSIndex *idx, const char *prefix, const char *const *contains,
                    int ncontains, const char *suffix, int *out, int cap, int *examined);

/* All ids whose title starts / ends with the clue, newest first. */
int ts_prefix_ids(const TSIndex *idx, const char *prefix, int *out, int cap);
int ts_suffix_ids(const TSIndex *idx, const char *suffix, int *out, int cap);

/* Length of the longest leading part of `prefix` that some title starts with
 * (resp. longest trailing part of `suffix` that some title ends with). */
int ts_longest_prefix(const TSIndex *idx, const char *prefix);
int ts_longest_suffix(const TSIndex *idx, const char *suffix);

/* Trie + Levenshtein search: catalog prefixes (is_suffix=0) or suffixes
 * (is_suffix=1) within edit distance maxdist (1..2) of clue, excluding the
 * clue itself. Writes lines "variant\tcount\tdistance\n" into buf, sorted by
 * distance then count desc. Returns number of lines written. */
int ts_fuzzy(const TSIndex *idx, const char *clue, int is_suffix, int maxdist,
             int limit, char *buf, int bufcap);

/* Benchmarks timed inside C (CLOCK_MONOTONIC), so the Python binding's
 * per-call overhead is excluded. Runs n queries with the indexed (linear=0)
 * or scanning (linear=1) algorithm, writes each answer to out (may be NULL)
 * and returns elapsed nanoseconds. ts_bench_multi uses one contains clue per
 * query (NULL / "" = none) and stores match counts. */
double ts_bench_exact(TSIndex *idx, const char *const *prefixes, const char *const *suffixes,
                      int n, int linear, int *out);
double ts_bench_multi(TSIndex *idx, const char *const *prefixes, const char *const *contains,
                      const char *const *suffixes, int n, int linear, int *out);

/* Hash-map baseline (all (prefix, suffix) pairs -> latest id), built on
 * demand and freed after the run; only for indexes created without a cap.
 * Returns query nanoseconds; build time and bytes via out-params. */
double ts_bench_hash(TSIndex *idx, const char *const *prefixes, const char *const *suffixes, int n, int *out,
                     double *build_ns, long *bytes);

/* Statistics */
long ts_ps_nodes(const TSIndex *idx);        /* nodes in prefix-suffix trie   */
long ts_ps_keys(const TSIndex *idx);         /* combined keys inserted (sum L)  */
long ts_ps_combinations(const TSIndex *idx); /* (prefix,suffix) pairs (sum L^2) */
long ts_ps_distinct(const TSIndex *idx);     /* distinct (prefix,suffix) nodes  */
long ts_aux_nodes(const TSIndex *idx);       /* prefix + suffix trie nodes      */
long ts_ngram_keys(const TSIndex *idx);      /* distinct n-grams                */
long ts_memory_bytes(const TSIndex *idx);    /* approximate index memory        */
long ts_build_count(const TSIndex *idx);     /* how many times indexes were built */
long ts_query_count(const TSIndex *idx);     /* indexed queries served          */

#ifdef __cplusplus
}
#endif
#endif
