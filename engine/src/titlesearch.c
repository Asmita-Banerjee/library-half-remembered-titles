/*
 * titlesearch.c - implementation of the C search engine.
 * See include/titlesearch.h for the public contract and README.md for the
 * complexity analysis.
 */
#include "titlesearch.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

typedef struct {
    int *v;
    int len, cap;
} IntVec;

static int vec_push(IntVec *a, int x) {
    if (a->len == a->cap) {
        int nc = a->cap ? a->cap * 2 : 4;
        int *nv = (int *)realloc(a->v, (size_t)nc * sizeof(int));
        if (!nv) return -1;
        a->v = nv;
        a->cap = nc;
    }
    a->v[a->len++] = x;
    return 0;
}

static void vec_free(IntVec *a) {
    free(a->v);
    a->v = NULL;
    a->len = a->cap = 0;
}

/* ------------------------------------------------------------------ */
/* Trie: left-child / right-sibling nodes in a growable pool.          */
/* Alphabet is small (a-z 0-9 space ' - |), so a sibling scan is O(1)  */
/* per character while each node costs only ~16 bytes (+ id list).     */
/* ------------------------------------------------------------------ */

typedef struct {
    int child;          /* first child index or -1                      */
    int sib;            /* next sibling index or -1                     */
    int latest;         /* prefix-suffix trie: latest id, else -1       */
    unsigned char ch;
    IntVec ids;         /* prefix/suffix tries: ascending ids in subtree */
} Node;

typedef struct {
    Node *n;
    int len, cap;
    int keep_ids;
} Trie;

static int trie_new_node(Trie *t, unsigned char ch) {
    if (t->len == t->cap) {
        int nc = t->cap ? t->cap * 2 : 256;
        Node *nn = (Node *)realloc(t->n, (size_t)nc * sizeof(Node));
        if (!nn) return -1;
        t->n = nn;
        t->cap = nc;
    }
    Node *x = &t->n[t->len];
    x->child = -1;
    x->sib = -1;
    x->latest = -1;
    x->ch = ch;
    x->ids.v = NULL;
    x->ids.len = x->ids.cap = 0;
    return t->len++;
}

static int trie_init(Trie *t, int keep_ids) {
    t->n = NULL;
    t->len = t->cap = 0;
    t->keep_ids = keep_ids;
    return trie_new_node(t, 0) == 0 ? 0 : -1; /* root = 0 */
}

static void trie_free(Trie *t) {
    for (int i = 0; i < t->len; i++) vec_free(&t->n[i].ids);
    free(t->n);
    t->n = NULL;
    t->len = t->cap = 0;
}

static int trie_find(const Trie *t, int node, unsigned char ch) {
    for (int c = t->n[node].child; c != -1; c = t->n[c].sib)
        if (t->n[c].ch == ch) return c;
    return -1;
}

static int trie_find_or_add(Trie *t, int node, unsigned char ch) {
    int c = trie_find(t, node, ch);
    if (c != -1) return c;
    c = trie_new_node(t, ch);          /* may realloc: use indices only */
    if (c < 0) return -1;
    t->n[c].sib = t->n[node].child;
    t->n[node].child = c;
    return c;
}

/* Walk a string from the root; -1 if the path does not exist. */
static int trie_walk(const Trie *t, const char *s, int len) {
    int node = 0;
    for (int i = 0; i < len && node != -1; i++) node = trie_find(t, node, (unsigned char)s[i]);
    return node;
}

/* ------------------------------------------------------------------ */
/* N-gram hash map: key (n<<24 | c1<<16 | c2<<8 | c3) -> IntVec         */
/* ------------------------------------------------------------------ */

typedef struct {
    uint32_t *keys;     /* 0 = empty slot (a real key always has n>=1) */
    IntVec *vals;
    int cap, len;
} GramMap;

static uint32_t gram_key(const char *s, int n) {
    uint32_t k = (uint32_t)n << 24;
    for (int i = 0; i < n; i++) k |= (uint32_t)(unsigned char)s[i] << (16 - 8 * i);
    return k;
}

static uint32_t hash32(uint32_t x) {
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}

