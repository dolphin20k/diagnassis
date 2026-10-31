import type { Metadata } from "next";
import Link from "next/link";
import { requireStudent } from "@/lib/server/auth";
import { getMyAttempts } from "@/lib/server/student";
import { Badge, toneForBand } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader, StateBlock } from "@/components/ui/States";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "History" };
export const dynamic = "force-dynamic";

function Graph({ points }: { points: { id: string; score: number; label: string; role: string }[] }) {
  const W = 720, H = 240, P = { l: 40, r: 20, t: 20, b: 36 };
  const x = (i: number) => (points.length === 1 ? (W - P.l - P.r) / 2 + P.l : P.l + (i * (W - P.l - P.r)) / (points.length - 1));
  const y = (s: number) => P.t + (1 - s / 100) * (H - P.t - P.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Readiness score over ${points.length} attempts: ${points.map((p) => `${p.label} ${p.score}`).join(", ")}`}>
      {[0, 25, 50, 75, 100].map((g) => (<g key={g}><line x1={P.l} x2={W - P.r} y1={y(g)} y2={y(g)} stroke="#E2E8F0" /><text x={P.l - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{g}</text></g>))}
      {points.slice(1).map((p, i) => <line key={p.id} x1={x(i)} y1={y(points[i]!.score)} x2={x(i + 1)} y2={y(p.score)} stroke="#06B6D4" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" />)}
      {points.map((p, i) => (
        <g key={p.id}>
          <circle cx={x(i)} cy={y(p.score)} r="7" fill="#fff" stroke="#4F46E5" strokeWidth="3" />
          <text x={x(i)} y={y(p.score) - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0F172A">{p.score}</text>
          <text x={x(i)} y={H - 12} textAnchor="middle" fontSize="11" fill="#64748B">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default async function HistoryPage() {
  await requireStudent();
  const attempts = (await getMyAttempts()).filter((a) => a.status === "submitted" && a.result);
  if (attempts.length === 0) return <><PageHeader title="History" /><StateBlock icon="history" title="No attempts yet" body="When you finish a diagnostic it will appear here, grouped by role." action={<LinkButton href="/diagnostic">Start diagnostic</LinkButton>} /></>;
  const points = attempts.map((a) => ({ id: a.id, score: a.score ?? 0, label: fmtDate(a.submitted_at).replace(/ \d{4}$/, ""), role: a.role_name }));
  const rows = [...attempts].reverse();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="History" subtitle="Every diagnostic you have completed, with your score trend." />
      <Card title="Readiness over time" subtitle="Dotted lines connect your attempts in order"><Graph points={points} /></Card>
      <Card title="Attempts">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="text-xs uppercase text-ink-2"><th scope="col" className="pb-2 font-semibold">Date</th><th scope="col" className="pb-2 font-semibold">Role</th><th scope="col" className="pb-2 font-semibold">Score</th><th scope="col" className="pb-2 font-semibold">Change</th><th scope="col" className="pb-2 font-semibold"><span className="sr-only">Open</span></th></tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((a) => {
                const d = a.result!.delta;
                return (
                  <tr key={a.id}>
                    <td className="py-3">{fmtDate(a.submitted_at)}</td>
                    <td className="py-3 font-semibold">{a.role_name}{a.is_custom_role ? <span className="ml-1.5 text-xs font-normal text-ink-2">AI-estimated</span> : null}</td>
                    <td className="py-3"><span className="mr-2 font-display font-bold">{a.score}</span><Badge tone={toneForBand(a.band ?? "")}>{a.band}</Badge></td>
                    <td className="py-3">{d === null ? <span className="text-ink-2">First for this role</span> : <span className={`inline-flex items-center gap-1 font-semibold ${d >= 0 ? "text-emerald-700" : "text-rose-700"}`}><Icon name={d >= 0 ? "trending-up" : "trending-down"} size={16} />{d >= 0 ? "+" : ""}{d}</span>}</td>
                    <td className="py-3 text-right"><Link href={`/results/${a.id}`} className="font-semibold">View result<span className="sr-only"> from {fmtDate(a.submitted_at)}</span></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
