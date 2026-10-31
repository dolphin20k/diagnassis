import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { researchRole, reviewSuggestions } from "@/lib/ai/features";
import { dbLogger } from "@/lib/ai/log";
import { applySuggestions, diffProfile, type Suggestion } from "@/lib/ai/research-rules";
import type { WeightedSkill } from "@/lib/scoring/weights";
import type { Json, SkillPriority, SkillSuggestionRow } from "@/lib/types/database";

export interface RoleResearchResult {
  roleId: string;
  roleName: string;
  approved: number;
  rejected: number;
  created: number;
  error?: string;
}

async function loadProfile(roleId: string): Promise<WeightedSkill[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("role_skills").select("weight,priority,trend,trend_change,skills(name,why)").eq("role_id", roleId);
  type Row = { weight: number; priority: SkillPriority; trend: "rising" | "stable" | "declining"; trend_change: string | null; skills: { name: string; why: string | null } | { name: string; why: string | null }[] | null };
  return ((data ?? []) as unknown as Row[])
    .map((r) => {
      const s = Array.isArray(r.skills) ? r.skills[0] : r.skills;
      return s ? { skill: s.name, weight: Number(r.weight), priority: r.priority, trend: r.trend, trend_change: r.trend_change, why: s.why } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.weight - a.weight);
}

const toItems = (items: WeightedSkill[]): Json =>
  items.map((i) => ({ skill: i.skill, weight: i.weight, priority: i.priority, trend: i.trend ?? "stable", trend_change: i.trend_change ?? null })) as unknown as Json;

/**
 * One role, one run:
 *  A. AI-review suggestions made by earlier runs and apply the approved ones (weights renormalised to 100),
 *  B. ask the model for an updated market profile, store trend labels, and record bounded new suggestions.
 * Decisions are written through service_apply_role_update so a role can never end up off 100%.
 */
export async function runRoleResearch(roleId: string, runId: string, runStartedAt: string): Promise<RoleResearchResult> {
  const admin = createAdminClient();
  const log = dbLogger(null);
  const { data: role } = await admin.from("roles").select("id,name,declining_skills,is_active").eq("id", roleId).maybeSingle();
  if (!role) throw new Error("role_not_found");
  const result: RoleResearchResult = { roleId, roleName: role.name, approved: 0, rejected: 0, created: 0 };

  let current = await loadProfile(roleId);

  // ---- Phase A: review and apply earlier suggestions
  const { data: due } = await admin
    .from("skill_suggestions")
    .select("*")
    .eq("role_id", roleId)
    .eq("status", "suggested")
    .lt("suggested_at", runStartedAt)
    .order("suggested_at", { ascending: true })
    .limit(12);
  const dueRows = (due ?? []) as SkillSuggestionRow[];
  if (dueRows.length > 0) {
    try {
      const asSuggestions: Suggestion[] = dueRows.map((d) => ({
        kind: d.kind, skill_name: d.skill_name, from_weight: d.from_weight, to_weight: d.to_weight,
        from_priority: d.from_priority, to_priority: d.to_priority, rationale: d.rationale,
      }));
      const { decisions } = await reviewSuggestions(role.name, asSuggestions, log);
      const decided = new Map(decisions.map((d) => [d.index, d]));
      const approvedIdx = dueRows.map((_, i) => i).filter((i) => decided.get(i)?.approve === true);
      const rejectedIdx = dueRows.map((_, i) => i).filter((i) => decided.get(i)?.approve === false);
      const next = applySuggestions(current, approvedIdx.map((i) => asSuggestions[i] as Suggestion));
      const note = "Reviewed automatically by AI";
      const { error } = await admin.rpc("service_apply_role_update", {
        p_role: roleId,
        p_items: approvedIdx.length ? toItems(next) : null,
        p_declining: null,
        p_applied: approvedIdx.map((i) => (dueRows[i] as SkillSuggestionRow).id),
        p_rejected: rejectedIdx.map((i) => (dueRows[i] as SkillSuggestionRow).id),
        p_note: note,
      });
      if (error) throw new Error(error.message);
      result.approved = approvedIdx.length;
      result.rejected = rejectedIdx.length;
      if (approvedIdx.length) current = await loadProfile(roleId);
    } catch (e) {
      result.error = `review: ${e instanceof Error ? e.message : "failed"}`;
    }
  }

  // ---- Phase B: refresh the market profile and trends
  try {
    const out = await researchRole({ role: role.name, current: current.map((c) => ({ skill: c.skill, weight: c.weight, priority: c.priority, trend: c.trend ?? null })) }, log);
    for (const p of out.proposed) {
      const c = current.find((x) => x.skill.toLowerCase() === p.name.toLowerCase());
      if (!c) continue;
      const { data: sk } = await admin.from("skills").select("id").ilike("name", c.skill.replace(/[\\%_]/g, (m) => `\\${m}`)).maybeSingle();
      if (sk) await admin.from("role_skills").update({ trend: p.trend, trend_change: p.trend_change }).eq("role_id", roleId).eq("skill_id", sk.id);
    }
    await admin.rpc("service_apply_role_update", { p_role: roleId, p_items: null, p_declining: out.declining.length ? out.declining : role.declining_skills, p_applied: [], p_rejected: [], p_note: "" });

    const pending = await admin.from("skill_suggestions").select("skill_name,kind").eq("role_id", roleId).eq("status", "suggested");
    const already = new Set((pending.data ?? []).map((p) => `${p.kind}:${p.skill_name.toLowerCase()}`));
    const diffs = diffProfile(current, out.proposed).filter((d) => !already.has(`${d.kind}:${d.skill_name.toLowerCase()}`));
    if (diffs.length) {
      const { error } = await admin.from("skill_suggestions").insert(diffs.map((d) => ({ ...d, role_id: roleId, run_id: runId })));
      if (error) throw new Error(error.message);
      result.created = diffs.length;
    }
  } catch (e) {
    result.error = `${result.error ? result.error + "; " : ""}research: ${e instanceof Error ? e.message : "failed"}`;
  }
  return result;
}
