import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function getApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function getApiAdmin() {
  const ctx = await getApiUser();
  if (!ctx) return null;
  const { data } = await ctx.supabase.from("profiles").select("role").eq("id", ctx.user.id).maybeSingle();
  return data?.role === "admin" ? ctx : null;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads a JSON request body but refuses anything larger than `maxBytes` (default 32 KB; every route here takes tiny payloads).
 * Returns null for oversized, empty or malformed bodies. Bounds memory/CPU before any schema validation runs.
 */
export async function readJson(req: Request, maxBytes = 32_768): Promise<unknown> {
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) return null;
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel().catch(() => undefined); return null; }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    return null;
  }
}
