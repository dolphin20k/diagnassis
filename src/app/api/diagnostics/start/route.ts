import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { after } from "next/server";
import { ensureQuestionBank, MIN_QUESTIONS, QUESTION_POOL_TARGET } from "@/lib/server/question-bank";
import { friendlyError, isKnownCode } from "@/lib/server/errors";
import { getApiUser, json } from "@/lib/server/api";
import { sanitizeSkillList, roleKey } from "@/lib/sanitize";
import { MAX_TESTED_SKILLS } from "@/lib/scoring";
import { withinRateLimit } from "@/lib/ai/log";
import type { RequirementSnapshot } from "@/lib/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z
  .object({
    roleId: z.string().uuid().nullable().optional(),
    customRole: z.string().trim().min(2).max(80).nullable().optional(),
    skills: z.array(z.string().max(80)).max(60).default([]),
    /** "I don't know any of these skills": a valid diagnostic with nothing claimed; result + beginner roadmap straight away. */
    beginner: z.boolean().optional(),
  })
  .refine((b) => !!b.roleId !== !!b.customRole, { message: "Provide either a curated role or a custom role" })
  .refine((b) => b.beginner === true || b.skills.length >= 1, { message: "Choose at least one skill or the beginner option" });

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
  const beginner = parsed.data.beginner === true;
  const skills = beginner ? [] : sanitizeSkillList(parsed.data.skills);
  if (!beginner && skills.length === 0) return json({ error: "invalid_request", message: "Add at least one skill you already have." }, 400);

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

  if (!beginner) {
    const claimed = new Set(skills.map((s) => s.toLowerCase()));
    const candidates = reqs.filter((r) => claimed.has(r.skill.toLowerCase())).slice(0, MAX_TESTED_SKILLS).map((r) => r.skill);
    if (candidates.length === 0) return json({ error: "no_testable_skills", message: friendlyError("no_testable_skills") }, 422);

    if (!(await withinRateLimit(ctx.user.id, "questions", 40))) {
      return json({ error: "rate_limited", message: "You have started a lot of tests recently. Try again in a little while." }, 429);
    }
    // Only wait for AI when a skill cannot make a full test yet; growing the pool (for variety) happens after the response.
    const counts = await ensureQuestionBank(candidates, ctx.user.id, MIN_QUESTIONS);
    after(() => ensureQuestionBank(candidates, ctx.user.id, QUESTION_POOL_TARGET).then(() => undefined, () => undefined));
    if (!candidates.some((s) => (counts[s] ?? 0) >= MIN_QUESTIONS)) {
      return json({ error: "questions_unavailable", message: "We could not prepare questions for your skills right now. Please try again in a moment." }, 503);
    }
  }

  const { data: attemptId, error } = await ctx.supabase.rpc("start_attempt", {
    p_role_id: roleId ?? null,
    p_custom_role: customRole ?? null,
    p_skills: skills,
    p_beginner: beginner,
  });
  if (error) {
    const code = error.message.trim();
    const status = code === "attempt_in_progress" || code === "attempt_limit_reached" ? 409 : isKnownCode(code) ? 422 : 500;
    return json({ error: code, message: friendlyError(code) }, status);
  }
  if (beginner) {
    // Nothing to test: score it now (every skill counts as missing) so the student lands on their roadmap.
    const submitted = await ctx.supabase.rpc("submit_attempt", { p_attempt: attemptId });
    if (submitted.error) return json({ error: "submit_failed", message: "We could not build your roadmap. Please try again." }, 500);
    return json({ attemptId, completed: true });
  }
  return json({ attemptId });
}
