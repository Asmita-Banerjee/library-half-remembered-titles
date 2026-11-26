import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Cover from "../components/Cover";
import { ErrorNote, IndexCard, Tag } from "../components/ui";
import { api } from "../lib/api";
import { fmt, useAsync } from "../lib/hooks";

export default function BookPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const bookId = Number(id);
  const valid = Number.isInteger(bookId) && bookId >= 0;
  const { data: b, error, loading, reload } = useAsync(() => (valid ? api.book(bookId) : Promise.reject(new Error("That record number isn't valid."))), [bookId]);

  return (
    <div>
      <button type="button" onClick={() => (window.history.length > 1 ? nav(-1) : nav("/catalogue"))}
        className="mb-6 inline-flex items-center gap-1.5 text-[14px] text-sage hover:text-chalk">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>
      {loading && !b && <p className="text-sage">Fetching the card…</p>}
      {error && <ErrorNote onRetry={valid ? reload : undefined}>{error === "Book not found" ? "There's no record with that number." : error}</ErrorNote>}
      {b && (
        <div className="grid gap-8 md:grid-cols-[200px_1fr]">
          <div className="flex flex-col items-center gap-3 md:items-start">
            <Cover isbn={b.cover_isbn} title={b.title} author={b.authors[0]} size="lg" />
          </div>
          <div className="min-w-0 space-y-5">
            <IndexCard ruled punched>
              <div className="flex min-h-[2.1rem] items-end justify-between gap-3">
                <span className="typewriter text-[13px] text-ink-soft">Record no. {b.id}</span>
                <span className="typewriter text-[13px] text-ink-soft">{b.source === "curated" ? "Detailed record" : "Extended catalogue"}</span>
              </div>
              <h1 className="mt-3 text-[1.75rem] leading-tight text-ink">{b.title}</h1>
              <p className="text-[15px] leading-[1.6rem] text-ink">
                {b.authors.map((a, i) => (
                  <span key={a}>{i > 0 && " and "}<Link to={`/authors?${new URLSearchParams({ name: a, run: "1" })}`} className="text-stamp hover:underline">{a}</Link></span>
                ))}
                {b.year !== null && <span className="text-ink-soft">, first published {b.year < 0 ? `${-b.year} BC` : b.year}</span>}
              </p>
              {b.original_title && <p className="text-[14px] leading-[1.6rem] text-ink-soft">Original title: {b.original_title}</p>}
              {b.series && <p className="text-[14px] leading-[1.6rem] text-ink-soft">Series: <span className="italic">{b.series}</span></p>}
              <div className="flex flex-wrap gap-1.5 py-[3px]">
                <Tag tone="stamp">{b.genre}</Tag>
                <Tag>{b.audience === "Children" ? "For children" : b.audience === "Young Adult" ? "For young adults" : "General readers"}</Tag>
                {b.average_rating && <Tag title="Average Goodreads rating">★ {b.average_rating.toFixed(2)} from {fmt(b.ratings_count ?? 0)} ratings</Tag>}
              </div>
              {b.note && <p className="text-[14px] leading-[1.6rem] text-ink">{b.note}</p>}
              {b.plot && <p className="mt-2 text-[15px] leading-[1.6rem] text-ink">{b.plot}</p>}
            </IndexCard>

            {b.characters.length > 0 && (
              <IndexCard>
                <h2 className="text-[17px] font-bold text-ink">Characters</h2>
                <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {b.characters.map((c) => (
                    <div key={c.name}><dt className="text-[14.5px] text-ink">{c.name}</dt><dd className="text-[13.5px] text-ink-soft">{c.description}</dd></div>
                  ))}
                </dl>
              </IndexCard>
            )}

            {(b.themes.length > 0 || b.settings.length > 0 || b.tags.length > 0) && (
              <IndexCard>
                {b.settings.length > 0 && <p className="text-[14px] text-ink"><span className="text-ink-soft">Set in </span>{b.settings.join(", ")}</p>}
                {b.themes.length > 0 && <p className="mt-1 text-[14px] text-ink"><span className="text-ink-soft">About </span>{b.themes.join(", ")}</p>}
                {b.tags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[13px] text-ink-soft">How readers shelve it on Goodreads</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">{b.tags.map((t) => <Tag key={t}>{t.replace(/-s(-|$)/g, "'s$1").replace(/-/g, " ")}</Tag>)}</div>
                  </div>
                )}
              </IndexCard>
            )}

            <IndexCard>
              <h2 className="text-[17px] font-bold text-ink">Find a copy</h2>
              <ul className="mt-2 space-y-1.5">
                {b.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[14.5px] text-stamp hover:underline">
                      {l.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
              {b.linked.length > 0 && (
                <p className="mt-3 text-[13.5px] text-ink-soft">
                  Also catalogued as {b.linked.map((x, i) => <span key={x.id}>{i > 0 && ", "}<Link className="text-stamp underline" to={`/book/${x.id}`}>record {x.id}</Link></span>)}.
                </p>
              )}
            </IndexCard>
          </div>
        </div>
      )}
    </div>
  );
}
