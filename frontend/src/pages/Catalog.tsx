import { ChevronLeft, ChevronRight, Library, ListFilter } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, Card, DatasetToggle, EmptyState, ErrorNote, PageHeader, TextField } from "../components/ui";
import { api } from "../lib/api";
import { fmt, useAsync, useDebounced } from "../lib/hooks";
import type { Dataset } from "../lib/types";

export default function CatalogPage() {
  const [dataset, setDataset] = useState<Dataset>("library");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [author, setAuthor] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const dq = useDebounced(q), da = useDebounced(author), dyf = useDebounced(yearFrom), dyt = useDebounced(yearTo);
  const pageSize = dataset === "dsa" ? 40 : 12;

  useEffect(() => setPage(1), [dataset, dq, genre, da, dyf, dyt]);
  const { data, error, loading } = useAsync(
    () => api.catalog({ dataset, page, page_size: pageSize, q: dq, genre, author: da, year_from: dyf, year_to: dyt }),
    [dataset, page, dq, genre, da, dyf, dyt],
  );

  const reset = () => { setQ(""); setGenre(""); setAuthor(""); setYearFrom(""); setYearTo(""); };

  return (
    <div>
      <PageHeader
        icon={<Library className="h-6 w-6" />}
        title="Library catalog"
        subtitle="Every record in insertion order with its record ID. Duplicate titles are kept as separate records, so the latest one is the one exact title search returns."
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <DatasetToggle value={dataset} onChange={(d) => { setDataset(d); reset(); }} />
        {data && <p className="text-sm text-muted">{fmt(data.total)} of {fmt(data.catalog_size)} records</p>}
      </div>

      <Card className="mb-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink"><ListFilter className="h-4 w-4 text-navy" /> Filter</div>
        <div className={dataset === "library" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-5" : "grid gap-3 sm:grid-cols-2"}>
          <TextField label="Title contains" value={q} onChange={(e) => setQ(e.target.value)} placeholder={dataset === "dsa" ? "e.g. ma" : "e.g. potter"} className="lg:col-span-2" />
          {dataset === "library" && (
            <>
              <div>
                <label htmlFor="genre" className="mb-1.5 block text-[13px] font-medium text-ink">Genre</label>
                <select id="genre" value={genre} onChange={(e) => setGenre(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[15px] focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15">
                  <option value="">All genres</option>
                  {data?.genres.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <TextField label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. austen" />
              <div className="grid grid-cols-2 gap-2">
                <TextField label="From year" inputMode="numeric" value={yearFrom} onChange={(e) => setYearFrom(e.target.value.replace(/\D/g, ""))} placeholder="1800" />
                <TextField label="To year" inputMode="numeric" value={yearTo} onChange={(e) => setYearTo(e.target.value.replace(/\D/g, ""))} placeholder="2000" />
              </div>
            </>
          )}
        </div>
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}
      {data && data.items.length === 0 && (
        <EmptyState icon={<Library className="h-8 w-8" />} title="No records match these filters">
          <button className="text-navy underline" onClick={reset}>Clear filters</button>
        </EmptyState>
      )}

      {data && data.items.length > 0 && dataset === "library" && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-stone-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Author(s)</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Genre</th>
                  <th className="px-4 py-3 text-right font-medium">Year</th>
                </tr>
              </thead>
              <tbody className={loading ? "opacity-60" : ""}>
                {data.items.map((b) => (
                  <tr key={b.id} className="border-b border-line/70 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-muted">#{b.id}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink">{b.title}</span>
                      {b.duplicate_count > 1 && <span className="ml-2"><Badge tone="amber">duplicate title ×{b.duplicate_count}</Badge></span>}
                      {b.note && <p className="mt-0.5 text-xs text-muted">{b.note}</p>}
                      <p className="mt-0.5 text-xs text-muted sm:hidden">{b.authors.join(", ")}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">{b.authors.join(", ")}</td>
                    <td className="hidden px-4 py-3 md:table-cell"><Badge>{b.genre}</Badge></td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{b.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data && data.items.length > 0 && dataset === "dsa" && (
        <Card>
          <p className="mb-4 text-sm text-muted">
            The original constrained catalog: lowercase single words, length ≤ 8, at most 1,000 names, fixed order. Generated deterministically; kept separate from the book catalog.
          </p>
          <ul className={"grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5 " + (loading ? "opacity-60" : "")}>
            {data.items.map((n) => (
              <li key={n.id} className="flex items-center justify-between rounded-md border border-line px-2.5 py-1.5">
                <span className="font-mono text-sm text-ink">{n.title}</span>
                <span className="flex items-center gap-1">
                  {n.duplicate_count > 1 && <span title={`appears ${n.duplicate_count} times`} className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                  <span className="font-mono text-[11px] text-muted">#{n.id}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> name appears more than once</p>
        </Card>
      )}

      {data && data.pages > 1 && (
        <nav aria-label="Pagination" className="mt-5 flex items-center justify-between">
          <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={data.page <= 1}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted">Page {data.page} of {data.pages}</span>
          <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={data.page >= data.pages}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
