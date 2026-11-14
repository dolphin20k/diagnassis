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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-11" -> "11 Nov" (or "11 Nov 2026" when `year`). Parsed by hand so no timezone shifts the date. */
const label = (iso: string, year = false) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]}${year ? ` ${y}` : ""}`;
};

/** Line chart of registrations and completed diagnostics per day, with dated axis ticks, value labels and a per-date table. */
function DailyChart({ daily: all }: { daily: AdminAnalytics["daily"] }) {
  // Long ranges with little activity would squash everything into the last few pixels: start the axis a few days before
  // the first activity (never fewer than 14 days shown) while the totals and the date table still cover the whole range.
  const first = all.findIndex((d) => d.registrations > 0 || d.diagnostics > 0);
  const from = first < 0 ? Math.max(0, all.length - 14) : Math.max(0, Math.min(first - 2, all.length - 14));
  const daily = all.slice(from);
  const W = 720, H = 260, P = { l: 36, r: 16, t: 20, b: 34 };
  const maxVal = Math.max(1, ...daily.map((d) => Math.max(d.registrations, d.diagnostics)));
  const top = Math.max(2, maxVal);
  const n = daily.length;
  const x = (i: number) => P.l + (n <= 1 ? (W - P.l - P.r) / 2 : (i / (n - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - v / top) * (H - P.t - P.b);
  const yTicks = Array.from({ length: top + 1 }, (_, i) => i).filter((v) => top <= 5 || v % Math.ceil(top / 5) === 0);
  const xTickCount = n <= 10 ? n : 7;
  const xTicks = Array.from({ length: xTickCount }, (_, k) => (xTickCount === 1 ? 0 : Math.round((k * (n - 1)) / (xTickCount - 1))));
  const totalReg = all.reduce((a, d) => a + d.registrations, 0);
  const totalDia = all.reduce((a, d) => a + d.diagnostics, 0);
  const summary = `Daily registrations and completed diagnostics from ${daily[0] ? label(daily[0].day, true) : ""} to ${daily.at(-1) ? label(daily.at(-1)!.day, true) : ""}. Total registrations ${totalReg}, completed diagnostics ${totalDia}.`;
  const line = (key: "registrations" | "diagnostics") => daily.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const series = [
    { key: "registrations" as const, color: "#4F46E5", name: "registrations", dy: -8 },
    { key: "diagnostics" as const, color: "#06B6D4", name: "completed diagnostics", dy: 16 },
  ];
  const active = all.filter((d) => d.registrations > 0 || d.diagnostics > 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={summary}>
        {yTicks.map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#E2E8F0" /><text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#64748B">{v}</text></g>)}
        {xTicks.map((i, k) => <g key={i}><line x1={x(i)} x2={x(i)} y1={H - P.b} y2={H - P.b + 4} stroke="#94A3B8" /><text x={x(i)} y={H - 12} textAnchor={k === 0 && n > 1 ? "start" : k === xTicks.length - 1 && n > 1 ? "end" : "middle"} fontSize="11" fill="#64748B">{label(daily[i]!.day)}</text></g>)}
        {series.map((sr) => <path key={sr.key} d={line(sr.key)} fill="none" stroke={sr.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
        {series.map((sr) => daily.map((d, i) => d[sr.key] > 0 ? (
          <g key={`${sr.key}-${d.day}`}>
            <circle cx={x(i)} cy={y(d[sr.key])} r="4.5" fill="#fff" stroke={sr.color} strokeWidth="2.5"><title>{`${label(d.day, true)}: ${d[sr.key]} ${sr.name}`}</title></circle>
            <text x={x(i)} y={y(d[sr.key]) + sr.dy} textAnchor="middle" fontSize="11" fontWeight="700" fill={sr.color}>{d[sr.key]}</text>
          </g>
        ) : null))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-5 text-xs text-ink-2"><span><i className="mr-1.5 inline-block h-1 w-4 rounded-full bg-primary align-middle" />Registrations ({totalReg})</span><span><i className="mr-1.5 inline-block h-1 w-4 rounded-full bg-cyan align-middle" />Completed diagnostics ({totalDia})</span></figcaption>
      {from > 0 ? <p className="mt-1 text-xs text-ink-2">Chart starts {label(daily[0]!.day, true)}; there was no activity earlier in this range.</p> : null}
      {active.length > 0 ? (
        <table className="mt-4 w-full text-left text-sm">
          <caption className="mb-1 text-left text-[13px] font-semibold">Activity by date</caption>
          <thead><tr className="text-xs uppercase text-ink-2"><th scope="col" className="pb-1.5 font-semibold">Date</th><th scope="col" className="pb-1.5 font-semibold">Registrations</th><th scope="col" className="pb-1.5 font-semibold">Completed diagnostics</th></tr></thead>
          <tbody className="divide-y divide-border">{[...active].reverse().map((d) => <tr key={d.day}><th scope="row" className="py-1.5 font-semibold">{label(d.day, true)}</th><td className="py-1.5 tabular-nums">{d.registrations}</td><td className="py-1.5 tabular-nums">{d.diagnostics}</td></tr>)}</tbody>
        </table>
      ) : <p className="mt-3 text-sm text-ink-2">No registrations or completed diagnostics in this range yet.</p>}
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
      <Card title="Diagnostic usage" subtitle="Registrations and completed diagnostics on each date"><DailyChart daily={a.daily} /></Card>
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
