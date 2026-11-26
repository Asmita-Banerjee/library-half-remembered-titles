import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { cx } from "./ui";

const NAV = [
  { to: "/plot", label: "Describe the story" },
  { to: "/title", label: "Title clues" },
  { to: "/authors", label: "Authors" },
  { to: "/catalogue", label: "Catalogue" },
  { to: "/history", label: "Your requests" },
];

function Brand() {
  return (
    <Link to="/" className="group flex items-center gap-3" aria-label="Half-Remembered Titles, home">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden className="shrink-0">
        <rect x="1" y="5" width="32" height="24" rx="2" fill="#b8954a" />
        <rect x="4" y="8" width="26" height="9" rx="1" fill="#f7f0dc" />
        <circle cx="17" cy="23" r="3" fill="#172c25" />
        <path d="M7 11.5h20M7 14h14" stroke="#5e5444" strokeWidth="1" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[16px] text-chalk group-hover:text-white">Half-Remembered Titles</span>
        <span className="block text-[11.5px] italic text-sage">a library for the books you almost remember</span>
      </span>
    </Link>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); setOpen(false); }, [loc.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-manila focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <header className="border-b border-room-line bg-room-deep">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6">
          <Brand />
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to}
                className={({ isActive }) => cx(
                  "rounded-[3px] px-2.5 py-1.5 text-[14px] transition-colors",
                  isActive ? "bg-manila text-ink" : "text-sage hover:text-chalk",
                )}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button className="rounded-[3px] p-2 text-chalk hover:bg-room-line lg:hidden" aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <nav aria-label="Main" className="border-t border-room-line px-4 pb-3 lg:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to}
                className={({ isActive }) => cx("block border-b border-room-line py-2.5 text-[15px]", isActive ? "text-chalk" : "text-sage")}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Outlet />
      </main>

      <footer className="border-t border-room-line bg-room-deep text-[13px] text-sage">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="text-chalk">Half-Remembered Titles</p>
            <p className="mt-1">Forgot the book? Remember the clues. We'll find the story.</p>
          </div>
          <div>
            <p className="text-chalk">Where the books come from</p>
            <p className="mt-1">
              60 hand-checked records plus 10,000 books from{" "}
              <a className="underline underline-offset-2 hover:text-chalk" href="https://github.com/zygmuntz/goodbooks-10k" target="_blank" rel="noreferrer">goodbooks-10k</a>{" "}
              (CC BY-SA 4.0). Covers from <a className="underline underline-offset-2 hover:text-chalk" href="https://openlibrary.org/dev/docs/api/covers" target="_blank" rel="noreferrer">Open Library</a>.
              Synonyms from WordNet 3.0, Princeton University.
            </p>
          </div>
          <div>
            <p className="text-chalk">How it's built</p>
            <p className="mt-1">
              Title search runs on a Trie engine written in C, behind a FastAPI and SQLite server.{" "}
              <a className="underline underline-offset-2 hover:text-chalk" href="https://github.com/Asmita-Banerjee/library-half-remembered-titles" target="_blank" rel="noreferrer">Source on GitHub</a>.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
