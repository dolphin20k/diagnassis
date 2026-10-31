"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/server/errors";
import { zodFieldErrors, type ActionResult } from "@/lib/server/action-result";
import { feedbackSchema, profileSchema, type ProfileInput } from "@/lib/validation";
import { sanitizeLabel, sanitizeSkillList } from "@/lib/sanitize";
import type { NotificationPrefs } from "@/lib/types/database";
import { z } from "zod";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}
const NOT_SIGNED_IN = { ok: false, error: "Your session has expired. Please log in again." } as const;

export async function saveProfile(input: ProfileInput): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return NOT_SIGNED_IN;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      full_name: sanitizeLabel(v.name, 120),
      college: sanitizeLabel(v.college, 160),
      branch: v.branch,
      year_of_study: v.year,
      skills: sanitizeSkillList(v.skills),
      target_role_id: v.roleId,
      target_role_other: v.roleId ? null : sanitizeLabel(v.roleOther ?? "", 80),
      details_completed: true,
      details_skipped: false,
    })
    .eq("id", ctx.user.id);
  if (error) return { ok: false, error: "We could not save your details. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function skipDetails(): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return NOT_SIGNED_IN;
  const { error } = await ctx.supabase.from("profiles").update({ details_skipped: true }).eq("id", ctx.user.id);
  if (error) return { ok: false, error: "Something went wrong. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function acceptPolicies(ids: string[]): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return NOT_SIGNED_IN;
  const parsed = z.array(z.string().uuid()).min(1).max(4).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Nothing to accept." };
  const { error } = await ctx.supabase.rpc("accept_policies", { p_policy_ids: parsed.data });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx || !z.string().uuid().safeParse(id).success) return NOT_SIGNED_IN;
  await ctx.supabase.rpc("mark_notification_read", { p_id: id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return NOT_SIGNED_IN;
  await ctx.supabase.rpc("mark_all_notifications_read");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function submitFeedback(input: { rating: number; topic: string | null; message: string; attemptId?: string | null }): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return NOT_SIGNED_IN;
  const attemptId = input.attemptId ? z.string().uuid().safeParse(input.attemptId) : null;
  if (attemptId && !attemptId.success) return { ok: false, error: "Invalid result." };
  if (attemptId?.success) {
    // Rating a result: the comment is optional.
    const r = z.object({ rating: z.number().int().min(1, "Choose a rating from 1 to 5.").max(5), message: z.string().trim().max(2000) }).safeParse(input);
    if (!r.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(r.error.issues) };
    const { error } = await ctx.supabase.from("feedback").insert({ user_id: ctx.user.id, attempt_id: attemptId.data, kind: "result", rating: r.data.rating, message: r.data.message });
    if (error) return { ok: false, error: error.code === "23505" ? "You have already rated this result." : "We could not send your rating. Please try again." };
    return { ok: true };
  }
  const parsed = feedbackSchema.safeParse({ rating: input.rating, topic: input.topic, message: input.message });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const { error } = await ctx.supabase.from("feedback").insert({ user_id: ctx.user.id, kind: "general", rating: parsed.data.rating, topic: parsed.data.topic, message: parsed.data.message });
  if (error) return { ok: false, error: "We could not send your feedback. Please try again." };
  return { ok: true };
}

export async function updateSettings(input: { name?: string; prefs?: NotificationPrefs }): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return NOT_SIGNED_IN;
  const patch: { full_name?: string; notification_prefs?: NotificationPrefs } = {};
  if (input.name !== undefined) {
    const n = sanitizeLabel(input.name, 120);
    if (n.length < 1) return { ok: false, error: "Enter your name.", fieldErrors: { name: "Enter your name." } };
    patch.full_name = n;
  }
  if (input.prefs) {
    const p = z.object({ results: z.boolean(), report: z.boolean(), platform: z.boolean(), policy: z.boolean(), deletion: z.boolean().optional(), roles: z.boolean().optional(), trends: z.boolean().optional(), rating: z.boolean().optional() }).safeParse(input.prefs);
    if (!p.success) return { ok: false, error: "Invalid preferences." };
    patch.notification_prefs = p.data;
  }
  const { error } = await ctx.supabase.from("profiles").update(patch).eq("id", ctx.user.id);
  if (error) return { ok: false, error: "We could not save your settings. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function requestDeletion(reason: string): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return NOT_SIGNED_IN;
  const { error } = await ctx.supabase.rpc("request_account_deletion", { p_reason: reason.trim().slice(0, 500) });
  if (error) return { ok: false, error: friendlyError(error.message) };
  revalidatePath("/settings");
  return { ok: true };
}

export async function cancelDeletion(): Promise<ActionResult> {
  const ctx = await authed();
  if (!ctx) return NOT_SIGNED_IN;
  await ctx.supabase.rpc("cancel_account_deletion");
  revalidatePath("/settings");
  return { ok: true };
}
