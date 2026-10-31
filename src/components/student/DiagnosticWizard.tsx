"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Badge, toneForPriority } from "@/components/ui/Badge";
import { OptionCard, SkillPicker } from "@/components/student/SkillPicker";
import { PageHeader } from "@/components/ui/States";
import { cn } from "@/components/ui/cn";
import { MAX_TESTED_SKILLS, QUESTIONS_PER_SKILL } from "@/lib/scoring";
import { sanitizeSkillList } from "@/lib/sanitize";
import type { RequirementSnapshot } from "@/lib/types/database";

const STEPS = ["Role", "Skills", "Overview"] as const;
const OTHERS = "others";

interface Estimate { name: string; requirements: RequirementSnapshot[] }

export function DiagnosticWizard({ roles, catalog, requirements, initialSkills, initialRoleId, initialOther, attemptsLeft }: { roles: { id: string; name: string }[]; catalog: string[]; requirements: Record<string, { skill: string; weight: number }[]>; initialSkills: string[]; initialRoleId: string | null; initialOther: string; attemptsLeft: number }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<string>(initialRoleId ?? (initialOther ? OTHERS : ""));
  const [other, setOther] = useState(initialOther);
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [none, setNone] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const curated = roles.find((r) => r.id === role);
  const roleName = role === OTHERS ? (estimate?.name ?? other.trim()) : (curated?.name ?? "");
  const reqs: { skill: string; weight: number }[] = role === OTHERS ? (estimate?.requirements ?? []) : (requirements[role] ?? []);
  const claimed = new Set(skills.map((s) => s.toLowerCase()));
  const tested = reqs.filter((r) => claimed.has(r.skill.toLowerCase())).slice(0, MAX_TESTED_SKILLS);
  const missing = reqs.filter((r) => !claimed.has(r.skill.toLowerCase()));

  async function nextFromRole() {
    setErr("");
    if (!role) return setErr("Choose a target role.");
    if (role !== OTHERS) return setStep(1);
    if (other.trim().length < 2) return setErr("Type the role you are aiming for.");
    if (estimate && estimate.name.toLowerCase() === other.trim().toLowerCase()) return setStep(1);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/estimate-role", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: other.trim() }) });
      const body = await res.json();
      if (!res.ok) return setErr(body.message ?? "We could not estimate that role. Try again.");
      if (body.curated) {
        setRole(body.curated.id);
        setStep(1);
      } else {
        setEstimate({ name: body.name, requirements: body.requirements });
        setStep(1);
      }
    } catch {
      setErr("Network problem. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/diagnostics/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role === OTHERS ? { customRole: estimate?.name ?? other.trim(), skills } : { roleId: role, skills }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.error === "attempt_in_progress") return router.replace("/dashboard");
        return setErr(body.message ?? "We could not start your diagnostic. Please try again.");
      }
      router.push(`/diagnostic/${body.attemptId}`);
    } catch {
      setErr("Network problem. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Start a diagnostic" subtitle={`${attemptsLeft} diagnostic${attemptsLeft === 1 ? "" : "s"} left`} />
      <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold", i <= step ? "border-primary bg-primary text-white" : "border-border bg-white text-ink-3")}>{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
            <span className={cn("hidden text-sm font-semibold sm:block", i <= step ? "text-ink" : "text-ink-3")}>{s}</span>
            {i < STEPS.length - 1 ? <span aria-hidden className={cn("h-0.5 flex-1", i < step ? "bg-primary" : "bg-border")} /> : null}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <Card title="Which role are you aiming for?" subtitle="We compare your skills with what this role asks for right now.">
          <div role="radiogroup" aria-label="Target role" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {roles.map((r) => <OptionCard key={r.id} selected={role === r.id} onClick={() => { setRole(r.id); setErr(""); }}>{r.name}</OptionCard>)}
            <OptionCard selected={role === OTHERS} onClick={() => { setRole(OTHERS); setErr(""); }}>Others</OptionCard>
          </div>
          {role === OTHERS ? (
            <div className="mt-4 rounded-lg bg-indigo-50 p-4">
              <Field label="Type the role you are aiming for" value={other} onChange={(e) => { setOther(e.target.value); setEstimate(null); }} placeholder="e.g. Game Developer" />
              <p className="mt-2 flex gap-2 text-sm text-primary-dark"><Icon name="sparkles" size={16} className="mt-0.5 shrink-0" /> We use AI to estimate what this role requires. Estimates can be less precise than our curated roles, and your result will say so.</p>
            </div>
          ) : null}
          {err ? <p role="alert" className="mt-4 text-sm text-rose-700">{err}</p> : null}
          <div className="mt-6 flex justify-end"><Button size="lg" onClick={nextFromRole} loading={busy}>{busy ? "Estimating requirements…" : "Continue"}</Button></div>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card title="Confirm the skills you already have" subtitle={`Only skills ${roleName} asks for are tested. Be honest: a skill you do not claim scores zero, a skill you claim is tested.`}>
          {role === OTHERS ? <p className="mb-4 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"><Icon name="sparkles" size={16} /> Requirements for {roleName} are AI-estimated.</p> : null}
          <div className="mb-4">
            <p className="mb-2 font-display text-[13px] font-semibold">This role asks for</p>
            <ul className="flex flex-wrap gap-2">
              {reqs.map((r) => {
                const has = claimed.has(r.skill.toLowerCase());
                return (
                  <li key={r.skill}>
                    <button type="button" aria-pressed={has} onClick={() => { setNone(false); setSkills(has ? skills.filter((s) => s.toLowerCase() !== r.skill.toLowerCase()) : [...skills, r.skill]); }} className={cn("inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-semibold", has ? "border-primary bg-indigo-50 text-primary-dark" : "border-border bg-white hover:border-indigo-300")}>
                      {has ? <Icon name="check" size={14} /> : <Icon name="plus" size={14} />}{r.skill} <span className="font-normal text-ink-2">{Math.round(r.weight)}%</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <label className="mt-3 flex items-center gap-2.5 text-sm font-semibold">
              <input type="checkbox" checked={none} onChange={(e) => { setNone(e.target.checked); if (e.target.checked) setSkills(skills.filter((s) => !reqs.some((r) => r.skill.toLowerCase() === s.toLowerCase()))); }} className="size-5 accent-[var(--primary)]" />
              I don&apos;t know any of these skills
            </label>
          </div>
          <SkillPicker value={skills} onChange={(v) => { setSkills(v); setNone(false); }} catalog={catalog} label="All your skills" />
          {none || tested.length === 0 ? (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4" role="status">
              <p className="flex items-center gap-2 font-display font-bold text-amber-900"><Icon name="lightbulb" size={18} /> Nothing to test yet, and that is fine</p>
              <p className="mt-1 text-sm text-amber-900">Start with {missing.slice(0, 3).map((m) => m.skill).join(", ") || "the skills listed above"}. These carry the most weight for {roleName}. Come back after a week of practice and your diagnostic will have something to measure.</p>
            </div>
          ) : null}
          <div className="mt-6 flex justify-between gap-3"><Button variant="secondary" onClick={() => setStep(0)}>Back</Button><Button size="lg" onClick={() => { if (tested.length === 0) return setErr("Claim at least one skill this role asks for to take the test."); setErr(""); setSkills(sanitizeSkillList(skills)); setStep(2); }}>Continue</Button></div>
          {err ? <p role="alert" className="mt-3 text-right text-sm text-rose-700">{err}</p> : null}
        </Card>
      ) : null}

      {step === 2 ? (
        <Card title="Test overview" subtitle={`${roleName} diagnostic`}>
          <dl className="grid grid-cols-3 gap-3">
            {[[tested.length, "skills tested"], [tested.length * QUESTIONS_PER_SKILL, `questions, ${QUESTIONS_PER_SKILL} per skill`], ["15–20", "minutes, no timer"]].map(([v, l]) => (
              <div key={String(l)} className="rounded-md bg-bg p-4"><dd className="font-display text-[26px] font-extrabold leading-tight">{v}</dd><dt className="text-[13px] text-ink-2">{l}</dt></div>
            ))}
          </dl>
          <p className="mb-2 mt-5 font-display text-[13px] font-semibold">Skills in this test</p>
          <ul className="flex flex-wrap gap-2">{tested.map((t) => <li key={t.skill}><Badge tone="info">{t.skill}</Badge></li>)}</ul>
          {missing.length > 0 ? (<><p className="mb-2 mt-4 font-display text-[13px] font-semibold">Not claimed, so they count as zero</p><ul className="flex flex-wrap gap-2">{missing.map((t) => <li key={t.skill}><Badge tone={toneForPriority("high")}>{t.skill}</Badge></li>)}</ul></>) : null}
          <ul className="mt-5 flex flex-col gap-1.5 text-sm text-ink-2">
            <li className="flex gap-2"><Icon name="save" size={16} className="mt-0.5 shrink-0" /> Answers save automatically. Close the tab any time and resume from your dashboard.</li>
            <li className="flex gap-2"><Icon name="flag" size={16} className="mt-0.5 shrink-0" /> Flag questions to revisit, and review everything before you submit.</li>
            <li className="flex gap-2"><Icon name="sparkles" size={16} className="mt-0.5 shrink-0" /> Questions are prepared with AI. Starting may take up to a minute the first time.</li>
          </ul>
          {err ? <p role="alert" className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p> : null}
          <div className="mt-6 flex justify-between gap-3"><Button variant="secondary" onClick={() => setStep(1)} disabled={busy}>Back</Button><Button size="lg" onClick={start} loading={busy}>{busy ? "Preparing your questions…" : "Start test"}</Button></div>
        </Card>
      ) : null}
      <span className="sr-only-live" aria-live="polite">{busy ? "Working, please wait" : ""}</span>
    </div>
  );
}
