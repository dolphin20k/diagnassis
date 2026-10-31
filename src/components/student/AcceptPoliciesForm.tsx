"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PolicyBody } from "@/components/layout/PolicyBody";
import { acceptPolicies } from "@/app/(student)/actions";
import { fmtDate } from "@/lib/format";
import type { PolicyRow } from "@/lib/types/database";

const NAMES = { terms: "Terms & Conditions", privacy: "Privacy Policy" } as const;

export function AcceptPoliciesForm({ policies, isUpdate }: { policies: PolicyRow[]; isUpdate: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const all = policies.every((p) => checked[p.id]);

  async function accept() {
    if (!all) return setErr("Tick each box to continue.");
    setBusy(true);
    const res = await acceptPolicies(policies.map((p) => p.id));
    if (!res.ok) {
      setBusy(false);
      return setErr(res.error);
    }
    router.replace("/dashboard");
    router.refresh();
  }
  return (
    <div>
      <h1 className="text-[clamp(24px,3vw,32px)]">{isUpdate ? "We have updated our policies" : "One quick step before you start"}</h1>
      <p className="mb-5 mt-1 text-ink-2">{isUpdate ? "Please review what changed and accept to keep using DIAGNASSIS." : "Please read and accept the Terms & Conditions and Privacy Policy."}</p>
      <div className="flex flex-col gap-5">
        {policies.map((p) => (
          <section key={p.id} aria-labelledby={`p-${p.id}`} className="rounded-lg border border-border bg-white/80 p-4">
            <h2 id={`p-${p.id}`} className="text-lg">{NAMES[p.type]} <span className="text-sm font-normal text-ink-2">· Version {p.version} · {fmtDate(p.published_at)}</span></h2>
            {p.change_note && isUpdate ? <p className="mt-1 rounded-md bg-indigo-50 px-3 py-2 text-sm text-primary-dark"><strong>What changed:</strong> {p.change_note}</p> : null}
            <div className="mt-3 max-h-56 overflow-y-auto pr-2" tabIndex={0} aria-label={`${NAMES[p.type]} text`}><PolicyBody body={p.body} /></div>
            <label className="mt-3 flex items-center gap-2.5 text-sm font-semibold">
              <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={!!checked[p.id]} onChange={(e) => { setChecked({ ...checked, [p.id]: e.target.checked }); setErr(""); }} />
              I have read and accept the {NAMES[p.type]} (version {p.version})
            </label>
          </section>
        ))}
        {err ? <p role="alert" className="text-sm text-rose-700">{err}</p> : null}
        <Button size="lg" onClick={accept} loading={busy} disabled={policies.length === 0}>Accept and continue</Button>
        <form action="/auth/signout" method="post"><button className="text-sm text-ink-2 underline">Log out instead</button></form>
      </div>
    </div>
  );
}
