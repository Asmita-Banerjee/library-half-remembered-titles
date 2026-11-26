export type Dataset = "library" | "dsa";
export type Status = "match" | "no_match";
export type Source = "curated" | "goodbooks";
export type Audience = "General" | "Young Adult" | "Children";

export interface ClueSpan { type: "prefix" | "contains" | "suffix"; value: string; start: number; end: number }

export interface RecordView {
  id: number;
  title: string;
  normalized_title: string;
  authors?: string[];
  genre?: string;
  year?: number | null;
  note?: string | null;
  source?: Source;
  audience?: Audience;
  series?: string | null;
  cover_isbn?: string | null;
  dataset: Dataset;
  matched_clues?: ClueSpan[];
  approximation?: { clue: "prefix" | "suffix"; typed: string; matched: string; distance: number };
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
  index_path: "prefix-suffix-trie" | "affix-intersection";
  search_id: number | null;
  message: string;
}

export interface FacetValues { genre: string; audience: "" | Audience; source: "" | Source; year_from: number | null; year_to: number | null }

export interface MultiResult {
  dataset: Dataset;
  clues: { prefix: string; contains: string[]; suffix: string };
  normalized: { prefix: string; contains: string[]; suffix: string };
  status: Status;
  total: number;
  unfiltered_total: number;
  facets_applied: boolean;
  results: RecordView[];
  candidates_verified: number;
  catalog_size: number;
  elapsed_ms: number;
  algorithm: string;
  search_id: number | null;
}

export interface LiveResult {
  total: number;
  suggestions: RecordView[];
  approximate: RecordView[];
  elapsed_ms: number;
  algorithm: string;
}

export interface Suggestion {
  prefix: string; contains: string[]; suffix: string; kind: string; reason: string;
  match_count: number; preview: string; exact: false;
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
  year: number | null;
  note?: string | null;
  source: Source;
  audience: Audience;
  series?: string | null;
  average_rating?: number | null;
  ratings_count?: number | null;
  cover_isbn?: string | null;
  duplicate_count?: number;
}

export interface Character { name: string; description: string }

export interface BookDetail extends BookCard {
  plot: string;
  characters: Character[];
  themes: string[];
  settings: string[];
  tags: string[];
  original_title?: string | null;
  isbn?: string | null;
  language?: string | null;
  normalized_title: string;
  linked: BookCard[];
  links: { label: string; kind: string; url: string }[];
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

export interface FacetOptions {
  genres: string[];
  audiences: Audience[];
  sources: { value: Source; label: string }[];
  year_min: number;
  year_max: number;
}

export interface AuthorHit { id: number; name: string; book_count: number }

export interface AuthorResult {
  query: string;
  authors: { id: number; name: string; books: BookCard[] }[];
  total_books: number;
  elapsed_ms: number;
  status: Status;
  algorithm: string;
  search_id: number | null;
}

export interface Reason {
  term: string; field: string; context: string; related_to: string | null;
  kind: "direct" | "spelling" | "related" | "wordnet";
}

export interface StoryHit extends BookCard {
  score: number;
  characters: Character[];
  plot: string;
  themes: string[];
  settings: string[];
  tags: string[];
  also_catalogued_as: number[];
  reasons: Reason[];
}

export interface StoryResult {
  query: string;
  terms: string[];
  expansions: { kind: "spelling" | "related" | "wordnet"; from: string; to: string; distance?: number }[];
  results: StoryHit[];
  status: Status;
  elapsed_ms: number;
  algorithm: string;
  facets_applied: boolean;
  search_id: number | null;
}

export type SearchType = "basic" | "multi" | "author" | "story";

export interface HistoryItem {
  id: number;
  search_type: SearchType;
  dataset: Dataset | null;
  clues: Record<string, unknown>;
  result_summary: string;
  result_count: number;
  status: "success" | "no_match" | "error";
  elapsed_ms: number;
  feedback: "found" | "not_found" | null;
  created_at: string;
}

export interface FeedbackStats { found: number; not_found: number; total: number; by_type: Record<string, { found: number; total: number }> }

export interface Overview {
  catalog_records: number;
  curated_records: number;
  extended_records: number;
  dsa_records: number;
  confirmed_found: number;
  confirmed_total: number;
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
  max_affix: number;
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
  story_index: { documents: number; vocabulary: number; wordnet_aliases: number };
  feedback: FeedbackStats;
  searches: { search_type: string; success: number; failure: number; count: number; avg_ms: number; last_ms: number }[];
  overview: Overview;
}

export interface Benchmark {
  dataset: Dataset;
  catalog_size: number;
  queries: number;
  hits: number;
  misses: number;
  exact: { indexed_total_ms: number; linear_total_ms: number; indexed_avg_us: number; linear_avg_us: number; speedup: number | null; results_agree: boolean; trie_memory_bytes: number };
  hash_baseline: { build_ms: number; total_ms: number; avg_us: number; memory_bytes: number; results_agree: boolean } | null;
  multi: { indexed_total_ms: number; linear_total_ms: number; speedup: number | null; results_agree: boolean };
  wall_ms: number;
  note: string;
}

export interface Scaling {
  dataset: Dataset;
  queries_per_size: number;
  max_affix: number;
  rows: { catalog_size: number; build_ms: number; trie_nodes: number; combinations: number; memory_bytes: number; memory_per_1000_mb: number; indexed_avg_us: number; linear_avg_us: number; hash_avg_us: number | null; speedup: number | null; results_agree: boolean }[];
}

export interface SelfCheck { passed: number; total: number; checks: { name: string; passed: boolean; detail: string }[] }