static int gram_init(GramMap *m, int cap) {
    m->cap = cap;
    m->len = 0;
    m->keys = (uint32_t *)calloc((size_t)cap, sizeof(uint32_t));
    m->vals = (IntVec *)calloc((size_t)cap, sizeof(IntVec));
    return (m->keys && m->vals) ? 0 : -1;
}

static void gram_free(GramMap *m) {
    if (m->vals)
        for (int i = 0; i < m->cap; i++) vec_free(&m->vals[i]);
    free(m->keys);
    free(m->vals);
    m->keys = NULL;
    m->vals = NULL;
    m->cap = m->len = 0;
}

static int gram_slot(const GramMap *m, uint32_t key) {
    int mask = m->cap - 1;
    int i = (int)(hash32(key) & (uint32_t)mask);
    while (m->keys[i] != 0 && m->keys[i] != key) i = (i + 1) & mask;
    return i;
}

static int gram_grow(GramMap *m) {
    GramMap g;
    if (gram_init(&g, m->cap * 2) != 0) return -1;
    for (int i = 0; i < m->cap; i++) {
        if (m->keys[i] == 0) continue;
        int s = gram_slot(&g, m->keys[i]);
        g.keys[s] = m->keys[i];
        g.vals[s] = m->vals[i];
        g.len++;
    }
    free(m->keys);
    free(m->vals);
    *m = g;
    return 0;
}

static IntVec *gram_get_or_add(GramMap *m, uint32_t key) {
    if ((m->len + 1) * 10 >= m->cap * 7 && gram_grow(m) != 0) return NULL;
    int s = gram_slot(m, key);
    if (m->keys[s] == 0) {
        m->keys[s] = key;
        m->len++;
    }
    return &m->vals[s];
}

static const IntVec *gram_get(const GramMap *m, uint32_t key) {
    int s = gram_slot(m, key);
    return m->keys[s] == key ? &m->vals[s] : NULL;
}

/* ------------------------------------------------------------------ */
/* Index                                                               */
/* ------------------------------------------------------------------ */

struct TSIndex {
    char **titles;      /* normalised, owned */
    int *lens;
    int n, cap;
    int built;

    Trie ps;            /* "<suffix>|<word>" -> latest id   */
    Trie pre;           /* title             -> id lists    */
    Trie suf;           /* reversed title    -> id lists    */
    GramMap grams;

    long ps_keys, ps_combos;
    long build_count, query_count;
};

int ts_normalize(const char *in, char *out, int cap) {
    int o = 0, pending_space = 0;
    if (!out || cap <= 0) return 0;
    if (!in) {
        out[0] = '\0';
        return 0;
    }
    for (const unsigned char *p = (const unsigned char *)in; *p; p++) {
        unsigned char c = *p;
        if (c >= 'A' && c <= 'Z') c = (unsigned char)(c - 'A' + 'a');
        int keep = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '\'' || c == '-';
        int space = (c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == ',' || c == '.' ||
                     c == ':' || c == ';' || c == '!' || c == '?' || c == '"' || c == '(' ||
                     c == ')' || c == '&' || c == '/');
        if (keep) {
            if (pending_space && o > 0 && o < cap - 1) out[o++] = ' ';
            pending_space = 0;
            if (o < cap - 1) out[o++] = (char)c;
        } else if (space) {
            pending_space = 1;
        } /* anything else (non-ASCII, '|', ...) is dropped */
    }
    out[o] = '\0';
    return o;
}

TSIndex *ts_create(void) {
    TSIndex *idx = (TSIndex *)calloc(1, sizeof(TSIndex));
    return idx;
}

void ts_destroy(TSIndex *idx) {
    if (!idx) return;
    for (int i = 0; i < idx->n; i++) free(idx->titles[i]);
    free(idx->titles);
    free(idx->lens);
    if (idx->built) {
        trie_free(&idx->ps);
        trie_free(&idx->pre);
        trie_free(&idx->suf);
        gram_free(&idx->grams);
    }
    free(idx);
}

