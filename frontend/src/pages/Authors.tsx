import { Search, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge, Button, Card, EmptyState, ErrorNote, PageHeader, SectionTitle, TextField, Timing, cx } from "../components/ui";
import { api } from "../lib/api";
import { useDebounced } from "../lib/hooks";
import type { AuthorHit, AuthorResult } from "../lib/types";

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
    if (!q.trim()) { setError("Enter an author's name."); setResult(null); return; }
    setBusy(true);
    try { setResult(await api.author(q)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || params.get("run") !== "1") return;
    ran.current = true;
    run();
    params.delete("run"); setParams(params, { replace: true });
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
      <PageHeader icon={<UserRound className="h-6 w-6" />} title="Search by author"
        subtitle="Type any part of a name (first name, surname or initials) in any case. Books with several authors appear under each of them." />
      <Card className="mb-6">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <TextField label="Author's name" value={name} placeholder="e.g. doyle, agatha, gaiman"
              onChange={(e) => { setName(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKey}
              role="combobox" aria-expanded={open && hits.length > 0} aria-controls="author-list" aria-autocomplete="list" maxLength={120} />
            {open && hits.length > 0 && (
              <ul id="author-list" role="listbox" className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-white shadow-md">
                {hits.map((h, i) => (
                  <li key={h.id} role="option" aria-selected={i === active}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}
                      className={cx("flex w-full items-center justify-between px-3 py-2 text-left text-sm", i === active ? "bg-navy-soft text-navy" : "hover:bg-stone-50")}>
                      <span>{h.name}</span>
                      <span className="text-xs text-muted">{h.book_count} book{h.book_count === 1 ? "" : "s"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button type="submit" loading={busy}><Search className="h-4 w-4" /> Search</Button>
        </form>
        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      </Card>

      {result && result.authors.length === 0 && (
        <EmptyState icon={<UserRound className="h-8 w-8" />} title={`No author matches "${result.query}"`}>Check the spelling, or type just the surname.</EmptyState>
      )}
      {result && result.authors.length > 0 && (
        <div className="space-y-5">
          {result.authors.map((a) => (
            <Card key={a.id}>
              <SectionTitle aside={<Timing ms={result.elapsed_ms} />}>
                <span className="font-serif text-lg">{a.name}</span>
                <span className="ml-2 text-sm font-normal text-muted">{a.books.length} book{a.books.length === 1 ? "" : "s"}</span>
              </SectionTitle>
              <ul className="divide-y divide-line">
                {a.books.map((b) => (
                  <li key={b.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-ink">{b.title} <span className="font-normal text-muted">({b.year})</span></p>
                      <p className="text-xs text-muted">{b.authors.length > 1 ? `with ${b.authors.filter((x) => x !== a.name).join(", ")}` : "sole author"}{b.note ? ` · ${b.note}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2"><Badge>{b.genre}</Badge><span className="font-mono text-xs text-muted">#{b.id}</span></div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <p className="text-xs text-muted">{result.algorithm}</p>
        </div>
      )}
    </div>
  );
}
