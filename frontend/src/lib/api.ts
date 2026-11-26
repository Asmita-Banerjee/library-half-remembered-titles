import type {
  AuthorHit, AuthorResult, BasicResult, Benchmark, BookCard, BookDetail, CatalogPage, Dataset, FacetOptions,
  FacetValues, FeedbackStats, HistoryItem, LiveResult, MultiResult, Overview, PerformanceStats, RefineResult,
  Scaling, SearchType, SelfCheck, StoryResult,
} from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  status: number;
  field?: string;
  constructor(message: string, status: number, field?: string) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("The library server can't be reached. Check that the backend is running, then try again.", 0);
  }
  if (!res.ok) {
    let msg = `The server answered with an error (${res.status}).`;
    let field: string | undefined;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = body.detail;
      else if (Array.isArray(body.detail)) msg = body.detail.map((d: { msg: string }) => d.msg).join("; ");
      field = body.field;
    } catch { /* keep the generic message */ }
    throw new ApiError(msg, res.status, field);
  }
  return res.json() as Promise<T>;
}

const post = <T,>(path: string, body: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body), signal });

/** Only send facets that are actually set. */
export function cleanFacets(f?: Partial<FacetValues> | null) {
  if (!f) return null;
  const out: Record<string, string | number> = {};
  if (f.genre) out.genre = f.genre;
  if (f.audience) out.audience = f.audience;
  if (f.source) out.source = f.source;
  if (f.year_from !== null && f.year_from !== undefined) out.year_from = f.year_from;
  if (f.year_to !== null && f.year_to !== undefined) out.year_to = f.year_to;
  return Object.keys(out).length ? out : null;
}

export const api = {
  overview: () => request<Overview>("/overview"),
  facets: () => request<FacetOptions>("/facets"),
  random: (n = 4) => request<{ books: (BookCard & { plot: string; tags: string[] })[] }>(`/random?n=${n}`),
  catalog: (params: Record<string, string | number | undefined | null>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    return request<CatalogPage>(`/catalog?${q}`);
  },
  book: (id: number) => request<BookDetail>(`/books/${id}`),
  basic: (dataset: Dataset, prefix: string, suffix: string) =>
    post<BasicResult>("/search/title", { dataset, prefix, suffix }),
  multi: (dataset: Dataset, prefix: string, contains: string[], suffix: string, facets?: Partial<FacetValues> | null) =>
    post<MultiResult>("/search/multi", { dataset, prefix, contains, suffix, facets: cleanFacets(facets) }),
  live: (dataset: Dataset, prefix: string, contains: string[], suffix: string, signal?: AbortSignal) =>
    post<LiveResult>("/search/live", { dataset, prefix, contains, suffix, limit: 6 }, signal),
  refine: (dataset: Dataset, prefix: string, contains: string[], suffix: string) =>
    post<RefineResult>("/search/refine", { dataset, prefix, contains, suffix }),
  authorAutocomplete: (q: string, signal?: AbortSignal) =>
    request<{ authors: AuthorHit[] }>(`/authors/autocomplete?q=${encodeURIComponent(q)}`, { signal }),
  author: (name: string) => post<AuthorResult>("/search/author", { name }),
  story: (query: string, facets?: Partial<FacetValues> | null) =>
    post<StoryResult>("/search/story", { query, limit: 12, facets: cleanFacets(facets) }),
  feedback: (search_type: SearchType, found: boolean, search_id: number | null, record_id?: number | null) =>
    post<FeedbackStats>("/feedback", { search_type, found, search_id, record_id: record_id ?? null }),
  history: () => request<{ limit: number; items: HistoryItem[] }>("/history"),
  clearHistory: () => request<{ cleared: number }>("/history", { method: "DELETE" }),
  performance: () => request<PerformanceStats>("/stats/performance"),
  benchmark: (dataset: Dataset, queries: number) =>
    request<Benchmark>(`/stats/benchmark?dataset=${dataset}&queries=${queries}`),
  scaling: (dataset: Dataset) => request<Scaling>(`/stats/scaling?dataset=${dataset}`),
  selfcheck: () => request<SelfCheck>("/stats/selfcheck"),
};
