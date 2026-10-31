"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/components/ui/cn";

export interface RunnerQuestion { position: number; skill: string; prompt: string; options: string[]; selected: number | null; flagged: boolean }
type Phase = "test" | "review" | "analysis";
type Save = { position: number; selected?: number; flagged?: boolean };

export function TestRunner({ attemptId, role, custom, questions, startAt, resumed }: { attemptId: string; role: string; custom: boolean; questions: RunnerQuestion[]; startAt: number; resumed: boolean }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<Phase>("test");
  const [qi, setQi] = useState(startAt);
  const [answers, setAnswers] = useState<Record<number, number>>(() => Object.fromEntries(questions.filter((q) => q.selected !== null).map((q) => [q.position, q.selected as number])));
  const [flags, setFlags] = useState<Record<number, boolean>>(() => Object.fromEntries(questions.filter((q) => q.flagged).map((q) => [q.position, true])));
  const [online, setOnline] = useState(true);
  const [saving, setSaving] = useState(0);
  const queue = useRef<Save[]>([]);
  const [queued, setQueued] = useState(0);
  const [step, setStep] = useState(0);
  const [analysisErr, setAnalysisErr] = useState("");
  const [welcome, setWelcome] = useState(resumed);

  const q = questions[qi] as RunnerQuestion;
  const total = questions.length;
  const answered = Object.keys(answers).length;
  const skills = useMemo(() => [...new Set(questions.map((x) => x.skill))], [questions]);

  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    while (queue.current.length > 0) {
      const item = queue.current[0] as Save;
      const { error } = await supabase.rpc("save_answer", { p_attempt: attemptId, p_position: item.position, p_selected: item.selected ?? null, p_flagged: item.flagged ?? null });
      if (error) {
        if (/attempt_not_found/.test(error.message)) return routerRef.current.replace(`/results/${attemptId}`);
        break; // keep it queued and retry later
      }
      queue.current.shift();
    }
    setQueued(queue.current.length);
  }, [supabase, attemptId]);

  useEffect(() => {
    const setNet = () => { setOnline(navigator.onLine); if (navigator.onLine) void flush(); };
    setNet();
    window.addEventListener("online", setNet);
    window.addEventListener("offline", setNet);
    const t = setInterval(() => { if (queue.current.length) void flush(); }, 8000);
    const beforeUnload = (e: BeforeUnloadEvent) => { if (queue.current.length) { e.preventDefault(); } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { window.removeEventListener("online", setNet); window.removeEventListener("offline", setNet); clearInterval(t); window.removeEventListener("beforeunload", beforeUnload); };
  }, [flush]);

  async function save(item: Save) {
    queue.current.push(item);
    setQueued(queue.current.length);
    setSaving((n) => n + 1);
    await flush();
    setSaving((n) => n - 1);
  }
  const choose = (idx: number) => { setAnswers((a) => ({ ...a, [q.position]: idx })); void save({ position: q.position, selected: idx }); };
  const toggleFlag = () => { const v = !flags[q.position]; setFlags((f) => ({ ...f, [q.position]: v })); void save({ position: q.position, flagged: v }); };
  const go = (i: number) => { setQi(i); setPhase("test"); window.scrollTo(0, 0); };

  async function submit() {
    setPhase("analysis");
    setAnalysisErr("");
    setStep(0);
    await flush();
    if (queue.current.length) { setAnalysisErr("Some answers could not be saved yet. Check your connection and try again."); return; }
    try {
      const res = await fetch(`/api/diagnostics/${attemptId}/submit`, { method: "POST" });
      if (!res.ok) throw new Error();
      setStep(1);
      // Insights are generated best-effort here; the results page retries them if this step fails.
      await fetch(`/api/diagnostics/${attemptId}/insights`, { method: "POST" }).catch(() => undefined);
      setStep(2);
      router.replace(`/results/${attemptId}`);
      router.refresh();
    } catch {
      setAnalysisErr("We could not build your result. Your answers are saved. Please try again.");
    }
  }

  const header = (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
        <Logo height={30} />
        <div className="min-w-0 flex-1 text-center"><p className="truncate font-display text-sm font-bold">{role}{custom ? " (AI-estimated)" : ""}</p><p className="text-xs text-ink-2">{phase === "review" ? "Review and submit" : `Question ${qi + 1} of ${total}`}</p></div>
        <p className="w-20 text-right text-xs text-ink-2" aria-live="polite">{!online ? "Offline" : saving > 0 || queued > 0 ? "Saving…" : "Saved"}</p>
      </div>
      <div className="h-1 bg-border" role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={total} aria-label="Questions answered"><div className="h-full bg-cyan transition-all" style={{ width: `${(answered / total) * 100}%` }} /></div>
    </header>
  );
  const banner = !online ? (
    <div role="alert" className="mx-auto mt-4 flex max-w-5xl items-center gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900"><Icon name="wifi-off" /> Connection lost. Keep going: your answers are held on this device and will save as soon as you are back online.</div>
  ) : null;

  if (phase === "analysis") {
    const labels = ["Scoring your answers", "Comparing with market requirements", "Writing your action plan"];
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="w-full max-w-md rounded-xl bg-surface p-8 text-center shadow-card" role="status" aria-live="polite">
          <Logo height={40} />
          <h1 className="mt-5 text-2xl">{analysisErr ? "Something went wrong" : "Building your result"}</h1>
          {analysisErr ? (
            <>
              <p className="mt-2 text-rose-700">{analysisErr}</p>
              <div className="mt-5 flex justify-center gap-3"><Button onClick={submit}>Try again</Button><Button variant="secondary" onClick={() => setPhase("review")}>Back to review</Button></div>
            </>
          ) : (
            <ol className="mt-6 flex flex-col gap-3 text-left">
              {labels.map((l, i) => (
                <li key={l} className="flex items-center gap-3">
                  {i < step ? <Icon name="circle-check" className="text-emerald-600" /> : i === step ? <span className="size-[18px] animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden /> : <Icon name="circle" className="text-slate-300" />}
                  <span className={i <= step ? "font-semibold" : "text-ink-3"}>{l}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    );
  }

  if (phase === "review") {
    const unanswered = questions.filter((x) => answers[x.position] === undefined);
    return (
      <div>
        {header}{banner}
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-[28px]">Review your answers</h1>
          <p className="mt-1 text-ink-2">{answered} of {total} answered. {unanswered.length > 0 ? "Unanswered questions score zero." : "Everything is answered."}</p>
          <div className="mt-6 flex flex-col gap-4">
            {skills.map((s) => {
              const qs = questions.filter((x) => x.skill === s);
              const done = qs.filter((x) => answers[x.position] !== undefined).length;
              return (
                <section key={s} className="rounded-lg bg-surface p-5 shadow-card">
                  <div className="flex items-center justify-between"><h2 className="text-lg">{s}</h2><span className="text-sm text-ink-2">{done} of {qs.length} answered</span></div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {qs.map((x) => (
                      <button key={x.position} onClick={() => go(x.position)} aria-label={`Question ${x.position + 1}, ${answers[x.position] === undefined ? "unanswered" : "answered"}${flags[x.position] ? ", flagged" : ""}`} className={cn("relative grid size-10 place-items-center rounded-md border-2 font-display text-sm font-bold", answers[x.position] === undefined ? "border-amber-400 bg-amber-50 text-amber-900" : "border-cyan bg-cyan/10 text-ink")}>
                        {x.position + 1}{flags[x.position] ? <Icon name="flag" size={11} className="absolute -right-1 -top-1 text-rose-600" fill="#E11D48" /> : null}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <Button variant="secondary" onClick={() => go(unanswered[0]?.position ?? total - 1)}>{unanswered.length ? "Go to first unanswered" : "Back to questions"}</Button>
            <Button size="lg" onClick={submit}>Submit diagnostic</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}{banner}
      {welcome ? (
        <div role="status" className="mx-auto mt-4 flex max-w-5xl items-center justify-between gap-3 rounded-md bg-indigo-50 px-4 py-3 text-sm text-primary-dark"><span>Welcome back. We saved your progress, so you are on question {qi + 1}.</span><button onClick={() => setWelcome(false)} aria-label="Dismiss"><Icon name="x" size={16} /></button></div>
      ) : null}
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1fr_260px]">
        <main id="main" className="min-w-0">
          <div className="rounded-xl bg-surface p-6 shadow-card sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-indigo-50 px-3 py-1 font-display text-xs font-bold text-primary-dark">{q.skill}</span>
              <button onClick={toggleFlag} aria-pressed={!!flags[q.position]} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold", flags[q.position] ? "bg-rose-50 text-rose-700" : "text-ink-2 hover:bg-slate-100")}><Icon name="flag" size={16} fill={flags[q.position] ? "#E11D48" : "none"} />{flags[q.position] ? "Flagged" : "Flag for review"}</button>
            </div>
            <h1 className="mt-4 whitespace-pre-line text-[clamp(20px,2.4vw,24px)] leading-snug" id="q">{q.prompt}</h1>
            <div role="radiogroup" aria-labelledby="q" className="mt-5 flex flex-col gap-3">
              {q.options.map((o, i) => {
                const sel = answers[q.position] === i;
                return (
                  <button key={i} role="radio" aria-checked={sel} onClick={() => choose(i)} className={cn("flex items-start gap-3 rounded-lg border-2 px-4 py-3.5 text-left transition", sel ? "border-primary bg-indigo-50 shadow-[0_0_0_4px_rgba(79,70,229,.12)]" : "border-border bg-surface hover:border-indigo-300")}>
                    <span aria-hidden className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 font-display text-xs font-bold", sel ? "border-primary bg-primary text-white" : "border-slate-300 text-ink-2")}>{String.fromCharCode(65 + i)}</span>
                    <span className="whitespace-pre-wrap break-words font-mono text-[15px] [font-family:var(--font-body)]">{o}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => go(qi - 1)} disabled={qi === 0}><Icon name="arrow-left" size={16} /> Previous</Button>
              {qi < total - 1 ? <Button onClick={() => go(qi + 1)}>Next <Icon name="arrow-right" size={16} /></Button> : <Button onClick={() => setPhase("review")}>Review and submit</Button>}
            </div>
          </div>
        </main>
        <aside aria-label="Progress by skill" className="rounded-xl bg-surface p-5 shadow-card lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-3 text-sm">Progress by skill</h2>
          <ul className="flex flex-col gap-3">
            {skills.map((s) => {
              const qs = questions.filter((x) => x.skill === s);
              return (
                <li key={s} className={cn("rounded-md p-2", s === q.skill && "bg-indigo-50")}>
                  <p className="text-[13px] font-semibold">{s} <span className="font-normal text-ink-2">{qs.filter((x) => answers[x.position] !== undefined).length}/{qs.length}</span></p>
                  <div className="mt-1.5 flex gap-1">{qs.map((x) => <button key={x.position} onClick={() => go(x.position)} aria-label={`Go to question ${x.position + 1}`} className="h-2 flex-1 rounded-full" style={{ background: x.position === qi ? "var(--primary)" : answers[x.position] !== undefined ? "var(--cyan)" : "var(--border)" }} />)}</div>
                </li>
              );
            })}
          </ul>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => setPhase("review")}>Review and submit</Button>
        </aside>
      </div>
    </div>
  );
}
