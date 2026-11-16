import { z } from "zod";

/**
 * Environment access. Values are validated lazily (on first use) so `next build` and
 * unit tests work without secrets, while any real request fails loudly and clearly.
 * Server-only values must never be read from client components.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

export function getPublicEnv() {
  // NEXT_PUBLIC_* values must be referenced literally so Next can inline them in the browser bundle.
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
}

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export function getServiceRoleKey(): string {
  return serverSchema.parse({ SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY }).SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Preferred chat models, fastest/most reliable first (measured 16 Nov 2026 against the NVIDIA API: ~0.3-1.5 s with
 * thinking disabled). NVIDIA retires models without notice (llama-3.3-70b on 5 Nov, nemotron-70b / mistral-large-2 /
 * mistral-nemo on 15 Nov), so this list is only a preference: at runtime the client also asks NVIDIA which models
 * the key can use and skips any model that answers 404/410.
 */
export const DEFAULT_AI_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b",
  "nvidia/nemotron-3.5-super-vl-120b-a12b",
  "mistralai/mistral-large-4-1t-a52b",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
];

export interface AiEnv {
  apiKey: string;
  baseUrl: string;
  /** First model to try. */
  model: string;
  /** Ordered candidates: the configured NVIDIA_MODEL first, then DEFAULT_AI_MODELS. */
  models: string[];
  /** NVIDIA_MODEL as set by the operator (always tried first, even when the catalogue does not list it). */
  configured: string | null;
  /** Ask the API which models this key can use (NVIDIA_DISCOVER_MODELS=false turns it off). */
  discover: boolean;
  timeoutMs: number;
}

export function getAiEnv(): AiEnv {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  const configured = (process.env.NVIDIA_MODEL || "").trim();
  const models = [...new Set([configured, ...DEFAULT_AI_MODELS].filter(Boolean))];
  return {
    apiKey,
    baseUrl: (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, ""),
    model: models[0] as string,
    models,
    discover: process.env.NVIDIA_DISCOVER_MODELS !== "false",
    configured: configured || null,
    timeoutMs: Number(process.env.NVIDIA_TIMEOUT_MS) > 0 ? Number(process.env.NVIDIA_TIMEOUT_MS) : 40_000,
  };
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("NVIDIA_API_KEY is not configured");
    this.name = "AiNotConfiguredError";
  }
}

export interface R2Env {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
}

/** Returns null when R2 is not configured so callers can degrade explicitly instead of faking storage. */
export function getR2Env(): R2Env | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

export function getCronSecret(): string | null {
  const s = process.env.CRON_SECRET;
  return s && s.length >= 24 ? s : null;
}
