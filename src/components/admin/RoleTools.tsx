"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { WeightsTable, type RoleItem } from "@/components/admin/RoleEditor";
import { createRole, promoteEstimate } from "@/app/admin/actions";
import { fmtDateTime } from "@/lib/format";
import { weightsTotal } from "@/lib/scoring/weights";

export function AddRoleButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [items, setItems] = useState<RoleItem[]>([{ skill: "", weight: 50, priority: "high" }, { skill: "", weight: 50, priority: "medium" }]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setErr("");
    if (name.trim().length < 2) return setErr("Enter a role name.");
    if (items.some((i) => !i.skill.trim())) return setErr("Every skill needs a name.");
    if (Math.abs(weightsTotal(items) - 100) > 0.01) return setErr("Weights must total exactly 100%.");
    setBusy(true);
    const r = await createRole(name, items.map((i) => ({ skill: i.skill.trim(), weight: i.weight, priority: i.priority })));
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast("Role added");
    setOpen(false);
    router.push(`/admin/roles/${r.data!.id}`);
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Add role</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add a curated role" description="Students can pick it once it is saved. Weights must total 100%." wide>
        <div className="flex flex-col gap-4">
          <Field label="Role name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cyber Security Analyst" />
          <WeightsTable items={items} onChange={setItems} />
          {err ? <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p> : null}
          <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={busy}>Add role</Button></div>
        </div>
      </Dialog>
    </>
  );
}

export function PromoteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const r = await promoteEstimate(id);
    setBusy(false);
    if (!r.ok) return toast(r.error, "error");
    toast(`${name} added as a curated role`);
    router.push(`/admin/roles/${r.data!.id}`);
  }
  return <Button variant="secondary" onClick={go} loading={busy}>Add as curated role</Button>;
}

type Step = { name: string; state: "waiting" | "running" | "done" | "failed"; note?: string };

/** Drives the same per-role pipeline the scheduled job uses, one request per role, with live progress. */
export function RunResearch({ last }: { last: { status: string; startedAt: string; created: number; applied: number } | null }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [msg, setMsg] = useState("");
  async function post(body: unknown) {
    const res = await fetch("/api/cron/market-research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }
  async function run() {
    setRunning(true);
    setMsg("");
    try {
      const start = await post({ phase: "start" });
      const roles: { id: string; name: string }[] = start.roles;
      setSteps(roles.map((r) => ({ name: r.name, state: "waiting" })));
      for (const [i, role] of roles.entries()) {
        setSteps((s) => s.map((x, k) => (k === i ? { ...x, state: "running" } : x)));
        try {
          const r = await post({ phase: "role", runId: start.runId, roleId: role.id });
          setSteps((s) => s.map((x, k) => (k === i ? { ...x, state: r.result.error ? "failed" : "done", note: r.result.error ? "Partly failed" : `${r.result.created} suggested, ${r.result.approved} applied` } : x)));
        } catch {
          setSteps((s) => s.map((x, k) => (k === i ? { ...x, state: "failed", note: "Failed" } : x)));
        }
      }
      const fin = await post({ phase: "finish", runId: start.runId });
      setMsg(`Research finished: ${fin.status}.`);
      router.refresh();
    } catch {
      setMsg("We could not start market research. Check the NVIDIA and Supabase service configuration in Settings.");
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3"><Button onClick={run} loading={running}><Icon name="refresh-cw" size={16} /> Run market research now</Button><span className="text-sm text-ink-2">{last ? `Last run ${fmtDateTime(last.startedAt)}: ${last.status}, ${last.created} suggested, ${last.applied} applied` : "No runs yet"}</span></div>
      {steps.length ? (
        <ul className="grid gap-1.5 text-sm" aria-live="polite">
          {steps.map((s) => <li key={s.name} className="flex items-center gap-2">{s.state === "running" ? <span className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden /> : <Icon name={s.state === "done" ? "circle-check" : s.state === "failed" ? "circle-alert" : "circle"} size={16} className={s.state === "done" ? "text-emerald-600" : s.state === "failed" ? "text-rose-600" : "text-slate-300"} />}<span>{s.name}</span><span className="text-ink-2">{s.note}</span></li>)}
        </ul>
      ) : null}
      {msg ? <p role="status" className="text-sm font-semibold">{msg}</p> : null}
    </div>
  );
}
