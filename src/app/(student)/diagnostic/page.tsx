import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/server/auth";
import { getAttemptLimit, getCatalog, getMyAttempts } from "@/lib/server/student";
import { createClient } from "@/lib/supabase/server";
import { DiagnosticWizard } from "@/components/student/DiagnosticWizard";
import { StateBlock } from "@/components/ui/States";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Diagnostic" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await requireStudent();
  const [attempts, limit, catalog] = await Promise.all([getMyAttempts(), getAttemptLimit(), getCatalog()]);
  const inProgress = attempts.find((a) => a.status === "in_progress");
  if (inProgress) redirect(`/diagnostic/${inProgress.id}`);
  if (!profile.details_completed) {
    return <StateBlock icon="lock" title="Add your details first" body="Diagnostics are locked until you add your college, branch, year, skills and target role." action={<LinkButton href="/profile?edit=1">Add my details</LinkButton>} />;
  }
  if (attempts.length >= limit) {
    return (
      <StateBlock
        icon="circle-pause"
        title="You have used all your diagnostics"
        body={`Each account can run ${limit} diagnostics. Review your history to see how your score changed, and use your action plan to keep improving.`}
        action={<LinkButton href="/history">View history</LinkButton>}
      />
    );
  }
  // Requirements for the preview (overview step) come from the same tables the attempt snapshots.
  const supabase = await createClient();
  const { data } = await supabase.from("role_skills").select("role_id,weight,skills(name)").order("weight", { ascending: false });
  const requirements: Record<string, { skill: string; weight: number }[]> = {};
  for (const r of (data ?? []) as unknown as { role_id: string; weight: number; skills: { name: string } | { name: string }[] | null }[]) {
    const s = Array.isArray(r.skills) ? r.skills[0] : r.skills;
    if (s) (requirements[r.role_id] ??= []).push({ skill: s.name, weight: Number(r.weight) });
  }
  return (
    <DiagnosticWizard
      roles={catalog.roles}
      catalog={catalog.skills}
      requirements={requirements}
      initialSkills={profile.skills}
      initialRoleId={profile.target_role_id}
      initialOther={profile.target_role_other ?? ""}
      attemptsLeft={limit - attempts.length}
    />
  );
}
