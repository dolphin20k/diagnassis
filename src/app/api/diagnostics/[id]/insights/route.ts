import { buildInsights } from "@/lib/ai/features";
import { dbLogger, withinRateLimit } from "@/lib/ai/log";
import { getApiUser, json, UUID } from "@/lib/server/api";
import type { Json } from "@/lib/types/database";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Builds (once) the personalised action plan, market-trend summary and learning resources with the NVIDIA model. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return json({ error: "invalid_id" }, 400);
  const ctx = await getApiUser();
  if (!ctx) return json({ error: "unauthenticated" }, 401);

  const { data: attempt } = await ctx.supabase.from("attempts").select("id,role_name,status,result,insights,declining_skills").eq("id", id).eq("user_id", ctx.user.id).maybeSingle();
  if (!attempt || attempt.status !== "submitted" || !attempt.result) return json({ error: "attempt_not_found" }, 404);
  if (attempt.insights) return json({ insights: attempt.insights });

  // Over the hourly budget we still return useful, clearly-labelled template guidance.
  const budgetOk = await withinRateLimit(ctx.user.id, "insights", 20);
  const insights = await buildInsights(attempt.role_name, attempt.result, attempt.declining_skills, { log: dbLogger(ctx.user.id), useAi: budgetOk }).catch(() => null);
  if (!insights) return json({ error: "insights_failed" }, 500);
  const { error } = await ctx.supabase.rpc("save_attempt_insights", { p_attempt: id, p_insights: insights as unknown as Json });
  if (error) return json({ error: "save_failed" }, 500);
  return json({ insights });
}
