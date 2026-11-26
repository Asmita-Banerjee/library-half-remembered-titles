import { CircleAlert, LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import type { ClueSpan, Dataset } from "../lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, icon }: { title: string; subtitle?: ReactNode; icon?: ReactNode }) {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-3">
        {icon && <span className="text-navy">{icon}</span>}
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink sm:text-[2.1rem]">{title}</h1>
      </div>
      {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{subtitle}</p>}
    </header>
  );
}

export function Card({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "li" }) {
  return <As className={cx("rounded-xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>{children}</As>;
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold text-ink">{children}</h2>
      {aside}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost"; loading?: boolean };
export function Button({ variant = "primary", loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-navy text-white hover:bg-navy-dark",
        variant === "secondary" && "border border-line bg-white text-ink hover:border-navy/40 hover:text-navy",
        variant === "ghost" && "text-muted hover:bg-navy-soft hover:text-navy",
        className,
      )}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: boolean; trailing?: ReactNode };
export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, hint, error, trailing, className, id, ...rest }, ref,
) {
  const inputId = id ?? `f-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-ink">{label}</label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          autoComplete="off"
          spellCheck={false}
          {...rest}
          className={cx(
            "w-full rounded-lg border bg-white px-3 py-2 text-[15px] text-ink placeholder:text-stone-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15",
            error ? "border-red-400" : "border-line",
            trailing ? "pr-10" : "",
          )}
        />
        {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
});

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "navy" | "green" | "red" | "amber" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-stone-100 text-stone-700",
        tone === "navy" && "bg-navy-soft text-navy",
        tone === "green" && "bg-emerald-50 text-emerald-800",
        tone === "red" && "bg-red-50 text-red-700",
        tone === "amber" && "bg-amber-50 text-amber-800",
      )}
    >
      {children}
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <div className="mb-3 text-stone-400">{icon}</div>
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-ink tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            value === o.value ? "bg-navy text-white" : "text-muted hover:text-navy",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DatasetToggle({ value, onChange }: { value: Dataset; onChange: (d: Dataset) => void }) {
  return (
    <Segmented
      label="Catalog"
      value={value}
      onChange={onChange}
      options={[{ value: "library", label: "Library catalog" }, { value: "dsa", label: "DSA test catalog" }]}
    />
  );
}

const SPAN_STYLE: Record<ClueSpan["type"], string> = {
  prefix: "bg-blue-100 text-blue-950 underline decoration-blue-400 decoration-2 underline-offset-4",
  contains: "bg-amber-100 text-amber-950 underline decoration-amber-500 decoration-2 underline-offset-4",
  suffix: "bg-emerald-100 text-emerald-950 underline decoration-emerald-500 decoration-2 underline-offset-4",
};

/** Normalised title with each matched clue highlighted (colour + underline). */
export function HighlightedTitle({ text, spans }: { text: string; spans: ClueSpan[] }) {
  const marks: (ClueSpan["type"] | null)[] = Array(text.length).fill(null);
  for (const s of spans) for (let i = Math.max(0, s.start); i < Math.min(text.length, s.end); i++) marks[i] ??= s.type;
  const parts: { t: string; k: ClueSpan["type"] | null }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.k === marks[i]) last.t += text[i];
    else parts.push({ t: text[i], k: marks[i] });
  }
  return (
    <span className="font-mono text-[13px] text-stone-600">
      {parts.map((p, i) => (p.k ? <mark key={i} className={cx("rounded-sm px-px", SPAN_STYLE[p.k])}>{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </span>
  );
}

export function ClueChip({ type, value }: { type: ClueSpan["type"]; value: string }) {
  const label = type === "prefix" ? "begins" : type === "suffix" ? "ends" : "contains";
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs", SPAN_STYLE[type].split(" ").slice(0, 2).join(" "))}>
      <span className="opacity-70">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </span>
  );
}

export function Timing({ ms, label = "server time" }: { ms: number; label?: string }) {
  const v = ms < 1 ? `${(ms * 1000).toFixed(0)} µs` : `${ms.toFixed(2)} ms`;
  return <span className="text-xs tabular-nums text-muted">{v} {label}</span>;
}
