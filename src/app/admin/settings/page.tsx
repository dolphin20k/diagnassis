import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { getAttemptLimit } from "@/lib/server/student";
import { PageHeader } from "@/components/ui/States";
import { AdminSettings } from "@/components/admin/AdminSettings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await requireAdmin();
  const limit = await getAttemptLimit();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <AdminSettings email={profile.email} name={profile.full_name} limit={limit} prefs={profile.notification_prefs} />
    </div>
  );
}
