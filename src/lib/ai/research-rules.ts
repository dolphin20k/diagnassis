import type { SkillPriority, SuggestionKind } from "@/lib/types/database";
import { normalizeWeights, priorityForWeight, type WeightedSkill } from "@/lib/scoring/weights";

/**
 * Guardrails for the automated market-research pipeline. The model proposes a market profile;
 * these deterministic rules decide what may change and by how much.
 */
export const RULES = {
  maxWeightShiftPerRun: 8,
  maxNewSkillWeight: 10,
  minSkills: 5,
  maxSkills: 12,
  maxChangesPerRun: 6,
};

export interface ProposedSkill {
  name: string;
  weight: number;
  priority: SkillPriority;
  rationale: string;
}

export interface Suggestion {
  kind: SuggestionKind;
  skill_name: string;
  from_weight: number | null;
  to_weight: number | null;
  from_priority: SkillPriority | null;
  to_priority: SkillPriority | null;
  rationale: string;
}

const key = (s: string) => s.trim().toLowerCase();

/** Turns the model's proposed profile into bounded, individually reviewable changes. */
export function diffProfile(current: WeightedSkill[], proposed: ProposedSkill[]): Suggestion[] {
  const cur = new Map(current.map((c) => [key(c.skill), c]));
  const prop = new Map(proposed.map((p) => [key(p.name), p]));
  const out: Suggestion[] = [];

  for (const p of proposed) {
    const c = cur.get(key(p.name));
    if (!c) {
      if (current.length + out.filter((o) => o.kind === "add_skill").length >= RULES.maxSkills) continue;
      const w = Math.min(RULES.maxNewSkillWeight, Math.max(2, Math.round(p.weight)));
      out.push({ kind: "add_skill", skill_name: p.name, from_weight: null, to_weight: w, from_priority: null, to_priority: p.priority, rationale: p.rationale });
    } else {
      const shift = Math.round(p.weight) - Math.round(c.weight);
      if (Math.abs(shift) >= 2) {
        const bounded = Math.max(-RULES.maxWeightShiftPerRun, Math.min(RULES.maxWeightShiftPerRun, shift));
        out.push({
          kind: bounded > 0 ? "raise_weight" : "lower_weight",
          skill_name: c.skill,
          from_weight: Math.round(c.weight),
          to_weight: Math.max(1, Math.round(c.weight) + bounded),
          from_priority: c.priority,
          to_priority: p.priority,
          rationale: p.rationale,
        });
      }
    }
  }
  // Removal only when the model no longer lists a skill AND the role stays above the minimum.
  const removable = current.filter((c) => !prop.has(key(c.skill)));
  for (const c of removable) {
    if (current.length - out.filter((o) => o.kind === "remove_skill").length <= RULES.minSkills) break;
    out.push({ kind: "remove_skill", skill_name: c.skill, from_weight: Math.round(c.weight), to_weight: null, from_priority: c.priority, to_priority: null, rationale: "No longer listed among the commonly required skills for this role." });
  }
  // Largest movements first, capped per run.
  const size = (s: Suggestion) => Math.abs((s.to_weight ?? 0) - (s.from_weight ?? 0));
  return out.sort((a, b) => size(b) - size(a)).slice(0, RULES.maxChangesPerRun);
}

/** Applies approved suggestions to the current profile and renormalizes weights to exactly 100. */
export function applySuggestions(current: WeightedSkill[], approved: Suggestion[]): WeightedSkill[] {
  let items = current.map((c) => ({ ...c }));
  for (const s of approved) {
    const idx = items.findIndex((i) => key(i.skill) === key(s.skill_name));
    if (s.kind === "add_skill") {
      if (idx === -1 && items.length < RULES.maxSkills) {
        const w = Math.min(RULES.maxNewSkillWeight, s.to_weight ?? 5);
        items.push({ skill: s.skill_name, weight: w, priority: s.to_priority ?? priorityForWeight(w), trend: "rising", trend_change: null });
      }
    } else if (s.kind === "remove_skill") {
      if (idx !== -1 && items.length > RULES.minSkills) items.splice(idx, 1);
    } else if (idx !== -1) {
      const item = items[idx];
      if (item) {
        item.weight = s.to_weight ?? item.weight;
        item.priority = s.to_priority ?? item.priority;
      }
    }
  }
  items = normalizeWeights(items);
  return items;
}
