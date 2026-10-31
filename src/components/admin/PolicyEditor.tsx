"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Field, TextArea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { publishPolicy } from "@/app/admin/actions";

export function PolicyEditor({ type, currentVersion, suggestedVersion, initialBody, studentCount }: { type: "terms" | "privacy"; currentVersion: string | null; suggestedVersion: string; initialBody: string; studentCount: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = useState(initialBody);
  const [version, setVersion] = useState(suggestedVersion);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = type === "terms" ? "Terms & Conditions" : "Privacy Policy";

  function review() {
    const e: Record<string, string> = {};
    if (!/^[0-9]+(\.[0-9]+){1,2}$/.test(version)) e.version = "Use a version like 1.5 or 2.0.1.";
    if (body.trim().length < 20) e.body = "Policy text is too short.";
    if (body.trim() === initialBody.trim()) e.body = "Edit the text before publishing a new version.";
    if (note.trim().length < 5) e.note = "Describe what changed so students know what to review.";
    setErrors(e);
    if (Object.keys(e).length === 0) setConfirm(true);
  }
  async function publish() {
    setBusy(true);
    const r = await publishPolicy({ type, version, body, note });
    setBusy(false);
    if (!r.ok) { setConfirm(false); return setErrors({ ...(r.fieldErrors ?? {}), form: r.error }); }
    setConfirm(false);
    toast(`${label} v${version} published`);
    router.refresh();
  }
  return (
    <Card title={`Edit ${label}`} subtitle={currentVersion ? `Current version ${currentVersion}. Sections start with “## Heading”.` : "Nothing is published yet. Sections start with “## Heading”."}>
      <div className="flex flex-col gap-4">
        {errors.form ? <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{errors.form}</p> : null}
        <Field label="New version number" value={version} onChange={(e) => setVersion(e.target.value)} error={errors.version} className="max-w-48" />
        <TextArea label="Policy text" value={body} onChange={(e) => setBody(e.target.value)} error={errors.body} className="[&_textarea]:min-h-80 [&_textarea]:font-mono [&_textarea]:text-sm" maxLength={40000} />
        <TextArea label="What changed? (shown to students)" value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} maxLength={400} className="[&_textarea]:min-h-20" />
        <div><Button onClick={review}>Review and publish</Button></div>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`Publish ${label} v${version}?`} description={`All ${studentCount} students will be asked to accept this version before they can continue. This cannot be undone.`}>
        <p className="rounded-md bg-bg px-3 py-2 text-sm"><strong>What changed:</strong> {note}</p>
        <div className="mt-5 flex justify-end gap-3"><Button variant="secondary" onClick={() => setConfirm(false)}>Keep editing</Button><Button onClick={publish} loading={busy}>Publish version {version}</Button></div>
      </Dialog>
    </Card>
  );
}
