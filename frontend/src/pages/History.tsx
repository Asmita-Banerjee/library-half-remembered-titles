import { History, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, EmptyState, ErrorNote, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import type { HistoryItem } from "../lib/types";

const TYPE_LABEL: Record<HistoryItem["search_type"], string> = {
  basic: "Beginning + ending", multi: "Multi-clue", author: "Author", story: "Character & story",
};

function cluesText(h: HistoryItem): string {
  const c = h.clues as Record<string, string | string[]>;
  const parts: string[] = [];
  if (c.prefix) parts.push(`begins “${c.prefix}”`);
  if (Array.isArray(c.contains)) c.contains.filter(Boolean).forEach((x) => parts.push(`contains “${x}”`));
  if (c.suffix) parts.push(`ends “${c.suffix}”`);
  if (c.author) parts.push(`“${c.author}”`);
  if (c.description) parts.push(`“${c.description}”`);
  return parts.join(" · ");
}

function repeatUrl(h: HistoryItem): string {
  const c = h.clues as Record<string, string | string[]>;
  const p = new URLSearchParams({ run: "1" });
  if (h.search_type === "author") { p.set("name", String(c.author)); return `/authors?${p}`; }
  if (h.search_type === "story") { p.set("q", String(c.description)); return `/story?${p}`; }
  p.set("mode", h.search_type);
  if (h.dataset) p.set("dataset", h.dataset);
  if (c.prefix) p.set("prefix", String(c.prefix));
  if (c.suffix) p.set("suffix", String(c.suffix));
  if (Array.isArray(c.contains)) c.contains.filter(Boolean).forEach((x) => p.append("c", x));
  return `/title?${p}`;
}

export default function HistoryPage() {
  const { data, error, reload } = useAsync(() => api.history(), []);
  const [clearing, setClearing] = useState(false);
  const nav = useNavigate();

  return (
    <div>
      <PageHeader icon={<History className="h-6 w-6" />} title="Search history"
        subtitle="Your last five searches, stored by the server. Repeat one to run it again with the same clues." />
      {error && <ErrorNote>{error}</ErrorNote>}
      {data && data.items.length === 0 && (
        <EmptyState icon={<History className="h-8 w-8" />} title="No searches yet">Searches you run appear here (live suggestions are not recorded).</EmptyState>
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.items.map((h) => (
              <Card as="li" key={h.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="navy">{TYPE_LABEL[h.search_type]}</Badge>
                    {h.dataset && h.search_type !== "author" && h.search_type !== "story" && <Badge>{h.dataset === "dsa" ? "DSA catalog" : "Library"}</Badge>}
                    <Badge tone={h.status === "success" ? "green" : "red"}>{h.status === "success" ? `${h.result_count} found` : "no match"}</Badge>
                    <span className="text-xs text-muted">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-ink">{cluesText(h)}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{h.result_summary}</p>
                </div>
                <Button variant="secondary" className="shrink-0" onClick={() => nav(repeatUrl(h))}>
                  <RotateCcw className="h-4 w-4" /> Repeat
                </Button>
              </Card>
            ))}
          </ul>
          <div className="mt-5">
            <Button variant="ghost" loading={clearing} onClick={async () => { setClearing(true); try { await api.clearHistory(); reload(); } finally { setClearing(false); } }}>
              <Trash2 className="h-4 w-4" /> Clear history
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
