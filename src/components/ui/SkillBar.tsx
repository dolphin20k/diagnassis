const color = (status: string) => (status === "matched" ? "var(--gap-strong)" : status === "weak" ? "var(--gap-attention)" : "var(--gap-critical)");

export function SkillBar({ label, value, status, trailing }: { label: string; value: number; status: "matched" | "weak" | "missing" | "none"; trailing?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[160px_1fr_72px]">
      <span className="truncate">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} ${value}%`}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: status === "none" ? "var(--cyan)" : color(status) }} />
      </div>
      <span className="text-right text-xs text-ink-2">{trailing ?? `${value}%`}</span>
    </div>
  );
}
