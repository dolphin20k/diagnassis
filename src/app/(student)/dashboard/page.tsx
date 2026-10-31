import type { Metadata } from "next";
import Link from "next/link";
import { Badge, toneForBand, toneForPriority } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/Button";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { requireStudent } from "@/lib/server/auth";
import { getAttemptLimit, getMyAttempts, getTargetRoleLabel } from "@/lib/server/student";
import { BAND_COPY, deltaLabel, rankGaps, trendLabel } from "@/lib/scoring";
import { fmtDate, greeting } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function Metric({ icon, label, value, tint }: { icon: IconName; label: string; value: React.ReactNode; tint: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg bg-surface p-5 shadow-card">
      <span className="grid size-11 shrink-0 place-items-center rounded-lg" style={{ background: tint }}><Icon name={icon} size={20} /></span>
      <div className="min-w-0"><p className="text-[13px] text-ink-2">{label}</p><p className="font-display text-xl font-bold leading-tight">{value}</p></div>
    </div>
  );
}

export default async function Dashboard() {
  const profile = await requireStudent();
  const [attempts, limit, targetRole] = await Promise.all([getMyAttempts(), getAttemptLimit(), getTargetRoleLabel(profile)]);
  const submitted = attempts.filter((a) => a.status === "submitted");
  const inProgress = attempts.find((a) => a.status === "in_progress");
  const latest = submitted.at(-1);
  const best = submitted.reduce((m, a) => Math.max(m, a.score ?? 0), 0);
  const used = attempts.length;
  const left = Math.max(0, limit - used);
  const first = (profile.full_name || "there").split(" ")[0];
  const locked = !profile.details_completed;
  const gaps = latest?.result ? rankGaps(latest.result.rows, 3) : [];
  const rows = latest?.result?.rows ?? [];
  const delta = latest?.result ? deltaLabel(latest.result.delta, latest.result.previous_date) : null;
  const R = 2 * Math.PI * 47;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="flex flex-wrap items-center gap-3 text-[clamp(28px,3.4vw,36px)] tracking-tight">{greeting()}, {first} <Icon name="hand" size={30} className="text-amber-500" /></h1>
          <p className="mt-1 text-ink-2">
            {latest ? `Your latest result is from ${fmtDate(latest.submitted_at)}. Keep going, every retake shows your progress.` : locked ? "Add your details to unlock your first diagnostic." : "Your profile is ready. Run your first diagnostic when you have 20 quiet minutes."}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-indigo-50 px-5 py-4 text-primary-dark">
          <span className="grid size-11 place-items-center rounded-full bg-white"><Icon name="target" size={22} /></span>
          <p className="max-w-52 font-display text-[15px] font-bold">Take small steps towards your big goals!</p>
        </div>
      </div>

      {inProgress ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-indigo-200 bg-indigo-50 p-5" role="status">
          <div className="flex items-center gap-3"><Icon name="circle-play" className="text-primary" size={26} /><div><p className="font-display font-bold">You have a diagnostic in progress</p><p className="text-sm text-ink-2">{inProgress.role_name}. Your answers are saved, so you can pick up where you left off.</p></div></div>
          <LinkButton href={`/diagnostic/${inProgress.id}`}>Resume test</LinkButton>
        </div>
      ) : null}

      {locked ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface p-6 shadow-card">
          <div className="flex items-center gap-3"><Icon name="lock" size={24} className="text-ink-2" /><div><p className="font-display text-lg font-bold">Diagnostics are locked</p><p className="text-ink-2">Complete your basic details (college, branch, year, skills and target role) to unlock them.</p></div></div>
          <LinkButton href="/profile?edit=1">Add my details</LinkButton>
        </div>
      ) : !latest && !inProgress ? (
        <section className="rounded-xl p-8 text-white shadow-pop [background:var(--gradient-hero)]">
          <p className="font-display text-[13px] font-bold tracking-wide text-indigo-100">YOUR FIRST DIAGNOSTIC</p>
          <h2 className="mt-1 text-[clamp(24px,3vw,32px)] text-white">See how ready you are{targetRole ? ` for ${targetRole}` : ""}</h2>
          <p className="mt-2 text-indigo-50">5 questions per skill, up to 8 skills. No timer. Takes 15 to 20 minutes and you can pause any time.</p>
          <LinkButton href="/diagnostic" variant="white" size="lg" className="mt-5"><Icon name="play" /> Start diagnostic</LinkButton>
        </section>
      ) : null}

      {submitted.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon="repeat" label="Total Attempts" value={used} tint="#EEF2FF" />
            <Metric icon="trophy" label="Best Score" value={`${best} / 100`} tint="#FEF3C7" />
            <Metric icon="briefcase" label="Latest Role" value={latest?.role_name ?? ""} tint="#ECFEFF" />
            <Metric icon="crosshair" label="Target Role" value={targetRole ?? "Not set"} tint="#F5F3FF" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
            {latest?.result ? (
              <Card>
                <div className="flex flex-wrap items-center gap-6">
                  <ScoreRing value={latest.result.score} size={124} stroke={12} />
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="text-sm text-ink-2">{latest.role_name} · Readiness</p>
                    <div className="mt-1 flex flex-wrap gap-2"><Badge tone={toneForBand(latest.result.band)}>{latest.result.band}</Badge>{delta ? <Badge tone={latest.result.delta! >= 0 ? "strong" : "critical"}>{delta}</Badge> : null}</div>
                    <p className="mt-3 text-[15px]">{BAND_COPY[latest.result.band].text}</p>
                    <div className="mt-4 flex flex-wrap gap-2"><LinkButton href={`/results/${latest.id}`} size="sm">View full result</LinkButton>{left > 0 ? <LinkButton href="/diagnostic" variant="secondary" size="sm">Retake</LinkButton> : null}</div>
                  </div>
                </div>
              </Card>
            ) : null}
            <section className="rounded-lg border border-sky-200 bg-sky-50 p-6" aria-label="Diagnostics available">
              <h2 className="flex items-center gap-2 text-lg"><span className="grid size-9 place-items-center rounded-md bg-white"><Icon name="scan-search" size={18} className="text-primary" /></span> Diagnostics available</h2>
              <div className="mt-4 flex items-center gap-5">
                <div className="relative size-[104px] shrink-0">
                  <svg viewBox="0 0 104 104" className="size-full -rotate-90" aria-hidden><circle cx="52" cy="52" r="47" fill="none" stroke="#fff" strokeWidth="9" /><circle cx="52" cy="52" r="47" fill="none" stroke="var(--cyan)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(limit ? left / limit : 0) * R} ${R}`} /></svg>
                  <div className="absolute inset-0 grid place-items-center text-center"><div><p className="font-display text-3xl font-extrabold leading-none">{left}</p><p className="text-[11px] text-ink-2">of {limit} left</p></div></div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex gap-1" aria-hidden>{Array.from({ length: limit }, (_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < left ? "#06B6D4" : "#94A3B8" }} />)}</div>
                  <p className="mt-2 flex gap-4 text-xs text-ink-2"><span>{left} remaining</span><span>{used} used</span></p>
                  <p className="mt-3 text-sm text-ink-2">Retake once you have worked on your top gaps, so the change in score means something.</p>
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Top gaps to work on">
              {gaps.length === 0 ? <p className="text-ink-2">No gaps in the skills we tested. Nice work.</p> : (
                <ol className="divide-y divide-border">
                  {gaps.map((g, i) => (
                    <li key={g.skill} className="flex items-center gap-3 py-3.5">
                      <span className="grid size-8 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-primary-dark">{i + 1}</span>
                      <span className="flex-1 font-display font-semibold">{g.skill}</span>
                      <Badge tone={g.status === "missing" ? "critical" : "attention"}>{g.status === "missing" ? "Missing" : "Weak"}</Badge>
                      <span className="hidden sm:block"><Badge tone={toneForPriority(g.priority)}>{g.priority[0]!.toUpperCase() + g.priority.slice(1)}</Badge></span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card title={`Market trends for ${latest?.role_name ?? "your role"}`} subtitle={latest?.trends_updated_at ? `Updated ${fmtDate(latest.trends_updated_at)} · AI-assisted estimates` : "AI-assisted estimates"}>
              <ul className="divide-y divide-border">
                {rows.filter((r) => r.trend && r.trend !== "stable").slice(0, 5).map((r) => (
                  <li key={r.skill} className="flex items-center gap-3 py-3">
                    <Icon name={r.trend === "rising" ? "trending-up" : "trending-down"} className={r.trend === "rising" ? "text-emerald-600" : "text-rose-600"} />
                    <span className="flex-1">{r.skill}</span>
                    <Badge tone={r.trend === "rising" ? "strong" : "critical"}>{trendLabel(r.trend)}</Badge>
                  </li>
                ))}
                {rows.every((r) => !r.trend || r.trend === "stable") ? <li className="py-3 text-ink-2">Requirements look stable for this role right now.</li> : null}
              </ul>
              <Link href={`/results/${latest?.id}#trends`} className="mt-3 inline-block text-sm font-semibold">See all trends</Link>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
