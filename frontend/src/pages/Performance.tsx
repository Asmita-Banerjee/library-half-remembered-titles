import { CircleCheck, CircleX, Gauge, Play } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, ErrorNote, PageHeader, SectionTitle, Segmented, Stat } from "../components/ui";
import { api } from "../lib/api";
import { fmt, useAsync } from "../lib/hooks";
import type { Benchmark, Dataset, Scaling, SelfCheck } from "../lib/types";

// Validated with the dataviz palette validator (light surface): CVD ΔE 26.6, normal ΔE 35.2.
// Linear's orange sits below 3:1 contrast, so every chart also has direct labels or a data table.
const C_INDEXED = "#257de0";
const C_LINEAR = "#f47230";
const AXIS = { fontSize: 12, fill: "#5f6673" };

const kb = (b: number) => (b > 1e6 ? `${(b / 1048576).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`);

function TableToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return <button className="text-xs text-navy hover:underline" onClick={onToggle}>{show ? "Hide table" : "Show data table"}</button>;
}

export default function PerformancePage() {
  const perf = useAsync(() => api.performance(), []);
  const [dataset, setDataset] = useState<Dataset>("dsa");
  const [bench, setBench] = useState<Benchmark | null>(null);
  const [scaling, setScaling] = useState<Scaling | null>(null);
  const [check, setCheck] = useState<SelfCheck | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showBenchTable, setShowBenchTable] = useState(false);
  const [showScaleTable, setShowScaleTable] = useState(false);

  async function act<T>(name: string, fn: () => Promise<T>, set: (v: T) => void) {
    setBusy(name); setErr(null);
    try { set(await fn()); perf.reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  const runAll = () => act("all", async () => {
    // Sequential on purpose: parallel benchmarks would compete for the CPU and skew timings.
    const b = await api.benchmark(dataset, 2000);
    const s = await api.scaling();
    const c = await api.selfcheck();
    return { b, s, c };
  }, ({ b, s, c }) => { setBench(b); setScaling(s); setCheck(c); });

  const p = perf.data;
  const ov = p?.overview;
  const benchRows = bench ? [
    { name: "Exact prefix + suffix", indexed: bench.exact.indexed_total_ms, linear: bench.exact.linear_total_ms },
    { name: "Multi-clue (prefix + contains)", indexed: bench.multi.indexed_total_ms, linear: bench.multi.linear_total_ms },
  ] : [];

  return (
    <div>
      <PageHeader icon={<Gauge className="h-6 w-6" />} title="Performance & testing"
        subtitle="Live numbers from the running server. Benchmarks are measured inside the C engine on the same query set for both methods, and the answers are compared." />

      {perf.error && <ErrorNote>{perf.error}</ErrorNote>}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Catalog size" value={p ? fmt(p.engines[0].records) : "–"} sub={p ? `+ ${fmt(p.engines[1].records)} DSA test names` : " "} />
        <Stat label="Indexed combinations" value={p ? fmt(p.engines.reduce((a, e) => a + e.prefix_suffix_combinations, 0)) : "–"} sub="(prefix, suffix) pairs" />
        <Stat label="Successful queries" value={ov ? fmt(ov.successful_searches) : "–"} sub={ov ? `${fmt(ov.total_searches)} total` : " "} />
        <Stat label="Failed queries" value={ov ? fmt(ov.failed_searches) : "–"} sub="no match" />
      </div>

      {p && (
        <Card className="mb-6">
          <SectionTitle>Index construction (built once at startup)</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-medium">Catalog</th><th className="py-2 pr-4 text-right font-medium">Records</th>
                  <th className="py-2 pr-4 text-right font-medium">Build time</th><th className="py-2 pr-4 text-right font-medium">Combined keys</th>
                  <th className="py-2 pr-4 text-right font-medium">Combinations</th><th className="py-2 pr-4 text-right font-medium">Trie nodes</th>
                  <th className="py-2 pr-4 text-right font-medium">Memory</th><th className="py-2 text-right font-medium">Builds / queries</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {p.engines.map((e) => (
                  <tr key={e.name} className="border-b border-line/70 last:border-0">
                    <td className="py-2 pr-4">{e.name === "dsa" ? "DSA test catalog" : "Library catalog"}</td>
                    <td className="py-2 pr-4 text-right">{fmt(e.records)}</td>
                    <td className="py-2 pr-4 text-right">{e.build_ms.toFixed(2)} ms</td>
                    <td className="py-2 pr-4 text-right">{fmt(e.combined_keys)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(e.prefix_suffix_combinations)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(e.ps_trie_nodes)} + {fmt(e.affix_trie_nodes)}</td>
                    <td className="py-2 pr-4 text-right">{kb(e.memory_bytes)}</td>
                    <td className="py-2 text-right">{e.build_count} / {fmt(e.indexed_queries)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Trie nodes = prefix-suffix Trie + (prefix Trie and suffix Trie for multi-clue). Author Trie {p.build_times_ms.author_trie?.toFixed(3)} ms ·
            story inverted index {p.build_times_ms.story_inverted_index?.toFixed(2)} ms ({fmt(p.story_index.vocabulary)} terms).
            "Builds" stays at 1: every query reuses the same index.
          </p>
        </Card>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Linear search vs indexed search</h2>
            <p className="text-sm text-muted">2,000 queries (≈70% drawn from real titles, 30% random misses).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Benchmark catalog" value={dataset} onChange={setDataset}
              options={[{ value: "dsa", label: "DSA (1,000)" }, { value: "library", label: "Library" }]} />
            <Button loading={busy === "all"} onClick={runAll}><Play className="h-4 w-4" /> Run benchmark & tests</Button>
          </div>
        </div>
        {err && <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>}

        {bench && (
          <div className="mt-6">
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Indexed, per query" value={`${bench.exact.indexed_avg_us.toFixed(3)} µs`} />
              <Stat label="Linear, per query" value={`${bench.exact.linear_avg_us.toFixed(3)} µs`} />
              <Stat label="Speed-up (exact)" value={bench.exact.speedup ? `${bench.exact.speedup}×` : "–"} sub={`multi-clue ${bench.multi.speedup ?? "–"}×`} />
              <Stat label="Answers identical" value={bench.exact.results_agree && bench.multi.results_agree ? "Yes" : "No"} sub={`${fmt(bench.hits)} hits · ${fmt(bench.misses)} misses`} />
            </div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Total time for {fmt(bench.queries)} queries (ms)</p>
              <TableToggle show={showBenchTable} onToggle={() => setShowBenchTable((s) => !s)} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benchRows} layout="vertical" margin={{ left: 8, right: 48 }} barGap={2} barCategoryGap="28%">
                  <CartesianGrid horizontal={false} stroke="#ecebe7" />
                  <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} unit=" ms" domain={[0, (max: number) => Number((max * 1.15).toPrecision(2))]} />
                  <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={170} />
                  <Tooltip cursor={{ fill: "rgba(30,58,138,0.05)" }} formatter={(v) => `${Number(v).toFixed(3)} ms`} contentStyle={{ borderRadius: 8, border: "1px solid #e4e2dc", fontSize: 13 }} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="indexed" name="Indexed (Trie / postings)" fill={C_INDEXED} radius={[0, 4, 4, 0]} barSize={14}>
                    <LabelList dataKey="indexed" position="right" formatter={(v) => `${Number(v).toFixed(2)}`} style={{ fontSize: 11, fill: "#1c1f26" }} />
                  </Bar>
                  <Bar dataKey="linear" name="Linear scan" fill={C_LINEAR} radius={[0, 4, 4, 0]} barSize={14}>
                    <LabelList dataKey="linear" position="right" formatter={(v) => `${Number(v).toFixed(2)}`} style={{ fontSize: 11, fill: "#1c1f26" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {showBenchTable && (
              <table className="mt-2 w-full text-sm tabular-nums">
                <thead className="text-left text-xs text-muted"><tr><th className="py-1">Query type</th><th className="text-right">Indexed (ms)</th><th className="text-right">Linear (ms)</th></tr></thead>
                <tbody>{benchRows.map((r) => <tr key={r.name} className="border-t border-line"><td className="py-1">{r.name}</td><td className="text-right">{r.indexed.toFixed(4)}</td><td className="text-right">{r.linear.toFixed(4)}</td></tr>)}</tbody>
              </table>
            )}
            <p className="mt-2 text-xs text-muted">{bench.note} Linear exact search stops at the newest match, so it is fastest on hits and slowest on misses; the gap widens as the catalog grows.</p>
          </div>
        )}

        {scaling && (
          <div className="mt-8">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Average time per exact query as the catalog grows (µs)</p>
              <TableToggle show={showScaleTable} onToggle={() => setShowScaleTable((s) => !s)} />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scaling.rows} margin={{ left: 0, right: 56, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="#ecebe7" />
                  <XAxis dataKey="catalog_size" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} unit=" µs" width={68} tickFormatter={(v) => Number(v).toFixed(2)} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(3)} µs`} labelFormatter={(l) => `${l} records`} contentStyle={{ borderRadius: 8, border: "1px solid #e4e2dc", fontSize: 13 }} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="indexed_avg_us" name="Indexed (Trie)" stroke={C_INDEXED} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}>
                    <LabelList dataKey="indexed_avg_us" position="right" content={(props) => props.index === scaling.rows.length - 1 ? <text x={Number(props.x) + 8} y={Number(props.y) + 4} fontSize={11} fill="#1c1f26">Indexed</text> : null} />
                  </Line>
                  <Line type="monotone" dataKey="linear_avg_us" name="Linear scan" stroke={C_LINEAR} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}>
                    <LabelList dataKey="linear_avg_us" position="right" content={(props) => props.index === scaling.rows.length - 1 ? <text x={Number(props.x) + 8} y={Number(props.y) + 4} fontSize={11} fill="#1c1f26">Linear</text> : null} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
            {showScaleTable && (
              <table className="mt-2 w-full text-sm tabular-nums">
                <thead className="text-left text-xs text-muted"><tr><th className="py-1">Records</th><th className="text-right">Build (ms)</th><th className="text-right">Trie nodes</th><th className="text-right">Indexed (µs)</th><th className="text-right">Linear (µs)</th><th className="text-right">Agree</th></tr></thead>
                <tbody>{scaling.rows.map((r) => <tr key={r.catalog_size} className="border-t border-line"><td className="py-1">{r.catalog_size}</td><td className="text-right">{r.build_ms.toFixed(3)}</td><td className="text-right">{fmt(r.trie_nodes)}</td><td className="text-right">{r.indexed_avg_us.toFixed(3)}</td><td className="text-right">{r.linear_avg_us.toFixed(3)}</td><td className="text-right">{r.results_agree ? "yes" : "NO"}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        )}
      </Card>

      {check && (
        <Card className="mb-6">
          <SectionTitle aside={<Badge tone={check.passed === check.total ? "green" : "red"}>{check.passed}/{check.total} passed</Badge>}>Live scenario tests</SectionTitle>
          <ul className="space-y-2.5">
            {check.checks.map((c) => (
              <li key={c.name} className="flex gap-2.5 text-sm">
                {c.passed ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-label="passed" /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-label="failed" />}
                <div><p className="font-medium text-ink">{c.name}</p><p className="text-muted">{c.detail}</p></div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {p && p.searches.length > 0 && (
        <Card>
          <SectionTitle>Search execution time by type</SectionTitle>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr className="border-b border-line">
              <th className="py-2 font-medium">Type</th><th className="py-2 text-right font-medium">Searches</th><th className="py-2 text-right font-medium">Found</th>
              <th className="py-2 text-right font-medium">No match</th><th className="py-2 text-right font-medium">Avg time</th><th className="py-2 text-right font-medium">Last</th></tr></thead>
            <tbody>
              {p.searches.map((s) => (
                <tr key={s.search_type} className="border-b border-line/70 last:border-0">
                  <td className="py-2 capitalize">{s.search_type === "basic" ? "Beginning + ending" : s.search_type}</td>
                  <td className="py-2 text-right">{fmt(s.count)}</td><td className="py-2 text-right">{fmt(s.success)}</td>
                  <td className="py-2 text-right">{fmt(s.failure)}</td><td className="py-2 text-right">{s.avg_ms.toFixed(3)} ms</td>
                  <td className="py-2 text-right">{s.last_ms.toFixed(3)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">Server-side time for the whole search request, including the Python→C call.</p>
        </Card>
      )}
    </div>
  );
}
