import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CallLogger } from "@/lib/ai/nvidia";

/** Persists AI call outcomes (no prompts, no responses) for rate limiting and admin monitoring. */
export function dbLogger(userId: string | null): CallLogger {
  return async (log) => {
    try {
      await createAdminClient().from("ai_requests").insert({
        user_id: userId,
        kind: log.kind,
        model: log.model,
        ok: log.ok,
        latency_ms: log.latencyMs,
        error: log.error ?? null,
      });
    } catch {
      /* logging must never break the user flow */
    }
  };
}

/** Allows at most `limit` AI-backed requests of this kind per user per hour. */
export async function withinRateLimit(userId: string, kind: string, limit: number): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await createAdminClient()
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", since);
  if (error) return true; // fail open on telemetry errors; the AI call itself is still bounded by timeouts
  return (count ?? 0) < limit;
}
