"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { setAttemptLimit } from "@/app/admin/actions";
import { updateSettings } from "@/app/(student)/actions";
import type { NotificationPrefs } from "@/lib/types/database";

const PREFS: [keyof NotificationPrefs, string, string][] = [
  ["deletion", "Deletion requests", "When a student asks for their account to be deleted."],
  ["roles", "New role requests", "When students type roles that are not curated yet."],
  ["trends", "Market trend refreshes", "When the automatic market research finishes."],
  ["rating", "Low ratings", "When a student rates a result or the platform 2 stars or lower."],
];
interface Health { ai: { ok: boolean; model: string; detail: string }; r2: { configured: boolean }; cron: { secretConfigured: boolean }; serviceRole: { configured: boolean } }

export function AdminSettings({ email, name, limit, prefs }: { email: string; name: string; limit: number; prefs: NotificationPrefs }) {
  const router = useRouter();
  const { toast } = useToast();
  const [lim, setLim] = useState(String(limit));
  const [err, setErr] = useState("");
  const [p, setP] = useState(prefs);
  const [health, setHealth] = useState<Health | null | "error">(null);

  useEffect(() => {
    fetch("/api/admin/ai-health").then((r) => (r.ok ? r.json() : Promise.reject())).then(setHealth).catch(() => setHealth("error"));
  }, []);

  async function saveLimit() {
    const n = Number(lim);
    if (!Number.isInteger(n) || n < 1 || n > 50) return setErr("Enter a whole number from 1 to 50.");
    const r = await setAttemptLimit(n);
    if (!r.ok) return setErr(r.error);
    setErr("");
    toast("Attempt limit updated");
    router.refresh();
  }
  async function setPref(k: keyof NotificationPrefs, v: boolean) {
    const next = { ...p, [k]: v };
    setP(next);
    const r = await updateSettings({ prefs: next });
    if (!r.ok) { setP(p); toast(r.error, "error"); } else toast("Preference saved");
  }
  const row = (label: string, ok: boolean | undefined, detail: string) => (
    <li className="flex items-center justify-between gap-3 py-2.5"><span>{label}</span><span className="flex items-center gap-2 text-sm text-ink-2">{detail}<Badge tone={ok ? "strong" : "critical"}>{ok ? "OK" : "Not ready"}</Badge></span></li>
  );
  return (
    <div className="flex flex-col gap-6">
      <Card title="Diagnostic limit" subtitle="How many diagnostics each student can run in total.">
        <div className="flex flex-wrap items-end gap-3"><Field label="Attempts per student" type="number" min={1} max={50} value={lim} onChange={(e) => setLim(e.target.value)} error={err} className="w-48" /><Button onClick={saveLimit} disabled={lim === String(limit)}>Save limit</Button></div>
      </Card>
      <Card title="Notification preferences">
        <div className="divide-y divide-border">
          {PREFS.map(([k, l, d]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-3.5"><div><p className="font-display text-[15px] font-semibold" id={`a-${k}`}>{l}</p><p className="text-sm text-ink-2">{d}</p></div>
              <button type="button" role="switch" aria-checked={p[k] !== false} aria-labelledby={`a-${k}`} onClick={() => setPref(k, p[k] === false)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${p[k] !== false ? "bg-primary" : "bg-slate-300"}`}><span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${p[k] !== false ? "left-[22px]" : "left-0.5"}`} /></button></div>
          ))}
        </div>
      </Card>
      <Card title="Integrations" subtitle="Checked from the server just now. Secret values are never shown.">
        {health === null ? <p className="text-ink-2" role="status">Checking…</p> : health === "error" ? <p role="alert" className="text-rose-700">Could not check integrations.</p> : (
          <ul className="divide-y divide-border">
            {row("NVIDIA AI", health.ai.ok, `${health.ai.detail}${health.ai.model ? ` · ${health.ai.model}` : ""}`)}
            {row("Supabase service role (AI features, research)", health.serviceRole.configured, health.serviceRole.configured ? "Configured" : "Set SUPABASE_SERVICE_ROLE_KEY")}
            {row("Cloudflare R2 report storage", health.r2.configured, health.r2.configured ? "Private bucket" : "Not configured: reports are generated on demand")}
            {row("Scheduled research secret", health.cron.secretConfigured, health.cron.secretConfigured ? "Configured" : "Set CRON_SECRET (24+ characters)")}
          </ul>
        )}
      </Card>
      <Card title="Account"><p className="text-[15px]"><Icon name="user" size={16} className="mr-1.5 inline" />{name || "Administrator"} · {email}</p><form action="/auth/signout" method="post" className="mt-4"><Button type="submit" variant="secondary"><Icon name="log-out" size={16} /> Log out</Button></form></Card>
    </div>
  );
}
