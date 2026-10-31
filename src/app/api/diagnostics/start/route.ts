import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureQuestionBank } from "@/lib/server/question-bank";
import { friendlyError, isKnownCode } from "@/lib/server/errors";
import { getApiUser, json } from "@/lib/server/api";
import { sanitizeSkillList, roleKey } from "@/lib/sanitize";
import { MAX_TESTED_SKILLS, QUESTIONS_PER_SKILL } from "@/lib/scoring";
import { withinRateLimit } from "@/lib/ai/log";
import type { RequirementSnapshot } from "@/lib/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z
  .object({
    roleId: z.string().uuid().nullable().optional(),
    customRole: z.string().trim().min(2).max(80).nullable().optional(),
    skills: z.array(z.string().max(80)).min(1).max(60),
  })
  .refine((b) => !!b.roleId !== !!b.customRole, { message: "Provide either a curated role or a custom role" });

/**
 * Prepares a diagnostic: finds the skills that will be tested, tops up the AI question bank for them,
 * then starts the attempt through the start_attempt RPC (which enforces limits, policies and one-at-a-time).
 */
export async function POST(req: Request) {
  const ctx = await getApiUser();
  if (!ctx) return json({ error: "unauthenticated" }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_request", message: "Choose a role and at least one skill." }, 400);
  const { roleId, customRole } = parsed.data;
  const skills = sanitizeSkillList(parsed.data.skills);
  if (skills.length === 0) return json({ error: "invalid_request", message: "Add at least one skill you already have." }, 400);

  // Requirements the attempt will snapshot (same source as start_attempt).
  let reqs: Pick<RequirementSnapshot, "skill" | "weight">[] = [];
  if (roleId) {
    const { data } = await ctx.supabase.from("role_skills").select("weight,skills(name)").eq("role_id", roleId).order("weight", { ascending: false });
    reqs = ((data ?? []) as unknown as { weight: number; skills: { name: string } | { name: string }[] | null }[])
      .map((r) => ({ skill: (Array.isArray(r.skills) ? r.skills[0]?.name : r.skills?.name) ?? "", weight: Number(r.weight) }))
      .filter((r) => r.skill);
  } else if (customRole) {
    const { data } = await createAdminClient().from("custom_role_estimates").select("requirements").eq("name_key", roleKey(customRole)).maybeSingle();
    reqs = (data?.requirements ?? []).map((r) => ({ skill: r.skill, weight: r.weight }));
  }
  if (reqs.length === 0) return json({ error: "role_not_ready", message: friendlyError(customRole ? "custom_role_not_estimated" : "role_has_no_skills") }, 422);

  const claimed = new Set(skills.map((s) => s.toLowerCase()));
  const candidates = reqs.filter((r) => claimed.has(r.skill.toLowerCase())).slice(0, MAX_TESTED_SKILLS).map((r) => r.skill);
  if (candidates.length === 0) return json({ error: "no_testable_skills", message: friendlyError("no_testable_skills") }, 422);

  if (!(await withinRateLimit(ctx.user.id, "questions", 40))) {
    return json({ error: "rate_limited", message: "You have started a lot of tests recently. Try again in a little while." }, 429);
  }
  const counts = await ensureQuestionBank(candidates, ctx.user.id);
  if (!candidates.some((s) => (counts[s] ?? 0) >= QUESTIONS_PER_SKILL)) {
    return json({ error: "questions_unavailable", message: "We could not prepare questions for your skills right now. Please try again in a moment." }, 503);
  }

  const { data: attemptId, error } = await ctx.supabase.rpc("start_attempt", {
    p_role_id: roleId ?? null,
    p_custom_role: customRole ?? null,
    p_skills: skills,
  });
  if (error) {
    const code = error.message.trim();
    const status = code === "attempt_in_progress" || code === "attempt_limit_reached" ? 409 : isKnownCode(code) ? 422 : 500;
    return json({ error: code, message: friendlyError(code) }, status);
  }
  return json({ attemptId });
}
