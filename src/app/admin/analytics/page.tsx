import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { PageHeader, StateBlock } from "@/components/ui/States";
import { SkillBar } from "@/components/ui/SkillBar";
import { Stars } from "@/components/ui/States";
import { Badge, toneForBand } from "@/components/ui/Badge";
import type { AdminAnalytics, Band } from "@/lib/types/database";

export const metadata: Metadata = { title: "Analytics" };
const RANGES = [30, 90, 365];

function DailyChart({ daily }: { daily: AdminAnalytics["daily"] }) {
  const W = 720, H = 200, P = { l: 32, r: 8, t: 12, b: 24 };
  const max = Math.max(1, ...daily.map((d) => Math.max(d.registrations, d.diagnostics)));
  const bw = (W - P.l - P.r) / Math.max(1, daily.length);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const summary = `Daily registrations and completed diagnostics. Total registrations ${daily.reduce((a, d) => a + d.registrations, 0)}, diagnostics ${daily.reduce((a, d) => a + d.diagnostics, 0)}.`;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary}>
        {[0, 0.5, 1].map((g) => <g key={g}><line x1={P.l} x2={W - P.r} y1={y(max * g)} y2={y(max * g)} stroke="#E2E8F0" /><text x={P.l - 6} y={y(max * g) + 4} textAnchor="end" fontSize="10" fill="#94A3B8">{Math.round(max * g)}</text></g>)}
        {daily.map((d, i) => (
          <g key={d.day}>
            <rect x={P.l + i * bw + bw * 0.1} width={Math.max(1, bw * 0.38)} y={y(d.registrations)} height={H - P.b - y(d.registrations)} fill="#4F46E5" rx="1"><title>{d.day}: {d.registrations} registrations</title></rect>
            <rect x={P.l + i * bw + bw * 0.52} width={Math.max(1, bw * 0.38)} y={y(d.diagnostics)} height={H - P.b - y(d.diagnostics)} fill="#06B6D4" rx="1"><title>{d.day}: {d.diagnostics} diagnostics</title></rect>
          </g>
        ))}
        <text x={P.l} y={H - 6} fontSize="10" fill="#64748B">{daily[0]?.day}</text>
        <text x={W - P.r} y={H - 6} textAnchor="end" fontSize="10" fill="#64748B">{daily.at(-1)?.day}</text>
      </svg>
      <figcaption className="mt-2 flex gap-5 text-xs text-ink-2"><span><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-primary" />Registrations</span><span><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-cyan" />Completed diagnostics</span></figcaption>
    </figure>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 90;
  const supabase = await createClient();
  const { data: a, error } = await supabase.rpc("admin_analytics", { p_days: days });
  if (error || !a) return <><PageHeader title="Analytics" /><StateBlock tone="error" icon="cloud-off" title="Something went wrong loading this page" body="Nothing has been lost. Check your connection and try again." /></>;
  const maxGap = Math.max(1, ...a.common_gaps.map((g) => g.total));
  const completion = a.started_in_range ? Math.round((a.completed_in_range / a.started_in_range) * 100) : null;
  const totalRatings = Object.values(a.feedback.distribution).reduce((x, y) => x + y, 0);
  const stats: [string, string | number, string][] = [
    ["Registered students", a.registered_total, `${a.registered_in_range} in the last ${days} days`],
    ["Completed diagnostics", a.completed_in_range, `${a.completed_total} all time`],
    ["Diagnostics started", a.started_in_range, completion === null ? "no starts yet" : `${completion}% completed`],
    ["Average score", a.avg_score ?? "–", `last ${days} days`],
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" action={<nav aria-label="Date range" className="flex gap-2">{RANGES.map((r) => <Link key={r} href={`?days=${r}`} aria-current={r === days ? "true" : undefined} className={`rounded-full border px-4 py-1.5 text-sm font-semibold hover:no-underline ${r === days ? "border-primary bg-primary text-white hover:text-white" : "border-border bg-surface"}`}>{r} days</Link>)}</nav>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([l, v, s]) => <div key={l} className="rounded-lg bg-surface p-5 shadow-card"><p className="text-[13px] text-ink-2">{l}</p><p className="font-display text-[30px] font-extrabold leading-tight">{v}</p><p className="text-xs text-ink-2">{s}</p></div>)}</div>
      <Card title="Diagnostic usage" subtitle="Registrations and completed diagnostics per day"><DailyChart daily={a.daily} /></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Most common skill gaps" subtitle="Skills students most often miss or score weakly on">
          {a.common_gaps.length === 0 ? <p className="text-ink-2">Skill gaps appear once students complete diagnostics.</p> : <div className="flex flex-col gap-3">{a.common_gaps.map((g) => <SkillBar key={g.skill} label={g.skill} value={Math.round((g.total / maxGap) * 100)} status="weak" trailing={`${g.total} (${g.missing} missing)`} />)}</div>}
        </Card>
        <Card title="Usage by role">
          {a.by_role.length === 0 ? <p className="text-ink-2">No completed diagnostics in this range.</p> : (
            <table className="w-full text-left text-sm"><thead><tr className="text-xs uppercase text-ink-2"><th scope="col" className="pb-2 font-semibold">Role</th><th scope="col" className="pb-2 font-semibold">Diagnostics</th><th scope="col" className="pb-2 font-semibold">Avg score</th></tr></thead><tbody className="divide-y divide-border">{a.by_role.map((r) => <tr key={r.role}><th scope="row" className="py-2.5 font-semibold">{r.role}</th><td className="py-2.5 tabular-nums">{r.count}</td><td className="py-2.5 tabular-nums">{r.avg_score ?? "–"}</td></tr>)}</tbody></table>
          )}
        </Card>
        <Card title="Readiness bands">
          <ul className="flex flex-col gap-2">{(["Ready", "Competitive", "Developing", "Early stage"] as Band[]).map((b) => <li key={b} className="flex items-center justify-between"><Badge tone={toneForBand(b)}>{b}</Badge><span className="tabular-nums">{a.bands[b] ?? 0}</span></li>)}</ul>
        </Card>
        <Card title="Feedback metrics" subtitle={`${a.feedback.count} ratings · average ${a.feedback.avg ?? "–"}`}>
          <ul className="flex flex-col gap-2">{[5, 4, 3, 2, 1].map((n) => { const c = a.feedback.distribution[String(n)] ?? 0; return <li key={n} className="flex items-center gap-3"><Stars value={n} size={14} /><div className="h-2 flex-1 overflow-hidden rounded-full bg-border"><div className="h-full bg-amber-400" style={{ width: `${totalRatings ? (c / totalRatings) * 100 : 0}%` }} /></div><span className="w-8 text-right text-sm tabular-nums">{c}</span></li>; })}</ul>
        </Card>
      </div>
      <Card title="AI usage" subtitle={`NVIDIA API calls in the last ${days} days`}><p className="text-[15px]">{a.ai.requests} requests, {a.ai.failures} failed{a.ai.requests ? ` (${Math.round((a.ai.failures / a.ai.requests) * 100)}%)` : ""}.</p></Card>
    </div>
  );
}
