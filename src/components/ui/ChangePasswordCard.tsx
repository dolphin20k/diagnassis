"use client";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PasswordField, PasswordStrength } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { passwordRules, passwordScore, resetSchema } from "@/lib/validation";

/** "Change password" card shared by the student and admin Settings pages. */
export function ChangePasswordCard({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const { toast } = useToast();
  const [pw, setPw] = useState({ cur: "", nw: "", cf: "" });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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

  return (
    <Card title="Password">
      {hasPassword ? (
        <form onSubmit={changePassword} className="flex flex-col gap-4" noValidate>
          <PasswordField label="Current password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} error={pwErr.cur} />
          <PasswordField label="New password" autoComplete="new-password" value={pw.nw} onChange={(e) => setPw({ ...pw, nw: e.target.value })} error={pwErr.nw} />
          <PasswordStrength score={passwordScore(pw.nw)} rules={passwordRules(pw.nw)} />
          <PasswordField label="Confirm new password" autoComplete="new-password" value={pw.cf} onChange={(e) => setPw({ ...pw, cf: e.target.value })} error={pwErr.cf} />
          <div className="flex flex-wrap items-center gap-3"><Button type="submit" loading={pwBusy}>Update password</Button><Button variant="ghost" onClick={sendReset} disabled={resetSent}>{resetSent ? "Reset link sent" : "Forgot it? Email me a reset link"}</Button></div>
        </form>
      ) : <p className="text-ink-2">You sign in with Google, so your password is managed by your Google account.</p>}
    </Card>
  );
}
