import { pingNvidia } from "@/lib/ai/nvidia";
import { r2Configured } from "@/lib/r2";
import { getApiAdmin, json } from "@/lib/server/api";

export const runtime = "nodejs";

/** Integration status for the admin Settings page. Never returns key material. */
export async function GET() {
  if (!(await getApiAdmin())) return json({ error: "forbidden" }, 403);
  const ai = await pingNvidia();
  return json({
    ai,
    r2: { configured: r2Configured() },
    cron: { secretConfigured: !!process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 24 },
    serviceRole: { configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
  });
}