int ts_add(TSIndex *idx, const char *title) {
    if (!idx || !title) return TS_INVALID;
    if (idx->built) return TS_BUILT;
    char buf[TS_MAX_TITLE];
    int len = ts_normalize(title, buf, TS_MAX_TITLE);
    if (len == 0) return TS_INVALID;
    if (idx->n == idx->cap) {
        int nc = idx->cap ? idx->cap * 2 : 64;
        char **nt = (char **)realloc(idx->titles, (size_t)nc * sizeof(char *));
        if (!nt) return TS_INVALID;
        idx->titles = nt;
        int *nl = (int *)realloc(idx->lens, (size_t)nc * sizeof(int));
        if (!nl) return TS_INVALID;
        idx->lens = nl;
        idx->cap = nc;
    }
    char *copy = (char *)malloc((size_t)len + 1);
    if (!copy) return TS_INVALID;
    memcpy(copy, buf, (size_t)len + 1);
    idx->titles[idx->n] = copy;
    idx->lens[idx->n] = len;
    return idx->n++;
}

int ts_build(TSIndex *idx) {
    if (!idx) return TS_INVALID;
    if (idx->built) return TS_BUILT;
    if (trie_init(&idx->ps, 0) || trie_init(&idx->pre, 1) || trie_init(&idx->suf, 1) ||
        gram_init(&idx->grams, 1024))
        return TS_INVALID;

    for (int id = 0; id < idx->n; id++) {
        const char *w = idx->titles[id];
        int L = idx->lens[id];

        /* 1. Prefix-suffix trie. For every non-empty suffix s = w[i..L),
         *    insert the combined key  s | w. The nodes after the separator
         *    spell every non-empty prefix p of w, so each such node IS the
         *    key "s|p" of one (prefix, suffix) combination: L keys cover all
         *    L*L combinations. Ids arrive in increasing order, so writing the
         *    id at every combination node leaves the latest match there. */
        for (int i = 0; i < L; i++) {
            int node = 0;
            for (int j = i; j < L; j++) node = trie_find_or_add(&idx->ps, node, (unsigned char)w[j]);
            node = trie_find_or_add(&idx->ps, node, (unsigned char)TS_SEPARATOR);
            for (int j = 0; j < L; j++) {
                node = trie_find_or_add(&idx->ps, node, (unsigned char)w[j]);
                if (node < 0) return TS_INVALID;
                idx->ps.n[node].latest = id;
                idx->ps_combos++;
            }
            idx->ps_keys++;
        }

        /* 2. Prefix trie with id lists (ascending because ids ascend). */
        int node = 0;
        for (int j = 0; j < L; j++) {
            node = trie_find_or_add(&idx->pre, node, (unsigned char)w[j]);
            if (node < 0) return TS_INVALID;
            vec_push(&idx->pre.n[node].ids, id);
        }
        /* 3. Suffix trie over the reversed title. */
        node = 0;
        for (int j = L - 1; j >= 0; j--) {
            node = trie_find_or_add(&idx->suf, node, (unsigned char)w[j]);
            if (node < 0) return TS_INVALID;
            vec_push(&idx->suf.n[node].ids, id);
        }
        /* 4. 1/2/3-gram postings, one entry per (gram, title). */
        for (int g = 1; g <= 3; g++) {
            for (int j = 0; j + g <= L; j++) {
                IntVec *v = gram_get_or_add(&idx->grams, gram_key(w + j, g));
                if (!v) return TS_INVALID;
                if (v->len == 0 || v->v[v->len - 1] != id) vec_push(v, id);
            }
        }
    }
    idx->built = 1;
    idx->build_count++;
    return 0;
}

int ts_is_built(const TSIndex *idx) { return idx && idx->built; }
int ts_size(const TSIndex *idx) { return idx ? idx->n : 0; }
const char *ts_title(const TSIndex *idx, int id) {
    return (idx && id >= 0 && id < idx->n) ? idx->titles[id] : NULL;
}

/* ------------------------------------------------------------------ */
/* Exact prefix + suffix                                               */
/* ------------------------------------------------------------------ */

int ts_query(TSIndex *idx, const char *prefix, const char *suffix) {
    if (!idx || !idx->built) return TS_INVALID;
    char p[TS_MAX_TITLE], s[TS_MAX_TITLE];
    int pl = ts_normalize(prefix, p, TS_MAX_TITLE);
    int sl = ts_normalize(suffix, s, TS_MAX_TITLE);
    if (pl == 0 || sl == 0) return TS_INVALID;
    idx->query_count++;
    int node = trie_walk(&idx->ps, s, sl);
    if (node != -1) node = trie_find(&idx->ps, node, (unsigned char)TS_SEPARATOR);
    for (int i = 0; i < pl && node != -1; i++) node = trie_find(&idx->ps, node, (unsigned char)p[i]);
    return node == -1 ? TS_NO_MATCH : idx->ps.n[node].latest;
}

