import { CircleAlert, LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { forwardRef } from "react";
import type { ClueSpan } from "../lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Page title set on the green room background. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 max-w-3xl">
      <h1 className="text-[2rem] leading-tight text-chalk sm:text-[2.5rem]">{title}</h1>
      {children && <div className="mt-3 text-[15px] leading-relaxed text-sage">{children}</div>}
    </header>
  );
}

/** A manila index card. `ruled` draws the red head rule and blue lines. */
export function IndexCard({ children, className, ruled = false, punched = false, as: As = "section" }: {
  children: ReactNode; className?: string; ruled?: boolean; punched?: boolean; as?: "section" | "div" | "article" | "li";
}) {
  return (
    <As className={cx("index-card px-5 py-4 sm:px-6", !ruled && "plain", punched && "pb-10", className)}>
      {children}
      {punched && <span className="punch" aria-hidden />}
    </As>
  );
}

/** Heading that sits on a ruled card's red head line. */
export function CardHead({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex min-h-[2.1rem] items-end justify-between gap-3">
      <h2 className="text-[17px] font-bold text-ink">{children}</h2>
      {aside}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "chalk"; loading?: boolean };
export function Button({ variant = "primary", loading, className, children, disabled, type = "button", ...rest }: BtnProps) {
  return (
    <button
      type={type}
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[3px] px-4 py-2 text-[14px] transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        variant === "primary" && "bg-stamp text-manila-light shadow-[0_2px_0_#33224f] hover:bg-stamp-dark active:translate-y-px active:shadow-none",
        variant === "secondary" && "border border-ink/25 bg-manila-light text-ink hover:border-stamp hover:text-stamp",
        variant === "quiet" && "text-ink-soft underline decoration-ink/25 underline-offset-4 hover:text-stamp hover:decoration-stamp",
        variant === "chalk" && "border border-chalk/30 text-chalk hover:border-chalk hover:bg-chalk/10",
        className,
      )}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const fieldCls = "w-full rounded-[3px] border bg-manila-light px-3 py-2 text-[15px] text-ink placeholder:text-ink-soft/60 focus:border-stamp focus:outline-none focus:ring-2 focus:ring-stamp/20";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: boolean; trailing?: ReactNode; hideLabel?: boolean };
export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, hint, error, trailing, className, id, hideLabel, ...rest }, ref,
) {
  const inputId = id ?? `f-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className={className}>
      <label htmlFor={inputId} className={cx("mb-1 block text-[13px] text-ink-soft", hideLabel && "sr-only")}>{label}</label>
      <div className="relative">
        <input ref={ref} id={inputId} autoComplete="off" spellCheck={false} {...rest}
          className={cx(fieldCls, "typewriter", error ? "border-rule-red" : "border-ink/20", trailing ? "pr-10" : null)} />
        {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
      </div>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
});

export function SelectField({ label, children, className, id, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const selId = id ?? `s-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className={className}>
      <label htmlFor={selId} className="mb-1 block text-[13px] text-ink-soft">{label}</label>
      <select id={selId} {...rest} className={cx(fieldCls, "border-ink/20 py-[9px]")}>{children}</select>
    </div>
  );
}

export function Tag({ children, tone = "plain", title }: { children: ReactNode; tone?: "plain" | "stamp" | "red" | "dark"; title?: string }) {
  return (
    <span title={title} className={cx(
      "inline-flex items-center gap-1 rounded-[3px] px-1.5 py-[1px] text-[12px]",
      tone === "plain" && "bg-manila-dark/70 text-ink",
      tone === "stamp" && "border border-stamp/40 text-stamp",
      tone === "red" && "border border-rule-red/50 text-rule-red",
      tone === "dark" && "bg-ink text-manila-light",
    )}>{children}</span>
  );
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-[3px] border border-rule-red/50 bg-[#f6e4d8] px-3 py-2.5 text-sm text-[#7a2522]">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
      {onRetry && <button className="underline underline-offset-2" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Loading({ label = "Searching the drawers" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-ink-soft">
      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> {label}…
    </p>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <IndexCard className="text-center">
      <p className="text-[17px] text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{children}</div>}
    </IndexCard>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, onDark = false }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; onDark?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label}
      className={cx("inline-flex flex-wrap gap-1 rounded-[4px] p-1", onDark ? "bg-room-deep" : "bg-manila-dark/60")}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx(
            "rounded-[3px] px-3 py-1.5 text-[13.5px] transition-colors",
            value === o.value
              ? onDark ? "bg-manila text-ink" : "bg-stamp text-manila-light"
              : onDark ? "text-sage hover:text-chalk" : "text-ink-soft hover:text-stamp",
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SPAN_STYLE: Record<ClueSpan["type"], string> = {
  prefix: "bg-[#d9cdf0] decoration-stamp",
  contains: "bg-[#f2d9a8] decoration-[#9a6b14]",
  suffix: "bg-[#c9dccf] decoration-[#2f6b4f]",
};
const SPAN_LABEL: Record<ClueSpan["type"], string> = { prefix: "begins with", contains: "contains", suffix: "ends with" };

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
    <span className="typewriter text-[13.5px] text-ink-soft">
      {parts.map((p, i) => (p.k
        ? <mark key={i} className={cx("rounded-[2px] text-ink underline decoration-2 underline-offset-[3px]", SPAN_STYLE[p.k])}>{p.t}</mark>
        : <span key={i}>{p.t}</span>))}
    </span>
  );
}

export function ClueChip({ type, value }: { type: ClueSpan["type"]; value: string }) {
  return (
    <span className={cx("inline-flex items-baseline gap-1 rounded-[3px] px-1.5 py-[1px] text-[12.5px] text-ink", SPAN_STYLE[type].split(" ")[0])}>
      <span className="text-ink-soft">{SPAN_LABEL[type]}</span>
      <span className="typewriter font-bold">{value}</span>
    </span>
  );
}

export function Timing({ ms }: { ms: number }) {
  const v = ms < 1 ? `${Math.max(1, Math.round(ms * 1000))} µs` : `${ms.toFixed(1)} ms`;
  return <span className="typewriter text-[12px] text-ink-soft" title="Time spent on the server">{v}</span>;
}

export function RecordNo({ id }: { id: number }) {
  return <span className="typewriter text-[12.5px] text-ink-soft" title="Record ID (insertion order)">No. {id}</span>;
}
