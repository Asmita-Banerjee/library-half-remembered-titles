import { SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Cover from "../components/Cover";
import FacetPanel, { EMPTY_FACETS, facetsActive } from "../components/FacetPanel";
import Feedback from "../components/Feedback";
import { Button, Empty, ErrorNote, IndexCard, Loading, PageHeader, RecordNo, Tag, Timing, cx } from "../components/ui";
import { api } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import type { FacetValues, Reason, StoryHit, StoryResult } from "../lib/types";

const TRY = [
  "A detective who wears a hat and solves mysteries",
  "boy wizard at a school of magic",
  "a doctor who becomes an evil alter ego",
  "sea captain obsessed with a white whale",
  "vampyre romance",
  "firemen who burn books",
];

const KIND_NOTE: Record<Reason["kind"], string> = {
  direct: "",
  spelling: "close spelling of",
  related: "related to",
  wordnet: "synonym of",
};

function ResultCard({ b, rank }: { b: StoryHit; rank: number }) {
  const [open, setOpen] = useState(false);
  const seen = new Set<string>();
  const reasons = b.reasons.filter((r) => { const k = `${r.term}|${r.field}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return (
    <IndexCard as="li" ruled className="flex gap-4 sm:gap-5">
      <Link to={`/book/${b.id}`} className="shrink-0 pt-1" tabIndex={-1} aria-hidden>
        <Cover isbn={b.cover_isbn} title={b.title} author={b.authors[0]} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-[2.1rem] flex-wrap items-end justify-between gap-x-3">
          <h3 className="text-[17px] font-bold leading-snug text-ink">
            <span className="mr-1.5 font-normal text-ink-soft">{rank}.</span>
            <Link to={`/book/${b.id}`} className="hover:text-stamp hover:underline">{b.title}</Link>
          </h3>
          <RecordNo id={b.id} />
        </div>
        <p className="mt-3.5 text-[14px] leading-[1.6rem] text-ink-soft">
          {b.authors.join(" and ")}{b.year !== null && `, ${b.year < 0 ? `${-b.year} BC` : b.year}`}
          {b.series && <> · <span className="italic">{b.series}</span></>}
        </p>
        <div className="flex flex-wrap gap-1.5 py-[3px]">
          <Tag tone="stamp">{b.genre}</Tag>
          {b.audience !== "General" && <Tag>{b.audience === "Children" ? "Children's" : "Young adult"}</Tag>}
          {b.source === "goodbooks" && b.average_rating && <Tag title={`${b.ratings_count?.toLocaleString()} ratings on Goodreads`}>★ {b.average_rating.toFixed(2)}</Tag>}
        </div>
        {b.plot && <p className="text-[14.5px] leading-[1.6rem] text-ink">{b.plot}</p>}
        {!b.plot && b.tags.length > 0 && (
          <p className="text-[14px] leading-[1.6rem] text-ink-soft">Readers shelve it under {b.tags.slice(0, 6).map((t) => t.replace(/-s(-|$)/g, "'s$1").replace(/-/g, " ")).join(", ")}.</p>
        )}
        <div className="mt-1 text-[13.5px] leading-[1.6rem]">
          <span className="text-ink-soft">Matched </span>
          {reasons.slice(0, open ? undefined : 4).map((r, i) => (
            <span key={i}>
              {i > 0 && <span className="text-ink-soft">; </span>}
              <span className="font-bold text-ink">"{r.term}"</span>
              {r.related_to && r.kind !== "direct" && <span className="text-ink-soft"> ({KIND_NOTE[r.kind]} "{r.related_to}")</span>}
              <span className="text-ink-soft"> in {r.field}</span>
            </span>
          ))}
          {reasons.length > 4 && (
            <button type="button" onClick={() => setOpen((o) => !o)} className="ml-1.5 text-stamp underline underline-offset-2">
              {open ? "show fewer" : `+${reasons.length - 4} more`}
            </button>
          )}
        </div>
        {open && b.characters.length > 0 && (
          <p className="text-[13.5px] leading-[1.6rem] text-ink-soft">
            Characters: {b.characters.map((c) => c.name).join(", ")}
          </p>
        )}
      </div>
    </IndexCard>
  );
}

export default function StoryPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [facets, setFacets] = useState<FacetValues>(EMPTY_FACETS);
  const [showFacets, setShowFacets] = useState(false);
  const [result, setResult] = useState<StoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastQuery = useRef<string>("");
  const reqId = useRef(0);

  async function run(text = q, f = facets) {
    setError(null);
    if (!text.trim()) { setError("Describe a character, a scene, the setting or what the book was about."); setResult(null); return; }
    const id = ++reqId.current;
    lastQuery.current = text;
    setBusy(true);
    try {
      const r = await api.story(text, f);
      if (id === reqId.current) setResult(r);
    } catch (e) {
      if (id === reqId.current) setError((e as Error).message);
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  }

  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (params.get("run") === "1" && q.trim()) {
      run();
      params.delete("run");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changing a filter re-runs the last search.
  const debouncedFacets = useDebounced(JSON.stringify(facets), 350);
  const firstFacetRun = useRef(true);
  useEffect(() => {
    if (firstFacetRun.current) { firstFacetRun.current = false; return; }
    if (lastQuery.current.trim()) run(lastQuery.current, JSON.parse(debouncedFacets) as FacetValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFacets]);

  const submit = (e: FormEvent) => { e.preventDefault(); run(); };
  const expansions = result?.expansions ?? [];

  return (
    <div>
      <PageHeader title="Describe the story">
        Tell us who was in it, what happened, where it was set or what it was about. Your own words are fine.
      </PageHeader>

      <IndexCard ruled punched className="mb-8">
        <form onSubmit={submit}>
          <div className="flex min-h-[2.1rem] items-end justify-between">
            <label htmlFor="story-q" className="text-[15px] text-ink">What do you remember?</label>
            <span className="typewriter text-[12.5px] text-ink-soft">{q.length}/500</span>
          </div>
          <textarea id="story-q" rows={3} maxLength={500} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }}
            placeholder="A detective who wears a hat and solves mysteries"
            className="typewriter mt-[3px] w-full resize-y bg-transparent text-[15px] leading-[1.6rem] text-ink placeholder:text-ink-soft/55 focus:outline-none" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="submit" loading={busy}>Find the book</Button>
            <button type="button" aria-expanded={showFacets} onClick={() => setShowFacets((s) => !s)}
              className={cx("inline-flex items-center gap-1.5 text-[14px] underline-offset-4 hover:underline", facetsActive(facets) ? "text-stamp" : "text-ink-soft")}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden /> Narrow it down{facetsActive(facets) && " (on)"}
            </button>
            {facetsActive(facets) && <button type="button" className="text-[13.5px] text-ink-soft underline underline-offset-4" onClick={() => setFacets(EMPTY_FACETS)}>Clear filters</button>}
          </div>
          {showFacets && <div className="mt-4 rounded-[3px] bg-manila-light/70 p-3"><FacetPanel idPrefix="story" value={facets} onChange={setFacets} /></div>}
          <div className="mt-4 flex flex-wrap items-center gap-2 pb-2">
            <span className="text-[13px] text-ink-soft">Try:</span>
            {TRY.map((ex) => (
              <button key={ex} type="button" onClick={() => { setQ(ex); run(ex); }}
                className="rounded-[3px] border border-ink/20 px-2 py-0.5 text-[13px] text-ink-soft hover:border-stamp hover:text-stamp">
                {ex}
              </button>
            ))}
          </div>
        </form>
        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      </IndexCard>

      {busy && !result && <p className="text-sage">Searching the drawers…</p>}

      {result && result.results.length === 0 && (
        <Empty title="No book in the catalogue matches that description">
          {result.facets_applied ? "Your filters may be too narrow. Clear them and search again." :
            "Try other words for the same thing, a character's name, or where it was set."}
        </Empty>
      )}

      {result && result.results.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 text-[14px] text-sage">
            <p>
              {result.results.length} best match{result.results.length === 1 ? "" : "es"}
              {result.facets_applied && " within your filters"}
              {expansions.length > 0 && (
                <> · also searched for {expansions.slice(0, 4).map((x, i) => (
                  <span key={i}>{i > 0 && ", "}<span className="text-chalk">{x.to}</span> ({x.kind === "spelling" ? "spelling of" : "for"} "{x.from}")</span>
                ))}</>
              )}
            </p>
            <span className="flex items-center gap-3">{busy && <Loading label="Updating" />}<Timing ms={result.elapsed_ms} /></span>
          </div>
          <ol className={cx("space-y-4", busy && "opacity-70")}>
            {result.results.map((b, i) => <ResultCard key={b.id} b={b} rank={i + 1} />)}
          </ol>
          <div className="mt-6"><Feedback key={result.search_id ?? "none"} onDark searchType="story" searchId={result.search_id} /></div>
        </>
      )}
    </div>
  );
}