static int starts_with(const char *t, int tl, const char *p, int pl) {
    return pl <= tl && memcmp(t, p, (size_t)pl) == 0;
}
static int ends_with(const char *t, int tl, const char *s, int sl) {
    return sl <= tl && memcmp(t + tl - sl, s, (size_t)sl) == 0;
}

int ts_query_linear(TSIndex *idx, const char *prefix, const char *suffix) {
    if (!idx) return TS_INVALID;
    char p[TS_MAX_TITLE], s[TS_MAX_TITLE];
    int pl = ts_normalize(prefix, p, TS_MAX_TITLE);
    int sl = ts_normalize(suffix, s, TS_MAX_TITLE);
    if (pl == 0 || sl == 0) return TS_INVALID;
    for (int id = idx->n - 1; id >= 0; id--)
        if (starts_with(idx->titles[id], idx->lens[id], p, pl) &&
            ends_with(idx->titles[id], idx->lens[id], s, sl))
            return id;
    return TS_NO_MATCH;
}

/* ------------------------------------------------------------------ */
/* Multi-clue: posting-list intersection + candidate verification      */
/* ------------------------------------------------------------------ */

#define MAX_LISTS 64
#define MAX_CLUES 16

typedef struct {
    const int *v;
    int len;
} Span;

static int cmp_span(const void *a, const void *b) {
    return ((const Span *)a)->len - ((const Span *)b)->len;
}

/* Normalise clues. Returns number of non-empty clues, or TS_INVALID. */
typedef struct {
    char p[TS_MAX_TITLE], s[TS_MAX_TITLE];
    int pl, sl;
    char c[MAX_CLUES][TS_MAX_TITLE];
    int cl[MAX_CLUES];
    int nc;
} Clues;

static int load_clues(Clues *k, const char *prefix, const char *const *contains, int ncontains,
                      const char *suffix) {
    k->pl = ts_normalize(prefix, k->p, TS_MAX_TITLE);
    k->sl = ts_normalize(suffix, k->s, TS_MAX_TITLE);
    k->nc = 0;
    if (ncontains < 0 || ncontains > MAX_CLUES) return TS_INVALID;
    for (int i = 0; i < ncontains; i++) {
        if (!contains || !contains[i]) continue;
        int l = ts_normalize(contains[i], k->c[k->nc], TS_MAX_TITLE);
        if (l > 0) k->cl[k->nc++] = l;
    }
    int total = (k->pl > 0) + (k->sl > 0) + k->nc;
    return total == 0 ? TS_INVALID : total;
}

