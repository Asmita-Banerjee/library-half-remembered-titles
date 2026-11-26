import { CircleCheck, CircleX, Play } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, ErrorNote, IndexCard, PageHeader, Segmented, Tag } from "../components/ui";
import { api } from "../lib/api";
import { fmt, useAsync } from "../lib/hooks";
import type { Benchmark, Dataset, Scaling, SelfCheck } from "../lib/types";

// Categorical slots validated with the dataviz palette checker (CVD ΔE ≥ 12.6).
// Orange and aqua sit below 3:1 contrast, so every chart has direct labels and a data table.
const C_INDEXED = "#257de0";
const C_LINEAR = "#f47230";
const C_HASH = "#00b894";
const AXIS = { fontSize: 12, fill: "#5e5444" };
const GRID = "rgba(42,36,27,0.12)";
const TIP = { borderRadius: 3, border: "1px solid rgba(42,36,27,.25)", background: "#f7f0dc", fontSize: 13 };

const mb = (b: number) => `${(b / 1e6).toFixed(b > 1e7 ? 0 : 1)} MB`;
const us = (v: number) => `${v.toFixed(v < 1 ? 3 : 2)} µs`;

function TableToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return <button type="button" className="text-[13px] text-stamp underline underline-offset-2" onClick={onToggle}>{show ? "Hide the numbers" : "Show the numbers"}</button>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="label-plate">
      <div className="px-3 py-2.5">
        <p className="typewriter text-[20px] font-bold text-ink">{value}</p>
        <p className="text-[12.5px] text-ink-soft">{label}</p>
        {sub && <p className="text-[12px] text-ink-soft/80">{sub}</p>}
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const perf = useAsync(() => api.performance(), []);
  const [dataset, setDataset] = useState<Dataset>("dsa");
  const [bench, setBench] = useState<Benchmark | null>(null);
  const [scaling, setScaling] = useState<Scaling | null>(null);
  const [check, setCheck] = useState<SelfCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showBench, setShowBench] = useState(false);
  const [showScale, setShowScale] = useState(false);

  async function runAll() {
    setBusy(true); setErr(null);
    try {
      // One after another on purpose: parallel runs would compete for the CPU and skew the timings.
      const b = await api.benchmark(dataset, 2000);
      const s = await api.scaling(dataset);
      const c = await api.selfcheck();
      setBench(b); setScaling(s); setCheck(c);
      perf.reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const p = perf.data;
  const ov = p?.overview;
  const benchRows = bench ? [
    { name: "Indexed (Trie)", ms: bench.exact.indexed_total_ms, fill: C_INDEXED },
    ...(bench.hash_baseline ? [{ name: "Hash map of all pairs", ms: bench.hash_baseline.total_ms, fill: C_HASH }] : []),
    { name: "Linear scan", ms: bench.exact.linear_total_ms, fill: C_LINEAR },
  ] : [];
  const lastRow = scaling ? scaling.rows.length - 1 : -1;
  const endLabel = (text: string) => (props: { x?: number | string; y?: number | string; index?: number }) =>
    props.index === lastRow ? <text x={Number(props.x) + 8} y={Number(props.y) + 4} fontSize={12} fill="#2a241b">{text}</text> : null;

  return (
    <div>
      <PageHeader title="Under the hood">
        Live numbers from the running server: how big the indexes are, how long they took to build, and how the Trie
        compares with simpler ways of answering the same title query.
      </PageHeader>
      {perf.error && <ErrorNote onRetry={perf.reload}>{perf.error}</ErrorNote>}

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="books in the library" value={p ? fmt(p.engines[0].records) : "…"} sub={p ? `plus ${fmt(p.engines[1].records)} DSA test names` : undefined} />
        <Stat label="(beginning, ending) pairs indexed" value={p ? fmt(p.engines.reduce((a, e) => a + e.prefix_suffix_combinations, 0)) : "…"} />
        <Stat label="searches with results" value={ov ? fmt(ov.successful_searches) : "…"} sub={ov ? `${fmt(ov.failed_searches)} found nothing` : undefined} />
        <Stat label="readers confirmed a find" value={p ? `${fmt(p.feedback.found)} of ${fmt(p.feedback.total)}` : "…"} />
      </div>

      {p && (
        <IndexCard ruled className="mb-6">
          <div className="flex min-h-[2.1rem] items-end"><h2 className="text-[17px] font-bold text-ink">Indexes, built once at start-up</h2></div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="text-left text-ink-soft">
                <tr className="border-b border-ink/20">
                  <th scope="col" className="py-2 pr-4 font-normal">Catalogue</th><th scope="col" className="py-2 pr-4 text-right font-normal">Records</th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">Build</th><th scope="col" className="py-2 pr-4 text-right font-normal">Trie depth</th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">Pairs</th><th scope="col" className="py-2 pr-4 text-right font-normal">Trie nodes</th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">Memory</th><th scope="col" className="py-2 text-right font-normal">Builds / queries</th>
                </tr>
              </thead>
              <tbody className="typewriter tabular-nums">
                {p.engines.map((e) => (
                  <tr key={e.name} className="border-b border-ink/10 last:border-0">
                    <td className="py-2 pr-4 font-serif">{e.name === "dsa" ? "DSA test names" : "Library"}</td>
                    <td className="py-2 pr-4 text-right">{fmt(e.records)}</td>
                    <td className="py-2 pr-4 text-right">{e.build_ms.toFixed(1)} ms</td>
                    <td className="py-2 pr-4 text-right">{e.max_affix ? `${e.max_affix} chars` : "full"}</td>
                    <td className="py-2 pr-4 text-right">{fmt(e.prefix_suffix_combinations)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(e.ps_trie_nodes + e.affix_trie_nodes)}</td>
                    <td className="py-2 pr-4 text-right">{mb(e.memory_bytes)}</td>
                    <td className="py-2 text-right">{e.build_count} / {fmt(e.indexed_queries)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
            The library's Trie stores beginnings and endings up to {p.engines[0].max_affix} characters, which keeps it at {mb(p.engines[0].memory_bytes)} instead of
            about 294 MB. Longer clues are answered by intersecting the beginning and ending indexes, so no title is ever scanned.
            Story index: {fmt(p.story_index.documents)} books, {fmt(p.story_index.vocabulary)} terms, {fmt(p.story_index.wordnet_aliases)} WordNet synonyms,
            built in {(p.build_times_ms.story_inverted_index / 1000).toFixed(1)} s. "Builds" stays at 1 because every query reuses the same index.
          </p>
        </IndexCard>
      )}

      <IndexCard ruled className="mb-6">
        <div className="flex min-h-[2.1rem] flex-wrap items-end justify-between gap-3">
          <h2 className="text-[17px] font-bold text-ink">Trie vs hash map vs linear scan</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Benchmark catalogue" value={dataset} onChange={setDataset}
              options={[{ value: "dsa", label: "DSA, 1,000 names" }, { value: "library", label: "Library, 10,060" }]} />
            <Button loading={busy} onClick={runAll}><Play className="h-4 w-4" aria-hidden /> Run benchmark and tests</Button>
          </div>
        </div>
        <p className="mt-3.5 text-[14px] leading-[1.6rem] text-ink-soft">
          2,000 title queries: about 70% built from real titles, the rest random misses. Every method answers the same queries and the answers are compared.
        </p>
        {err && <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>}
        {!bench && !busy && <p className="mt-3 text-[14px] text-ink">Run it to time all three methods on this server.</p>}

        {bench && (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Trie, per query" value={us(bench.exact.indexed_avg_us)} sub={mb(bench.exact.trie_memory_bytes)} />
              {bench.hash_baseline
                ? <Stat label="hash map, per query" value={us(bench.hash_baseline.avg_us)} sub={`${mb(bench.hash_baseline.memory_bytes)}, built in ${bench.hash_baseline.build_ms} ms`} />
                : <Stat label="hash map" value="n/a" sub="needs every pair; too big for 10,060 titles" />}
              <Stat label="linear scan, per query" value={us(bench.exact.linear_avg_us)} sub="no index" />
              <Stat label="same answers" value={bench.exact.results_agree && bench.multi.results_agree && (!bench.hash_baseline || bench.hash_baseline.results_agree) ? "yes" : "NO"}
                sub={`Trie ${bench.exact.speedup}× faster than scanning`} />
            </div>
            <div className="mt-5 flex items-center justify-between">
              <p className="text-[14px] text-ink">Total time for {fmt(bench.queries)} queries, in milliseconds</p>
              <TableToggle show={showBench} onToggle={() => setShowBench((s) => !s)} />
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benchRows} layout="vertical" margin={{ left: 8, right: 56 }} barCategoryGap="30%">
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={150} />
                  <Tooltip cursor={{ fill: "rgba(90,61,138,0.08)" }} formatter={(v) => [`${Number(v).toFixed(3)} ms`, "Total"]} contentStyle={TIP} />
                  <Bar dataKey="ms" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}
                    shape={(props: unknown) => {
                      const { x, y, width, height, payload } = props as { x: number; y: number; width: number; height: number; payload: { fill: string } };
                      return <rect x={x} y={y} width={Math.max(width, 2)} height={height} rx={3} fill={payload.fill} />;
                    }}>
                    <LabelList dataKey="ms" position="right" formatter={(v) => `${Number(v).toFixed(2)} ms`} style={{ fontSize: 12, fill: "#2a241b" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {showBench && (
              <table className="mt-2 w-full text-[13.5px] tabular-nums">
                <thead className="text-left text-ink-soft"><tr><th scope="col" className="py-1 font-normal">Method</th><th scope="col" className="text-right font-normal">Total (ms)</th><th scope="col" className="text-right font-normal">Per query (µs)</th></tr></thead>
                <tbody>{benchRows.map((r) => <tr key={r.name} className="border-t border-ink/15"><td className="py-1">{r.name}</td><td className="text-right">{r.ms.toFixed(4)}</td><td className="text-right">{(r.ms * 1000 / bench.queries).toFixed(4)}</td></tr>)}</tbody>
              </table>
            )}
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              {bench.note} The hash map of every (beginning, ending) pair is the fastest lookup, but it stores far more:
              for each title of length L it keeps L² keys. The Trie shares common beginnings and endings, so it's the one that still fits for long titles.
              Multi-clue search: indexed {bench.multi.indexed_total_ms.toFixed(2)} ms vs scanning {bench.multi.linear_total_ms.toFixed(2)} ms ({bench.multi.speedup}× faster).
            </p>
          </div>
        )}

        {scaling && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <p className="text-[14px] text-ink">Time per query as the catalogue grows ({scaling.dataset === "dsa" ? "DSA names" : "library titles"}), in microseconds</p>
              <TableToggle show={showScale} onToggle={() => setShowScale((s) => !s)} />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scaling.rows} margin={{ left: 0, right: 64, top: 10 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="catalog_size" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(Number(v))} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => Number(v).toFixed(1)} />
                  <Tooltip formatter={(v, n) => [us(Number(v)), String(n)]} labelFormatter={(l) => `${fmt(Number(l))} records`} contentStyle={TIP} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="indexed_avg_us" name="Trie" stroke={C_INDEXED} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#ede2c4" }} isAnimationActive={false}>
                    <LabelList dataKey="indexed_avg_us" content={endLabel("Trie")} />
                  </Line>
                  {scaling.rows[0]?.hash_avg_us !== null && (
                    <Line type="monotone" dataKey="hash_avg_us" name="Hash map" stroke={C_HASH} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#ede2c4" }} isAnimationActive={false}>
                      <LabelList dataKey="hash_avg_us" content={endLabel("Hash")} />
                    </Line>
                  )}
                  <Line type="monotone" dataKey="linear_avg_us" name="Linear scan" stroke={C_LINEAR} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#ede2c4" }} isAnimationActive={false}>
                    <LabelList dataKey="linear_avg_us" content={endLabel("Linear")} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
            {showScale && (
              <div className="overflow-x-auto">
                <table className="mt-2 w-full text-[13px] tabular-nums">
                  <thead className="text-left text-ink-soft"><tr>
                    <th scope="col" className="py-1 font-normal">Records</th><th scope="col" className="text-right font-normal">Build (ms)</th><th scope="col" className="text-right font-normal">Memory</th>
                    <th scope="col" className="text-right font-normal">Per 1,000</th><th scope="col" className="text-right font-normal">Trie (µs)</th><th scope="col" className="text-right font-normal">Hash (µs)</th>
                    <th scope="col" className="text-right font-normal">Linear (µs)</th><th scope="col" className="text-right font-normal">Agree</th></tr></thead>
                  <tbody>{scaling.rows.map((r) => (
                    <tr key={r.catalog_size} className="border-t border-ink/15">
                      <td className="py-1">{fmt(r.catalog_size)}</td><td className="text-right">{r.build_ms.toFixed(1)}</td><td className="text-right">{mb(r.memory_bytes)}</td>
                      <td className="text-right">{r.memory_per_1000_mb.toFixed(2)} MB</td><td className="text-right">{r.indexed_avg_us.toFixed(3)}</td>
                      <td className="text-right">{r.hash_avg_us === null ? "n/a" : r.hash_avg_us.toFixed(3)}</td><td className="text-right">{r.linear_avg_us.toFixed(3)}</td>
                      <td className="text-right">{r.results_agree ? "yes" : "NO"}</td>
                    </tr>))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </IndexCard>

      {check && (
        <IndexCard ruled className="mb-6">
          <div className="flex min-h-[2.1rem] items-end justify-between gap-3">
            <h2 className="text-[17px] font-bold text-ink">Live checks against the running indexes</h2>
            <span className={check.passed === check.total ? "stamp text-[12px]" : "stamp red text-[12px]"}>{check.passed}/{check.total} passed</span>
          </div>
          <ul className="mt-3 space-y-2.5">
            {check.checks.map((c) => (
              <li key={c.name} className="flex gap-2.5 text-[14px]">
                {c.passed ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2f6b4f]" aria-label="passed" /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-rule-red" aria-label="failed" />}
                <div><p className="text-ink">{c.name}</p><p className="text-[13px] text-ink-soft">{c.detail}</p></div>
              </li>
            ))}
          </ul>
        </IndexCard>
      )}

      {p && p.searches.length > 0 && (
        <IndexCard ruled>
          <div className="flex min-h-[2.1rem] items-end"><h2 className="text-[17px] font-bold text-ink">Searches so far</h2></div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13.5px] tabular-nums">
              <thead className="text-left text-ink-soft"><tr className="border-b border-ink/20">
                <th scope="col" className="py-2 font-normal">Type</th><th scope="col" className="py-2 text-right font-normal">Searches</th><th scope="col" className="py-2 text-right font-normal">Found</th>
                <th scope="col" className="py-2 text-right font-normal">No match</th><th scope="col" className="py-2 text-right font-normal">Readers confirmed</th><th scope="col" className="py-2 text-right font-normal">Average time</th></tr></thead>
              <tbody>
                {p.searches.map((s) => {
                  const fb = p.feedback.by_type[s.search_type];
                  return (
                    <tr key={s.search_type} className="border-b border-ink/10 last:border-0">
                      <td className="py-2">{({ basic: "Beginning and ending", multi: "Title clues", author: "Author", story: "Story" } as Record<string, string>)[s.search_type] ?? s.search_type}</td>
                      <td className="py-2 text-right">{fmt(s.count)}</td><td className="py-2 text-right">{fmt(s.success)}</td>
                      <td className="py-2 text-right">{fmt(s.failure)}</td>
                      <td className="py-2 text-right">{fb ? `${fb.found} of ${fb.total}` : <Tag>none yet</Tag>}</td>
                      <td className="py-2 text-right">{s.avg_ms.toFixed(3)} ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[13px] text-ink-soft">Server time for the whole request, including the call from Python into the C engine.</p>
        </IndexCard>
      )}
    </div>
  );
}
