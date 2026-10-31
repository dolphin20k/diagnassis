import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireStudent } from "@/lib/server/auth";
import { PageHeader } from "@/components/ui/States";
import { SettingsPanels } from "@/components/student/SettingsPanels";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await requireStudent();
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: deletion }, { data: acceptances }] = await Promise.all([
    supabase.from("deletion_requests").select("id,status,requested_at").eq("user_id", profile.id).eq("status", "pending").maybeSingle(),
    supabase.from("policy_acceptances").select("accepted_at,policies(type,version)").order("accepted_at", { ascending: false }),
  ]);
  const accepted = ((acceptances ?? []) as unknown as { accepted_at: string; policies: { type: string; version: string } | { type: string; version: string }[] | null }[])
    .map((a) => ({ at: a.accepted_at, p: Array.isArray(a.policies) ? a.policies[0] : a.policies }))
    .filter((a): a is { at: string; p: { type: string; version: string } } => !!a.p);
  const providers = (user?.app_metadata?.providers as string[] | undefined) ?? [];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsPanels
        name={profile.full_name}
        email={profile.email}
        prefs={profile.notification_prefs}
        hasPassword={providers.includes("email")}
        deletionPending={deletion ? deletion.requested_at : null}
        accepted={accepted}
      />
    </div>
  );
}
