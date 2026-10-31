"use client";
import { useId, useState } from "react";
import { cn } from "./cn";
import { Icon } from "./Icon";

type Common = { label: string; error?: string; hint?: string; className?: string };

export function Field({ label, error, hint, className, id, ...rest }: Common & React.InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fid} className="font-display text-[13px] font-semibold">{label}</label>
      <input
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        className={cn("w-full rounded-md border bg-surface px-3 py-2.5 text-[15px] outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_var(--focus-ring)] disabled:bg-slate-50 disabled:text-ink-2", error ? "border-gap-critical" : "border-border")}
        {...rest}
      />
      {error ? <p id={`${fid}-err`} role="alert" className="text-[13px] text-rose-700">{error}</p> : hint ? <p id={`${fid}-hint`} className="text-[13px] text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function PasswordField({ label, error, hint, className, id, ...rest }: Common & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const auto = useId();
  const fid = id ?? auto;
  const [show, setShow] = useState(false);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fid} className="font-display text-[13px] font-semibold">{label}</label>
      <div className="relative">
        <input
          id={fid}
          type={show ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
          className={cn("w-full rounded-md border bg-surface py-2.5 pl-3 pr-11 text-[15px] outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_var(--focus-ring)]", error ? "border-gap-critical" : "border-border")}
          {...rest}
        />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-2 hover:bg-slate-100">
          <Icon name={show ? "eye-off" : "eye"} />
        </button>
      </div>
      {error ? <p id={`${fid}-err`} role="alert" className="text-[13px] text-rose-700">{error}</p> : hint ? <p id={`${fid}-hint`} className="text-[13px] text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function TextArea({ label, error, hint, className, id, ...rest }: Common & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fid} className="font-display text-[13px] font-semibold">{label}</label>
      <textarea id={fid} aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-err` : undefined} className={cn("min-h-28 w-full rounded-md border bg-surface px-3 py-2.5 text-[15px] outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_var(--focus-ring)]", error ? "border-gap-critical" : "border-border")} {...rest} />
      {error ? <p id={`${fid}-err`} role="alert" className="text-[13px] text-rose-700">{error}</p> : hint ? <p className="text-[13px] text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function PasswordStrength({ score, rules }: { score: number; rules: [string, boolean][] }) {
  const L = [["Too short", "#94A3B8"], ["Weak", "#E11D48"], ["Fair", "#D97706"], ["Good", "#0891B2"], ["Strong", "#16A34A"]][score] as [string, string];
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= score ? L[1] : "#E2E8F0" }} />)}
        </div>
        <span className="min-w-14 text-right text-xs font-semibold" style={{ color: L[1] }}>{L[0]}</span>
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {rules.map(([label, ok]) => (
          <li key={label} className="flex items-center gap-1.5 text-[13px]" style={{ color: ok ? "#16A34A" : "#64748B" }}>
            <Icon name={ok ? "circle-check" : "circle"} size={14} />
            <span>{label}<span className="sr-only">{ok ? " (met)" : " (not met)"}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
