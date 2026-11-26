import { BookOpen, Gauge, History, House, Library, Menu, ScanSearch, TextSearch, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { cx } from "./ui";

const NAV = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/catalog", label: "Catalog", icon: Library },
  { to: "/title", label: "Title search", icon: ScanSearch },
  { to: "/authors", label: "Authors", icon: UserRound },
  { to: "/story", label: "Characters & story", icon: TextSearch },
  { to: "/history", label: "History", icon: History },
  { to: "/performance", label: "Performance", icon: Gauge },
];

function Brand() {
  return (
    <NavLink to="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy text-white">
        <BookOpen className="h-5 w-5" aria-hidden />
      </span>
      <span className="font-serif text-[15px] font-semibold leading-tight text-ink">
        The Library's<br />Half-Remembered Titles
      </span>
    </NavLink>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive ? "bg-navy-soft font-medium text-navy" : "text-muted hover:bg-stone-100 hover:text-ink",
            )
          }
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-white/70 px-4 py-6 lg:flex">
        <Brand />
        <div className="mt-8"><NavItems /></div>
        <p className="mt-auto px-3 text-xs leading-relaxed text-muted">
          Search engine in C · FastAPI · SQLite · React
        </p>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg p-2 text-ink hover:bg-stone-100"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-[61px] z-20 border-b border-line bg-white px-4 py-3 shadow-sm lg:hidden">
          <NavItems onNavigate={() => setOpen(false)} />
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 lg:py-12">
        <Outlet />
      </main>
    </div>
  );
}
