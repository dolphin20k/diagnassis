import type { SkillPriority, SkillTrend } from "@/lib/types/database";

export interface WeightedSkill {
  skill: string;
  weight: number;
  priority: SkillPriority;
  trend?: SkillTrend | null;
  trend_change?: string | null;
  why?: string | null;
}

/**
 * Rescales weights to whole numbers that total exactly 100 (largest-remainder method),
 * keeping every skill at 1 or more.
 */
export function normalizeWeights<T extends { weight: number }>(items: T[]): T[] {
  if (items.length === 0) return items;
  const total = items.reduce((a, i) => a + Math.max(0, i.weight), 0);
  if (total <= 0) {
    const even = Math.floor(100 / items.length);
    const out = items.map((i) => ({ ...i, weight: even }));
    const first = out[0];
    if (first) first.weight += 100 - even * items.length;
    return out;
  }
  const raw = items.map((i) => (Math.max(0, i.weight) / total) * 100);
  const base = raw.map((x) => Math.max(1, Math.floor(x)));
  let remaining = 100 - base.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  let guard = 0;
  while (remaining !== 0 && guard++ < 1000) {
    for (const { i } of remaining > 0 ? order : [...order].reverse()) {
      if (remaining === 0) break;
      const cur = base[i] ?? 1;
      if (remaining > 0) {
        base[i] = cur + 1;
        remaining--;
      } else if (cur > 1) {
        base[i] = cur - 1;
        remaining++;
      }
    }
  }
  return items.map((it, i) => ({ ...it, weight: base[i] ?? 1 }));
}

export function weightsTotal(items: { weight: number }[]): number {
  return Math.round(items.reduce((a, i) => a + Number(i.weight || 0), 0) * 100) / 100;
}

/** Prototype rule: priority labels follow weight bands unless explicitly provided. */
export function priorityForWeight(weight: number): SkillPriority {
  return weight >= 12 ? "high" : weight >= 7 ? "medium" : "low";
}
