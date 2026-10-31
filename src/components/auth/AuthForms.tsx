"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, PasswordField, PasswordStrength } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { forgotSchema, loginSchema, passwordRules, passwordScore, resetSchema, signupSchema } from "@/lib/validation";
import { safeNext } from "@/lib/safe-redirect";
import { cn } from "@/components/ui/cn";

type Errors = Record<string, string>;
const fieldErrors = (issues: { path: (string | number)[]; message: string }[]): Errors => {
  const e: Errors = {};
  for (const i of issues) if (!e[String(i.path[0])]) e[String(i.path[0])] = i.message;
  return e;
};
const origin = () => window.location.origin;
const NETWORK_ERROR = "We could not reach the server. Check your connection and try again.";

function Tabs({ active }: { active: "login" | "signup" }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-white/50 p-1" role="tablist" aria-label="Account">
      {(["login", "signup"] as const).map((k) => (
        <Link key={k} href={`/${k}`} role="tab" aria-selected={active === k} className={cn("rounded-lg py-3 text-center font-display text-sm font-semibold", active === k ? "bg-white text-primary-dark shadow-[0_2px_8px_rgba(79,70,229,.18)]" : "text-slate-600 hover:text-primary-dark")}>
          {k === "login" ? "Log in" : "Sign up"}
        </Link>
      ))}
    </div>
  );
}

