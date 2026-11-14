import type { Metadata } from "next";
import { getCurrentUser, requireAdmin } from "@/lib/server/auth";
import { getAttemptLimit } from "@/lib/server/student";
import { PageHeader } from "@/components/ui/States";
import { AdminSettings } from "@/components/admin/AdminSettings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await requireAdmin();
  const [limit, user] = await Promise.all([getAttemptLimit(), getCurrentUser()]);
  const providers = (user?.app_metadata?.providers as string[] | undefined) ?? [];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <AdminSettings email={profile.email} name={profile.full_name} limit={limit} prefs={profile.notification_prefs} hasPassword={providers.includes("email")} />
    </div>
  );
}
