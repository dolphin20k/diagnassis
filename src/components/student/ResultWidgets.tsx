"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextArea } from "@/components/ui/Field";
import { Stars } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { submitFeedback } from "@/app/(student)/actions";
import { cn } from "@/components/ui/cn";

/** Generates the AI action plan if the submit step could not (e.g. the student closed the tab). */
export function InsightsLoader({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "failed">("loading");
  const started = useRef(false);
  async function run() {
    setState("loading");
    try {
      const res = await fetch(`/api/diagnostics/${attemptId}/insights`, { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setState("failed");
    }
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm">
      {state === "loading" ? <><span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden /> Writing your personalised action plan…</> : <><Icon name="circle-alert" className="text-amber-600" /> We could not write your personalised plan yet. <Button size="sm" variant="secondary" onClick={run}>Try again</Button></>}
    </div>
  );
}

export function RateResult({ attemptId, existing }: { attemptId: string; existing: number | null }) {
  const { toast } = useToast();
  const [rating, setRating] = useState(existing ?? 0);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(existing !== null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    if (rating < 1) return setErr("Choose a rating from 1 to 5.");
    setBusy(true);
    const res = await submitFeedback({ rating, topic: null, message: note, attemptId });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    setDone(true);
    toast("Thanks for rating this result");
  }
  return (
    <Card title="How useful was this result?" subtitle={done ? "Thanks, your rating helps us improve." : "Your rating goes to the DIAGNASSIS team."}>
      {done ? <Stars value={rating} size={24} /> : (
        <div className="flex flex-col gap-3">
          <div role="radiogroup" aria-label="Rating" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => { setRating(i); setErr(""); }} className="rounded-md p-1 hover:bg-amber-50">
                <Icon name="star" size={30} className={cn(i <= rating ? "text-amber-400" : "text-slate-300")} fill={i <= rating ? "#FBBF24" : "none"} />
              </button>
            ))}
          </div>
          <TextArea label="Anything to add? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
          {err ? <p role="alert" className="text-sm text-rose-700">{err}</p> : null}
          <div><Button onClick={send} loading={busy}>Send rating</Button></div>
        </div>
      )}
    </Card>
  );
}
