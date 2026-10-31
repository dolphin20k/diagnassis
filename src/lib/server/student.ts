import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AttemptRow, ProfileRow } from "@/lib/types/database";

export type AttemptSummary = Pick<AttemptRow, "id" | "role_name" | "status" | "score" | "band" | "result" | "submitted_at" | "started_at" | "is_custom_role" | "trends_updated_at" | "declining_skills">;

export const getAttemptLimit = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "attempt_limit").maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : 5;
});

export const getMyAttempts = cache(async (): Promise<AttemptSummary[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attempts")
    .select("id,role_name,status,score,band,result,submitted_at,started_at,is_custom_role,trends_updated_at,declining_skills")
    .order("started_at", { ascending: true });
  return (data ?? []) as AttemptSummary[];
});

export const getUnreadCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
});

export async function getTargetRoleLabel(p: ProfileRow): Promise<string | null> {
  if (p.target_role_other) return p.target_role_other;
  if (!p.target_role_id) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("roles").select("name").eq("id", p.target_role_id).maybeSingle();
  return data?.name ?? null;
}

export const getCatalog = cache(async () => {
  const supabase = await createClient();
  const [roles, skills] = await Promise.all([
    supabase.from("roles").select("id,name").eq("is_active", true).order("name"),
    supabase.from("skills").select("name").order("name"),
  ]);
  return { roles: roles.data ?? [], skills: (skills.data ?? []).map((s) => s.name) };
});
