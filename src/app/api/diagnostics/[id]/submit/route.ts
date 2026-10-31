import { friendlyError, isKnownCode } from "@/lib/server/errors";
import { getApiUser, json, UUID } from "@/lib/server/api";

export const runtime = "nodejs";

/** Grades the attempt on the server (answer keys never leave the database). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return json({ error: "invalid_id" }, 400);
  const ctx = await getApiUser();
  if (!ctx) return json({ error: "unauthenticated" }, 401);
  const { data, error } = await ctx.supabase.rpc("submit_attempt", { p_attempt: id });
  if (error) {
    const code = error.message.trim();
    return json({ error: code, message: friendlyError(code) }, isKnownCode(code) ? 404 : 500);
  }
  return json({ result: data });
}
