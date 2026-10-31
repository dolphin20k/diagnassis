"use client";
import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { sanitizeLabel } from "@/lib/sanitize";

/** Tag input with catalogue suggestions; students may also add their own skill. */
export function SkillPicker({ value, onChange, catalog, label = "Current skills", error, max = 60 }: { value: string[]; onChange: (v: string[]) => void; catalog: string[]; label?: string; error?: string; max?: number }) {
  const [q, setQ] = useState("");
  const id = useId();
  const ql = q.trim().toLowerCase();
  const chosen = new Set(value.map((v) => v.toLowerCase()));
  const sugg = catalog.filter((k) => !chosen.has(k.toLowerCase()) && (!ql || k.toLowerCase().includes(ql))).slice(0, ql ? 8 : 10);
  const exact = catalog.some((k) => k.toLowerCase() === ql) || chosen.has(ql);
  const add = (raw: string) => {
    const k = sanitizeLabel(raw);
    if (!k || chosen.has(k.toLowerCase()) || value.length >= max) return;
    onChange([...value, k]);
    setQ("");
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-display text-[13px] font-semibold">{label} <span className="font-normal text-ink-2">({value.length} selected)</span></label>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Selected skills">
          {value.map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 py-1 pl-3 pr-1.5 text-sm font-semibold text-primary-dark">
              {k}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== k))} aria-label={`Remove ${k}`} className="grid size-5 place-items-center rounded-full hover:bg-indigo-100"><Icon name="x" size={13} /></button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const m = catalog.find((k) => k.toLowerCase() === ql);
            add(m ?? q);
          }
        }}
        placeholder="Search or type a skill, then press Enter"
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-md border bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--focus-ring)] ${error ? "border-gap-critical" : "border-border"}`}
      />
      <div className="flex flex-wrap gap-2" aria-label="Suggested skills">
        {sugg.map((k) => (
          <button key={k} type="button" onClick={() => add(k)} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-sm hover:border-primary hover:bg-indigo-50">
            <Icon name="plus" size={13} />{k}
          </button>
        ))}
        {ql && !exact ? (
          <button type="button" onClick={() => add(q)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary bg-surface px-3 py-1 text-sm font-semibold text-primary">
            <Icon name="plus" size={13} />Add &ldquo;{sanitizeLabel(q)}&rdquo; as a new skill
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="text-[13px] text-rose-700">{error}</p> : null}
    </div>
  );
}

export function OptionCard({ selected, onClick, children, role = "radio" }: { selected: boolean; onClick: () => void; children: React.ReactNode; role?: "radio" | "checkbox" }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg border-2 px-3.5 py-3 text-left font-display text-sm transition ${selected ? "border-primary bg-indigo-50 font-bold text-primary-dark shadow-[0_0_0_4px_rgba(79,70,229,.14)]" : "border-border bg-surface font-semibold hover:border-indigo-300"}`}
    >
      <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"}`}>{selected ? <Icon name="check" size={12} /> : null}</span>
      {children}
    </button>
  );
}
