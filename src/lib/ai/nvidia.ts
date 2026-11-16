import { z } from "zod";
import { getAiEnv, AiNotConfiguredError } from "@/lib/env";

/**
 * Minimal client for NVIDIA's OpenAI-compatible chat completions API (NIM / build.nvidia.com).
 * Server-only: the API key is read from the environment and never leaves the server.
 * Every structured call is validated with zod; invalid output is retried once with the validation
 * error fed back to the model, then surfaced as an AiError (callers fall back or report failure).
 */

export type AiErrorCode = "not_configured" | "timeout" | "http" | "empty" | "bad_json" | "invalid";

export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string, public status?: number) {
    super(message);
    this.name = "AiError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallLog {
  kind: string;
  model: string | null;
  ok: boolean;
  latencyMs: number;
  error?: string;
}
export type CallLogger = (log: CallLog) => void | Promise<void>;

export interface JsonCallOptions<T> {
  kind: string;
  system: string;
  user: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  maxTokens?: number;
  temperature?: number;
  log?: CallLogger;
  fetchImpl?: typeof fetch;
}

/** Extracts the first JSON object/array from model text (handles code fences and chatter). */
export function extractJson(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    /* fall through to bracket scanning */
  }
  const start = stripped.search(/[[{]/);
  if (start === -1) throw new AiError("bad_json", "No JSON found in model output");
  const open = stripped[start] as string;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i] as string;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) {
      try {
        return JSON.parse(stripped.slice(start, i + 1));
      } catch {
        throw new AiError("bad_json", "Model output was not valid JSON");
      }
    }
  }
  throw new AiError("bad_json", "Unterminated JSON in model output");
}

/** Models that NVIDIA has retired or does not offer to this key; we move on to the next candidate. */
const MODEL_GONE = new Set([404, 410]);
/** Wrong or unauthorised key: no other model will help, so stop at once. */
const FATAL = new Set([401, 403]);
/** If the current model has not answered after this long, start the next one in parallel and use whichever answers first. */
export const HEDGE_AFTER_MS = 6_000;
const MAX_PARALLEL = 3;

/** Reasoning models wrap their chain of thought in <think> tags; it must not reach the JSON parser. */
const stripThinking = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "");

// Remembers the model that last answered so later requests start with one that is alive and reasonably fast.
let workingModel: string | null = null;
/** Models that answered 404/410 (retired / not offered to this key) are skipped for a while; slow ones are tried last. */
const goneUntil = new Map<string, number>();
const slowUntil = new Map<string, number>();
const GONE_FOR_MS = 6 * 60 * 60 * 1000;
const SLOW_FOR_MS = 10 * 60 * 1000;
let discovered: { at: number; ids: string[] } | null = null;
const DISCOVERY_TTL_MS = 30 * 60 * 1000;
/** Chat-capable models only: the catalogue also lists embedding, guard, reward, image and speech models. */
const NOT_CHAT = /embed|guard|safety|reward|rerank|parse|clip|bge|whisper|tts|asr|image|diffusion|sdxl|flux|translate|retriev|deplot|detector|calibration|vila|neva|fuyu|paligemma|kosmos|llava|cosmos|omni|starcoder|codellama|codestral|coder|laguna/i;

