import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/server/api";
import { Icon } from "@/components/ui/Icon";
import { RoleEditor } from "@/components/admin/RoleEditor";
import { fmtDate } from "@/lib/format";
import type { SkillPriority, SkillTrend } from "@/lib/types/database";

export const metadata: Metadata = { title: "Edit role" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: role } = await supabase.from("roles").select("*").eq("id", id).maybeSingle();
  if (!role) notFound();
  const { data } = await supabase.from("role_skills").select("weight,priority,trend,trend_change,skills(name)").eq("role_id", id).order("weight", { ascending: false });
  const items = ((data ?? []) as unknown as { weight: number; priority: SkillPriority; trend: SkillTrend; trend_change: string | null; skills: { name: string } | { name: string }[] | null }[])
    .map((r) => ({ skill: (Array.isArray(r.skills) ? r.skills[0]?.name : r.skills?.name) ?? "", weight: Number(r.weight), priority: r.priority, trend: r.trend, trendChange: r.trend_change }))
    .filter((r) => r.skill);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/roles" className="inline-flex items-center gap-1.5 text-sm font-semibold"><Icon name="arrow-left" size={16} /> Roles &amp; skills</Link>
      <RoleEditor roleId={role.id} name={role.name} active={role.is_active} reviewed={role.last_reviewed_at ? fmtDate(role.last_reviewed_at) : null} declining={role.declining_skills} initial={items} />
    </div>
  );
}
