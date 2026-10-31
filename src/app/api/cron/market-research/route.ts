import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCronSecret } from "@/lib/env";
import { runRoleResearch } from "@/lib/server/research";
import { getApiAdmin, json, UUID } from "@/lib/server/api";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Market-research pipeline, one small step per request so each stays inside serverless time limits:
 *   {phase:"start"}                         -> creates a run, returns the roles to process
 *   {phase:"role", runId, roleId}           -> reviews earlier suggestions + researches one role
 *   {phase:"finish", runId}                 -> closes the run with its final status
 * Callers: the scheduled Netlify function (Bearer CRON_SECRET) or a signed-in admin ("Run now").
 */
const body = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal("start") }),
  z.object({ phase: z.literal("role"), runId: z.string().regex(UUID), roleId: z.string().regex(UUID) }),
  z.object({ phase: z.literal("finish"), runId: z.string().regex(UUID) }),
]);

function bearerOk(req: Request): boolean {
  const secret = getCronSecret();
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const viaCron = bearerOk(req);
  const adminCtx = viaCron ? null : await getApiAdmin();
  if (!viaCron && !adminCtx) return json({ error: "forbidden" }, 403);

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_request" }, 400);
  const admin = createAdminClient();
  const b = parsed.data;

  if (b.phase === "start") {
    const { data: roles } = await admin.from("roles").select("id,name").eq("is_active", true).order("name");
    const { data: run, error } = await admin
      .from("market_research_runs")
      .insert({ trigger_source: viaCron ? "cron" : "manual", roles_total: roles?.length ?? 0, model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct" })
      .select("id,started_at")
      .single();
    if (error || !run) return json({ error: "run_failed" }, 500);
    return json({ runId: run.id, startedAt: run.started_at, roles: roles ?? [] });
  }

  const { data: run } = await admin.from("market_research_runs").select("*").eq("id", b.runId).maybeSingle();
  if (!run || run.status !== "running") return json({ error: "run_not_active" }, 409);

  if (b.phase === "role") {
    try {
      const r = await runRoleResearch(b.roleId, run.id, run.started_at);
      await admin
        .from("market_research_runs")
        .update({
          roles_ok: run.roles_ok + (r.error ? 0 : 1),
          suggestions_created: run.suggestions_created + r.created,
          suggestions_applied: run.suggestions_applied + r.approved,
          error: r.error ? `${r.roleName}: ${r.error}`.slice(0, 900) : run.error,
        })
        .eq("id", run.id);
      return json({ result: r });
    } catch {
      return json({ error: "role_failed" }, 500);
    }
  }

  const status = run.roles_ok === 0 && run.roles_total > 0 ? "failed" : run.roles_ok < run.roles_total ? "partial" : "succeeded";
  await admin.from("market_research_runs").update({ status, finished_at: new Date().toISOString() }).eq("id", run.id);
  if (status !== "failed") {
    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
    for (const a of admins ?? []) {
      await admin.rpc("create_notification", {
        p_user: a.id,
        p_type: "trends",
        p_title: "Market trends refreshed",
        p_body: `${run.roles_ok} of ${run.roles_total} roles updated. ${run.suggestions_created} new suggested changes.`,
        p_link: "/admin/roles",
      });
    }
  }
  return json({ status });
}
