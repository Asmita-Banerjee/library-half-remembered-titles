import type {
  AuthorHit, AuthorResult, BasicResult, Benchmark, CatalogPage, Dataset, HistoryItem, LiveResult,
  MultiResult, Overview, PerformanceStats, RefineResult, Scaling, SelfCheck, StoryResult,
} from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  constructor(message: string, public status: number, public field?: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Cannot reach the server. Is the backend running?", 0);
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let field: string | undefined;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = body.detail;
      else if (Array.isArray(body.detail)) msg = body.detail.map((d: { msg: string }) => d.msg).join("; ");
      field = body.field;
    } catch { /* ignore */ }
    throw new ApiError(msg, res.status, field);
  }
  return res.json() as Promise<T>;
}

const post = <T,>(path: string, body: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body), signal });

export const api = {
  overview: () => request<Overview>("/overview"),
  catalog: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") q.set(k, String(v)); });
    return request<CatalogPage>(`/catalog?${q}`);
  },
  basic: (dataset: Dataset, prefix: string, suffix: string) =>
    post<BasicResult>("/search/title", { dataset, prefix, suffix }),
  multi: (dataset: Dataset, prefix: string, contains: string[], suffix: string) =>
    post<MultiResult>("/search/multi", { dataset, prefix, contains, suffix }),
  live: (dataset: Dataset, prefix: string, contains: string[], suffix: string, signal?: AbortSignal) =>
    post<LiveResult>("/search/live", { dataset, prefix, contains, suffix, limit: 6 }, signal),
  refine: (dataset: Dataset, prefix: string, contains: string[], suffix: string) =>
    post<RefineResult>("/search/refine", { dataset, prefix, contains, suffix }),
  authorAutocomplete: (q: string, signal?: AbortSignal) =>
    request<{ authors: AuthorHit[] }>(`/authors/autocomplete?q=${encodeURIComponent(q)}`, { signal }),
  author: (name: string) => post<AuthorResult>("/search/author", { name }),
  story: (query: string) => post<StoryResult>("/search/story", { query, limit: 10 }),
  history: () => request<{ limit: number; items: HistoryItem[] }>("/history"),
  clearHistory: () => request<{ cleared: number }>("/history", { method: "DELETE" }),
  performance: () => request<PerformanceStats>("/stats/performance"),
  benchmark: (dataset: Dataset, queries: number) =>
    request<Benchmark>(`/stats/benchmark?dataset=${dataset}&queries=${queries}`),
  scaling: () => request<Scaling>("/stats/scaling"),
  selfcheck: () => request<SelfCheck>("/stats/selfcheck"),
};
