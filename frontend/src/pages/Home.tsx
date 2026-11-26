import { ArrowRight, Gauge, History, Library, ScanSearch, TextSearch, UserRound, WandSparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, ErrorNote, Stat } from "../components/ui";
import { api } from "../lib/api";
import { fmt, useAsync } from "../lib/hooks";

const METHODS = [
  { to: "/title", icon: ScanSearch, title: "Beginning + ending", text: "Remember how the title starts and ends? The Trie returns the latest matching record." },
  { to: "/title?mode=multi", icon: WandSparkles, title: "Multi-clue search", text: "Combine a beginning, an ending and any number of fragments from the middle." },
  { to: "/authors", icon: UserRound, title: "By author", text: "Type part of a name and browse everything they wrote, co-authored books included." },
  { to: "/story", icon: TextSearch, title: "By character or story", text: "Describe a character, plot, setting or theme in plain words." },
];

export default function HomePage() {
  const { data, error } = useAsync(() => api.overview(), []);
  return (
    <div>
      <section className="mb-10">
        <p className="text-sm font-medium text-navy">A digital library for fuzzy memories</p>
        <h1 className="mt-2 max-w-2xl font-serif text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          Forgot the book? Remember the clues. We'll find the story.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          Search by the fragments you remember: the first letters of a title, how it ends, an author's name, or a
          character you can still picture. Title clues are answered by a prefix–suffix Trie written in C and built
          once when the catalog loads.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/title" className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark">
            Start with a title clue <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link to="/catalog" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:text-navy">
            Browse the catalog
          </Link>
        </div>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}
      <section aria-label="Catalog statistics" className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Catalog records" value={data ? fmt(data.catalog_records) : "–"} sub={data ? `${data.authors} authors · ${data.genres} genres` : " "} />
        <Stat label="Indexed records" value={data ? fmt(data.indexed_records) : "–"} sub={data ? `incl. ${fmt(data.dsa_records)} DSA test names` : " "} />
        <Stat label="Total searches" value={data ? fmt(data.total_searches) : "–"} sub="recorded by the server" />
        <Stat
          label="Success rate"
          value={data ? (data.total_searches ? `${Math.round((100 * data.successful_searches) / data.total_searches)}%` : "–") : "–"}
          sub={data ? `${fmt(data.successful_searches)} found · ${fmt(data.failed_searches)} no match` : " "}
        />
      </section>

      <h2 className="mb-4 text-[15px] font-semibold text-ink">Search methods</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {METHODS.map(({ to, icon: Icon, title, text }) => (
          <Link key={to} to={to} className="group">
            <Card className="h-full transition-colors group-hover:border-navy/40">
              <Icon className="h-5 w-5 text-navy" aria-hidden />
              <h3 className="mt-3 font-medium text-ink">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link to="/catalog" className="inline-flex items-center gap-1.5 text-muted hover:text-navy"><Library className="h-4 w-4" /> Catalog</Link>
        <Link to="/history" className="inline-flex items-center gap-1.5 text-muted hover:text-navy"><History className="h-4 w-4" /> Recent searches</Link>
        <Link to="/performance" className="inline-flex items-center gap-1.5 text-muted hover:text-navy"><Gauge className="h-4 w-4" /> Performance &amp; tests</Link>
      </div>
    </div>
  );
}
