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
 * Chat models tried in order when none is configured, or when the configured one has been retired by NVIDIA
 * (HTTP 404/410). `meta/llama-3.3-70b-instruct` was retired (410 Gone) which broke every AI feature.
 */
export const DEFAULT_AI_MODELS = [
  "mistralai/mistral-large-2-instruct",
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
  "mistralai/mistral-large",
  "openai/gpt-oss-20b",
];

export interface AiEnv {
  apiKey: string;
  baseUrl: string;
  /** First model to try. */
  model: string;
  /** Ordered candidates: the configured NVIDIA_MODEL first, then DEFAULT_AI_MODELS. */
  models: string[];
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
    timeoutMs: Number(process.env.NVIDIA_TIMEOUT_MS) > 0 ? Number(process.env.NVIDIA_TIMEOUT_MS) : 25_000,
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
