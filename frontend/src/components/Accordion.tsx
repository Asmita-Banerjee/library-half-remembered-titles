import { Plus } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "./ui";

export default function Accordion({ items }: { items: { q: string; a: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <div className="divide-y divide-ink/15 border-y border-ink/15">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q}>
            <h3>
              <button type="button" id={`${base}-b${i}`} aria-expanded={isOpen} aria-controls={`${base}-p${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-3.5 text-left text-[15.5px] text-ink hover:text-stamp">
                {it.q}
                <Plus className={cx("h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-45")} aria-hidden />
              </button>
            </h3>
            <div id={`${base}-p${i}`} role="region" aria-labelledby={`${base}-b${i}`} hidden={!isOpen}
              className="pb-4 pr-8 text-[14.5px] leading-relaxed text-ink-soft">
              {it.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
