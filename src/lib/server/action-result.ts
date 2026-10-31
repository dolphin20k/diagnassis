export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function zodFieldErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
