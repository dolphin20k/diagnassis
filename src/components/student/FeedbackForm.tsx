"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { OptionCard } from "@/components/student/SkillPicker";
import { submitFeedback } from "@/app/(student)/actions";
import { FEEDBACK_TOPICS, feedbackSchema } from "@/lib/validation";
import { cn } from "@/components/ui/cn";

export function FeedbackForm() {
  const [f, setF] = useState<{ rating: number; topic: string | null; message: string }>({ rating: 0, topic: null, message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = feedbackSchema.safeParse(f);
    if (!parsed.success) {
      const m: Record<string, string> = {};
      for (const i of parsed.error.issues) if (!m[String(i.path[0])]) m[String(i.path[0])] = i.message;
      return setErrors(m);
    }
    setBusy(true);
    const res = await submitFeedback(parsed.data);
    setBusy(false);
    if (!res.ok) return setErrors({ ...(res.fieldErrors ?? {}), form: res.error });
    setDone(true);
  }
  if (done)
    return (
      <Card><div className="flex flex-col items-center gap-3 py-8 text-center" role="status"><span className="grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Icon name="circle-check-big" size={28} /></span><h2 className="text-xl">Thank you</h2><p className="text-ink-2">Your feedback has been sent to the team.</p><Button variant="secondary" onClick={() => { setF({ rating: 0, topic: null, message: "" }); setDone(false); }}>Send more feedback</Button></div></Card>
    );
  return (
    <Card>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {errors.form ? <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{errors.form}</p> : null}
        <fieldset>
          <legend className="font-display text-[13px] font-semibold">How useful is DIAGNASSIS so far?</legend>
          <div role="radiogroup" aria-label="Rating" className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" role="radio" aria-checked={f.rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => { setF({ ...f, rating: i }); setErrors({ ...errors, rating: "" }); }} className="rounded-md p-1 hover:bg-amber-50"><Icon name="star" size={32} className={cn(i <= f.rating ? "text-amber-400" : "text-slate-300")} fill={i <= f.rating ? "#FBBF24" : "none"} /></button>
            ))}
          </div>
          {errors.rating ? <p role="alert" className="text-[13px] text-rose-700">{errors.rating}</p> : null}
        </fieldset>
        <fieldset>
          <legend className="font-display text-[13px] font-semibold">What is it about? (optional)</legend>
          <div role="radiogroup" aria-label="Topic" className="mt-2 grid gap-2 sm:grid-cols-2">{FEEDBACK_TOPICS.map((t) => <OptionCard key={t} selected={f.topic === t} onClick={() => setF({ ...f, topic: f.topic === t ? null : t })}>{t}</OptionCard>)}</div>
        </fieldset>
        <TextArea label="Your comments or suggestions" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} error={errors.message} maxLength={2000} hint={`${f.message.trim().length} / 2000 characters`} />
        <div><Button type="submit" size="lg" loading={busy}>Send feedback</Button></div>
      </form>
    </Card>
  );
}
