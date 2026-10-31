"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/server/errors";
import { zodFieldErrors, type ActionResult } from "@/lib/server/action-result";
import { policyPublishSchema, roleItemsSchema } from "@/lib/validation";
import { sanitizeLabel } from "@/lib/sanitize";
import type { Json } from "@/lib/types/database";

async function adminCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("is_admin");
  return data === true ? { supabase, user } : null;
}
const DENIED = { ok: false, error: "You do not have permission to do that." } as const;

export async function publishPolicy(input: unknown): Promise<ActionResult> {
  const ctx = await adminCtx();
  if (!ctx) return DENIED;
  const parsed = policyPublishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const { error } = await ctx.supabase.rpc("admin_publish_policy", { p_type: parsed.data.type, p_version: parsed.data.version, p_body: parsed.data.body, p_note: parsed.data.note ?? null });
  if (error) return { ok: false, error: friendlyError(error.message), fieldErrors: /version/.test(error.message) ? { version: friendlyError(error.message) } : undefined };
  revalidatePath("/admin/policies");
  return { ok: true };
}

export async function saveRoleSkills(roleId: string, items: unknown): Promise<ActionResult> {
  const ctx = await adminCtx();
  if (!ctx || !z.string().uuid().safeParse(roleId).success) return DENIED;
  const parsed = roleItemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: "Each skill needs a name, a weight above 0 and a priority." };
  const total = Math.round(parsed.data.reduce((a, i) => a + i.weight, 0) * 100) / 100;
  if (Math.abs(total - 100) > 0.01) return { ok: false, error: `Weights must total 100%. They currently total ${total}%.` };
  const { error } = await ctx.supabase.rpc("admin_save_role_skills", { p_role: roleId, p_items: parsed.data.map((i) => ({ ...i, skill: sanitizeLabel(i.skill) })) as unknown as Json });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin/roles");
  return { ok: true };
}

export async function createRole(name: string, items: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await adminCtx();
  if (!ctx) return DENIED;
  const n = sanitizeLabel(name, 80);
  const parsed = roleItemsSchema.safeParse(items);
  if (n.length < 2) return { ok: false, error: "Enter a role name.", fieldErrors: { name: "Enter a role name." } };
  if (!parsed.success) return { ok: false, error: "Each skill needs a name, a weight above 0 and a priority." };
  const total = Math.round(parsed.data.reduce((a, i) => a + i.weight, 0) * 100) / 100;
  if (Math.abs(total - 100) > 0.01) return { ok: false, error: `Weights must total 100%. They currently total ${total}%.` };
  const { data, error } = await ctx.supabase.rpc("admin_create_role", { p_name: n, p_items: parsed.data.map((i) => ({ ...i, skill: sanitizeLabel(i.skill) })) as unknown as Json });
  if (error) return { ok: false, error: error.code === "23505" ? "A role with that name already exists." : friendlyError(error.message) };
  revalidatePath("/admin/roles");
  return { ok: true, data: { id: data } };
}

export async function setRoleActive(roleId: string, active: boolean): Promise<ActionResult> {
  const ctx = await adminCtx();
  if (!ctx || !z.string().uuid().safeParse(roleId).success) return DENIED;
  const { error } = await ctx.supabase.rpc("admin_set_role_active", { p_role: roleId, p_active: active });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin/roles");
  return { ok: true };
}

export async function promoteEstimate(id: string): Promise<ActionResult<{ id: string }>> {
  const ctx = await adminCtx();
  if (!ctx || !z.string().uuid().safeParse(id).success) return DENIED;
  const { data, error } = await ctx.supabase.rpc("admin_promote_custom_role", { p_estimate: id });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/admin/roles");
  return { ok: true, data: { id: data } };
}

export async function setAttemptLimit(limit: number): Promise<ActionResult> {
  const ctx = await adminCtx();
  if (!ctx) return DENIED;
  if (!Number.isInteger(limit)) return { ok: false, error: friendlyError("invalid_limit") };
  const { error } = await ctx.supabase.rpc("admin_set_attempt_limit", { p_limit: limit });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: true };
}
