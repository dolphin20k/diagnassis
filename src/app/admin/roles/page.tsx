import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { PageHeader, StateBlock } from "@/components/ui/States";
import { AddRoleButton, PromoteButton, RunResearch } from "@/components/admin/RoleTools";
import { cn } from "@/components/ui/cn";
import { fmtDate } from "@/lib/format";
import type { SkillSuggestionRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Roles & skills" };

const TABS = [["roles", "Roles"], ["suggested", "Suggested changes"], ["roles-typed", "Student-typed roles"], ["skills-typed", "Student-typed skills"]] as const;
const KIND: Record<string, string> = { add_skill: "Add skill", remove_skill: "Remove skill", raise_weight: "Raise weight", lower_weight: "Lower weight" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as (typeof TABS)[number][0]) : "roles";
  const supabase = await createClient();
  const [rolesQ, sugQ, typedQ, skillsQ, runQ] = await Promise.all([
    supabase.from("roles").select("id,name,is_active,last_reviewed_at,role_skills(skill_id)").order("name"),
    supabase.from("skill_suggestions").select("*,roles(name)").order("suggested_at", { ascending: false }).limit(60),
    supabase.from("custom_role_estimates").select("*").is("promoted_role_id", null).order("request_count", { ascending: false }).limit(50),
    supabase.rpc("admin_typed_skills"),
    supabase.from("market_research_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (rolesQ.error) return <><PageHeader title="Roles & skills" /><StateBlock tone="error" icon="cloud-off" title="Something went wrong loading this page" body="Nothing has been lost. Check your connection and try again." /></>;
  const roles = (rolesQ.data ?? []) as unknown as { id: string; name: string; is_active: boolean; last_reviewed_at: string | null; role_skills: unknown[] }[];
  const sugs = (sugQ.data ?? []) as unknown as (SkillSuggestionRow & { roles: { name: string } | { name: string }[] | null })[];
  const typed = typedQ.data ?? [];
  const typedSkills = skillsQ.data ?? [];
  const counts: Record<string, number> = { roles: roles.length, suggested: sugs.filter((s) => s.status === "suggested").length, "roles-typed": typed.length, "skills-typed": typedSkills.length };
  const last = runQ.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Roles & skills" subtitle="Curated roles, the skills they require, and what the automatic research suggests." action={<div className="flex flex-wrap gap-2"><AddRoleButton /></div>} />
      <nav aria-label="Sections" className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => <Link key={k} href={`?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold hover:no-underline", tab === k ? "border-primary bg-primary text-white hover:text-white" : "border-border bg-surface text-ink")}>{l}{counts[k]! > 0 && k !== "roles" ? <span className={cn("rounded-full px-1.5 text-xs", tab === k ? "bg-white/25" : "bg-indigo-50 text-primary-dark")}>{counts[k]}</span> : null}</Link>)}
      </nav>

      {tab === "roles" ? (
        roles.length === 0 ? <StateBlock icon="briefcase" title="No roles yet" body="Add your first curated role to start running diagnostics." /> : (
          <ul className="grid gap-3">
            {roles.map((r) => (
              <li key={r.id}><Link href={`/admin/roles/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-5 shadow-card hover:no-underline"><div><p className="font-display text-lg font-bold text-ink">{r.name} {!r.is_active ? <Badge tone="neutral">Inactive</Badge> : null}</p><p className="text-sm text-ink-2">{r.role_skills.length} required skills · {r.last_reviewed_at ? `Reviewed ${fmtDate(r.last_reviewed_at)}` : "Not reviewed yet"}</p></div><Icon name="chevron-right" className="text-ink-3" /></Link></li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "suggested" ? (
        <div className="flex flex-col gap-4">
          <Card>
            <p className="text-[15px]">Suggested by the automatic market research that runs every 2 days. Changes are reviewed and applied by AI on the following run, and every change is bounded so a single run can never reshape a role. Research uses the AI model&apos;s general knowledge, not live job-listing data.</p>
            <div className="mt-4"><RunResearch last={last ? { status: last.status, startedAt: last.started_at, created: last.suggestions_created, applied: last.suggestions_applied } : null} /></div>
          </Card>
          {sugs.length === 0 ? <StateBlock icon="sparkles" title="No suggestions yet" body="Suggestions appear after the first automatic research run." /> : (
            <ul className="grid gap-3">
              {sugs.map((s) => {
                const role = Array.isArray(s.roles) ? s.roles[0]?.name : s.roles?.name;
                const tone: Tone = s.status === "approved" ? "strong" : s.status === "rejected" ? "neutral" : "attention";
                return (
                  <li key={s.id} className="rounded-lg bg-surface p-5 shadow-card">
                    <div className="flex flex-wrap items-center gap-2"><Badge tone="info">{role}</Badge><Badge tone="fill">{KIND[s.kind]}</Badge><strong className="font-display">{s.skill_name}</strong><span className="text-ink-2">{s.from_weight !== null ? `${s.from_weight}%` : "Not required"} → {s.to_weight !== null ? `${s.to_weight}%` : "Remove"}</span><Badge tone={tone}>{s.status === "approved" ? "Approved by AI" : s.status === "rejected" ? "Rejected by AI" : "Awaiting AI review"}</Badge></div>
                    <p className="mt-2 text-[15px]">{s.rationale}</p>
                    <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2"><span className="inline-flex items-center gap-1"><Icon name="calendar" size={13} />Suggested on {fmtDate(s.suggested_at)}</span>{s.decided_at ? <span className="inline-flex items-center gap-1 text-emerald-700"><Icon name="circle-check" size={13} />{s.status === "approved" ? "Approved" : "Rejected"} by AI on {fmtDate(s.decided_at)}{s.applied ? " and applied" : ""}</span> : null}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "roles-typed" ? (
        typed.length === 0 ? <StateBlock icon="inbox" title="Nothing to review" body="Roles that students type in themselves appear here with AI-estimated requirements." /> : (
          <ul className="grid gap-3">
            {typed.map((t) => (
              <li key={t.id} className="rounded-lg bg-surface p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-display text-lg font-bold">{t.name}</p><p className="text-sm text-ink-2">Typed {t.request_count} time{t.request_count === 1 ? "" : "s"} · estimated {fmtDate(t.created_at)}</p></div><PromoteButton id={t.id} name={t.name} /></div>
                <p className="mt-2 flex flex-wrap gap-1.5">{t.requirements.map((r) => <Badge key={r.skill} tone="info">{r.skill} {Math.round(r.weight)}%</Badge>)}</p>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "skills-typed" ? (
        typedSkills.length === 0 ? <StateBlock icon="inbox" title="Nothing to review" body="Skills students add that are not in the catalogue appear here." /> : (
          <Card><table className="w-full text-left text-sm"><thead><tr className="text-xs uppercase text-ink-2"><th scope="col" className="pb-2 font-semibold">Skill</th><th scope="col" className="pb-2 font-semibold">Students</th></tr></thead><tbody className="divide-y divide-border">{typedSkills.map((s) => <tr key={s.skill}><th scope="row" className="py-2.5 font-semibold">{s.skill}</th><td className="py-2.5 tabular-nums">{s.students}</td></tr>)}</tbody></table></Card>
        )
      ) : null}
    </div>
  );
}
