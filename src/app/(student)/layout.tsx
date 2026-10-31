import { redirect } from "next/navigation";
import { StudentShell } from "@/components/layout/StudentShell";
import { DetailsGate } from "@/components/student/DetailsGate";
import { requireStudent } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { getAttemptLimit, getCatalog, getMyAttempts, getTargetRoleLabel, getUnreadCount } from "@/lib/server/student";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStudent();
  const supabase = await createClient();

  // A newly published policy version must be accepted before anything else (design: accept-update).
  const { data: pending } = await supabase.rpc("pending_policies");
  if (pending && pending.length > 0) redirect("/accept-policies");

  const [unread, attempts, limit, catalog] = await Promise.all([getUnreadCount(), getMyAttempts(), getAttemptLimit(), getCatalog()]);
  const roleLabel = await getTargetRoleLabel(profile);
  const showDetails = !profile.details_completed && !profile.details_skipped;
  return (
    <StudentShell name={profile.full_name || profile.email} unread={unread} attemptsLeft={Math.max(0, limit - attempts.length)} limit={limit}>
      {children}
      {showDetails ? <DetailsGate profile={profile} roles={catalog.roles} skills={catalog.skills} roleLabel={roleLabel} /> : null}
    </StudentShell>
  );
}
