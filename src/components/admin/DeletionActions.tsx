"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

export function DeletionActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<"approve" | "deny" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    if (!mode) return;
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/admin/deletions/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve: mode === "approve" }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(body.message ?? "Something went wrong. Please try again.");
    toast(mode === "approve" ? "Account deleted" : "Request denied");
    setMode(null);
    router.refresh();
  }
  return (
    <>
      <div className="flex gap-2"><Button variant="secondary" onClick={() => setMode("deny")}>Deny</Button><Button variant="danger" onClick={() => setMode("approve")}>Approve and delete</Button></div>
      <Dialog open={mode !== null} onClose={() => setMode(null)} title={mode === "approve" ? `Delete ${name}'s account?` : `Deny ${name}'s request?`} description={mode === "approve" ? "This permanently deletes their profile, diagnostics, reports and feedback. It cannot be undone." : "Their account stays active and they will be notified."}>
        {err ? <p role="alert" className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p> : null}
        <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button><Button variant={mode === "approve" ? "danger" : "primary"} onClick={go} loading={busy}>{mode === "approve" ? "Delete account" : "Deny request"}</Button></div>
      </Dialog>
    </>
  );
}
