import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/server/api";
import { Badge, toneForBand, toneForStatus } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Stars } from "@/components/ui/States";
import { SkillBar } from "@/components/ui/SkillBar";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Student detail" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ attempt?: string }> }) {
  const { id } = await params;
  const { attempt } = await searchParams;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data: s } = await supabase.from("profiles").select("*").eq("id", id).eq("role", "student").maybeSingle();
  if (!s) notFound();
  const [{ data: attempts }, { data: feedback }, { data: role }] = await Promise.all([
    supabase.from("attempts").select("id,role_name,status,score,band,result,submitted_at,started_at,is_custom_role").eq("user_id", id).order("started_at", { ascending: false }),
    supabase.from("feedback").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    s.target_role_id ? supabase.from("roles").select("name").eq("id", s.target_role_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const list = attempts ?? [];
  const sel = list.find((a) => a.id === attempt) ?? list.find((a) => a.status === "submitted") ?? null;
  const rows = sel?.result?.rows ?? [];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/students" className="inline-flex items-center gap-1.5 text-sm font-semibold"><Icon name="arrow-left" size={16} /> Students</Link>
        <h1 className="mt-2 text-[clamp(26px,3vw,34px)]">{s.full_name || s.email}</h1>
        <p className="text-ink-2">{s.email} · Joined {fmtDate(s.created_at)}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Details">
          <dl className="grid gap-3 text-[15px]">
            {([["College", s.college], ["Branch", s.branch], ["Year", s.year_of_study ? `${s.year_of_study} year` : null], ["Target role", role?.name ?? s.target_role_other]] as const).map(([k, v]) => <div key={k}><dt className="text-[13px] text-ink-2">{k}</dt><dd className="font-semibold">{v || <span className="font-normal text-ink-3">Not added</span>}</dd></div>)}
            <div><dt className="text-[13px] text-ink-2">Skills</dt><dd className="mt-1 flex flex-wrap gap-1.5">{s.skills.length ? s.skills.map((k) => <Badge key={k} tone="info">{k}</Badge>) : <span className="text-ink-3">None</span>}</dd></div>
          </dl>
        </Card>
        <Card title="Diagnostic attempts" subtitle={`${list.length} attempt${list.length === 1 ? "" : "s"}`}>
          {list.length === 0 ? <p className="text-ink-2">This student has not started a diagnostic yet.</p> : (
            <ul className="flex flex-wrap gap-2">
              {list.map((a) => (
                <li key={a.id}>
                  <Link href={`?attempt=${a.id}`} aria-current={sel?.id === a.id ? "true" : undefined} className={`block rounded-lg border-2 px-3 py-2 text-sm hover:no-underline ${sel?.id === a.id ? "border-primary bg-indigo-50" : "border-border"}`}>
                    <span className="block font-semibold">{a.role_name}</span>
                    <span className="text-xs text-ink-2">{a.status === "submitted" ? `${fmtDate(a.submitted_at)} · ` : "In progress · "}{a.score ?? "–"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {sel?.result ? (
        <Card title={`${sel.role_name} result`} subtitle={`${fmtDate(sel.submitted_at)} · score ${sel.score} · ${sel.result.tested_count} skills tested`} action={sel.band ? <Badge tone={toneForBand(sel.band)}>{sel.band}</Badge> : null}>
          <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">{[...rows].sort((a, b) => b.weight - a.weight).map((r) => <SkillBar key={r.skill} label={r.skill} value={r.proficiency} status={r.tested ? r.status : "missing"} trailing={r.tested ? `${r.proficiency}%` : "Not claimed"} />)}</div>
          <p className="mt-4 flex flex-wrap gap-2 text-sm">{(["matched", "weak", "missing"] as const).map((st) => <Badge key={st} tone={toneForStatus(st)}>{rows.filter((r) => r.status === st).length} {st}</Badge>)}</p>
        </Card>
      ) : null}
      <Card title="Feedback from this student">
        {(feedback ?? []).length === 0 ? <p className="text-ink-2">No feedback yet.</p> : <ul className="divide-y divide-border">{(feedback ?? []).map((f) => <li key={f.id} className="py-3"><div className="flex items-center gap-3"><Stars value={f.rating} /><span className="text-xs text-ink-2">{f.kind === "result" ? "Result rating" : f.topic ?? "General"} · {fmtDate(f.created_at)}</span></div>{f.message ? <p className="mt-1">{f.message}</p> : null}</li>)}</ul>}
      </Card>
    </div>
  );
}
