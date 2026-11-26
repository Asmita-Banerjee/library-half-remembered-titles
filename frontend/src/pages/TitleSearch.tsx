import { Lightbulb, LoaderCircle, Plus, ScanSearch, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Badge, Button, Card, ClueChip, DatasetToggle, EmptyState, ErrorNote, HighlightedTitle, PageHeader,
  SectionTitle, Segmented, TextField, Timing, cx,
} from "../components/ui";
import { ApiError, api } from "../lib/api";
import { fmt, useDebounced } from "../lib/hooks";
import type { BasicResult, ClueSpan, Dataset, LiveResult, MultiResult, RecordView, RefineResult, Suggestion } from "../lib/types";

type Mode = "basic" | "multi";
type ClueType = ClueSpan["type"];
interface ClueRow { id: number; type: ClueType; value: string }

const TYPE_LABEL: Record<ClueType, string> = { prefix: "Beginning", contains: "Contains", suffix: "Ending" };
let rowId = 0;
const row = (type: ClueType, value = ""): ClueRow => ({ id: ++rowId, type, value });

function splitRows(rows: ClueRow[]) {
  const prefix = rows.find((r) => r.type === "prefix")?.value ?? "";
  const suffix = rows.find((r) => r.type === "suffix")?.value ?? "";
  const contains = rows.filter((r) => r.type === "contains").map((r) => r.value);
  return { prefix, suffix, contains };
}

function recordMeta(r: RecordView) {
  if (r.dataset === "dsa") return "DSA test catalog";
  return [r.authors?.join(", "), r.year, r.genre].filter(Boolean).join(" · ");
}

/* ---------------------------------------------------------------- live -- */

