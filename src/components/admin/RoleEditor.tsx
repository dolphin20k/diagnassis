"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { saveRoleSkills, setRoleActive } from "@/app/admin/actions";
import { weightsTotal } from "@/lib/scoring/weights";
import { trendLabel } from "@/lib/scoring";
import type { SkillPriority, SkillTrend } from "@/lib/types/database";

export interface RoleItem { skill: string; weight: number; priority: SkillPriority; trend?: SkillTrend; trendChange?: string | null }

export function WeightsTable({ items, onChange, showTrend }: { items: RoleItem[]; onChange: (i: RoleItem[]) => void; showTrend?: boolean }) {
  const total = weightsTotal(items);
  const ok = Math.abs(total - 100) < 0.01;
  const upd = (idx: number, patch: Partial<RoleItem>) => onChange(items.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead><tr className="text-xs uppercase text-ink-2"><th scope="col" className="pb-2 font-semibold">Skill</th><th scope="col" className="pb-2 font-semibold">Weight %</th><th scope="col" className="pb-2 font-semibold">Priority</th>{showTrend ? <th scope="col" className="pb-2 font-semibold">Market trend</th> : null}<th scope="col" className="pb-2"><span className="sr-only">Remove</span></th></tr></thead>
          <tbody className="divide-y divide-border">
            {items.map((it, i) => (
              <tr key={i}>
                <td className="py-2 pr-3"><input aria-label={`Skill ${i + 1} name`} value={it.skill} onChange={(e) => upd(i, { skill: e.target.value })} maxLength={60} className="w-full rounded-md border border-border px-2.5 py-2 outline-none focus:border-primary" /></td>
                <td className="py-2 pr-3"><input aria-label={`${it.skill || "Skill"} weight`} type="number" min={1} max={100} step={1} inputMode="numeric" value={Number.isNaN(it.weight) ? "" : it.weight} onChange={(e) => upd(i, { weight: e.target.value === "" ? NaN : Number(e.target.value) })} className="w-24 rounded-md border border-border px-2.5 py-2 outline-none focus:border-primary" /></td>
                <td className="py-2 pr-3"><select aria-label={`${it.skill || "Skill"} priority`} value={it.priority} onChange={(e) => upd(i, { priority: e.target.value as SkillPriority })} className="rounded-md border border-border px-2.5 py-2"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></td>
                {showTrend ? <td className="py-2 pr-3">{it.trend ? <Badge tone={it.trend === "rising" ? "strong" : it.trend === "declining" ? "critical" : "neutral"}>{trendLabel(it.trend)}{it.trendChange ? ` ${it.trendChange}` : ""}</Badge> : <span className="text-ink-3">New</span>}</td> : null}
                <td className="py-2 text-right"><button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label={`Remove ${it.skill || "skill"}`} className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash-2" size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={() => onChange([...items, { skill: "", weight: 5, priority: "medium" }])}><Icon name="plus" size={14} /> Add skill</Button>
        <p role={ok ? "status" : "alert"} className={`flex items-center gap-1.5 font-display text-sm font-bold ${ok ? "text-emerald-700" : "text-rose-700"}`}><Icon name={ok ? "circle-check" : "circle-alert"} size={16} />Total {Number.isNaN(total) ? "–" : total}% {ok ? "" : "(must be exactly 100%)"}</p>
      </div>
    </div>
  );
}

export function RoleEditor({ roleId, name, active, reviewed, declining, initial }: { roleId: string; name: string; active: boolean; reviewed: string | null; declining: string[]; initial: RoleItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const total = weightsTotal(items);
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);

  async function save() {
    setErr("");
    if (items.some((i) => !i.skill.trim())) return setErr("Every skill needs a name.");
    if (new Set(items.map((i) => i.skill.trim().toLowerCase())).size !== items.length) return setErr("A skill appears more than once.");
    if (Math.abs(total - 100) > 0.01) return setErr(`Weights must total 100%. They currently total ${Number.isNaN(total) ? "an invalid value" : total + "%"}.`);
    setBusy(true);
    const r = await saveRoleSkills(roleId, items.map((i) => ({ skill: i.skill.trim(), weight: i.weight, priority: i.priority })));
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast("Role updated");
    router.refresh();
  }
  async function toggle() {
    const r = await setRoleActive(roleId, !active);
    if (!r.ok) return toast(r.error, "error");
    toast(active ? "Role hidden from students" : "Role is active");
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[clamp(26px,3vw,34px)]">{name}</h1><p className="text-ink-2">{reviewed ? `Reviewed ${reviewed}` : "Not reviewed yet"} · {active ? "Active" : "Inactive (hidden from students)"}</p></div>
        <Button variant="secondary" onClick={toggle}>{active ? "Hide from students" : "Make active"}</Button>
      </div>
      <Card title="Required skills and weights" subtitle="Weights are each skill's share of the readiness score and must total exactly 100%.">
        <WeightsTable items={items} onChange={setItems} showTrend />
        {err ? <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p> : null}
        <div className="mt-4 flex gap-3"><Button onClick={save} loading={busy} disabled={!dirty}>Save changes</Button><Button variant="ghost" onClick={() => { setItems(initial); setErr(""); }} disabled={!dirty}>Discard</Button></div>
      </Card>
      <Card title="Declining skills" subtitle="Maintained by the automatic market research.">{declining.length ? <p className="flex flex-wrap gap-1.5">{declining.map((d) => <Badge key={d} tone="critical">{d}</Badge>)}</p> : <p className="text-ink-2">None recorded.</p>}</Card>
    </div>
  );
}
