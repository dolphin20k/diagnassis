import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PageHeader, StateBlock } from "@/components/ui/States";
import { fmtRelative, fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Admin dashboard" };

const KIND_ICON: Record<string, IconName> = { registration: "user-plus", diagnostic_completed: "chart-column", feedback: "star", deletion_requested: "user-x", deletion_approved: "user-x", policy_published: "shield-check", role_updated: "briefcase", role_created: "briefcase" };

function Stat({ icon, label, value, sub, href }: { icon: IconName; label: string; value: React.ReactNode; sub?: string; href?: string }) {
  const body = (
    <div className="flex h-full items-center gap-4 rounded-lg bg-surface p-5 shadow-card">
      <span className="grid size-12 place-items-center rounded-lg bg-indigo-50 text-primary"><Icon name={icon} size={22} /></span>
      <div><p className="text-[13px] text-ink-2">{label}</p><p className="font-display text-[28px] font-extrabold leading-tight">{value}</p>{sub ? <p className="text-xs text-ink-2">{sub}</p> : null}</div>
    </div>
  );
  return href ? <Link href={href} className="block hover:no-underline">{body}</Link> : body;
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: d, error } = await supabase.rpc("admin_dashboard");
  if (error || !d) return <StateBlock tone="error" icon="cloud-off" title="Something went wrong loading this page" body="Nothing has been lost. Check your connection and try again." />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" subtitle="How DIAGNASSIS is being used." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon="users" label="Registered students" value={d.students_total} sub={`${d.students_new_7d} new in 7 days`} href="/admin/students" />
        <Stat icon="clipboard-check" label="Completed diagnostics" value={d.diagnostics_total} sub={`${d.diagnostics_7d} in 7 days`} href="/admin/analytics" />
        <Stat icon="gauge" label="Average readiness score" value={d.avg_score ?? "–"} sub={d.diagnostics_total ? "across all completed diagnostics" : "no results yet"} href="/admin/analytics" />
        <Stat icon="star" label="Average rating" value={d.avg_rating ?? "–"} sub={`${d.feedback_total} ratings`} href="/admin/feedback" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon="user-x" label="Deletion requests pending" value={d.pending_deletions} href="/admin/deletions" />
        <Stat icon="sparkles" label="Suggested skill changes" value={d.suggestions_pending} href="/admin/roles?tab=suggested" />
        <Stat icon="briefcase" label="Student-typed roles to review" value={d.typed_roles} href="/admin/roles?tab=roles-typed" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Recent activity">
          {d.recent_activity.length === 0 ? <p className="text-ink-2">Numbers and activity appear once students start using the platform.</p> : (
            <ul className="divide-y divide-border">
              {d.recent_activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-50 text-primary"><Icon name={KIND_ICON[a.kind] ?? "info"} size={16} /></span><div className="min-w-0"><p className="text-[15px]">{a.summary}</p><p className="text-xs text-ink-2">{a.detail ? `${a.detail} · ` : ""}{fmtRelative(a.created_at)}</p></div></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Market research" subtitle="Runs automatically every two days">
          {d.last_research ? (
            <p className="text-[15px]">Last run <strong>{fmtDateTime(d.last_research.started_at)}</strong> finished as <strong>{d.last_research.status}</strong>. {d.last_research.suggestions_created} changes suggested, {d.last_research.suggestions_applied} applied.</p>
          ) : <p className="text-ink-2">No research run has completed yet. Start one from Roles &amp; skills.</p>}
          <Link href="/admin/roles?tab=suggested" className="mt-3 inline-block text-sm font-semibold">Open suggested changes</Link>
        </Card>
      </div>
    </div>
  );
}