function LivePanel({ dataset, prefix, contains, suffix }: { dataset: Dataset; prefix: string; contains: string[]; suffix: string }) {
  const key = JSON.stringify([dataset, prefix, contains, suffix]);
  const debounced = useDebounced(key, 200);
  const [data, setData] = useState<LiveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = !prefix.trim() && !suffix.trim() && contains.every((c) => !c.trim());

  useEffect(() => {
    const [d, p, c, s] = JSON.parse(debounced) as [Dataset, string, string[], string];
    if (!p.trim() && !s.trim() && c.every((x) => !x.trim())) { setData(null); return; }
    const ctrl = new AbortController();
    setLoading(true);
    api.live(d, p, c, s, ctrl.signal)
      .then((r) => { setData(r); setError(null); })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [debounced]);

  return (
    <div className="rounded-xl border border-line bg-stone-50/60 p-4" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Live suggestions from the catalog</p>
        {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-muted" /> : data && <Timing ms={data.elapsed_ms} />}
      </div>
      {empty && <p className="text-sm text-muted">Start typing a clue. Matching titles appear here as you type.</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!empty && data && (
        <>
          <p className="mb-2 text-sm text-ink">
            {data.total === 0 ? "No catalog title fits these clues yet." : `${fmt(data.total)} title${data.total === 1 ? "" : "s"} fit so far${data.total > data.suggestions.length ? `, showing the ${data.suggestions.length} newest` : ""}.`}
          </p>
          <ul className="space-y-1.5">
            {data.suggestions.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate"><HighlightedTitle text={r.normalized_title} spans={r.matched_clues ?? []} /></span>
                <span className="shrink-0 font-mono text-[11px] text-muted">#{r.id}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- refine -- */

function RefinePanel({ data, loading, onTry }: { data: RefineResult | null; loading: boolean; onTry: (s: Suggestion) => void }) {
  if (loading) return <p className="flex items-center gap-2 text-sm text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> Looking for clues that do exist…</p>;
  if (!data) return null;
  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <SectionTitle aside={<Timing ms={data.elapsed_ms} />}>
        <span className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-600" /> Try different clues</span>
      </SectionTitle>
      <p className="mb-4 text-sm text-muted">
        These are <strong className="font-medium text-ink">suggestions, not results</strong>. Your search above was left unchanged;
        each alternative below was checked against the index and does match at least one title. Pick one to run it as a new exact search.
      </p>
      {data.suggestions.length === 0 ? (
        <p className="text-sm text-ink">No nearby clues exist in the catalog either. Try a shorter beginning or ending.</p>
      ) : (
        <ul className="space-y-2.5">
          {data.suggestions.map((s, i) => (
            <li key={i} className="flex flex-col gap-3 rounded-lg border border-line bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  {s.prefix && <ClueChip type="prefix" value={s.prefix} />}
                  {s.contains.map((c, j) => <ClueChip key={j} type="contains" value={c} />)}
                  {s.suffix && <ClueChip type="suffix" value={s.suffix} />}
                </div>
                <p className="mt-1.5 text-sm text-ink">{s.reason}</p>
                <p className="mt-0.5 text-xs text-muted">{s.match_count} match{s.match_count === 1 ? "" : "es"} · newest: {s.preview}</p>
              </div>
              <Button variant="secondary" className="shrink-0" onClick={() => onTry(s)}>Search with these</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- page -- */

export default function TitleSearchPage() {
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>((params.get("mode") as Mode) === "multi" ? "multi" : "basic");
  const [dataset, setDataset] = useState<Dataset>(params.get("dataset") === "dsa" ? "dsa" : "library");

  // basic
  const [prefix, setPrefix] = useState(params.get("prefix") ?? "");
  const [suffix, setSuffix] = useState(params.get("suffix") ?? "");
  const [basic, setBasic] = useState<BasicResult | null>(null);
  // multi
  const [rows, setRows] = useState<ClueRow[]>(() => {
    if (params.get("mode") === "multi") {
      const r: ClueRow[] = [];
      if (params.get("prefix")) r.push(row("prefix", params.get("prefix")!));
      params.getAll("c").forEach((c) => r.push(row("contains", c)));
      if (params.get("suffix")) r.push(row("suffix", params.get("suffix")!));
      if (r.length) return r;
    }
    return [row("prefix"), row("contains")];
  });
  const [multi, setMulti] = useState<MultiResult | null>(null);

  const [error, setError] = useState<{ msg: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refine, setRefine] = useState<RefineResult | null>(null);
  const [refining, setRefining] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const clues = useMemo(() => (mode === "basic" ? { prefix, suffix, contains: [] as string[] } : splitRows(rows)), [mode, prefix, suffix, rows]);

  const clearResults = () => { setBasic(null); setMulti(null); setRefine(null); setError(null); };

  async function runRefine(d: Dataset, p: string, c: string[], s: string) {
    setRefining(true);
    try { setRefine(await api.refine(d, p, c, s)); }
    catch { setRefine(null); }
    finally { setRefining(false); }
  }

  async function runBasic(d = dataset, p = prefix, s = suffix) {
    clearResults();
    if (!p.trim() || !s.trim()) {
      setError({ msg: !p.trim() && !s.trim() ? "Enter both the beginning and the ending of the title." : !p.trim() ? "Enter the beginning (prefix) of the title." : "Enter the ending (suffix) of the title.", field: !p.trim() ? "prefix" : "suffix" });
      return;
    }
    setBusy(true);
    try {
      const r = await api.basic(d, p, s);
      setBasic(r);
      if (r.status === "no_match") runRefine(d, p, [], s);
    } catch (e) {
      const err = e as ApiError;
      setError({ msg: err.message, field: err.field });
    } finally {
      setBusy(false);
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  async function runMulti(d = dataset, list = rows) {
    clearResults();
    const { prefix: p, suffix: s, contains: c } = splitRows(list);
    if (!p.trim() && !s.trim() && c.every((x) => !x.trim())) {
      setError({ msg: "Add at least one non-empty clue.", field: "clues" });
      return;
    }
    setBusy(true);
    try {
      const r = await api.multi(d, p, c.filter((x) => x.trim()), s);
      setMulti(r);
      if (r.status === "no_match") runRefine(d, p, c.filter((x) => x.trim()), s);
    } catch (e) {
      setError({ msg: (e as ApiError).message, field: (e as ApiError).field });
    } finally {
      setBusy(false);
    }
  }

  // Repeat-from-history: run once on mount when ?run=1
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || params.get("run") !== "1") return;
    ran.current = true;
    if (mode === "basic") runBasic(); else runMulti();
    params.delete("run");
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trySuggestion(s: Suggestion) {
    if (mode === "basic" && s.contains.length === 0 && s.prefix && s.suffix) {
      setPrefix(s.prefix); setSuffix(s.suffix);
      runBasic(dataset, s.prefix, s.suffix);
    } else {
      const next: ClueRow[] = [];
      if (s.prefix) next.push(row("prefix", s.prefix));
      s.contains.forEach((c) => next.push(row("contains", c)));
      if (s.suffix) next.push(row("suffix", s.suffix));
      setMode("multi"); setRows(next);
      runMulti(dataset, next);
    }
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (mode === "basic") runBasic(); else runMulti(); };
  const hasType = (t: ClueType) => rows.some((r) => r.type === t);
  const updateRow = (id: number, patch: Partial<ClueRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div>
      <PageHeader
        icon={<ScanSearch className="h-6 w-6" />}
        title="Title search"
        subtitle="Search with the pieces of the title you remember. Matching ignores case and punctuation."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented label="Search mode" value={mode} onChange={(m) => { setMode(m); clearResults(); }}
          options={[{ value: "basic", label: "Beginning + ending" }, { value: "multi", label: "Multi-clue" }]} />
        <DatasetToggle value={dataset} onChange={(d) => { setDataset(d); clearResults(); }} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <form onSubmit={onSubmit} noValidate>
            {mode === "basic" ? (
              <>
                <p className="mb-4 text-sm text-muted">Returns the <strong className="font-medium text-ink">latest inserted</strong> record whose title begins and ends with your clues.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Beginning (prefix)" value={prefix} onChange={(e) => setPrefix(e.target.value)}
                    placeholder={dataset === "dsa" ? "e.g. ma" : "e.g. harry"} error={error?.field === "prefix" || error?.field === "both"} maxLength={120} />
                  <TextField label="Ending (suffix)" value={suffix} onChange={(e) => setSuffix(e.target.value)}
                    placeholder={dataset === "dsa" ? "e.g. a" : "e.g. stone"} error={error?.field === "suffix" || error?.field === "both"} maxLength={120} />
                </div>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted">Every clue must match the <strong className="font-medium text-ink">same</strong> title. All matches are listed, newest record first.</p>
                <ul className="space-y-3">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-end gap-2">
                      <div className="w-32 shrink-0">
                        <label htmlFor={`t-${r.id}`} className="mb-1.5 block text-[13px] font-medium text-ink">Clue type</label>
                        <select id={`t-${r.id}`} value={r.type} onChange={(e) => updateRow(r.id, { type: e.target.value as ClueType })}
                          className="w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15">
                          {(["prefix", "contains", "suffix"] as ClueType[]).map((t) => (
                            <option key={t} value={t} disabled={t !== "contains" && t !== r.type && hasType(t)}>{TYPE_LABEL[t]}</option>
                          ))}
                        </select>
                      </div>
                      <TextField id={`v-${r.id}`} label={TYPE_LABEL[r.type] + (r.type === "contains" ? " (middle characters)" : "")} className="min-w-0 flex-1"
                        value={r.value} onChange={(e) => updateRow(r.id, { value: e.target.value })} maxLength={120}
                        placeholder={r.type === "prefix" ? "e.g. the" : r.type === "suffix" ? "e.g. man" : "e.g. visible"} />
                      <button type="button" aria-label={`Remove ${TYPE_LABEL[r.type]} clue`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                        disabled={rows.length === 1} className="mb-1 rounded-lg p-2 text-muted hover:bg-stone-100 hover:text-red-700 disabled:opacity-30">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["prefix", "contains", "suffix"] as ClueType[]).map((t) => (
                    <Button key={t} type="button" variant="ghost" className="px-2.5 py-1.5"
                      disabled={(t !== "contains" && hasType(t)) || (t === "contains" && rows.filter((r) => r.type === "contains").length >= 8)}
                      onClick={() => setRows((rs) => [...rs, row(t)])}>
                      <Plus className="h-3.5 w-3.5" /> {TYPE_LABEL[t]}
                    </Button>
                  ))}
                </div>
              </>
            )}
            {error && <div className="mt-4"><ErrorNote>{error.msg}</ErrorNote></div>}
            <div className="mt-5 flex items-center gap-3">
              <Button type="submit" loading={busy}><Search className="h-4 w-4" /> Search</Button>
              <button type="button" className="text-sm text-muted hover:text-navy" onClick={() => {
                clearResults();
                if (mode === "basic") { setPrefix(""); setSuffix(""); } else setRows([row("prefix"), row("contains")]);
              }}>Clear</button>
            </div>
          </form>
        </Card>

        <LivePanel dataset={dataset} prefix={clues.prefix} contains={clues.contains} suffix={clues.suffix} />
      </div>

      <div ref={resultRef} className="mt-6 space-y-5">
        {basic && (
          <Card>
            <SectionTitle aside={<Timing ms={basic.elapsed_ms} />}>Exact result</SectionTitle>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <ClueChip type="prefix" value={basic.normalized.prefix} />
              <ClueChip type="suffix" value={basic.normalized.suffix} />
            </div>
            {basic.record ? (
              <div className="rounded-lg border border-line p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-serif text-xl font-semibold text-ink">{basic.record.title}</h3>
                  <Badge tone="navy">Record ID #{basic.record.id}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{recordMeta(basic.record)}</p>
                {basic.record.note && <p className="mt-1 text-xs text-muted">{basic.record.note}</p>}
                <p className="mt-3 text-sm text-ink">{basic.message}</p>
                {basic.matching_records > 1 && (
                  <button className="mt-1 text-sm text-navy underline-offset-2 hover:underline" onClick={() => {
                    const next = [row("prefix", basic.clues.prefix), row("suffix", basic.clues.suffix)];
                    setMode("multi"); setRows(next); runMulti(dataset, next);
                  }}>See all {basic.matching_records} matching records</button>
                )}
              </div>
            ) : (
              <EmptyState icon={<Search className="h-7 w-7" />} title="No exact match">{basic.message}</EmptyState>
            )}
            <p className="mt-3 text-xs text-muted">{basic.algorithm}</p>
          </Card>
        )}

        {multi && (
          <Card>
            <SectionTitle aside={<Timing ms={multi.elapsed_ms} />}>
              {multi.total === 0 ? "No matching titles" : `${fmt(multi.total)} matching record${multi.total === 1 ? "" : "s"}`}
            </SectionTitle>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {multi.normalized.prefix && <ClueChip type="prefix" value={multi.normalized.prefix} />}
              {multi.normalized.contains.map((c, i) => <ClueChip key={i} type="contains" value={c} />)}
              {multi.normalized.suffix && <ClueChip type="suffix" value={multi.normalized.suffix} />}
            </div>
            {multi.total === 0 ? (
              <EmptyState icon={<Search className="h-7 w-7" />} title="No title matches every clue">All supplied clues must fit the same title.</EmptyState>
            ) : (
              <ol className="divide-y divide-line">
                {multi.results.map((r) => (
                  <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-ink">{r.title}</span>
                      <span className="font-mono text-xs text-muted">#{r.id}</span>
                    </div>
                    <p className="text-xs text-muted">{recordMeta(r)}</p>
                    <div className="mt-1.5"><HighlightedTitle text={r.normalized_title} spans={r.matched_clues ?? []} /></div>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-4 text-xs text-muted">
              {multi.algorithm}. Verified {fmt(multi.candidates_verified)} candidate{multi.candidates_verified === 1 ? "" : "s"} out of {fmt(multi.catalog_size)} records.
            </p>
          </Card>
        )}

        <RefinePanel data={refine} loading={refining} onTry={trySuggestion} />
      </div>

      <div className={cx("mt-6 flex flex-wrap gap-3 text-xs text-muted", (basic || multi) && "hidden")}>
        <span>Highlight key:</span>
        <ClueChip type="prefix" value="…" /><ClueChip type="contains" value="…" /><ClueChip type="suffix" value="…" />
      </div>
    </div>
  );
}
