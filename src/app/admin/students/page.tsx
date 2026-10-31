import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, toneForBand } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader, StateBlock } from "@/components/ui/States";
import { bandFor } from "@/lib/scoring";
import { fmtDate } from "@/lib/format";
import { StudentFilters } from "@/components/admin/StudentFilters";

export const metadata: Metadata = { title: "Students" };
const PAGE = 25;

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const [{ data: rows, error }, { data: roles }] = await Promise.all([
    supabase.rpc("admin_list_students", { p_search: sp.q?.slice(0, 80) ?? null, p_role: sp.role ?? null, p_limit: PAGE, p_offset: (page - 1) * PAGE }),
    supabase.from("roles").select("name").order("name"),
  ]);
  if (error) return <><PageHeader title="Students" /><StateBlock tone="error" icon="cloud-off" title="Something went wrong loading this page" body="Nothing has been lost. Check your connection and try again." /></>;
  const total = rows?.[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.role ? { role: sp.role } : {}), page: String(p) })}`;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Students" subtitle={`${total} student${total === 1 ? "" : "s"}`} />
      <StudentFilters q={sp.q ?? ""} role={sp.role ?? ""} roles={(roles ?? []).map((r) => r.name)} />
      {!rows || rows.length === 0 ? (
        <StateBlock icon="users" title={sp.q || sp.role ? "No students match" : "No students yet"} body={sp.q || sp.role ? "Try a different search or clear the filters." : "Students appear here after they create an account."} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="text-xs uppercase text-ink-2"><th scope="col" className="pb-2 font-semibold">Student</th><th scope="col" className="pb-2 font-semibold">College</th><th scope="col" className="pb-2 font-semibold">Role</th><th scope="col" className="pb-2 font-semibold">Attempts</th><th scope="col" className="pb-2 font-semibold">Latest score</th><th scope="col" className="pb-2 font-semibold">Joined</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3"><Link href={`/admin/students/${s.id}`} className="font-semibold">{s.full_name || s.email}</Link><p className="text-xs text-ink-2">{s.email}</p></td>
                    <td className="py-3">{s.college ?? "–"}{s.year_of_study ? <span className="text-ink-2"> · {s.year_of_study} year</span> : null}</td>
                    <td className="py-3">{s.role_label ?? "–"}</td>
                    <td className="py-3 tabular-nums">{s.attempts}</td>
                    <td className="py-3">{s.latest_score === null ? <span className="text-ink-2">No attempts</span> : <Badge tone={toneForBand(bandFor(s.latest_score))}>{s.latest_score}</Badge>}</td>
                    <td className="py-3 text-ink-2">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 ? (
            <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
              {page > 1 ? <Link href={qs(page - 1)}>Previous</Link> : <span />}
              <span className="text-ink-2">Page {page} of {pages}</span>
              {page < pages ? <Link href={qs(page + 1)}>Next</Link> : <span />}
            </nav>
          ) : null}
        </Card>
      )}
    </div>
  );
}
