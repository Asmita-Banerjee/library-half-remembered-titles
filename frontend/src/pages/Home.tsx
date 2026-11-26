import { useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Accordion from "../components/Accordion";
import Cover from "../components/Cover";
import { Button, IndexCard, cx } from "../components/ui";
import { api } from "../lib/api";
import { fmt, useAsync, useDebounced } from "../lib/hooks";
import type { HistoryItem } from "../lib/types";
import { historyText, repeatUrl } from "./History";

type Mode = "plot" | "title" | "author";

const EXAMPLES: { mode: Mode; text: string; prefix?: string; suffix?: string }[] = [
  { mode: "plot", text: "A detective who wears a hat and solves mysteries" },
  { mode: "title", text: "Starts with \"the hob\", ends with \"bit\"", prefix: "the hob", suffix: "bit" },
  { mode: "plot", text: "Kids find a magical land through a wardrobe" },
  { mode: "author", text: "Something by Agatha Christie" },
  { mode: "plot", text: "A sea captain hunting a white whale" },
  { mode: "title", text: "Starts with \"harry\", ends with \"azkaban\"", prefix: "harry", suffix: "azkaban" },
];

function RequestSlip({ requestNo }: { requestNo: number | null }) {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("plot");
  const [plot, setPlot] = useState("");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [author, setAuthor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }), []);

  const live = useDebounced(JSON.stringify([prefix, suffix]), 220);
  const [liveCount, setLiveCount] = useState<{ total: number; first?: string } | null>(null);
  useEffect(() => {
    const [p, s] = JSON.parse(live) as [string, string];
    if (mode !== "title" || (!p.trim() && !s.trim())) { setLiveCount(null); return; }
    const ctrl = new AbortController();
    api.live("library", p, [], s, ctrl.signal)
      .then((r) => setLiveCount({ total: r.total, first: r.suggestions[0]?.title }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [live, mode]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (mode === "plot") {
      if (!plot.trim()) return setError("Write down anything you remember: a character, a scene, where it was set.");
      nav(`/plot?${new URLSearchParams({ q: plot.trim(), run: "1" })}`);
    } else if (mode === "title") {
      if (!prefix.trim() && !suffix.trim()) return setError("Fill in how the title begins, how it ends, or both.");
      const p = new URLSearchParams({ run: "1" });
      if (prefix.trim() && suffix.trim()) { p.set("mode", "basic"); p.set("prefix", prefix); p.set("suffix", suffix); }
      else { p.set("mode", "multi"); if (prefix.trim()) p.set("prefix", prefix); if (suffix.trim()) p.set("suffix", suffix); }
      nav(`/title?${p}`);
    } else {
      if (!author.trim()) return setError("Type all or part of the author's name.");
      nav(`/authors?${new URLSearchParams({ name: author.trim(), run: "1" })}`);
    }
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); };

  return (
    <form onSubmit={submit} onKeyDown={onKey} className="index-card relative px-5 pb-12 pt-4 sm:px-7" aria-label="Book request slip">
      <div className="flex min-h-[2.1rem] items-end justify-between gap-2 typewriter text-[13px] text-ink-soft">
        <span>Book request no. {requestNo ?? "…"}</span>
        <span>{today}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-1" role="tablist" aria-label="What do you remember?">
        {([["plot", "What happens in it"], ["title", "Part of the title"], ["author", "Who wrote it"]] as [Mode, string][]).map(([m, l]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }}
            className={cx("rounded-t-[3px] border-b-2 px-3 py-1.5 text-[14px]",
              mode === m ? "border-stamp bg-manila-light text-ink" : "border-transparent text-ink-soft hover:text-stamp")}>
            {l}
          </button>
        ))}
      </div>
      <div className="rounded-b-[3px] rounded-tr-[3px] bg-manila-light/70 p-3">
        {mode === "plot" && (
          <>
            <label htmlFor="slip-plot" className="sr-only">Describe what you remember</label>
            <textarea id="slip-plot" rows={4} maxLength={500} value={plot} onChange={(e) => setPlot(e.target.value)}
              placeholder="An orphan boy finds out he's a wizard and goes away to a school with moving staircases…"
              className="typewriter w-full resize-none bg-transparent text-[15px] leading-[1.6rem] text-ink placeholder:text-ink-soft/55 focus:outline-none" />
          </>
        )}
        {mode === "title" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="slip-pre" className="mb-1 block text-[13px] text-ink-soft">It begins with</label>
              <input id="slip-pre" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="the hob" autoComplete="off" spellCheck={false}
                className="typewriter w-full border-b border-ink/30 bg-transparent py-1.5 text-[15px] focus:border-stamp focus:outline-none" />
            </div>
            <div>
              <label htmlFor="slip-suf" className="mb-1 block text-[13px] text-ink-soft">It ends with</label>
              <input id="slip-suf" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="bit" autoComplete="off" spellCheck={false}
                className="typewriter w-full border-b border-ink/30 bg-transparent py-1.5 text-[15px] focus:border-stamp focus:outline-none" />
            </div>
            <p className="text-[13px] text-ink-soft sm:col-span-2" aria-live="polite">
              {liveCount === null ? "Fill in either box, or both. Capitals and punctuation don't matter."
                : liveCount.total === 0 ? "No title fits yet. You'll get suggestions after you submit."
                  : `${fmt(liveCount.total)} title${liveCount.total === 1 ? "" : "s"} fit so far${liveCount.first ? `, including ${liveCount.first}` : ""}.`}
            </p>
          </div>
        )}
        {mode === "author" && (
          <div>
            <label htmlFor="slip-author" className="mb-1 block text-[13px] text-ink-soft">Author's name, or part of it</label>
            <input id="slip-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="christie" autoComplete="off" spellCheck={false}
              className="typewriter w-full border-b border-ink/30 bg-transparent py-1.5 text-[15px] focus:border-stamp focus:outline-none" />
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-[13.5px] text-rule-red" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12.5px] text-ink-soft">Ctrl + Enter also sends it</span>
        <Button type="submit">Send request</Button>
      </div>
      <span className="punch" aria-hidden />
    </form>
  );
}

