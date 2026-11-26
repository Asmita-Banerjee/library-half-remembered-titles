export type Dataset = "library" | "dsa";
export type Status = "match" | "no_match";

export interface RecordView {
  id: number;
  title: string;
  normalized_title: string;
  authors?: string[];
  genre?: string;
  year?: number;
  note?: string | null;
  dataset: Dataset;
  matched_clues?: ClueSpan[];
}

export interface ClueSpan {
  type: "prefix" | "contains" | "suffix";
  value: string;
  start: number;
  end: number;
}

export interface BasicResult {
  dataset: Dataset;
  clues: { prefix: string; suffix: string };
  normalized: { prefix: string; suffix: string };
  status: Status;
  record: RecordView | null;
  matching_records: number;
  elapsed_ms: number;
  algorithm: string;
  message: string;
}

export interface MultiResult {
  dataset: Dataset;
  clues: { prefix: string; contains: string[]; suffix: string };
  normalized: { prefix: string; contains: string[]; suffix: string };
  status: Status;
  total: number;
  results: RecordView[];
  candidates_verified: number;
  catalog_size: number;
  elapsed_ms: number;
  algorithm: string;
}

export interface LiveResult {
  total: number;
  suggestions: RecordView[];
  elapsed_ms: number;
  candidates_verified?: number;
  algorithm: string;
}

export interface Suggestion {
  prefix: string;
  contains: string[];
  suffix: string;
  kind: string;
  reason: string;
  match_count: number;
  preview: string;
  exact: false;
}

export interface RefineResult {
  original: { prefix: string; contains: string[]; suffix: string };
  original_matches: number;
  suggestions: Suggestion[];
  elapsed_ms: number;
  note: string;
}

export interface BookCard {
  id: number;
  title: string;
  authors: string[];
  genre: string;
  year: number;
  note?: string | null;
  duplicate_count?: number;
}

export interface CatalogPage {
  dataset: Dataset;
  page: number;
  page_size: number;
  pages: number;
  total: number;
  catalog_size: number;
  items: (BookCard & { duplicate_count: number })[];
  genres: string[];
}

export interface AuthorHit { id: number; name: string; book_count: number }

export interface AuthorResult {
  query: string;
  authors: { id: number; name: string; books: BookCard[] }[];
  total_books: number;
  elapsed_ms: number;
  status: Status;
  algorithm: string;
}

export interface Character { name: string; description: string }

export interface StoryHit extends BookCard {
  score: number;
  characters: Character[];
  plot: string;
  themes: string[];
  settings: string[];
  reasons: { term: string; field: string; context: string; related_to: string | null }[];
}

export interface StoryResult {
  query: string;
  terms: string[];
  results: StoryHit[];
  status: Status;
  elapsed_ms: number;
  algorithm: string;
}

export interface HistoryItem {
  id: number;
  search_type: "basic" | "multi" | "author" | "story";
  dataset: Dataset | null;
  clues: Record<string, unknown>;
  result_summary: string;
  result_count: number;
  status: "success" | "no_match" | "error";
  elapsed_ms: number;
  created_at: string;
}

export interface Overview {
  catalog_records: number;
  dsa_records: number;
  indexed_records: number;
  total_searches: number;
  successful_searches: number;
  failed_searches: number;
  authors: number;
  genres: number;
}

export interface EngineStats {
  name: string;
  records: number;
  build_ms: number;
  build_count: number;
  indexed_queries: number;
  ps_trie_nodes: number;
  combined_keys: number;
  prefix_suffix_combinations: number;
  distinct_combinations: number;
  affix_trie_nodes: number;
  ngram_keys: number;
  memory_bytes: number;
}

export interface PerformanceStats {
  engines: EngineStats[];
  build_times_ms: Record<string, number>;
  story_index: { documents: number; vocabulary: number };
  searches: { search_type: string; success: number; failure: number; count: number; avg_ms: number; last_ms: number }[];
  overview: Overview;
}

export interface Benchmark {
  dataset: Dataset;
  catalog_size: number;
  queries: number;
  hits: number;
  misses: number;
  exact: { indexed_total_ms: number; linear_total_ms: number; indexed_avg_us: number; linear_avg_us: number; speedup: number | null; results_agree: boolean };
  multi: { indexed_total_ms: number; linear_total_ms: number; speedup: number | null; results_agree: boolean };
  wall_ms: number;
  note: string;
}

export interface Scaling {
  queries_per_size: number;
  rows: { catalog_size: number; build_ms: number; trie_nodes: number; combinations: number; indexed_avg_us: number; linear_avg_us: number; speedup: number | null; results_agree: boolean }[];
}

export interface SelfCheck {
  passed: number;
  total: number;
  checks: { name: string; passed: boolean; detail: string }[];
}
