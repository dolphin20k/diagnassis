import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PolicyEditor } from "@/components/admin/PolicyEditor";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/States";
import { cn } from "@/components/ui/cn";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Policies" };

export default async function Page({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const sp = await searchParams;
  const doc = sp.doc === "terms" ? "terms" : "privacy";
  const supabase = await createClient();
  const [{ data: history }, { count: students }] = await Promise.all([
    supabase.from("policies").select("id,version,published_at,body,change_note,policy_acceptances(count)").eq("type", doc).order("published_at", { ascending: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
  ]);
  const list = (history ?? []) as unknown as { id: string; version: string; published_at: string; body: string; change_note: string | null; policy_acceptances: { count: number }[] }[];
  const current = list[0];
  const next = current ? (() => { const p = current.version.split("."); p[1] = String(Number(p[1] ?? 0) + 1); return p.slice(0, 2).join("."); })() : "1.0";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Policies" subtitle="Publishing a new version asks every student to review and accept it before they continue." />
      <nav aria-label="Document" className="flex gap-2">{([["privacy", "Privacy Policy"], ["terms", "Terms & Conditions"]] as const).map(([k, l]) => <Link key={k} href={`?doc=${k}`} aria-current={doc === k ? "page" : undefined} className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold hover:no-underline", doc === k ? "border-primary bg-primary text-white hover:text-white" : "border-border bg-surface text-ink")}>{l}</Link>)}</nav>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <PolicyEditor key={doc + (current?.version ?? "")} type={doc} currentVersion={current?.version ?? null} suggestedVersion={next} initialBody={current?.body ?? ""} studentCount={students ?? 0} />
        <Card title="Version history">
          {list.length === 0 ? <p className="text-ink-2">Nothing published yet.</p> : (
            <ul className="divide-y divide-border">
              {list.map((p, i) => {
                const accepted = p.policy_acceptances?.[0]?.count ?? 0;
                return <li key={p.id} className="py-3"><p className="font-display font-bold">v{p.version}{i === 0 ? <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Current</span> : null}</p><p className="text-sm text-ink-2">{fmtDate(p.published_at)} · {students ? Math.round((accepted / students) * 100) : 0}% of students accepted ({accepted})</p>{p.change_note ? <p className="mt-0.5 text-sm">{p.change_note}</p> : null}</li>;
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
