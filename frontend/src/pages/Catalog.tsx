import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FacetPanel, { EMPTY_FACETS, facetsActive } from "../components/FacetPanel";
import { Button, Empty, ErrorNote, IndexCard, PageHeader, Segmented, Tag, TextField } from "../components/ui";
import { api } from "../lib/api";
import { fmt, useAsync, useDebounced } from "../lib/hooks";
import type { Dataset, FacetValues } from "../lib/types";

export default function CatalogPage() {
  const [dataset, setDataset] = useState<Dataset>("library");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [author, setAuthor] = useState("");
  const [facets, setFacets] = useState<FacetValues>(EMPTY_FACETS);
  const dq = useDebounced(q, 250);
  const da = useDebounced(author, 250);
  const df = useDebounced(JSON.stringify(facets), 300);
  const pageSize = dataset === "dsa" ? 60 : 25;

  useEffect(() => setPage(1), [dataset, dq, da, df]);
  const { data, error, loading, reload } = useAsync(() => {
    const f = JSON.parse(df) as FacetValues;
    return api.catalog({
      dataset, page, page_size: pageSize, q: dq, author: da, genre: f.genre, audience: f.audience, source: f.source,
      year_from: f.year_from, year_to: f.year_to,
    });
  }, [dataset, page, dq, da, df]);

  const reset = () => { setQ(""); setAuthor(""); setFacets(EMPTY_FACETS); };
  const filtered = Boolean(q || author || facetsActive(facets));

  return (
    <div>
      <PageHeader title="The catalogue">
        Every record in the order it was added, with its record number. When two records share a title, both are kept;
        the newer one is what the beginning-and-ending search returns.
      </PageHeader>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented onDark label="Catalogue" value={dataset} onChange={(d) => { setDataset(d); reset(); }}
          options={[{ value: "library", label: "Library" }, { value: "dsa", label: "DSA test names" }]} />
        {data && <p className="text-[14px] text-sage">{filtered ? `${fmt(data.total)} of ` : ""}{fmt(data.catalog_size)} records</p>}
      </div>

      <IndexCard className="mb-6">
        <div className={dataset === "library" ? "grid gap-3 sm:grid-cols-2" : ""}>
          <TextField label="Title contains" value={q} onChange={(e) => setQ(e.target.value)} placeholder={dataset === "dsa" ? "ma" : "potter"} maxLength={120} />
          {dataset === "library" && <TextField label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="austen" maxLength={120} />}
        </div>
        {dataset === "library" && <div className="mt-3"><FacetPanel idPrefix="cat" value={facets} onChange={setFacets} /></div>}
        {filtered && <button type="button" className="mt-3 text-[13.5px] text-ink-soft underline underline-offset-4 hover:text-ink" onClick={reset}>Clear all filters</button>}
      </IndexCard>

      {error && <ErrorNote onRetry={reload}>{error}</ErrorNote>}
      {!data && loading && <p className="text-sage">Opening the drawers…</p>}
      {data && data.items.length === 0 && <Empty title="No records match these filters"><button className="text-stamp underline" onClick={reset}>Clear the filters</button></Empty>}

      {data && data.items.length > 0 && dataset === "library" && (
        <div className={loading ? "opacity-70" : ""}>
          <div className="overflow-x-auto rounded-[4px] bg-manila shadow-[0_10px_24px_-14px_rgba(0,0,0,.55)]">
            <table className="w-full text-left text-[14px]">
              <caption className="sr-only">Catalogue records, page {data.page} of {data.pages}</caption>
              <thead className="border-b-2 border-rule-red text-[13px] text-ink-soft">
                <tr>
                  <th scope="col" className="px-4 py-3 font-normal">No.</th>
                  <th scope="col" className="px-4 py-3 font-normal">Title</th>
                  <th scope="col" className="hidden px-4 py-3 font-normal md:table-cell">Author</th>
                  <th scope="col" className="hidden px-4 py-3 font-normal lg:table-cell">Genre</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Year</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b.id} className="border-b border-[rgba(110,140,165,0.28)] last:border-0 hover:bg-manila-light">
                    <td className="typewriter px-4 py-2.5 text-[12.5px] text-ink-soft">{b.id}</td>
                    <td className="px-4 py-2.5">
                      <Link to={`/book/${b.id}`} className="text-ink hover:text-stamp hover:underline">{b.title}</Link>
                      {b.duplicate_count > 1 && <span className="ml-2"><Tag tone="red" title="Another record has the same title">same title ×{b.duplicate_count}</Tag></span>}
                      {b.source === "curated" && <span className="ml-2"><Tag tone="stamp" title="Hand-written record with plot and characters">detailed</Tag></span>}
                      {b.note && <p className="text-[12.5px] text-ink-soft">{b.note}</p>}
                      <p className="text-[12.5px] text-ink-soft md:hidden">{b.authors.join(", ")}</p>
                    </td>
                    <td className="hidden px-4 py-2.5 text-ink-soft md:table-cell">{b.authors.join(", ")}</td>
                    <td className="hidden px-4 py-2.5 text-ink-soft lg:table-cell">{b.genre}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-soft">{b.year ?? "?"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.items.length > 0 && dataset === "dsa" && (
        <IndexCard className={loading ? "opacity-70" : ""}>
          <p className="mb-4 text-[14px] text-ink-soft">
            The original problem's catalogue: 1,000 single lowercase words of at most 8 letters, in fixed order. It's generated the same way on every start, and kept apart from the books.
          </p>
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
            {data.items.map((n) => (
              <li key={n.id} className="flex items-center justify-between rounded-[3px] bg-manila-light px-2 py-1">
                <span className="typewriter text-[14px] text-ink">{n.title}</span>
                <span className="typewriter text-[11px] text-ink-soft" title={n.duplicate_count > 1 ? `appears ${n.duplicate_count} times` : undefined}>
                  {n.duplicate_count > 1 && <span className="text-rule-red">×{n.duplicate_count} </span>}{n.id}
                </span>
              </li>
            ))}
          </ul>
        </IndexCard>
      )}

      {data && data.pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between">
          <Button variant="chalk" onClick={() => setPage((p) => p - 1)} disabled={data.page <= 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
          <span className="text-[14px] text-sage">Page {data.page} of {fmt(data.pages)}</span>
          <Button variant="chalk" onClick={() => setPage((p) => p + 1)} disabled={data.page >= data.pages}>Next <ChevronRight className="h-4 w-4" /></Button>
        </nav>
      )}
    </div>
  );
}
