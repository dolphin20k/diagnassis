import { pingNvidia, probeNvidia } from "@/lib/ai/nvidia";
import { r2Configured } from "@/lib/r2";
import { getApiAdmin, json } from "@/lib/server/api";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Integration status for the admin Settings page. Never returns key material. */
export async function GET() {
  if (!(await getApiAdmin())) return json({ error: "forbidden" }, 403);
  const reach = await pingNvidia();
  // Reachable is not enough: the models must also answer in time. Only probe when a key is configured.
  const probe = reach.detail.includes("not set") ? null : await probeNvidia();
  const ai = probe ? { ok: probe.ok, model: probe.model || reach.model, detail: probe.ok ? `Answered in ${(probe.latencyMs / 1000).toFixed(1)}s` : probe.detail } : reach;
  return json({
    ai,
    r2: { configured: r2Configured() },
    cron: { secretConfigured: !!process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 24 },
    serviceRole: { configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
  });
}
