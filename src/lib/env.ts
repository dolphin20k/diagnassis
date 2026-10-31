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

export interface AiEnv {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export function getAiEnv(): AiEnv {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new AiNotConfiguredError();
  return {
    apiKey,
    baseUrl: (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, ""),
    model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
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
