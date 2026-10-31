import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/server/auth";
import { getCatalog, getTargetRoleLabel } from "@/lib/server/student";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/States";
import { ProfileEditor } from "@/components/student/ProfileEditor";
import { initials } from "@/lib/format";

export const metadata: Metadata = { title: "My Profile" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const profile = await requireStudent();
  const { edit } = await searchParams;
  const [catalog, role] = await Promise.all([getCatalog(), getTargetRoleLabel(profile)]);
  const items: [string, string | null][] = [["Name", profile.full_name], ["Email", profile.email], ["College", profile.college], ["Branch", profile.branch], ["Year of study", profile.year_of_study ? `${profile.year_of_study} year` : null]];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="My Profile" action={<ProfileEditor profile={profile} roles={catalog.roles} skills={catalog.skills} startOpen={edit === "1"} />} />
      <Card>
        <div className="mb-5 flex items-center gap-4"><span className="grid size-16 place-items-center rounded-full bg-primary font-display text-xl font-bold text-white" aria-hidden>{initials(profile.full_name || profile.email)}</span><div><p className="font-display text-xl font-bold">{profile.full_name || "Your name"}</p><p className="text-ink-2">{profile.email}</p></div></div>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {items.slice(2).map(([k, v]) => <div key={k}><dt className="text-[13px] text-ink-2">{k}</dt><dd className="font-semibold">{v || <span className="font-normal text-ink-3">Not added</span>}</dd></div>)}
          <div><dt className="text-[13px] text-ink-2">Target career path</dt><dd className="font-semibold">{role || <span className="font-normal text-ink-3">Not added</span>}</dd></div>
        </dl>
      </Card>
      <Card title="Current skills" subtitle="Skills you claim are tested in your diagnostic.">
        {profile.skills.length ? <ul className="flex flex-wrap gap-2">{profile.skills.map((s) => <li key={s}><Badge tone="info">{s}</Badge></li>)}</ul> : <p className="text-ink-2">No skills added yet.</p>}
      </Card>
      <p className="text-sm text-ink-2"><Link href="/settings">Account settings</Link> · <Link href="/feedback">Send feedback</Link></p>
    </div>
  );
}