int ts_multi(TSIndex *idx, const char *prefix, const char *const *contains, int ncontains,
             const char *suffix, int *out, int cap, int *examined) {
    if (examined) *examined = 0;
    if (!idx || !idx->built) return TS_INVALID;
    Clues k;
    if (load_clues(&k, prefix, contains, ncontains, suffix) == TS_INVALID) return TS_INVALID;
    idx->query_count++;

    Span lists[MAX_LISTS];
    int nl = 0;
    int verify[MAX_CLUES];
    int nverify = 0;

    if (k.pl > 0) {
        int node = trie_walk(&idx->pre, k.p, k.pl);
        if (node == -1) return 0;
        lists[nl].v = idx->pre.n[node].ids.v;
        lists[nl++].len = idx->pre.n[node].ids.len;
    }
    if (k.sl > 0) {
        char r[TS_MAX_TITLE];
        for (int i = 0; i < k.sl; i++) r[i] = k.s[k.sl - 1 - i];
        int node = trie_walk(&idx->suf, r, k.sl);
        if (node == -1) return 0;
        lists[nl].v = idx->suf.n[node].ids.v;
        lists[nl++].len = idx->suf.n[node].ids.len;
    }
    for (int c = 0; c < k.nc; c++) {
        int l = k.cl[c];
        if (l <= 3) {
            /* A title contains a <=3-char clue iff it contains that n-gram. */
            const IntVec *v = gram_get(&idx->grams, gram_key(k.c[c], l));
            if (!v) return 0;
            if (nl < MAX_LISTS) { lists[nl].v = v->v; lists[nl++].len = v->len; }
        } else {
            /* Every trigram of the clue must occur; the converse is not
             * guaranteed, so survivors are verified with strstr below. */
            for (int j = 0; j + 3 <= l; j++) {
                const IntVec *v = gram_get(&idx->grams, gram_key(k.c[c] + j, 3));
                if (!v) return 0;
                if (nl < MAX_LISTS) { lists[nl].v = v->v; lists[nl++].len = v->len; }
            }
            verify[nverify++] = c;
        }
    }

    /* Intersect smallest-first so the working set only shrinks. */
    qsort(lists, (size_t)nl, sizeof(Span), cmp_span);
    int *cand = (int *)malloc((size_t)(lists[0].len + 1) * sizeof(int));
    if (!cand) return TS_INVALID;
    int nc = lists[0].len;
    memcpy(cand, lists[0].v, (size_t)nc * sizeof(int));
    for (int i = 1; i < nl && nc > 0; i++) {
        int a = 0, b = 0, w = 0;
        while (a < nc && b < lists[i].len) {
            if (cand[a] < lists[i].v[b]) a++;
            else if (cand[a] > lists[i].v[b]) b++;
            else { cand[w++] = cand[a]; a++; b++; }
        }
        nc = w;
    }

    int total = 0;
    if (examined) *examined = nverify ? nc : 0;
    for (int i = nc - 1; i >= 0; i--) {        /* newest first */
        int id = cand[i], ok = 1;
        for (int v = 0; v < nverify && ok; v++)
            ok = strstr(idx->titles[id], k.c[verify[v]]) != NULL;
        if (!ok) continue;
        if (out && total < cap) out[total] = id;
        total++;
    }
    free(cand);
    return total;
}

int ts_multi_linear(TSIndex *idx, const char *prefix, const char *const *contains, int ncontains,
                    const char *suffix, int *out, int cap, int *examined) {
    if (examined) *examined = 0;
    if (!idx) return TS_INVALID;
    Clues k;
    if (load_clues(&k, prefix, contains, ncontains, suffix) == TS_INVALID) return TS_INVALID;
    int total = 0;
    for (int id = idx->n - 1; id >= 0; id--) {
        const char *t = idx->titles[id];
        int tl = idx->lens[id], ok = 1;
        if (k.pl && !starts_with(t, tl, k.p, k.pl)) ok = 0;
        if (ok && k.sl && !ends_with(t, tl, k.s, k.sl)) ok = 0;
        for (int c = 0; c < k.nc && ok; c++) ok = strstr(t, k.c[c]) != NULL;
        if (!ok) continue;
        if (out && total < cap) out[total] = id;
        total++;
    }
    if (examined) *examined = idx->n;
    return total;
}

/* ------------------------------------------------------------------ */
/* Completions and refinement helpers                                  */
/* ------------------------------------------------------------------ */

static int copy_desc(const IntVec *v, int *out, int cap) {
    for (int i = 0; out && i < v->len && i < cap; i++) out[i] = v->v[v->len - 1 - i];
    return v->len;
}

int ts_prefix_ids(const TSIndex *idx, const char *prefix, int *out, int cap) {
    if (!idx || !idx->built) return TS_INVALID;
    char p[TS_MAX_TITLE];
    int pl = ts_normalize(prefix, p, TS_MAX_TITLE);
    if (pl == 0) return TS_INVALID;
    int node = trie_walk(&idx->pre, p, pl);
    return node == -1 ? 0 : copy_desc(&idx->pre.n[node].ids, out, cap);
}

int ts_suffix_ids(const TSIndex *idx, const char *suffix, int *out, int cap) {
    if (!idx || !idx->built) return TS_INVALID;
    char s[TS_MAX_TITLE], r[TS_MAX_TITLE];
    int sl = ts_normalize(suffix, s, TS_MAX_TITLE);
    if (sl == 0) return TS_INVALID;
    for (int i = 0; i < sl; i++) r[i] = s[sl - 1 - i];
    int node = trie_walk(&idx->suf, r, sl);
    return node == -1 ? 0 : copy_desc(&idx->suf.n[node].ids, out, cap);
}

