import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteReports, r2Configured } from "@/lib/r2";
import { friendlyError, isKnownCode } from "@/lib/server/errors";
import { getApiAdmin, json, UUID } from "@/lib/server/api";

export const runtime = "nodejs";

/**
 * Approve or deny an account-deletion request. On approval the student's stored R2 reports are removed
 * FIRST; if that fails the deletion is aborted so no orphaned personal data is left behind.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getApiAdmin();
  if (!ctx) return json({ error: "forbidden", message: friendlyError("forbidden") }, 403);
  const parsed = z.object({ approve: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!UUID.test(id) || !parsed.success) return json({ error: "invalid_request" }, 400);

  if (parsed.data.approve) {
    const { data: request } = await ctx.supabase.from("deletion_requests").select("user_id,status").eq("id", id).maybeSingle();
    if (!request || request.status !== "pending") return json({ error: "request_not_pending", message: friendlyError("request_not_pending") }, 409);
    if (request.user_id) {
      const { data: reports } = await createAdminClient().from("reports").select("storage_key").eq("user_id", request.user_id);
      const keys = (reports ?? []).map((r) => r.storage_key);
      if (keys.length > 0) {
        try {
          if (!r2Configured()) throw new Error("r2_not_configured");
          await deleteReports(keys);
        } catch {
          return json({ error: "storage_cleanup_failed", message: "We could not remove the student's stored reports, so nothing was deleted. Check the R2 configuration and try again." }, 502);
        }
      }
    }
  }

  const { error } = await ctx.supabase.rpc("admin_resolve_deletion", { p_id: id, p_approve: parsed.data.approve });
  if (error) {
    const code = error.message.trim();
    return json({ error: code, message: friendlyError(code) }, isKnownCode(code) ? 409 : 500);
  }
  return json({ ok: true });
}
