import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Stars, PageHeader, StateBlock } from "@/components/ui/States";
import { cn } from "@/components/ui/cn";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Feedback" };

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string; max?: string }> }) {
  const sp = await searchParams;
  const kind = sp.kind === "result" || sp.kind === "general" ? sp.kind : "all";
  const max = [1, 2, 3, 4].includes(Number(sp.max)) ? Number(sp.max) : 5;
  const supabase = await createClient();
  let q = supabase.from("feedback").select("*,profiles(full_name,email),attempts(role_name,score)").order("created_at", { ascending: false }).limit(100);
  if (kind !== "all") q = q.eq("kind", kind);
  if (max < 5) q = q.lte("rating", max);
  const [{ data, error }, { data: all }] = await Promise.all([q, supabase.from("feedback").select("rating")]);
  if (error) return <><PageHeader title="Feedback" /><StateBlock tone="error" icon="cloud-off" title="Something went wrong loading this page" body="Nothing has been lost. Check your connection and try again." /></>;
  const ratings = (all ?? []).map((r) => r.rating);
  const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : "–";
  const rows = (data ?? []) as unknown as { id: string; kind: string; rating: number; topic: string | null; message: string; created_at: string; user_id: string; profiles: { full_name: string; email: string } | { full_name: string; email: string }[] | null; attempts: { role_name: string; score: number } | { role_name: string; score: number }[] | null }[];
  const chip = (active: boolean) => cn("rounded-full border px-4 py-1.5 text-sm font-semibold hover:no-underline", active ? "border-primary bg-primary text-white hover:text-white" : "border-border bg-surface text-ink");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Feedback" subtitle={`${ratings.length} ratings · average ${avg} out of 5`} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
        {([["all", "All"], ["result", "Result ratings"], ["general", "General"]] as const).map(([k, l]) => <Link key={k} href={`?kind=${k}&max=${max}`} className={chip(kind === k)}>{l}</Link>)}
        <span className="mx-1 w-px bg-border" aria-hidden />
        {[[5, "Any rating"], [2, "2 stars or lower"], [3, "3 stars or lower"]].map(([m, l]) => <Link key={m} href={`?kind=${kind}&max=${m}`} className={chip(max === m)}>{l}</Link>)}
      </div>
      {rows.length === 0 ? <StateBlock icon="message-square" title="No feedback yet" body="Result ratings and general feedback from students will appear here." /> : (
        <ul className="grid gap-3">
          {rows.map((f) => {
            const who = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
            const at = Array.isArray(f.attempts) ? f.attempts[0] : f.attempts;
            return (
              <li key={f.id} className="rounded-lg bg-surface p-5 shadow-card">
                <div className="flex flex-wrap items-center gap-3"><Stars value={f.rating} /><Badge tone={f.kind === "result" ? "info" : "fill"}>{f.kind === "result" ? "Result rating" : "General"}</Badge><span className="text-sm text-ink-2">{who?.full_name || who?.email} · {fmtDate(f.created_at)}</span></div>
                <p className="mt-1 text-xs text-ink-2">{at ? `${at.role_name} · score ${at.score}` : f.topic ? `Topic: ${f.topic}` : ""}</p>
                {f.message ? <p className="mt-2 whitespace-pre-line">{f.message}</p> : <p className="mt-2 text-ink-3">No comment.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
