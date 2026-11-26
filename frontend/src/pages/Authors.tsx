import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Cover from "../components/Cover";
import Feedback from "../components/Feedback";
import { Button, Empty, ErrorNote, IndexCard, PageHeader, RecordNo, Tag, TextField, Timing, cx } from "../components/ui";
import { api } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import type { AuthorHit, AuthorResult } from "../lib/types";

const SHOW = 12;

function AuthorCard({ a, elapsed }: { a: AuthorResult["authors"][number]; elapsed: number }) {
  const [all, setAll] = useState(false);
  const books = all ? a.books : a.books.slice(0, SHOW);
  return (
    <IndexCard ruled as="article">
      <div className="flex min-h-[2.1rem] flex-wrap items-end justify-between gap-3">
        <h2 className="text-[19px] text-ink">{a.name}</h2>
        <span className="flex items-center gap-3 text-[13px] text-ink-soft">{a.books.length} book{a.books.length === 1 ? "" : "s"} <Timing ms={elapsed} /></span>
      </div>
      <ul className="mt-3 grid gap-x-6 sm:grid-cols-2">
        {books.map((b) => (
          <li key={b.id} className="flex gap-3 border-b border-ink/10 py-2.5">
            <Cover isbn={b.cover_isbn} title={b.title} author={b.authors[0]} size="sm" />
            <div className="min-w-0">
              <Link to={`/book/${b.id}`} className="text-[15px] leading-snug text-ink hover:text-stamp hover:underline">{b.title}</Link>
              <p className="text-[12.5px] text-ink-soft">
                {b.year !== null ? b.year : "Year unknown"}
                {b.authors.length > 1 && `, with ${b.authors.filter((x) => x !== a.name).join(" and ")}`}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5"><Tag tone="stamp">{b.genre}</Tag>{b.note && <Tag>{b.note.split(".")[0]}</Tag>}<RecordNo id={b.id} /></div>
            </div>
          </li>
        ))}
      </ul>
      {a.books.length > SHOW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-[14px] text-stamp underline underline-offset-2">
          {all ? "Show fewer" : `Show all ${a.books.length}`}
        </button>
      )}
    </IndexCard>
  );
}

export default function AuthorsPage() {
  const [params, setParams] = useSearchParams();
  const [name, setName] = useState(params.get("name") ?? "");
  const [hits, setHits] = useState<AuthorHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<AuthorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dname = useDebounced(name, 150);
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    if (!dname.trim()) { setHits([]); return; }
    const ctrl = new AbortController();
    api.authorAutocomplete(dname, ctrl.signal).then((r) => { setHits(r.authors); setActive(-1); }).catch(() => {});
    return () => ctrl.abort();
  }, [dname]);

  async function run(q = name) {
    setOpen(false);
    setError(null);
    if (!q.trim()) { setError("Type all or part of the author's name."); setResult(null); return; }
    setBusy(true);
    try { setResult(await api.author(q)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || params.get("run") !== "1") return;
    ran.current = true;
    run();
    params.delete("run");
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (h: AuthorHit) => { skipNext.current = true; setName(h.name); setHits([]); run(h.name); };
  const onKey = (e: KeyboardEvent) => {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + hits.length) % hits.length); }
    if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(hits[active]); }
    if (e.key === "Escape") setOpen(false);
  };
  const submit = (e: FormEvent) => { e.preventDefault(); run(); };

  return (
    <div>
      <PageHeader title="Authors">
        Type any part of a name: a first name, a surname or initials, in any case. Books with several authors are listed under each of them.
      </PageHeader>
      <IndexCard ruled punched className="mb-8">
        <form onSubmit={submit}>
          <div className="flex min-h-[2.1rem] items-end"><p className="text-[15px] text-ink">Who wrote it?</p></div>
          <div className="mt-[3px] flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="relative flex-1">
              <TextField label="Author's name" hideLabel value={name} placeholder="doyle, agatha, gaiman"
                onChange={(e) => { setName(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKey}
                role="combobox" aria-expanded={open && hits.length > 0} aria-controls="author-list" aria-autocomplete="list"
                aria-activedescendant={active >= 0 ? `author-opt-${active}` : undefined} maxLength={120} />
              {open && hits.length > 0 && (
                <ul id="author-list" role="listbox" className="absolute z-10 mt-1 w-full overflow-hidden rounded-[3px] border border-ink/20 bg-manila-light shadow-lg">
                  {hits.map((h, i) => (
                    <li key={h.id} id={`author-opt-${i}`} role="option" aria-selected={i === active}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}
                        className={cx("flex w-full items-center justify-between px-3 py-2 text-left text-[14.5px]", i === active ? "bg-stamp text-manila-light" : "hover:bg-manila-dark/60")}>
                        <span>{h.name}</span>
                        <span className={cx("text-[12.5px]", i === active ? "text-manila-light/80" : "text-ink-soft")}>{h.book_count} book{h.book_count === 1 ? "" : "s"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button type="submit" loading={busy}>Find their books</Button>
          </div>
        </form>
        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      </IndexCard>

      {result && result.authors.length === 0 && (
        <Empty title={`No author matches "${result.query}"`}>Check the spelling, or type only the surname.</Empty>
      )}
      {result && result.authors.length > 0 && (
        <div className="space-y-5">
          {result.authors.length > 1 && <p className="text-[14px] text-sage">{result.authors.length} authors match "{result.query}". Pick a fuller name to narrow it.</p>}
          {result.authors.map((a) => <AuthorCard key={a.id} a={a} elapsed={result.elapsed_ms} />)}
          <Feedback key={result.search_id ?? 0} onDark searchType="author" searchId={result.search_id} />
        </div>
      )}
    </div>
  );
}