int ts_longest_prefix(const TSIndex *idx, const char *prefix) {
    if (!idx || !idx->built) return TS_INVALID;
    char p[TS_MAX_TITLE];
    int pl = ts_normalize(prefix, p, TS_MAX_TITLE), node = 0, i = 0;
    for (; i < pl; i++) {
        node = trie_find(&idx->pre, node, (unsigned char)p[i]);
        if (node == -1) break;
    }
    return i;
}

int ts_longest_suffix(const TSIndex *idx, const char *suffix) {
    if (!idx || !idx->built) return TS_INVALID;
    char s[TS_MAX_TITLE];
    int sl = ts_normalize(suffix, s, TS_MAX_TITLE), node = 0, i = 0;
    for (; i < sl; i++) {
        node = trie_find(&idx->suf, node, (unsigned char)s[sl - 1 - i]);
        if (node == -1) break;
    }
    return i;
}

/* Fuzzy search: DFS over the trie carrying one Levenshtein DP row per depth. */
typedef struct {
    char text[TS_MAX_TITLE];
    int count, dist;
} Fuzzy;

typedef struct {
    const Trie *t;
    const char *clue;
    int cl, maxd;
    char path[TS_MAX_TITLE];
    Fuzzy *res;
    int nres, cap;
} FuzzCtx;

static void fuzzy_dfs(FuzzCtx *f, int node, int depth, const int *prev) {
    int row[TS_MAX_TITLE + 1];
    for (int c = f->t->n[node].child; c != -1; c = f->t->n[c].sib) {
        unsigned char ch = f->t->n[c].ch;
        row[0] = prev[0] + 1;
        int best = row[0];
        for (int j = 1; j <= f->cl; j++) {
            int cost = (f->clue[j - 1] == (char)ch) ? 0 : 1;
            int v = prev[j - 1] + cost;
            if (prev[j] + 1 < v) v = prev[j] + 1;
            if (row[j - 1] + 1 < v) v = row[j - 1] + 1;
            row[j] = v;
            if (v < best) best = v;
        }
        f->path[depth] = (char)ch;
        int d = row[f->cl];
        if (d <= f->maxd && d > 0 && f->nres < f->cap) {
            Fuzzy *r = &f->res[f->nres++];
            memcpy(r->text, f->path, (size_t)depth + 1);
            r->text[depth + 1] = '\0';
            r->count = f->t->n[c].ids.len;
            r->dist = d;
        }
        if (best <= f->maxd && depth + 1 < f->cl + f->maxd && depth + 1 < TS_MAX_TITLE - 1)
            fuzzy_dfs(f, c, depth + 1, row);
    }
}

static int cmp_fuzzy(const void *a, const void *b) {
    const Fuzzy *x = (const Fuzzy *)a, *y = (const Fuzzy *)b;
    if (x->dist != y->dist) return x->dist - y->dist;
    if (x->count != y->count) return y->count - x->count;
    return strcmp(x->text, y->text);
}

int ts_fuzzy(const TSIndex *idx, const char *clue, int is_suffix, int maxdist, int limit,
             char *buf, int bufcap) {
    if (!idx || !idx->built || !buf || bufcap <= 0) return TS_INVALID;
    if (maxdist < 1) maxdist = 1;
    if (maxdist > 2) maxdist = 2;
    buf[0] = '\0';
    char norm[TS_MAX_TITLE], q[TS_MAX_TITLE];
    int cl = ts_normalize(clue, norm, TS_MAX_TITLE);
    if (cl == 0 || cl > TS_MAX_TITLE - 4) return TS_INVALID;
    for (int i = 0; i < cl; i++) q[i] = is_suffix ? norm[cl - 1 - i] : norm[i];
    q[cl] = '\0';

    FuzzCtx f;
    f.t = is_suffix ? &idx->suf : &idx->pre;
    f.clue = q;
    f.cl = cl;
    f.maxd = maxdist;
    f.cap = 512;
    f.nres = 0;
    f.res = (Fuzzy *)malloc((size_t)f.cap * sizeof(Fuzzy));
    if (!f.res) return TS_INVALID;
    int row0[TS_MAX_TITLE + 1];
    for (int j = 0; j <= cl; j++) row0[j] = j;
    fuzzy_dfs(&f, 0, 0, row0);

    /* Each trie node is a distinct string, so results are already unique. */
    qsort(f.res, (size_t)f.nres, sizeof(Fuzzy), cmp_fuzzy);
    int written = 0, off = 0;
    for (int i = 0; i < f.nres && written < limit; i++) {
        char text[TS_MAX_TITLE];
        int tl = (int)strlen(f.res[i].text);
        for (int j = 0; j < tl; j++) text[j] = is_suffix ? f.res[i].text[tl - 1 - j] : f.res[i].text[j];
        text[tl] = '\0';
        int n = snprintf(buf + off, (size_t)(bufcap - off), "%s\t%d\t%d\n", text, f.res[i].count,
                         f.res[i].dist);
        if (n < 0 || off + n >= bufcap) break;
        off += n;
        written++;
    }
    free(f.res);
    return written;
}