/** Lists the models this key can use (cached). Returns null when the listing is unavailable. */
async function discoverModels(env: Env, fetchImpl: typeof fetch): Promise<string[] | null> {
  if (!env.discover) return null;
  if (discovered && Date.now() - discovered.at < DISCOVERY_TTL_MS) return discovered.ids;
  try {
    const res = await fetchImpl(`${env.baseUrl}/models`, { headers: { Authorization: `Bearer ${env.apiKey}` }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { id?: string }[] };
    const ids = (body.data ?? []).map((m) => m.id ?? "").filter((id) => id && !NOT_CHAT.test(id));
    if (ids.length === 0) return null;
    discovered = { at: Date.now(), ids };
    return ids;
  } catch {
    return null;
  }
}

/** Candidate order: last working model, configured + preferred models the key can use, then any other listed chat model. */
async function candidates(env: Env, fetchImpl: typeof fetch): Promise<string[]> {
  const listed = await discoverModels(env, fetchImpl);
  const preferred = listed ? env.models.filter((m) => listed.includes(m) || m === env.configured) : env.models;
  const extra = listed ? listed.filter((m) => !preferred.includes(m)) : [];
  const now = Date.now();
  let order = [...new Set([...(workingModel ? [workingModel] : []), ...preferred, ...extra])];
  const alive = order.filter((m) => (goneUntil.get(m) ?? 0) < now);
  order = alive.length ? alive : order;
  return [...order.filter((m) => (slowUntil.get(m) ?? 0) < now), ...order.filter((m) => (slowUntil.get(m) ?? 0) >= now)];
}

class Cancelled extends Error {}

interface Completion { text: string; model: string }
type Env = ReturnType<typeof getAiEnv>;

/** One request to one model, with its own timeout and a single retry on 429/5xx. */
async function attempt(
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens: number; temperature: number; fetchImpl: typeof fetch },
  env: Env,
  master: AbortSignal,
): Promise<Completion> {
  const ctrl = new AbortController();
  const onMaster = () => ctrl.abort();
  master.addEventListener("abort", onMaster);
  const timer = setTimeout(() => ctrl.abort(), env.timeoutMs);
  try {
    let res: Response | null = null;
    // Current NVIDIA models are reasoning models: thinking tokens count against max_tokens and add many seconds, and the
    // JSON tasks here do not need it. enable_thinking=false is honoured by Nemotron and ignored by others; if a model
    // rejects the field (400) we retry once without it.
    let noThinking = true;
    for (let i = 0; i < 3; i++) {
      res = await opts.fetchImpl(`${env.baseUrl}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${env.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          model, messages, temperature: opts.temperature, top_p: 0.9, stream: false,
          // Headroom for models that still think a little before answering.
          max_tokens: opts.maxTokens + 1024,
          ...(noThinking ? { chat_template_kwargs: { enable_thinking: false } } : {}),
        }),
      });
      if (res.status === 400 && noThinking) { noThinking = false; continue; }
      if (res.status !== 429 && res.status < 500) break;
      if (i === 2) break;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
    if (!res) throw new AiError("http", "No response");
    // Never echo the response body: it can contain request details.
    if (!res.ok) throw new AiError("http", `NVIDIA API responded with ${res.status}`, res.status);
    const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[]; model?: string };
    const text = stripThinking(body.choices?.[0]?.message?.content ?? "");
    if (!text.trim()) throw new AiError("empty", "Model returned no content");
    return { text, model: body.model || model };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (master.aborted) throw new Cancelled();
    if (e instanceof Error && e.name === "AbortError") throw new AiError("timeout", "NVIDIA API request timed out");
    throw new AiError("http", "Could not reach the NVIDIA API");
  } finally {
    clearTimeout(timer);
    master.removeEventListener("abort", onMaster);
  }
}

/**
 * Asks the candidate models for a completion. The first model starts straight away; when it is retired (404/410), fails,
 * or is merely slow (HEDGE_AFTER_MS), the next model is started alongside it, and the first valid answer wins.
 * This keeps the app working when NVIDIA's free endpoints are queued or a model is withdrawn.
 */
async function complete(
  messages: ChatMessage[],
  opts: { maxTokens: number; temperature: number; fetchImpl: typeof fetch },
): Promise<Completion> {
  const env = getAiEnv();
  const order = await candidates(env, opts.fetchImpl);
  return new Promise<Completion>((resolve, reject) => {
    const master = new AbortController();
    const errors: AiError[] = [];
    let next = 0;
    let live = 0;
    let done = false;
    let hedge: ReturnType<typeof setTimeout> | undefined;

    const finish = (fn: () => void) => { done = true; if (hedge) clearTimeout(hedge); master.abort(); fn(); };
    const launch = () => {
      if (done || next >= order.length) return;
      const model = order[next++] as string;
      live++;
      if (hedge) clearTimeout(hedge);
      if (next < order.length) hedge = setTimeout(() => { if (live < MAX_PARALLEL) launch(); }, HEDGE_AFTER_MS);
      attempt(model, messages, opts, env, master.signal).then(
        (out) => { if (done) return; workingModel = model; finish(() => resolve(out)); },
        (e: unknown) => {
          live--;
          if (done || e instanceof Cancelled) return;
          const err = e instanceof AiError ? e : new AiError("http", "Unexpected AI failure");
          errors.push(err);
          if (err.status !== undefined && FATAL.has(err.status)) return finish(() => reject(err));
          if (err.status !== undefined && MODEL_GONE.has(err.status)) {
            goneUntil.set(model, Date.now() + GONE_FOR_MS);
            if (workingModel === model) workingModel = null;
          }
          if (err.code === "timeout" || err.code === "empty") slowUntil.set(model, Date.now() + SLOW_FOR_MS);
          if (next < order.length) return launch();
          if (live === 0) {
            const timedOut = errors.find((x) => x.code === "timeout");
            const allGone = errors.every((x) => x.status !== undefined && MODEL_GONE.has(x.status));
            finish(() => reject(
              timedOut ?? (allGone ? new AiError("http", `No available NVIDIA model (status ${err.status}). Set NVIDIA_MODEL to a model your key can use`, err.status) : (errors.find((x) => !(x.status !== undefined && MODEL_GONE.has(x.status))) ?? err)),
            ));
          }
        },
      );
    };
    launch();
  });
}

export async function callJson<T>(o: JsonCallOptions<T>): Promise<{ data: T; model: string }> {
  const started = Date.now();
  const fetchImpl = o.fetchImpl ?? fetch;
  const messages: ChatMessage[] = [
    { role: "system", content: o.system },
    { role: "user", content: o.user },
  ];
  let model: string | null = null;
  try {
    let lastIssue = "";
    for (let round = 0; round < 2; round++) {
      if (round > 0 && Date.now() - started > 30_000) break; // slow model: fail fast instead of overrunning the route time limit
      const out = await complete(messages, { maxTokens: o.maxTokens ?? 2048, temperature: o.temperature ?? 0.4, fetchImpl });
      model = out.model;
      try {
        const raw = extractJson(out.text);
        let parsed = o.schema.safeParse(raw);
        // Models sometimes echo the prompt's shape and wrap the answer, e.g. {"output_format": {...}}: unwrap one level.
        if (!parsed.success && raw && typeof raw === "object" && !Array.isArray(raw)) {
          const vals = Object.values(raw as Record<string, unknown>);
          if (vals.length === 1 && vals[0] && typeof vals[0] === "object") {
            const inner = o.schema.safeParse(vals[0]);
            if (inner.success) parsed = inner;
          }
        }
        if (parsed.success) {
          await o.log?.({ kind: o.kind, model, ok: true, latencyMs: Date.now() - started });
          return { data: parsed.data, model };
        }
        lastIssue = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
      } catch (e) {
        lastIssue = e instanceof Error ? e.message : "invalid JSON";
      }
      messages.push(
        { role: "assistant", content: out.text.slice(0, 4000) },
        { role: "user", content: `That reply was rejected (${lastIssue}). Reply again with ONLY the corrected JSON, no commentary.` },
      );
    }
    throw new AiError("invalid", `Model output failed validation: ${lastIssue}`);
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("http", "Unexpected AI failure");
    await o.log?.({ kind: o.kind, model, ok: false, latencyMs: Date.now() - started, error: `${err.code}: ${err.message}`.slice(0, 280) });
    throw err;
  }
}

/** Lightweight key check for the admin "AI health" panel. */
export async function pingNvidia(fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; model: string; detail: string }> {
  let env;
  try {
    env = getAiEnv();
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return { ok: false, model: "", detail: "NVIDIA_API_KEY is not set" };
    throw e;
  }
  try {
    const res = await fetchImpl(`${env.baseUrl}/models`, { headers: { Authorization: `Bearer ${env.apiKey}` }, signal: AbortSignal.timeout(10_000) });
    return { ok: res.ok, model: env.model, detail: res.ok ? "Reachable" : `HTTP ${res.status}` };
  } catch {
    return { ok: false, model: env.model, detail: "Could not reach the NVIDIA API from this environment" };
  }
}

/** Real (tiny) completion through the same model race the app uses: shows which model answers and how fast. */
export async function probeNvidia(fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; model: string; latencyMs: number; detail: string }> {
  const started = Date.now();
  try {
    const out = await complete([{ role: "user", content: "Reply with the single word OK." }], { maxTokens: 16, temperature: 0, fetchImpl });
    return { ok: true, model: out.model, latencyMs: Date.now() - started, detail: "Answering" };
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("http", "Unexpected AI failure");
    return { ok: false, model: "", latencyMs: Date.now() - started, detail: err.code === "timeout" ? "Timed out: the AI service is too slow right now" : err.status ? `HTTP ${err.status}` : err.message };
  }
}

/** Test helper: forget which models worked, failed or were listed. */
export function resetModelStateForTests() {
  workingModel = null;
  goneUntil.clear();
  slowUntil.clear();
  discovered = null;
}
