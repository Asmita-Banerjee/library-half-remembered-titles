/*
 * titlesearch_cli - the original constrained problem, solved with the engine.
 *
 * Input (stdin):
 *   N                 number of names (1..1000)
 *   name_0 ... name_{N-1}   lowercase single words, length 1..8, in insertion order
 *   Q                 number of queries (1..2000)
 *   Q lines: <prefix> <suffix>
 * Output: one line per query - the id (0-based insertion index) of the latest
 * inserted name with that prefix and suffix, or -1.
 *
 * Flags: --loose  skip the original constraints (any title, any length)
 *        --stats  print index statistics and timings to stderr
 */
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "titlesearch.h"

#define MAX_NAMES 1000
#define MAX_LEN 8
#define MAX_QUERIES 2000

static double now_ms(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec * 1e3 + t.tv_nsec / 1e6;
}

static int valid_name(const char *s) {
    size_t n = strlen(s);
    if (n == 0 || n > MAX_LEN) return 0;
    for (size_t i = 0; i < n; i++)
        if (!islower((unsigned char)s[i])) return 0;
    return 1;
}

int main(int argc, char **argv) {
    int strict = 1, stats = 0;
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--loose")) strict = 0;
        else if (!strcmp(argv[i], "--stats")) stats = 1;
        else {
            fprintf(stderr, "usage: %s [--loose] [--stats] < input\n", argv[0]);
            return 2;
        }
    }

    int n, q;
    char a[TS_MAX_TITLE], b[TS_MAX_TITLE];
    if (scanf("%d", &n) != 1 || n < 1 || (strict && n > MAX_NAMES)) {
        fprintf(stderr, "error: N must be 1..%d\n", MAX_NAMES);
        return 1;
    }
    TSIndex *idx = ts_create();
    for (int i = 0; i < n; i++) {
        if (scanf("%255s", a) != 1) {
            fprintf(stderr, "error: expected %d names\n", n);
            return 1;
        }
        if (strict && !valid_name(a)) {
            fprintf(stderr, "error: name %d '%s' must be lowercase a-z, length 1..%d\n", i, a, MAX_LEN);
            return 1;
        }
        ts_add(idx, a);
    }
    double t0 = now_ms();
    ts_build(idx); /* built exactly once */
    double t1 = now_ms();

    if (scanf("%d", &q) != 1 || q < 0 || (strict && q > MAX_QUERIES)) {
        fprintf(stderr, "error: Q must be 0..%d\n", MAX_QUERIES);
        return 1;
    }
    double tq = 0;
    for (int i = 0; i < q; i++) {
        if (scanf("%255s %255s", a, b) != 2) {
            fprintf(stderr, "error: expected %d queries\n", q);
            return 1;
        }
        double s0 = now_ms();
        int r = ts_query(idx, a, b);
        tq += now_ms() - s0;
        printf("%d\n", r < 0 ? -1 : r);
    }
    if (stats) {
        fprintf(stderr, "names=%d queries=%d build_ms=%.3f query_total_ms=%.3f\n", n, q, t1 - t0, tq);
        fprintf(stderr, "ps_nodes=%ld combined_keys=%ld combinations=%ld distinct=%ld memory=%ld bytes\n",
                ts_ps_nodes(idx), ts_ps_keys(idx), ts_ps_combinations(idx), ts_ps_distinct(idx),
                ts_memory_bytes(idx));
    }
    ts_destroy(idx);
    return 0;
}
