"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Field, PasswordField, PasswordStrength, TextArea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { cancelDeletion, requestDeletion, updateSettings } from "@/app/(student)/actions";
import { passwordRules, passwordScore, resetSchema } from "@/lib/validation";
import { fmtDate } from "@/lib/format";
import type { NotificationPrefs } from "@/lib/types/database";

const PREFS: [keyof NotificationPrefs, string, string][] = [
  ["results", "Results ready", "When a diagnostic result has been generated."],
  ["report", "Report ready", "When a PDF report is ready to download."],
  ["platform", "Platform updates", "New roles, features and maintenance notices."],
  ["policy", "Policy updates", "When the Terms or Privacy Policy change."],
];

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div><p className="font-display text-[15px] font-semibold" id={`t-${label}`}>{label}</p><p className="text-sm text-ink-2">{desc}</p></div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`t-${label}`} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-primary" : "bg-slate-300"}`}><span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} /></button>
    </div>
  );
}

export function SettingsPanels({ name, email, prefs, hasPassword, deletionPending, accepted }: { name: string; email: string; prefs: NotificationPrefs; hasPassword: boolean; deletionPending: string | null; accepted: { at: string; p: { type: string; version: string } }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [nm, setNm] = useState(name);
  const [nmErr, setNmErr] = useState("");
  const [p, setP] = useState(prefs);
  const [pw, setPw] = useState({ cur: "", nw: "", cf: "" });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState("");

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const r = await updateSettings({ name: nm });
    if (!r.ok) return setNmErr(r.error);
    setNmErr("");
    toast("Account information updated");
    router.refresh();
  }
  async function setPref(k: keyof NotificationPrefs, v: boolean) {
    const next = { ...p, [k]: v };
    setP(next);
    const r = await updateSettings({ prefs: next });
    if (!r.ok) { setP(p); toast(r.error, "error"); } else toast("Preference saved");
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!pw.cur) err.cur = "Enter your current password.";
    const parsed = resetSchema.safeParse({ password: pw.nw, confirm: pw.cf });
    if (!parsed.success) for (const i of parsed.error.issues) err[i.path[0] === "password" ? "nw" : "cf"] ??= i.message;
    if (pw.nw && pw.nw === pw.cur) err.nw = "Choose a password different from your current one.";
    if (Object.keys(err).length) return setPwErr(err);
    setPwBusy(true);
    const sb = createClient();
    const { error: verr } = await sb.auth.signInWithPassword({ email, password: pw.cur });
    if (verr) { setPwBusy(false); return setPwErr({ cur: "That is not your current password." }); }
    const { error } = await sb.auth.updateUser({ password: pw.nw });
    setPwBusy(false);
    if (error) return setPwErr({ nw: "We could not update your password. Try a different one." });
    setPw({ cur: "", nw: "", cf: "" });
    setPwErr({});
    toast("Password updated");
  }
  async function sendReset() {
    await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    setResetSent(true);
    toast(`Reset link sent to ${email}`);
  }
  async function confirmDelete() {
    setDelBusy(true);
    const r = await requestDeletion(reason);
    setDelBusy(false);
    if (!r.ok) return setDelErr(r.error);
    setDelOpen(false);
    toast("Deletion request sent");
    router.refresh();
  }
  async function undoDelete() {
    await cancelDeletion();
    toast("Deletion request cancelled");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Account" subtitle="Your name appears on your results and reports.">
        <form onSubmit={saveName} className="flex flex-col gap-4" noValidate>
          <Field label="Full name" value={nm} onChange={(e) => setNm(e.target.value)} error={nmErr} />
          <Field label="Email address" value={email} disabled hint="Your email is managed by your sign-in method and cannot be changed here." readOnly />
          <div><Button type="submit" disabled={nm.trim() === name}>Save changes</Button></div>
        </form>
      </Card>

      <Card title="Password">
        {hasPassword ? (
          <>
            <form onSubmit={changePassword} className="flex flex-col gap-4" noValidate>
              <PasswordField label="Current password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} error={pwErr.cur} />
              <PasswordField label="New password" autoComplete="new-password" value={pw.nw} onChange={(e) => setPw({ ...pw, nw: e.target.value })} error={pwErr.nw} />
              <PasswordStrength score={passwordScore(pw.nw)} rules={passwordRules(pw.nw)} />
              <PasswordField label="Confirm new password" autoComplete="new-password" value={pw.cf} onChange={(e) => setPw({ ...pw, cf: e.target.value })} error={pwErr.cf} />
              <div className="flex flex-wrap items-center gap-3"><Button type="submit" loading={pwBusy}>Update password</Button><Button variant="ghost" onClick={sendReset} disabled={resetSent}>{resetSent ? "Reset link sent" : "Forgot it? Email me a reset link"}</Button></div>
            </form>
          </>
        ) : <p className="text-ink-2">You sign in with Google, so your password is managed by your Google account.</p>}
      </Card>

      <Card title="Notification preferences" subtitle="Choose which updates appear in your notifications.">
        <div className="divide-y divide-border">{PREFS.map(([k, l, d]) => <Toggle key={k} checked={p[k] !== false} onChange={(v) => setPref(k, v)} label={l} desc={d} />)}</div>
      </Card>

      <Card title="Privacy" subtitle="Only you and the platform administrator can see your individual results.">
        <ul className="flex flex-col gap-2 text-[15px]">
          {accepted.length === 0 ? <li className="text-ink-2">No policy acceptances recorded yet.</li> : accepted.map((a) => <li key={a.p.type + a.p.version} className="flex items-center gap-2"><Icon name="circle-check" className="text-emerald-600" size={16} />Accepted {a.p.type === "terms" ? "Terms & Conditions" : "Privacy Policy"} v{a.p.version} on {fmtDate(a.at)}</li>)}
        </ul>
        <p className="mt-3 flex gap-4 text-sm"><Link href="/terms">Read Terms &amp; Conditions</Link><Link href="/privacy">Read Privacy Policy</Link></p>
      </Card>

      <Card title="Delete my account">
        {deletionPending ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-amber-50 p-4" role="status"><p className="text-amber-900"><strong>Deletion requested on {fmtDate(deletionPending)}.</strong> The administrator will review it. Your account stays active until then.</p><Button variant="secondary" onClick={undoDelete}>Cancel request</Button></div>
        ) : (
          <><p className="text-ink-2">Ask the administrator to permanently delete your account, results, reports and feedback. This cannot be undone once approved.</p><Button variant="danger" className="mt-4" onClick={() => setDelOpen(true)}><Icon name="trash-2" size={16} /> Request account deletion</Button></>
        )}
      </Card>

      <form action="/auth/signout" method="post"><Button type="submit" variant="secondary"><Icon name="log-out" size={16} /> Log out</Button></form>

      <Dialog open={delOpen} onClose={() => setDelOpen(false)} title="Request account deletion?" description="An administrator will review your request. If approved, all of your data is permanently deleted.">
        <TextArea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        {delErr ? <p role="alert" className="mt-2 text-sm text-rose-700">{delErr}</p> : null}
        <div className="mt-5 flex justify-end gap-3"><Button variant="secondary" onClick={() => setDelOpen(false)}>Keep my account</Button><Button variant="danger" onClick={confirmDelete} loading={delBusy}>Send request</Button></div>
      </Dialog>
    </div>
  );
}
