import { Check } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import type { SearchType } from "../lib/types";
import { cx } from "./ui";

/** "Did you find your book?" - records a confirmed (or not) outcome for this search. */
export default function Feedback({ searchType, searchId, recordId, onDark = false }: {
  searchType: SearchType; searchId: number | null; recordId?: number | null; onDark?: boolean;
}) {
  const [state, setState] = useState<"idle" | "saving" | "found" | "not_found" | "error">("idle");
  async function send(found: boolean) {
    setState("saving");
    try {
      await api.feedback(searchType, found, searchId, recordId);
      setState(found ? "found" : "not_found");
    } catch {
      setState("error");
    }
  }
  const text = onDark ? "text-sage" : "text-ink-soft";
  if (state === "found") {
    return <p className={cx("flex items-center gap-2 text-sm", text)} role="status"><span className="stamp stamp-in text-[12px]">Found</span> Marked as found. Thanks.</p>;
  }
  if (state === "not_found") {
    return <p className={cx("text-sm", text)} role="status">Noted as not found. Try different clues, or describe the story instead.</p>;
  }
  return (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 text-sm", text)}>
      <span>Did this find your book?</span>
      <button type="button" disabled={state === "saving"} onClick={() => send(true)}
        className={cx("inline-flex items-center gap-1 rounded-[3px] border px-2.5 py-1", onDark ? "border-chalk/30 text-chalk hover:bg-chalk/10" : "border-stamp/50 text-stamp hover:bg-stamp hover:text-manila-light")}>
        <Check className="h-3.5 w-3.5" aria-hidden /> Yes, found it
      </button>
      <button type="button" disabled={state === "saving"} onClick={() => send(false)}
        className={cx("underline underline-offset-4", onDark ? "decoration-chalk/30 hover:text-chalk" : "decoration-ink/25 hover:text-ink")}>
        Not yet
      </button>
      {state === "error" && <span className="text-rule-red">Couldn't save that. Try again.</span>}
    </div>
  );
}
