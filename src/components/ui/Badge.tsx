import { cn } from "./cn";

export type Tone = "strong" | "attention" | "critical" | "info" | "fill" | "neutral";
const TONES: Record<Tone, { dot: string; bg: string; fg: string }> = {
  strong: { dot: "#22C55E", bg: "#DCFCE7", fg: "#166534" },
  attention: { dot: "#F59E0B", bg: "#FEF3C7", fg: "#92400E" },
  critical: { dot: "#F43F5E", bg: "#FFE4E6", fg: "#9F1239" },
  info: { dot: "#6366F1", bg: "#E0E7FF", fg: "#3730A3" },
  fill: { dot: "#06B6D4", bg: "#CFFAFE", fg: "#155E75" },
  neutral: { dot: "#94A3B8", bg: "#F1F5F9", fg: "#334155" },
};

/** Status is always conveyed by text as well as colour. */
export function Badge({ tone = "info", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  const t = TONES[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-display text-xs font-semibold", className)} style={{ background: t.bg, color: t.fg }}>
      <i aria-hidden className="size-1.5 rounded-full" style={{ background: t.dot }} />
      {children}
    </span>
  );
}
export const toneForBand = (band: string): Tone => (band === "Ready" ? "strong" : band === "Competitive" ? "info" : band === "Developing" ? "attention" : "critical");
export const toneForPriority = (p: string): Tone => (p === "high" ? "critical" : p === "medium" ? "attention" : "info");
export const toneForStatus = (s: string): Tone => (s === "matched" ? "strong" : s === "weak" ? "attention" : "critical");
