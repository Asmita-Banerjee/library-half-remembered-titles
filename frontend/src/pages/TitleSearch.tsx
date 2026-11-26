import { Lightbulb, LoaderCircle, Plus, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Cover from "../components/Cover";
import FacetPanel, { EMPTY_FACETS, facetsActive } from "../components/FacetPanel";
import Feedback from "../components/Feedback";
import {
  Button, ClueChip, ErrorNote, HighlightedTitle, IndexCard, PageHeader, RecordNo, Segmented, Tag, TextField,
  Timing, cx,
} from "../components/ui";
import { ApiError, api } from "../lib/api";
import { fmt, useDebounced } from "../lib/hooks";
import type {
  BasicResult, ClueSpan, Dataset, FacetValues, LiveResult, MultiResult, RecordView, RefineResult, Suggestion,
} from "../lib/types";

type Mode = "basic" | "multi";
type ClueType = ClueSpan["type"];
interface ClueRow { id: number; type: ClueType; value: string }

const TYPE_LABEL: Record<ClueType, string> = { prefix: "Begins with", contains: "Contains", suffix: "Ends with" };
let rowSeq = 0;
const row = (type: ClueType, value = ""): ClueRow => ({ id: ++rowSeq, type, value });

function splitRows(rows: ClueRow[]) {
  return {
    prefix: rows.find((r) => r.type === "prefix")?.value ?? "",
    suffix: rows.find((r) => r.type === "suffix")?.value ?? "",
    contains: rows.filter((r) => r.type === "contains").map((r) => r.value),
  };
}

function byline(r: RecordView) {
  if (r.dataset === "dsa") return "DSA test catalogue";
  const parts = [r.authors?.join(" and "), r.year !== null && r.year !== undefined ? String(r.year) : null];
  return parts.filter(Boolean).join(", ");
}

/* ------------------------------------------------------------ live panel -- */

function LivePanel({ dataset, prefix, contains, suffix }: { dataset: Dataset; prefix: string; contains: string[]; suffix: string }) {
  const key = JSON.stringify([dataset, prefix, contains, suffix]);
  const debounced = useDebounced(key, 200);
  const [data, setData] = useState<LiveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = !prefix.trim() && !suffix.trim() && contains.every((c) => !c.trim());

  useEffect(() => {
    const [d, p, c, s] = JSON.parse(debounced) as [Dataset, string, string[], string];
    if (!p.trim() && !s.trim() && c.every((x) => !x.trim())) { setData(null); setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    api.live(d, p, c, s, ctrl.signal)
      .then((r) => { setData(r); setError(null); setLoading(false); })
      .catch((e: Error) => { if (e.name !== "AbortError") { setError(e.message); setLoading(false); } });
    return () => ctrl.abort();
  }, [debounced]);

  const list = (items: RecordView[]) => (
    <ul className="mt-2 space-y-1.5">
      {items.map((r) => (
        <li key={r.id} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">
            {r.dataset === "library"
              ? <Link to={`/book/${r.id}`} className="hover:underline"><HighlightedTitle text={r.normalized_title} spans={r.matched_clues ?? []} /></Link>
              : <HighlightedTitle text={r.normalized_title} spans={r.matched_clues ?? []} />}
          </span>
          <span className="typewriter shrink-0 text-[11.5px] text-ink-soft">No. {r.id}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <aside aria-live="polite" aria-label="Titles that fit so far" className="rounded-[4px] border border-dashed border-chalk/30 p-4 text-chalk">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px]">Fits so far</p>
        {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-sage" /> : data && <span className="typewriter text-[12px] text-sage">{data.elapsed_ms < 1 ? `${Math.max(1, Math.round(data.elapsed_ms * 1000))} µs` : `${data.elapsed_ms.toFixed(1)} ms`}</span>}
      </div>
      {empty && <p className="mt-2 text-[13.5px] text-sage">Start typing. Titles that fit every clue you've entered appear here as you type.</p>}
      {error && <p className="mt-2 text-[13.5px] text-[#f0b3a8]">{error}</p>}
      {!empty && data && (
        <div className="mt-2 rounded-[3px] bg-manila p-3 text-ink">
          <p className="text-[13.5px]">
            {data.total === 0 ? "No title fits these clues exactly."
              : `${fmt(data.total)} title${data.total === 1 ? "" : "s"} fit${data.total > data.suggestions.length ? `; the ${data.suggestions.length} newest:` : ":"}`}
          </p>
          {data.total > 0 && list(data.suggestions)}
          {data.total === 0 && data.approximate.length > 0 && (
            <>
              <p className="mt-2 text-[13px] text-ink-soft">
                Close spellings that do exist (not exact matches):
                {" "}<span className="typewriter text-ink">"{data.approximate[0].approximation?.typed}" → "{data.approximate[0].approximation?.matched}"</span>
              </p>
              {list(data.approximate)}
            </>
          )}
        </div>
      )}
    </aside>
  );
}

/* --------------------------------------------------------- refine panel -- */

function RefinePanel({ data, loading, onTry }: { data: RefineResult | null; loading: boolean; onTry: (s: Suggestion) => void }) {
  if (loading) return <p className="flex items-center gap-2 text-sage"><LoaderCircle className="h-4 w-4 animate-spin" /> Looking for clues that do exist…</p>;
  if (!data) return null;
  return (
    <IndexCard ruled>
      <div className="flex min-h-[2.1rem] items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink"><Lightbulb className="h-4 w-4 text-brass" aria-hidden /> Librarian's note: try these clues</h2>
        <Timing ms={data.elapsed_ms} />
      </div>
      <p className="mt-3.5 text-[14px] leading-[1.6rem] text-ink-soft">
        Your search was left exactly as you typed it. Each alternative below was checked against the index and matches at least one title.
      </p>
      {data.suggestions.length === 0 ? (
        <p className="text-[14.5px] leading-[1.6rem] text-ink">No nearby clues exist either. Try a shorter beginning or ending, or describe the story instead.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {data.suggestions.map((s, i) => (
            <li key={i} className="flex flex-col gap-3 rounded-[3px] bg-manila-light p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  {s.prefix && <ClueChip type="prefix" value={s.prefix} />}
                  {s.contains.map((c, j) => <ClueChip key={j} type="contains" value={c} />)}
                  {s.suffix && <ClueChip type="suffix" value={s.suffix} />}
                </div>
                <p className="mt-1.5 text-[14px] text-ink">{s.reason}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-soft">{s.match_count} match{s.match_count === 1 ? "" : "es"}, newest: {s.preview}</p>
              </div>
              <Button variant="secondary" className="shrink-0" onClick={() => onTry(s)}>Search with these</Button>
            </li>
          ))}
        </ul>
      )}
    </IndexCard>
  );
}

/* ----------------------------------------------------------------- page -- */

export default function TitleSearchPage() {
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "multi" ? "multi" : "basic");
  const [dataset, setDataset] = useState<Dataset>(params.get("dataset") === "dsa" ? "dsa" : "library");
  const [prefix, setPrefix] = useState(params.get("mode") !== "multi" ? params.get("prefix") ?? "" : "");
  const [suffix, setSuffix] = useState(params.get("mode") !== "multi" ? params.get("suffix") ?? "" : "");
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
  const [facets, setFacets] = useState<FacetValues>(EMPTY_FACETS);
  const [showFacets, setShowFacets] = useState(false);
  const [basic, setBasic] = useState<BasicResult | null>(null);
  const [multi, setMulti] = useState<MultiResult | null>(null);
  const [error, setError] = useState<{ msg: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refine, setRefine] = useState<RefineResult | null>(null);
  const [refining, setRefining] = useState(false);
  const reqId = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const clues = useMemo(() => (mode === "basic" ? { prefix, suffix, contains: [] as string[] } : splitRows(rows)), [mode, prefix, suffix, rows]);
  const clearResults = () => { reqId.current++; setBasic(null); setMulti(null); setRefine(null); setError(null); setBusy(false); setRefining(false); };
  const scrollToResults = () => requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  async function runRefine(id: number, d: Dataset, p: string, c: string[], s: string) {
    setRefining(true);
    try { const r = await api.refine(d, p, c, s); if (id === reqId.current) setRefine(r); }
    catch { if (id === reqId.current) setRefine(null); }
    finally { if (id === reqId.current) setRefining(false); }
  }

  async function runBasic(d = dataset, p = prefix, s = suffix) {
    clearResults();
    if (!p.trim() || !s.trim()) {
      setError({
        msg: !p.trim() && !s.trim() ? "Fill in how the title begins and how it ends." : !p.trim() ? "Fill in how the title begins." : "Fill in how the title ends.",
        field: !p.trim() ? "prefix" : "suffix",
      });
      return;
    }
    const id = ++reqId.current;
    setBusy(true);
    try {
      const r = await api.basic(d, p, s);
      if (id !== reqId.current) return;
      setBasic(r);
      scrollToResults();
      if (r.status === "no_match") runRefine(id, d, p, [], s);
    } catch (e) {
      if (id === reqId.current) setError({ msg: (e as ApiError).message, field: (e as ApiError).field });
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }

  async function runMulti(d = dataset, list = rows, f = facets) {
    clearResults();
    const { prefix: p, suffix: s, contains: c } = splitRows(list);
    const cs = c.filter((x) => x.trim());
    if (!p.trim() && !s.trim() && cs.length === 0) { setError({ msg: "Fill in at least one clue.", field: "clues" }); return; }
    const id = ++reqId.current;
    setBusy(true);
    try {
      const r = await api.multi(d, p, cs, s, d === "library" ? f : null);
      if (id !== reqId.current) return;
      setMulti(r);
      scrollToResults();
      if (r.status === "no_match" && !r.facets_applied) runRefine(id, d, p, cs, s);
    } catch (e) {
      if (id === reqId.current) setError({ msg: (e as ApiError).message, field: (e as ApiError).field });
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }

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
  const resultLink = (r: RecordView, children: ReactNode) =>
    r.dataset === "library" ? <Link to={`/book/${r.id}`} className="hover:text-stamp hover:underline">{children}</Link> : children;

  return (
    <div>
      <PageHeader title="Title clues">
        Remember how the title starts, how it ends, or a few letters from the middle? Capitals and punctuation don't matter.
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented onDark label="Search type" value={mode} onChange={(m) => { setMode(m); clearResults(); }}
          options={[{ value: "basic", label: "Beginning and ending" }, { value: "multi", label: "Any clues" }]} />
        <Segmented onDark label="Catalogue" value={dataset} onChange={(d) => { setDataset(d); clearResults(); }}
          options={[{ value: "library", label: "Library, 10,060 books" }, { value: "dsa", label: "DSA test names, 1,000" }]} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
        <IndexCard ruled punched>
          <form onSubmit={onSubmit} noValidate>
            <div className="flex min-h-[2.1rem] items-end">
              <p className="text-[15px] text-ink">
                {mode === "basic" ? "Returns the most recently added book whose title fits both." : "Every clue must fit the same title. All matches are listed, newest first."}
              </p>
            </div>
            {mode === "basic" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <TextField label="Begins with" value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={120}
                  placeholder={dataset === "dsa" ? "ma" : "harry"} error={error?.field === "prefix" || error?.field === "both"} />
                <TextField label="Ends with" value={suffix} onChange={(e) => setSuffix(e.target.value)} maxLength={120}
                  placeholder={dataset === "dsa" ? "a" : "azkaban"} error={error?.field === "suffix" || error?.field === "both"} />
              </div>
            ) : (
              <>
                <ul className="mt-4 space-y-3">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-end gap-2">
                      <div className="w-[8.5rem] shrink-0">
                        <label htmlFor={`t-${r.id}`} className="mb-1 block text-[13px] text-ink-soft">Clue</label>
                        <select id={`t-${r.id}`} value={r.type} onChange={(e) => updateRow(r.id, { type: e.target.value as ClueType })}
                          className="w-full rounded-[3px] border border-ink/20 bg-manila-light px-2 py-[9px] text-[14px] focus:border-stamp focus:outline-none">
                          {(["prefix", "contains", "suffix"] as ClueType[]).map((t) => (
                            <option key={t} value={t} disabled={t !== "contains" && t !== r.type && hasType(t)}>{TYPE_LABEL[t]}</option>
                          ))}
                        </select>
                      </div>
                      <TextField id={`v-${r.id}`} label={`${TYPE_LABEL[r.type]} text`} hideLabel className="min-w-0 flex-1"
                        value={r.value} onChange={(e) => updateRow(r.id, { value: e.target.value })} maxLength={120}
                        placeholder={r.type === "prefix" ? "the" : r.type === "suffix" ? "man" : "visible"} />
                      <button type="button" aria-label={`Remove this ${TYPE_LABEL[r.type].toLowerCase()} clue`}
                        onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} disabled={rows.length === 1}
                        className="mb-1 rounded-[3px] p-2 text-ink-soft hover:bg-manila-dark hover:text-rule-red disabled:opacity-30">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {(["prefix", "contains", "suffix"] as ClueType[]).map((t) => (
                    <button key={t} type="button"
                      disabled={(t !== "contains" && hasType(t)) || (t === "contains" && rows.filter((r) => r.type === "contains").length >= 8)}
                      onClick={() => setRows((rs) => [...rs, row(t)])}
                      className="inline-flex items-center gap-1 text-[13.5px] text-stamp hover:underline disabled:text-ink-soft/50 disabled:no-underline">
                      <Plus className="h-3.5 w-3.5" aria-hidden /> {TYPE_LABEL[t]}
                    </button>
                  ))}
                  {dataset === "library" && (
                    <button type="button" aria-expanded={showFacets} onClick={() => setShowFacets((s) => !s)}
                      className={cx("ml-auto inline-flex items-center gap-1.5 text-[13.5px] hover:underline", facetsActive(facets) ? "text-stamp" : "text-ink-soft")}>
                      <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Filters{facetsActive(facets) && " (on)"}
                    </button>
                  )}
                </div>
                {showFacets && dataset === "library" && (
                  <div className="mt-3 rounded-[3px] bg-manila-light/70 p-3">
                    <FacetPanel idPrefix="title" value={facets} onChange={setFacets} />
                    {facetsActive(facets) && <button type="button" className="mt-2 text-[13px] text-ink-soft underline" onClick={() => setFacets(EMPTY_FACETS)}>Clear filters</button>}
                  </div>
                )}
              </>
            )}
            {error && <div className="mt-4"><ErrorNote>{error.msg}</ErrorNote></div>}
            <div className="mt-5 flex items-center gap-4">
              <Button type="submit" loading={busy}>Search titles</Button>
              <button type="button" className="text-[14px] text-ink-soft underline underline-offset-4 hover:text-ink" onClick={() => {
                clearResults();
                if (mode === "basic") { setPrefix(""); setSuffix(""); } else setRows([row("prefix"), row("contains")]);
              }}>Clear</button>
            </div>
          </form>
        </IndexCard>

        <LivePanel dataset={dataset} prefix={clues.prefix} contains={clues.contains} suffix={clues.suffix} />
      </div>

      <div ref={resultRef} className="mt-8 scroll-mt-6 space-y-5">
        {basic && (
          <IndexCard ruled>
            <div className="flex min-h-[2.1rem] flex-wrap items-end justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <ClueChip type="prefix" value={basic.normalized.prefix} />
                <ClueChip type="suffix" value={basic.normalized.suffix} />
              </div>
              <Timing ms={basic.elapsed_ms} />
            </div>
            {basic.record ? (
              <div className="mt-3 flex gap-5">
                {basic.record.dataset === "library" && (
                  <Link to={`/book/${basic.record.id}`} aria-hidden tabIndex={-1}>
                    <Cover isbn={basic.record.cover_isbn} title={basic.record.title} author={basic.record.authors?.[0]} />
                  </Link>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-[21px] leading-snug text-ink">{resultLink(basic.record, basic.record.title)}</h2>
                    <span className="stamp stamp-in text-[13px]">Found</span>
                  </div>
                  <p className="text-[14px] leading-[1.6rem] text-ink-soft">{byline(basic.record)} <RecordNo id={basic.record.id} /></p>
                  {basic.record.note && <p className="text-[13.5px] leading-[1.6rem] text-ink-soft">{basic.record.note}</p>}
                  <p className="text-[14.5px] leading-[1.6rem] text-ink">{basic.message}</p>
                  {basic.matching_records > 1 && (
                    <button type="button" className="text-[14px] leading-[1.6rem] text-stamp underline underline-offset-2" onClick={() => {
                      const next = [row("prefix", basic.clues.prefix), row("suffix", basic.clues.suffix)];
                      setMode("multi"); setRows(next); runMulti(dataset, next, EMPTY_FACETS);
                    }}>See all {basic.matching_records} matching records</button>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[16px] leading-[1.6rem] text-ink">{basic.message}</p>
            )}
            <p className="mt-3 text-[12.5px] leading-[1.6rem] text-ink-soft">How it was found: {basic.algorithm}.</p>
            {basic.record && <div className="mt-2"><Feedback key={basic.search_id ?? 0} searchType="basic" searchId={basic.search_id} recordId={basic.record.id} /></div>}
          </IndexCard>
        )}

        {multi && (
          <IndexCard ruled>
            <div className="flex min-h-[2.1rem] flex-wrap items-end justify-between gap-2">
              <h2 className="text-[17px] font-bold text-ink">
                {multi.total === 0 ? "No title fits every clue" : `${fmt(multi.total)} matching record${multi.total === 1 ? "" : "s"}`}
                {multi.facets_applied && <span className="font-normal text-ink-soft"> within your filters (of {fmt(multi.unfiltered_total)})</span>}
              </h2>
              <Timing ms={multi.elapsed_ms} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {multi.normalized.prefix && <ClueChip type="prefix" value={multi.normalized.prefix} />}
              {multi.normalized.contains.map((c, i) => <ClueChip key={i} type="contains" value={c} />)}
              {multi.normalized.suffix && <ClueChip type="suffix" value={multi.normalized.suffix} />}
            </div>
            {multi.total > 0 && (
              <ol className="mt-2">
                {multi.results.map((r) => (
                  <li key={r.id} className="flex gap-3 border-b border-ink/10 py-2.5 last:border-0">
                    {r.dataset === "library" && <Cover isbn={r.cover_isbn} title={r.title} author={r.authors?.[0]} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[15.5px] text-ink">{resultLink(r, r.title)}</span>
                        <RecordNo id={r.id} />
                      </div>
                      <p className="text-[13px] text-ink-soft">{byline(r)}</p>
                      <div className="mt-1"><HighlightedTitle text={r.normalized_title} spans={r.matched_clues ?? []} /></div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {multi.total > multi.results.length && <p className="mt-2 text-[13px] text-ink-soft">Showing the newest {multi.results.length}. Add another clue to narrow it down.</p>}
            {multi.total === 0 && multi.facets_applied && <p className="mt-3 text-[14px] text-ink">{fmt(multi.unfiltered_total)} titles fit your clues, but none match the filters. Clear the filters to see them.</p>}
            <p className="mt-3 text-[12.5px] leading-[1.6rem] text-ink-soft">
              How it was found: {multi.algorithm}. {fmt(multi.candidates_verified)} candidate{multi.candidates_verified === 1 ? "" : "s"} checked out of {fmt(multi.catalog_size)} records.
            </p>
            {multi.total > 0 && <div className="mt-2"><Feedback key={multi.search_id ?? 0} searchType="multi" searchId={multi.search_id} /></div>}
          </IndexCard>
        )}

        <RefinePanel data={refine} loading={refining} onTry={trySuggestion} />

        {!basic && !multi && !busy && !error && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-sage">
            <span>Colours on result titles:</span>
            <ClueChip type="prefix" value="…" /><ClueChip type="contains" value="…" /><ClueChip type="suffix" value="…" />
            <Tag tone="dark">Record numbers follow the order books were added</Tag>
          </div>
        )}
      </div>
      {basic === null && multi === null && busy && <p className="mt-4 text-sage">Searching…</p>}
    </div>
  );
}
