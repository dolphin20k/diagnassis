import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/server/auth";
import { UUID } from "@/lib/server/api";
import { getAttemptLimit, getMyAttempts } from "@/lib/server/student";
import { Badge, toneForBand, toneForPriority, toneForStatus } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/Button";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { SkillBar } from "@/components/ui/SkillBar";
import { InsightsLoader, RateResult } from "@/components/student/ResultWidgets";
import { BAND_COPY, deltaLabel, fallbackAction, rankGaps, searchUrl, trendLabel } from "@/lib/scoring";
import { fmtDate } from "@/lib/format";
import type { ActionItem } from "@/lib/types/database";

export const metadata: Metadata = { title: "Result" };
export const dynamic = "force-dynamic";

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const profile = await requireStudent();
  const supabase = await createClient();
  const { data: a } = await supabase.from("attempts").select("*").eq("id", id).eq("user_id", profile.id).maybeSingle();
  if (!a) notFound();
  if (a.status !== "submitted" || !a.result) redirect(`/diagnostic/${id}`);
  const [attempts, limit, rating] = await Promise.all([
    getMyAttempts(),
    getAttemptLimit(),
    supabase.from("feedback").select("rating").eq("attempt_id", id).eq("kind", "result").maybeSingle(),
  ]);
  const r = a.result;
  const rows = [...r.rows].sort((x, y) => y.weight - x.weight);
  const matched = rows.filter((x) => x.status === "matched");
  const weak = rows.filter((x) => x.status === "weak");
  const missing = rows.filter((x) => x.status === "missing");
  const gaps = rankGaps(r.rows, 3);
  const actions: ActionItem[] = a.insights?.actions ?? gaps.map((g) => fallbackAction(a.role_name, g));
  const delta = deltaLabel(r.delta, r.previous_date);
  const rising = rows.filter((x) => x.trend === "rising");
  const declining = rows.filter((x) => x.trend === "declining").map((x) => x.skill).concat(a.declining_skills);
  const stable = rows.filter((x) => !x.trend || x.trend === "stable");
  const canRetake = attempts.length < limit;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold"><Icon name="arrow-left" size={16} /> Dashboard</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(26px,3vw,34px)] tracking-tight">{a.role_name} result</h1>
            <p className="mt-1 text-sm text-ink-2">Taken {fmtDate(a.submitted_at)} · {r.tested_count} skills tested · {r.question_count} questions</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canRetake ? <LinkButton href="/diagnostic" variant="secondary">Retake</LinkButton> : null}
            <a href={`/api/reports/${id}`} className="inline-flex items-center justify-center gap-2 rounded-md border border-primary bg-primary px-[18px] py-2.5 font-display text-sm font-semibold text-white hover:bg-primary-dark hover:text-white"><Icon name="download" size={16} /> Download PDF report</a>
          </div>
        </div>
        {a.is_custom_role ? <p className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"><Icon name="sparkles" size={16} /> Requirements for this role were AI-estimated, so this result may be less precise than for curated roles.</p> : null}
      </div>

      <section aria-labelledby="score" className="flex flex-wrap items-center gap-8 rounded-xl border border-sky-200 bg-sky-50 p-6 md:p-8">
        <ScoreRing value={r.score} size={172} stroke={14} track="#E2E8F0" />
        <div className="min-w-0 flex-1 basis-72">
          <p id="score" className="font-display text-[13px] font-bold uppercase tracking-wide text-sky-800">Readiness score</p>
          <div className="mt-2 flex flex-wrap gap-2"><Badge tone={toneForBand(r.band)}>{r.band}</Badge>{delta ? <Badge tone={(r.delta ?? 0) >= 0 ? "strong" : "critical"}>{delta}</Badge> : <Badge tone="info">First attempt for this role</Badge>}</div>
          <p className="mt-3 font-display text-[clamp(20px,2.4vw,26px)] font-bold leading-snug">{BAND_COPY[r.band].text}</p>
          {a.insights?.summary ? <p className="mt-2 text-ink-2">{a.insights.summary}</p> : null}
          <p className="mt-3 flex flex-wrap gap-5 text-sm"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-gap-strong" />{matched.length} matched</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-gap-attention" />{weak.length} weak</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-gap-critical" />{missing.length} missing</span></p>
        </div>
      </section>

      {!a.insights ? <InsightsLoader attemptId={id} /> : null}

      <section aria-labelledby="actions">
        <h2 id="actions" className="text-2xl">Your top {Math.max(actions.length, 1)} things to work on</h2>
        <p className="mt-1 text-ink-2">Chosen by how much each gap affects your score for this role.{a.insights && !a.insights.ai_generated ? " Standard guidance is shown because AI-written advice was unavailable." : ""}</p>
        {actions.length === 0 ? <div className="mt-4"><Card><p>You matched every skill we tested. Keep your skills current, and try adding stretch skills to your profile for a tougher diagnostic.</p></Card></div> : null}
        <ol className="mt-4 flex flex-col gap-4">
          {actions.map((x, i) => (
            <li key={x.skill} className="rounded-lg bg-surface p-6 shadow-card">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-full bg-primary font-display text-sm font-bold text-white">{i + 1}</span>
                <h3 className="text-xl">{x.skill}</h3>
                <Badge tone={x.status === "missing" ? "critical" : "attention"}>{x.status === "missing" ? "Missing" : "Weak"}</Badge>
                <Badge tone={toneForPriority(x.priority)}>{cap(x.priority)} priority</Badge>
                {x.trend === "rising" ? <Badge tone="strong">Rising</Badge> : null}
                {x.ai_generated ? <span className="inline-flex items-center gap-1 text-xs text-ink-2"><Icon name="sparkles" size={13} /> AI-written</span> : null}
              </div>
              <p className="mt-3">{x.why}</p>
              <p className="mt-2 rounded-md bg-indigo-50 px-3 py-2 text-[15px]"><strong className="text-primary-dark">Next step:</strong> {x.next_step}</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2" aria-label={`Learning resources for ${x.skill}`}>
                {x.resources.map((rs) => (
                  <li key={rs.title}>
                    <a href={searchUrl(rs.search_query, rs.kind)} target="_blank" rel="noopener noreferrer" className="group flex h-full items-start gap-3 rounded-lg border border-border p-4 text-ink hover:border-primary hover:bg-indigo-50/40">
                      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sidebar text-white"><Icon name={rs.kind === "video" ? "play" : rs.kind === "docs" ? "file-text" : "layers"} size={18} /></span>
                      <span className="min-w-0"><span className="block font-display text-[15px] font-semibold group-hover:text-primary">{rs.title}</span><span className="block text-xs text-ink-2">{rs.kind === "video" ? "YouTube search" : "Web search"} · {rs.level ?? cap(rs.kind)}<Icon name="external-link" size={11} className="ml-1 inline" /></span></span>
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-ink-2">Resource links open a search for the suggested topic. We do not control third-party content.</p>
      </section>

      <section aria-labelledby="gaps" className="grid gap-6 lg:grid-cols-2">
        <Card title="Skill gap visualizer" subtitle="Your tested level against what this role asks for">
          <h2 id="gaps" className="sr-only">Skill gap visualizer</h2>
          <div className="flex flex-col gap-3">{rows.map((x) => <SkillBar key={x.skill} label={x.skill} value={x.proficiency} status={x.tested ? x.status : "missing"} trailing={x.tested ? `${x.proficiency}%` : "Not claimed"} />)}</div>
          <p className="mt-4 flex flex-wrap gap-4 text-xs text-ink-2"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-gap-strong" />Matched (70%+)</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-gap-attention" />Weak</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-gap-critical" />Missing</span></p>
        </Card>
        <Card title="Score breakdown" subtitle="Each skill contributes its weight × your level">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead><tr className="text-xs uppercase text-ink-2"><th scope="col" className="pb-2 font-semibold">Skill</th><th scope="col" className="pb-2 font-semibold">Priority</th><th scope="col" className="pb-2 font-semibold">Status</th><th scope="col" className="pb-2 text-right font-semibold">Points</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map((x) => (
                  <tr key={x.skill}><th scope="row" className="py-2.5 font-semibold">{x.skill}</th><td className="py-2.5">{cap(x.priority)}</td><td className="py-2.5"><Badge tone={toneForStatus(x.status)}>{cap(x.status)}</Badge></td><td className="py-2.5 text-right tabular-nums">{x.points} / {Math.round(x.weight)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><th scope="row" colSpan={3} className="pt-3 text-left">Readiness score</th><td className="pt-3 text-right font-display text-base font-bold">{r.score} / 100</td></tr></tfoot>
            </table>
          </div>
        </Card>
      </section>

      <section id="trends" aria-labelledby="trend-h" className="scroll-mt-24">
        <Card title="Market trend insights" subtitle={`${a.role_name}${a.trends_updated_at ? ` · reviewed ${fmtDate(a.trends_updated_at)}` : ""} · AI-assisted estimates, not live listing counts`}>
          <h2 id="trend-h" className="sr-only">Market trend insights</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {[["Rising", "trending-up", "text-emerald-600", rising.map((x) => x.skill)], ["Stable", "minus", "text-slate-500", stable.map((x) => x.skill)], ["Declining", "trending-down", "text-rose-600", declining]].map(([label, icon, color, list]) => (
              <div key={label as string}>
                <p className="flex items-center gap-2 font-display font-bold"><Icon name={icon as "minus"} className={color as string} /> {label as string}</p>
                <p className="mt-1.5 text-[15px] text-ink-2">{(list as string[]).length ? (list as string[]).join(", ") : "None right now"}</p>
              </div>
            ))}
          </div>
          {a.insights?.trend_summary ? <p className="mt-5 rounded-md bg-bg px-4 py-3">{a.insights.trend_summary}</p> : null}
          {rising.length ? <p className="mt-3 text-sm text-ink-2">Rising skills you can add to your plan: {rising.filter((x) => x.status !== "matched").map((x) => `${x.skill} (${trendLabel(x.trend)}${x.trend_change ? ` ${x.trend_change}` : ""})`).join(", ") || "you already match them all"}.</p> : null}
        </Card>
      </section>

      <RateResult attemptId={id} existing={rating.data?.rating ?? null} />
    </div>
  );
}
