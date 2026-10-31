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

async function complete(
  messages: ChatMessage[],
  opts: { maxTokens: number; temperature: number; fetchImpl: typeof fetch },
): Promise<{ text: string; model: string }> {
  const env = getAiEnv();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.timeoutMs);
  try {
    let res: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await opts.fetchImpl(`${env.baseUrl}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${env.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          model: env.model,
          messages,
          temperature: opts.temperature,
          top_p: 0.9,
          max_tokens: opts.maxTokens,
          stream: false,
        }),
      });
      if (res.status !== 429 && res.status < 500) break;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
    if (!res) throw new AiError("http", "No response");
    if (!res.ok) {
      // Never echo the response body: it can contain request details.
      throw new AiError("http", `NVIDIA API responded with ${res.status}`, res.status);
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; model?: string };
    const text = body.choices?.[0]?.message?.content;
    if (!text || !text.trim()) throw new AiError("empty", "Model returned no content");
    return { text, model: body.model || env.model };
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new AiError("timeout", "NVIDIA API request timed out");
    throw new AiError("http", "Could not reach the NVIDIA API");
  } finally {
    clearTimeout(timer);
  }
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
    for (let attempt = 0; attempt < 2; attempt++) {
      const out = await complete(messages, { maxTokens: o.maxTokens ?? 2048, temperature: o.temperature ?? 0.4, fetchImpl });
      model = out.model;
      try {
        const parsed = o.schema.safeParse(extractJson(out.text));
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
