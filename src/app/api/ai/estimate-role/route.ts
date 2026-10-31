import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateRoleRequirements, RoleNotPlausibleError } from "@/lib/ai/features";
import { AiError } from "@/lib/ai/nvidia";
import { AiNotConfiguredError } from "@/lib/env";
import { dbLogger, withinRateLimit } from "@/lib/ai/log";
import { getApiUser, json } from "@/lib/server/api";
import { roleKey, sanitizeLabel } from "@/lib/sanitize";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({ role: z.string().trim().min(2).max(80) });

/** Estimates requirements for a student-typed ("Others") role with the NVIDIA model and caches them. */
export async function POST(req: Request) {
  const ctx = await getApiUser();
  if (!ctx) return json({ error: "unauthenticated" }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_role", message: "Type the role you are aiming for." }, 400);

  const name = sanitizeLabel(parsed.data.role, 80);
  if (name.length < 2) return json({ error: "invalid_role", message: "Type the role you are aiming for." }, 400);
  const key = roleKey(name);
  const admin = createAdminClient();

  // A curated role with the same name should be used instead of an estimate.
  const { data: curated } = await ctx.supabase.from("roles").select("id,name").eq("is_active", true);
  const match = (curated ?? []).find((r) => roleKey(r.name) === key);
  if (match) return json({ curated: { id: match.id, name: match.name } });

  const { data: existing } = await admin.from("custom_role_estimates").select("*").eq("name_key", key).maybeSingle();
  if (existing) {
    await admin.from("custom_role_estimates").update({ request_count: existing.request_count + 1 }).eq("id", existing.id);
    return json({ name: existing.name, requirements: existing.requirements, ai_estimated: true, cached: true });
  }

  if (!(await withinRateLimit(ctx.user.id, "estimate_role", 10))) {
    return json({ error: "rate_limited", message: "You have reached the hourly limit for custom roles. Try again later." }, 429);
  }
  try {
    const { requirements, model } = await estimateRoleRequirements(name, dbLogger(ctx.user.id));
    const ins = await admin.from("custom_role_estimates").insert({ name, name_key: key, requirements, model }).select("*").single();
    if (ins.error) {
      // Lost a race with a concurrent identical request: use the stored row.
      const { data: again } = await admin.from("custom_role_estimates").select("*").eq("name_key", key).maybeSingle();
      if (!again) throw ins.error;
      return json({ name: again.name, requirements: again.requirements, ai_estimated: true, cached: true });
    }
    return json({ name, requirements, ai_estimated: true, cached: false });
  } catch (e) {
    if (e instanceof RoleNotPlausibleError) return json({ error: "role_not_plausible", message: e.reason }, 422);
    if (e instanceof AiNotConfiguredError) return json({ error: "ai_unavailable", message: "AI estimation is not configured on this server." }, 503);
    if (e instanceof AiError) return json({ error: "ai_failed", message: "We could not estimate that role right now. Try again in a moment." }, 502);
    return json({ error: "server_error", message: "Something went wrong. Please try again." }, 500);
  }
}
