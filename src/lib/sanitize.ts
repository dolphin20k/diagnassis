/**
 * Skill and role names are user-controlled and are later placed into LLM prompts and URLs.
 * Restrict them to a conservative character set so they cannot carry instructions or markup.
 */
const ALLOWED = /[^\p{L}\p{N} .+#&/()'\-_]/gu;

export function sanitizeLabel(input: string, maxLen = 60): string {
  return input
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(ALLOWED, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function sanitizeSkillList(skills: string[], max = 60): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of skills) {
    const clean = sanitizeLabel(s, 60);
    const key = clean.toLowerCase();
    if (clean.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}

/** Same key the database uses for custom role estimates (lower-cased, single-spaced). */
export function roleKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}