function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true);
    setErr("");
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin()}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) {
      setBusy(false);
      setErr("Google sign-in is not available right now. Use your email and password instead.");
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-xs text-ink-3"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
      <Button variant="secondary" size="lg" className="w-full" onClick={go} loading={busy}>
        <span aria-hidden className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-white">G</span> Continue with Google
      </Button>
      {err ? <p role="alert" className="text-[13px] text-rose-700">{err}</p> : null}
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const urlErr = useSearchParams().get("error");
  const [f, setF] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Errors>(urlErr ? { form: "We could not complete that sign-in. Please try again." } : {});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse(f);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setBusy(true);
    setErrors({});
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
      if (error) {
        const offline = /fetch|network|retryable/i.test(`${error.name} ${error.message}`);
        return setErrors({ form: offline ? NETWORK_ERROR : /confirm/i.test(error.message) ? "Confirm your email first. We sent you a link when you signed up." : "That email and password do not match. Try again or reset your password." });
      }
      router.replace(next);
      router.refresh();
    } catch {
      setErrors({ form: NETWORK_ERROR });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Tabs active="login" />
      <h1 className="text-[28px]">Welcome back</h1>
      <p className="mb-5 mt-1 text-ink-2">Log in to continue your diagnostic.</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {errors.form ? <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{errors.form}</p> : null}
        <Field label="Email address" type="email" autoComplete="email" placeholder="you@college.edu" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} />
        <PasswordField label="Password" autoComplete="current-password" placeholder="Your password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={errors.password} />
        <div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-semibold">Forgot password?</Link></div>
        <Button type="submit" size="lg" loading={busy} className="w-full">{busy ? "Logging in…" : "Log in"}</Button>
        <GoogleButton next={next} />
      </form>
    </>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "", agree: false });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const rules = passwordRules(f.password);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse(f);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setBusy(true);
    setErrors({});
    try {
      const { data, error } = await createClient().auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { data: { full_name: parsed.data.name }, emailRedirectTo: `${origin()}/auth/callback?next=/accept-policies` },
      });
      if (error) return setErrors({ form: /registered|exists/i.test(error.message) ? "An account with that email already exists. Log in instead." : "We could not create your account. Please try again." });
      // Supabase returns an empty identities list (no error) for an already-registered email.
      if (data.user && data.user.identities?.length === 0) return setErrors({ form: "An account with that email already exists. Log in instead." });
      if (data.session) {
        router.replace("/accept-policies");
        router.refresh();
      } else setSent(true);
    } catch {
      setErrors({ form: "We could not create your account. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
        <span className="grid size-16 place-items-center rounded-full bg-indigo-50 text-primary"><Icon name="mail-check" size={30} /></span>
        <h1 className="text-2xl">Check your email</h1>
        <p className="max-w-sm text-ink-2">We sent a confirmation link to <strong className="text-ink">{f.email}</strong>. Open it to finish creating your account.</p>
        <Link href="/login" className="font-semibold">Back to log in</Link>
      </div>
    );

  return (
    <>
      <Tabs active="signup" />
      <h1 className="text-[28px]">Create your account</h1>
      <p className="mb-5 mt-1 text-ink-2">Free for students. Takes less than a minute.</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {errors.form ? <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{errors.form}</p> : null}
        <Field label="Full name" autoComplete="name" placeholder="e.g. Priya Raghavan" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
        <Field label="Email address" type="email" autoComplete="email" placeholder="you@college.edu" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} />
        <PasswordField label="Password" autoComplete="new-password" placeholder="Create a password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={errors.password} />
        <PasswordStrength score={passwordScore(f.password)} rules={rules} />
        <PasswordField label="Confirm password" autoComplete="new-password" placeholder="Type it again" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} error={errors.confirm} />
        <div>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} aria-invalid={errors.agree ? true : undefined} className="mt-0.5 size-5 accent-[var(--primary)]" />
            <span>I agree to the <Link href="/terms" target="_blank">Terms &amp; Conditions</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span>
          </label>
          {errors.agree ? <p role="alert" className="mt-1 text-[13px] text-rose-700">{errors.agree}</p> : null}
        </div>
        <Button type="submit" size="lg" loading={busy} className="w-full">{busy ? "Creating account…" : "Create account"}</Button>
        <GoogleButton next="/dashboard" />
      </form>
    </>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = forgotSchema.safeParse({ email });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? "Enter a valid email.");
    setBusy(true);
    setErr("");
    // The response is identical whether or not the account exists (no account enumeration).
    try {
      await createClient().auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin()}/auth/callback?next=/reset-password` });
      setSent(true);
    } catch {
      setErr(NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  }
  if (sent)
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
        <span className="grid size-16 place-items-center rounded-full bg-indigo-50 text-primary"><Icon name="mail-check" size={30} /></span>
        <h1 className="text-2xl">Check your email</h1>
        <p className="max-w-sm text-ink-2">If an account exists for <strong className="text-ink">{email}</strong>, a reset link is on its way. It expires in one hour.</p>
        <Button variant="secondary" onClick={() => setSent(false)}>Use a different email</Button>
        <Link href="/login" className="font-semibold">Back to log in</Link>
      </div>
    );
  return (
    <>
      <h1 className="text-[28px]">Reset your password</h1>
      <p className="mb-5 mt-1 text-ink-2">Enter your email and we will send you a link to choose a new password.</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Email address" type="email" autoComplete="email" placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} error={err} />
        <Button type="submit" size="lg" loading={busy} className="w-full">{busy ? "Sending…" : "Send reset link"}</Button>
        <Link href="/login" className="text-center text-sm font-semibold">Back to log in</Link>
      </form>
    </>
  );
}

export function ResetForm() {
  const router = useRouter();
  const [f, setF] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = resetSchema.safeParse(f);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password: parsed.data.password });
      if (error) return setErrors({ form: "That link has expired or the password was rejected. Request a new reset link." });
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrors({ form: NETWORK_ERROR });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1 className="text-[28px]">Choose a new password</h1>
      <p className="mb-5 mt-1 text-ink-2">Pick something you have not used before.</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {errors.form ? <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{errors.form}</p> : null}
        <PasswordField label="New password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} error={errors.password} />
        <PasswordStrength score={passwordScore(f.password)} rules={passwordRules(f.password)} />
        <PasswordField label="Confirm new password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} error={errors.confirm} />
        <Button type="submit" size="lg" loading={busy} className="w-full">{busy ? "Saving…" : "Update password"}</Button>
      </form>
    </>
  );
}

/** Landing-page call to action: Google OAuth, with a plain sign-up fallback link when it is unavailable. */
export function GoogleCta({ className, label = "Sign in with Google" }: { className?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    setBusy(true);
    setErr("");
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin()}/auth/callback?next=/dashboard` } });
    if (error) {
      setBusy(false);
      setErr("Google sign-in is unavailable right now. Please sign up with your email.");
    }
  }
  return (
    <span className="inline-flex flex-col gap-1.5">
      <Button variant="white" size="lg" className={className} onClick={go} loading={busy}>
        <span aria-hidden className="grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-white">G</span> {label}
      </Button>
      {err ? <span role="alert" className="text-[13px] text-white">{err} <Link href="/signup" className="font-semibold text-white underline">Sign up</Link></span> : null}
    </span>
  );
}
