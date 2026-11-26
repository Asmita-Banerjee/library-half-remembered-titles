import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Empty, ErrorNote, IndexCard, Loading, PageHeader, Tag, cx } from "../components/ui";
import { api } from "../lib/api";
import { useAsync } from "../lib/hooks";
import type { HistoryItem } from "../lib/types";

const TYPE_LABEL: Record<HistoryItem["search_type"], string> = {
  basic: "Beginning and ending", multi: "Title clues", author: "Author", story: "Story description",
};

export function historyText(h: HistoryItem): string {
  const c = h.clues as Record<string, string | string[] | undefined>;
  const parts: string[] = [];
  if (c.prefix) parts.push(`begins "${c.prefix}"`);
  if (Array.isArray(c.contains)) c.contains.filter(Boolean).forEach((x) => parts.push(`contains "${x}"`));
  if (c.suffix) parts.push(`ends "${c.suffix}"`);
  if (c.author) parts.push(`by "${c.author}"`);
  if (c.description) parts.push(`"${c.description}"`);
  return parts.join(", ") || TYPE_LABEL[h.search_type];
}

export function repeatUrl(h: HistoryItem): string {
  const c = h.clues as Record<string, string | string[] | undefined>;
  const p = new URLSearchParams({ run: "1" });
  if (h.search_type === "author") { p.set("name", String(c.author ?? "")); return `/authors?${p}`; }
  if (h.search_type === "story") { p.set("q", String(c.description ?? "")); return `/plot?${p}`; }
  p.set("mode", h.search_type);
  if (h.dataset) p.set("dataset", h.dataset);
  if (c.prefix) p.set("prefix", String(c.prefix));
  if (c.suffix) p.set("suffix", String(c.suffix));
  if (Array.isArray(c.contains)) c.contains.filter(Boolean).forEach((x) => p.append("c", x));
  return `/title?${p}`;
}

export default function HistoryPage() {
  const { data, error, loading, reload } = useAsync(() => api.history(), []);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const nav = useNavigate();

  async function clear() {
    setClearing(true);
    setClearError(null);
    try { await api.clearHistory(); reload(); }
    catch (e) { setClearError((e as Error).message); }
    finally { setClearing(false); }
  }

  return (
    <div>
      <PageHeader title="Your requests">
        The last five requests, kept by the library server. Send one again with the same clues, or clear the list.
        Suggestions that appear while you type aren't saved here.
      </PageHeader>
      {loading && !data && <p className="text-sage">Loading your requests…</p>}
      {error && <ErrorNote onRetry={reload}>{error}</ErrorNote>}
      {data && data.items.length === 0 && <Empty title="No requests yet">Your searches will be filed here.</Empty>}
      {data && data.items.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.items.map((h) => (
              <IndexCard as="li" ruled key={h.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex min-h-[2.1rem] flex-wrap items-end gap-2">
                    <span className="typewriter text-[13px] text-ink-soft">Request {h.id}</span>
                    <Tag tone="stamp">{TYPE_LABEL[h.search_type]}</Tag>
                    {h.dataset === "dsa" && <Tag>DSA test catalogue</Tag>}
                    <span className="text-[12.5px] text-ink-soft">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-3 text-[15.5px] text-ink">{historyText(h)}</p>
                  <p className="mt-1 text-[13.5px] leading-[1.6rem] text-ink-soft">{h.result_summary}</p>
                </div>
                <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
                  <span className={cx("stamp text-[11.5px]", h.status !== "success" && "red")}>
                    {h.status === "success" ? `${h.result_count} found` : "No match"}
                  </span>
                  {h.feedback && <span className="text-[12.5px] text-ink-soft">{h.feedback === "found" ? "You found your book" : "You didn't find it"}</span>}
                  <Button variant="secondary" onClick={() => nav(repeatUrl(h))}><RotateCcw className="h-4 w-4" /> Search again</Button>
                </div>
              </IndexCard>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-4">
            <Button variant="chalk" loading={clearing} onClick={clear}><Trash2 className="h-4 w-4" /> Clear requests</Button>
            {clearError && <span className="text-sm text-[#f0b3a8]">{clearError}</span>}
          </div>
        </>
      )}
      {loading && data && <div className="mt-3"><Loading label="Refreshing" /></div>}
    </div>
  );
}