function Plate({ value, label }: { value: string; label: string }) {
  return (
    <div className="label-plate">
      <div className="px-3 py-2 text-center">
        <p className="typewriter text-[19px] font-bold text-ink">{value}</p>
        <p className="text-[12.5px] text-ink-soft">{label}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const nav = useNavigate();
  const overview = useAsync(() => api.overview(), []);
  const history = useAsync(() => api.history(), []);
  const stacks = useAsync(() => api.random(4), []);
  const o = overview.data;

  function runExample(ex: (typeof EXAMPLES)[number]) {
    if (ex.mode === "plot") nav(`/plot?${new URLSearchParams({ q: ex.text, run: "1" })}`);
    else if (ex.mode === "author") nav(`/authors?${new URLSearchParams({ name: "agatha christie", run: "1" })}`);
    else nav(`/title?${new URLSearchParams({ mode: "basic", prefix: ex.prefix!, suffix: ex.suffix!, run: "1" })}`);
  }

  return (
    <div>
      <section className="grid items-start gap-10 lg:grid-cols-[1fr_minmax(0,500px)]">
        <div className="pt-2">
          <h1 className="text-[2.6rem] leading-[1.12] text-chalk sm:text-[3.3rem]">
            Forgot the book? Remember the clues. We'll find the story.
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-[1.75] text-sage">
            Fill in a request slip with whatever stuck with you: the first word of the title, the last one, a character,
            a scene, the author's surname. We search 10,060 books and show you exactly which of your clues each one matched.
          </p>
          <div className="mt-8">
            <p className="mb-2 text-[13.5px] text-sage">Requests other readers make</p>
            <ul className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <li key={ex.text}>
                  <button type="button" onClick={() => runExample(ex)}
                    className="rounded-[3px] border border-chalk/25 px-2.5 py-1 text-left text-[13.5px] text-chalk/90 hover:border-chalk hover:bg-chalk/10">
                    {ex.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <RequestSlip requestNo={o ? o.total_searches + 1 : null} />
      </section>

      <section aria-label="The collection" className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Plate value={o ? fmt(o.catalog_records) : "…"} label="books on the shelves" />
        <Plate value={o ? fmt(o.authors) : "…"} label="authors" />
        <Plate value={o ? fmt(o.total_searches) : "…"} label="requests answered" />
        <Plate value={o ? (o.confirmed_total ? `${Math.round((100 * o.confirmed_found) / o.confirmed_total)}%` : "none yet") : "…"}
          label={o?.confirmed_total ? `found, said ${fmt(o.confirmed_total)} readers` : "confirmed finds"} />
      </section>

      <section className="mt-16">
        <h2 className="text-[1.6rem] text-chalk">How a request is answered</h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            ["You fill in the slip", "Any mix of clues works: the beginning or end of the title, a fragment from the middle, a name, or a few sentences about the story."],
            ["We search the drawers", "Title clues go to a Trie index that answers in microseconds without reading every title. Story clues are ranked by how well they match characters, plot, setting and readers' shelves."],
            ["You check the card", "Each result shows why it matched. If nothing fits, we suggest nearby clues that do exist, and never swap them in without asking."],
          ].map(([t, d], i) => (
            <li key={t} className="border-t-2 border-brass pt-3">
              <p className="typewriter text-[13px] text-brass">Step {i + 1}</p>
              <h3 className="mt-1 text-[17px] text-chalk">{t}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-sage">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <h2 className="text-[1.6rem] text-chalk">Recently requested</h2>
          <div className="mt-5 space-y-2.5">
            {history.data && history.data.items.length === 0 && (
              <p className="text-sage">No requests yet. Yours will be the first.</p>
            )}
            {history.data?.items.map((h: HistoryItem) => (
              <Link key={h.id} to={repeatUrl(h)} className="group flex items-start justify-between gap-3 rounded-[3px] bg-manila px-4 py-3 hover:bg-manila-light">
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] text-ink group-hover:text-stamp">{historyText(h)}</span>
                  <span className="block truncate text-[12.5px] text-ink-soft">{h.result_summary}</span>
                </span>
                <span className={cx("stamp shrink-0 text-[11px]", h.status !== "success" && "red")}>
                  {h.status === "success" ? "Filed" : "No match"}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[1.6rem] text-chalk">Pulled from the stacks</h2>
            <button type="button" onClick={stacks.reload} className="text-[13.5px] text-sage underline underline-offset-4 hover:text-chalk">Pull four more</button>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {stacks.data?.books.map((b) => (
              <li key={b.id}>
                <Link to={`/book/${b.id}`} className="flex h-full gap-3 rounded-[3px] bg-manila p-3 hover:bg-manila-light">
                  <Cover isbn={b.cover_isbn} title={b.title} author={b.authors[0]} size="sm" />
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[14.5px] leading-snug text-ink">{b.title}</span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-ink-soft">{b.authors.join(", ")}{b.year !== null ? `, ${b.year}` : ""}</span>
                    <span className="mt-1 block text-[12px] text-stamp">{b.genre}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-16">
        <IndexCard>
          <h2 className="mb-2 text-[1.4rem] text-ink">Questions readers ask</h2>
          <Accordion items={[
            { q: "I only remember one word of the title. Will that work?", a: <>Yes. Use <Link className="text-stamp underline" to="/title?mode=multi">Title clues</Link> and add it as a "contains" clue. Add the beginning or ending too if you remember them; every clue must fit the same title.</> },
            { q: "Why did I get a different book than the one I meant?", a: "When several books fit the same beginning and ending, the exact search returns the most recently added record and tells you how many others match. Switch to \"any clues\" to see them all." },
            { q: "What happens when nothing matches?", a: "You get a short list of clues that do exist in the catalogue, such as the same beginning with a real ending, or a near spelling, each with the reason it was suggested. Your original search is left as you typed it." },
            { q: "How does the story search understand what I describe?", a: "It matches your words against characters, plots, settings, themes and the shelves readers put books on. It also tries close spellings and common synonyms, and labels them as such. It doesn't use a paid AI service, so a description that shares no words with the book's details can still miss." },
            { q: "Where do the books come from?", a: "60 records were written by hand with plots and characters. The other 10,000 are the most-rated books on Goodreads, from the open goodbooks-10k dataset, with genres and readership taken from how readers shelved them." },
          ]} />
        </IndexCard>
      </section>
    </div>
  );
}
