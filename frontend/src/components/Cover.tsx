import { useState } from "react";
import { cx } from "./ui";

const SPINES = ["#5a3d8a", "#2f6b4f", "#7a2e2b", "#2b4a6b", "#7b5a1e", "#3d3d5c", "#5c3a2e", "#245a5a"];

function spineColour(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return SPINES[h % SPINES.length];
}

/**
 * Book cover from Open Library's cover service (looked up by ISBN). When there
 * is no ISBN or no cover, a cloth-bound placeholder with the title is drawn.
 */
export default function Cover({ isbn, title, author, size = "md", className }: {
  isbn?: string | null; title: string; author?: string; size?: "sm" | "md" | "lg"; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dims = size === "sm" ? "h-[84px] w-[56px]" : size === "lg" ? "h-[270px] w-[180px]" : "h-[126px] w-[84px]";
  if (isbn && !failed) {
    return (
      <img
        src={`https://covers.openlibrary.org/b/isbn/${isbn}-${size === "lg" ? "L" : "M"}.jpg?default=false`}
        alt={`Cover of ${title}`}
        loading="lazy"
        onError={() => setFailed(true)}
        onLoad={(e) => { if ((e.currentTarget as HTMLImageElement).naturalWidth < 5) setFailed(true); }}
        className={cx(dims, "shrink-0 rounded-[2px] bg-manila-dark object-cover shadow-[2px_3px_0_rgba(0,0,0,0.25)]", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cx(dims, "flex shrink-0 flex-col justify-between overflow-hidden rounded-[2px] p-1.5 text-left shadow-[2px_3px_0_rgba(0,0,0,0.25)]", className)}
      style={{ background: spineColour(title), backgroundImage: "linear-gradient(90deg, rgba(0,0,0,.25) 0 6%, transparent 6% 100%)" }}
    >
      <span className={cx("line-clamp-4 font-serif leading-tight text-[#f3e9cf]", size === "lg" ? "text-[17px]" : size === "sm" ? "text-[8px]" : "text-[10.5px]")}>
        {title}
      </span>
      {author && size !== "sm" && <span className="line-clamp-1 text-[9px] text-[#f3e9cf]/75">{author}</span>}
    </div>
  );
}
