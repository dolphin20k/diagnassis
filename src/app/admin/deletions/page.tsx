import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeletionActions } from "@/components/admin/DeletionActions";
import { Badge, type Tone } from "@/components/ui/Badge";
import { PageHeader, StateBlock } from "@/components/ui/States";
import { cn } from "@/components/ui/cn";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Deletion requests" };
const TABS = [["pending", "Pending"], ["approved", "Approved"], ["denied", "Denied"], ["cancelled", "Cancelled"]] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find(([k]) => k === sp.tab)?.[0] ?? "pending";
  const supabase = await createClient();
  const { data, error } = await supabase.from("deletion_requests").select("*").eq("status", tab).order("requested_at", { ascending: false }).limit(100);
  if (error) return <><PageHeader title="Deletion requests" /><StateBlock tone="error" icon="cloud-off" title="Something went wrong loading this page" body="Nothing has been lost. Check your connection and try again." /></>;
  const tone: Record<string, Tone> = { pending: "attention", approved: "strong", denied: "neutral", cancelled: "neutral" };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Deletion requests" subtitle="Approving a request permanently deletes the student's account, results, reports and feedback." />
      <nav aria-label="Status" className="flex flex-wrap gap-2">{TABS.map(([k, l]) => <Link key={k} href={`?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold hover:no-underline", tab === k ? "border-primary bg-primary text-white hover:text-white" : "border-border bg-surface text-ink")}>{l}</Link>)}</nav>
      {data.length === 0 ? <StateBlock icon="user-x" title={`No ${tab} requests`} body={tab === "pending" ? "You are all caught up. New requests will appear here." : "Nothing to show here."} /> : (
        <ul className="grid gap-3">
          {data.map((d) => (
            <li key={d.id} className="rounded-lg bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0"><p className="font-display text-lg font-bold">{d.student_name || d.student_email} <Badge tone={tone[d.status] ?? "neutral"}>{d.status[0]!.toUpperCase() + d.status.slice(1)}</Badge></p><p className="text-sm text-ink-2">{d.student_email}{d.college ? ` · ${d.college}` : ""}</p><p className="mt-1 text-sm text-ink-2">Requested {fmtDate(d.requested_at)} · {d.attempt_count} diagnostic{d.attempt_count === 1 ? "" : "s"}</p><p className="mt-2">{d.reason || <span className="text-ink-3">No reason given.</span>}</p></div>
                {d.status === "pending" ? <DeletionActions id={d.id} name={d.student_name || d.student_email} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
