import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { FacetOptions, FacetValues } from "../lib/types";
import { SelectField, TextField } from "./ui";

export const EMPTY_FACETS: FacetValues = { genre: "", audience: "", source: "", year_from: null, year_to: null };

let cached: FacetOptions | null = null;

export function useFacetOptions() {
  const [opts, setOpts] = useState<FacetOptions | null>(cached);
  useEffect(() => {
    if (cached) return;
    api.facets().then((o) => { cached = o; setOpts(o); }).catch(() => {});
  }, []);
  return opts;
}

export function facetsActive(f: FacetValues) {
  return Boolean(f.genre || f.audience || f.source || f.year_from !== null || f.year_to !== null);
}

const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Math.trunc(Number(v)));

/** Narrow a search by genre, readership, publication years and record type. */
export default function FacetPanel({ value, onChange, idPrefix }: { value: FacetValues; onChange: (f: FacetValues) => void; idPrefix: string }) {
  const opts = useFacetOptions();
  const [from, setFrom] = useState(value.year_from?.toString() ?? "");
  const [to, setTo] = useState(value.year_to?.toString() ?? "");
  useEffect(() => {
    if (num(from) !== value.year_from) setFrom(value.year_from?.toString() ?? "");
    if (num(to) !== value.year_to) setTo(value.year_to?.toString() ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.year_from, value.year_to]);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <SelectField id={`${idPrefix}-genre`} label="Genre" value={value.genre} onChange={(e) => onChange({ ...value, genre: e.target.value })}>
        <option value="">Any genre</option>
        {opts?.genres.map((g) => <option key={g} value={g}>{g}</option>)}
      </SelectField>
      <SelectField id={`${idPrefix}-aud`} label="Written for" value={value.audience}
        onChange={(e) => onChange({ ...value, audience: e.target.value as FacetValues["audience"] })}>
        <option value="">Any reader</option>
        <option value="Children">Children</option>
        <option value="Young Adult">Young adults</option>
        <option value="General">General readers</option>
      </SelectField>
      <TextField id={`${idPrefix}-from`} label="Published from" inputMode="numeric" placeholder={opts ? String(Math.max(opts.year_min, 1800)) : "1800"}
        value={from} onChange={(e) => { const v = e.target.value.replace(/[^\d-]/g, ""); setFrom(v); onChange({ ...value, year_from: num(v) }); }} />
      <TextField id={`${idPrefix}-to`} label="Published until" inputMode="numeric" placeholder={opts ? String(opts.year_max) : "2017"}
        value={to} onChange={(e) => { const v = e.target.value.replace(/[^\d-]/g, ""); setTo(v); onChange({ ...value, year_to: num(v) }); }} />
      <SelectField id={`${idPrefix}-src`} label="Records" value={value.source}
        onChange={(e) => onChange({ ...value, source: e.target.value as FacetValues["source"] })}>
        <option value="">All records</option>
        <option value="curated">Detailed (with plot)</option>
        <option value="goodbooks">Extended catalogue</option>
      </SelectField>
    </div>
  );
}