/* ------------------------------------------------------------------ */
/* Benchmarks                                                          */
/* ------------------------------------------------------------------ */

static double now_ns(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (double)t.tv_sec * 1e9 + (double)t.tv_nsec;
}

double ts_bench_exact(TSIndex *idx, const char *const *prefixes, const char *const *suffixes,
                      int n, int linear, int *out) {
    if (!idx || !idx->built || !prefixes || !suffixes || n < 0) return -1.0;
    double t0 = now_ns();
    for (int i = 0; i < n; i++) {
        int r = linear ? ts_query_linear(idx, prefixes[i], suffixes[i])
                       : ts_query(idx, prefixes[i], suffixes[i]);
        if (out) out[i] = r;
    }
    return now_ns() - t0;
}

double ts_bench_multi(TSIndex *idx, const char *const *prefixes, const char *const *contains,
                      const char *const *suffixes, int n, int linear, int *out) {
    if (!idx || !idx->built || !prefixes || !suffixes || n < 0) return -1.0;
    double t0 = now_ns();
    for (int i = 0; i < n; i++) {
        const char *c1[1];
        c1[0] = contains ? contains[i] : NULL;
        int ex;
        int r = linear ? ts_multi_linear(idx, prefixes[i], c1, 1, suffixes[i], NULL, 0, &ex)
                       : ts_multi(idx, prefixes[i], c1, 1, suffixes[i], NULL, 0, &ex);
        if (out) out[i] = r;
    }
    return now_ns() - t0;
}

/* ------------------------------------------------------------------ */
/* Statistics                                                          */
/* ------------------------------------------------------------------ */

long ts_ps_nodes(const TSIndex *idx) { return idx && idx->built ? idx->ps.len : 0; }
long ts_ps_keys(const TSIndex *idx) { return idx ? idx->ps_keys : 0; }
long ts_ps_combinations(const TSIndex *idx) { return idx ? idx->ps_combos : 0; }
long ts_ps_distinct(const TSIndex *idx) {
    if (!idx || !idx->built) return 0;
    long c = 0;
    for (int i = 0; i < idx->ps.len; i++) c += idx->ps.n[i].latest >= 0;
    return c;
}
long ts_aux_nodes(const TSIndex *idx) {
    return idx && idx->built ? (long)idx->pre.len + idx->suf.len : 0;
}
long ts_ngram_keys(const TSIndex *idx) { return idx && idx->built ? idx->grams.len : 0; }
long ts_memory_bytes(const TSIndex *idx) {
    if (!idx || !idx->built) return 0;
    long b = (long)idx->ps.cap * (long)sizeof(Node) + (long)idx->pre.cap * (long)sizeof(Node) +
             (long)idx->suf.cap * (long)sizeof(Node);
    for (int i = 0; i < idx->pre.len; i++) b += (long)idx->pre.n[i].ids.cap * (long)sizeof(int);
    for (int i = 0; i < idx->suf.len; i++) b += (long)idx->suf.n[i].ids.cap * (long)sizeof(int);
    b += (long)idx->grams.cap * (long)(sizeof(uint32_t) + sizeof(IntVec));
    for (int i = 0; i < idx->grams.cap; i++) b += (long)idx->grams.vals[i].cap * (long)sizeof(int);
    return b;
}
long ts_build_count(const TSIndex *idx) { return idx ? idx->build_count : 0; }
long ts_query_count(const TSIndex *idx) { return idx ? idx->query_count : 0; }
