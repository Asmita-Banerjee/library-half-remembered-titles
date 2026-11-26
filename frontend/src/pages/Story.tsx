import { Search, TextSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge, Button, Card, EmptyState, ErrorNote, PageHeader, Timing } from "../components/ui";
import { api } from "../lib/api";
import type { StoryResult } from "../lib/types";

const EXAMPLES = [
  "A detective who wears a hat and solves mysteries.",
  "boy wizard at a school of magic",
  "captain obsessed with a white whale",
  "firemen burn books",
  "time travel to the far future",
  "orphan girl with red hair on a farm",
];

export default function StoryPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [result, setResult] = useState<StoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(text = q) {
    setError(null);
    if (!text.trim()) { setError("Describe a character, plot, setting or theme."); setResult(null); return; }
    setBusy(true);
    try { setResult(await api.story(text)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || params.get("run") !== "1") return;
    ran.current = true;
    run();
    params.delete("run"); setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const submit = (e: FormEvent) => { e.preventDefault(); run(); };

  return (
    <div>
      <PageHeader icon={<TextSearch className="h-6 w-6" />} title="Characters & story"
        subtitle="Describe what you remember in your own words: who was in it, what happened, where it was set, or what it was about." />
      <Card className="mb-6">
        <form onSubmit={submit}>
          <label htmlFor="story-q" className="mb-1.5 block text-[13px] font-medium text-ink">What do you remember?</label>
          <textarea id="story-q" rows={3} maxLength={500} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }}
            placeholder="e.g. A detective who wears a hat and solves mysteries."
            className="w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-[15px] placeholder:text-stone-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="submit" loading={busy}><Search className="h-4 w-4" /> Find books</Button>
            <span className="ml-1 text-xs text-muted">Try:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => { setQ(ex); run(ex); }}
                className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-muted hover:border-navy/40 hover:text-navy">{ex}</button>
            ))}
          </div>
        </form>
        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      </Card>

      {result && result.results.length === 0 && (
        <EmptyState icon={<TextSearch className="h-8 w-8" />} title="No books match that description">
          None of the words {result.terms.length ? <>({result.terms.map((t) => `“${t}”`).join(", ")})</> : null} appear in the catalog's character, plot, setting or theme data.
        </EmptyState>
      )}
      {result && result.results.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>Ranked {result.results.length} book{result.results.length === 1 ? "" : "s"} for: {result.terms.map((t) => <Badge key={t} tone="navy">{t}</Badge>)}</span>
            <Timing ms={result.elapsed_ms} />
          </div>
          <ol className="space-y-4">
            {result.results.map((b, i) => (
              <Card as="li" key={b.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-serif text-lg font-semibold text-ink"><span className="mr-2 text-muted">{i + 1}.</span>{b.title}</h3>
                  <div className="flex items-center gap-2"><Badge>{b.genre}</Badge><span className="font-mono text-xs text-muted">#{b.id}</span></div>
                </div>
                <p className="text-sm text-muted">{b.authors.join(", ")} · {b.year} · relevance {b.score.toFixed(2)}</p>
                <p className="mt-3 text-sm leading-relaxed text-ink">{b.plot}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Characters</p>
                    <ul className="space-y-0.5 text-sm">
                      {b.characters.slice(0, 4).map((c) => <li key={c.name}><span className="font-medium text-ink">{c.name}</span> <span className="text-muted">— {c.description}</span></li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Why it matched</p>
                    <ul className="space-y-1 text-sm">
                      {b.reasons.map((r, j) => (
                        <li key={j} className="text-ink">
                          <span className="font-medium">“{r.term}”</span>
                          {r.related_to && <span className="text-muted"> (related to “{r.related_to}”)</span>}
                          <span className="text-muted"> in {r.field}</span>
                          {r.context && <span className="block truncate text-xs text-muted">{r.context}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {b.settings.slice(0, 3).map((s) => <Badge key={s}>{s}</Badge>)}
                  {b.themes.slice(0, 3).map((t) => <Badge key={t} tone="navy">{t}</Badge>)}
                </div>
              </Card>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted">{result.algorithm}. Keyword-based; related terms are shown as such and score lower than direct matches.</p>
        </>
      )}
    </div>
  );
}
