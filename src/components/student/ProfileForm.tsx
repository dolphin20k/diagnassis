"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { OptionCard, SkillPicker } from "@/components/student/SkillPicker";
import { saveProfile } from "@/app/(student)/actions";
import { BRANCHES, YEARS, profileSchema } from "@/lib/validation";
import type { ProfileRow } from "@/lib/types/database";

export interface RoleOption { id: string; name: string }
const OTHERS = "others";

export function ProfileForm({ profile, roles, skills, mode, onDone, onSkip }: { profile: ProfileRow; roles: RoleOption[]; skills: string[]; mode: "onboard" | "edit"; onDone?: () => void; onSkip?: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [f, setF] = useState({
    name: profile.full_name,
    college: profile.college ?? "",
    branch: profile.branch ?? "",
    year: (profile.year_of_study ?? "") as "" | "3rd" | "4th",
    skills: profile.skills,
    role: profile.target_role_id ?? (profile.target_role_other ? OTHERS : ""),
    other: profile.target_role_other ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = { name: f.name, college: f.college, branch: f.branch, year: f.year as "3rd" | "4th", skills: f.skills, roleId: f.role && f.role !== OTHERS ? f.role : null, roleOther: f.role === OTHERS ? f.other : f.role ? null : null };
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      const m: Record<string, string> = {};
      for (const i of parsed.error.issues) if (!m[String(i.path[0])]) m[String(i.path[0])] = i.message;
      if (!f.role) m.role = "Choose a target role.";
      else if (f.role === OTHERS && !f.other.trim()) m.role = "Type the role you are aiming for.";
      return setErrors(m);
    }
    setBusy(true);
    setErrors({});
    const res = await saveProfile(parsed.data);
    setBusy(false);
    if (!res.ok) return setErrors({ ...(res.fieldErrors ?? {}), form: res.error });
    toast(mode === "edit" ? "Profile updated" : "Profile saved. You can start a diagnostic now.");
    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {errors.form && !Object.keys(errors).some((k) => k !== "form") ? <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{errors.form}</p> : null}
      <Field label="Full name" value={f.name} onChange={(e) => set("name", e.target.value)} error={errors.name} autoComplete="name" />
      <Field label="College / institution" value={f.college} onChange={(e) => set("college", e.target.value)} error={errors.college} placeholder="e.g. PSG College of Technology, Coimbatore" />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="branch" className="font-display text-[13px] font-semibold">Branch / specialization</label>
        <select id="branch" value={f.branch} onChange={(e) => set("branch", e.target.value)} aria-invalid={errors.branch ? true : undefined} className={`rounded-md border bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--focus-ring)] ${errors.branch ? "border-gap-critical" : "border-border"}`}>
          <option value="">Choose your branch</option>
          {BRANCHES.map((b) => <option key={b}>{b}</option>)}
          {f.branch && !(BRANCHES as readonly string[]).includes(f.branch) ? <option>{f.branch}</option> : null}
        </select>
        {errors.branch ? <p role="alert" className="text-[13px] text-rose-700">{errors.branch}</p> : null}
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="font-display text-[13px] font-semibold">Current year of study</legend>
        <div role="radiogroup" aria-label="Year of study" className="grid grid-cols-2 gap-3">
          {YEARS.map((y) => <OptionCard key={y} selected={f.year === y} onClick={() => set("year", y)}>{y} year</OptionCard>)}
        </div>
        {errors.year ? <p role="alert" className="text-[13px] text-rose-700">{errors.year}</p> : null}
      </fieldset>
      <SkillPicker value={f.skills} onChange={(v) => set("skills", v)} catalog={skills} error={errors.skills} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="font-display text-[13px] font-semibold">Preferred / target career role</legend>
        <div role="radiogroup" aria-label="Target role" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {roles.map((r) => <OptionCard key={r.id} selected={f.role === r.id} onClick={() => set("role", r.id)}>{r.name}</OptionCard>)}
          <OptionCard selected={f.role === OTHERS} onClick={() => set("role", OTHERS)}>Others</OptionCard>
        </div>
        {f.role === OTHERS ? <Field label="Type the role you are aiming for" value={f.other} onChange={(e) => set("other", e.target.value)} placeholder="e.g. Game Developer" hint="Requirements for typed roles are estimated by AI and may be less precise." error={errors.role} /> : errors.role ? <p role="alert" className="text-[13px] text-rose-700">{errors.role}</p> : null}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" loading={busy} size="lg">{mode === "onboard" ? "Save & Continue" : "Save changes"}</Button>
        {onSkip ? <Button variant="ghost" size="lg" onClick={onSkip}>Skip for now</Button> : null}
        {mode === "edit" && onDone ? <Button variant="ghost" size="lg" onClick={onDone}>Cancel</Button> : null}
      </div>
    </form>
  );
}
