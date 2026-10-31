import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const [sug, typed, del, notifs] = await Promise.all([
    supabase.from("skill_suggestions").select("id", { count: "exact", head: true }).eq("status", "suggested"),
    supabase.from("custom_role_estimates").select("id", { count: "exact", head: true }).is("promoted_role_id", null),
    supabase.from("deletion_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return (
    <AdminShell name={profile.full_name || profile.email} counts={{ queue: (sug.count ?? 0) + (typed.count ?? 0), deletions: del.count ?? 0, notifs: notifs.count ?? 0 }}>
      {children}
    </AdminShell>
  );
}
