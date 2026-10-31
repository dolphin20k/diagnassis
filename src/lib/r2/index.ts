import "server-only";
import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Env } from "@/lib/env";

/**
 * Cloudflare R2 (S3-compatible) storage for generated PDF reports. The bucket is PRIVATE:
 * objects are only ever reachable through short-lived presigned URLs that the server issues
 * after verifying the requester owns the report. Credentials never reach the browser.
 */
const KEY_RE = /^reports\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/;
export const SIGNED_URL_TTL_SECONDS = 300;
export const MAX_REPORT_BYTES = 10 * 1024 * 1024;

/** Keys are built only from server-verified UUIDs, never from user-supplied names. */
export function reportKey(userId: string, attemptId: string): string {
  const key = `reports/${userId}/${attemptId}.pdf`;
  if (!KEY_RE.test(key)) throw new Error("invalid_report_key");
  return key;
}
export const isValidReportKey = (key: string) => KEY_RE.test(key);

function client() {
  const env = getR2Env();
  if (!env) return null;
  return {
    env,
    s3: new S3Client({
      region: "auto",
      endpoint: env.endpoint,
      credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
      forcePathStyle: true,
    }),
  };
}

export const r2Configured = () => getR2Env() !== null;

export async function putReport(key: string, bytes: Uint8Array): Promise<void> {
  const c = client();
  if (!c) throw new Error("r2_not_configured");
  if (!isValidReportKey(key)) throw new Error("invalid_report_key");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_REPORT_BYTES) throw new Error("invalid_report_size");
  // PDF magic number check: never store anything that is not a PDF.
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("invalid_report_content");
  await c.s3.send(
    new PutObjectCommand({
      Bucket: c.env.bucket,
      Key: key,
      Body: bytes,
      ContentType: "application/pdf",
      CacheControl: "private, max-age=0, no-store",
    }),
  );
}

export async function reportExists(key: string): Promise<boolean> {
  const c = client();
  if (!c || !isValidReportKey(key)) return false;
  try {
    await c.s3.send(new HeadObjectCommand({ Bucket: c.env.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function signedReportUrl(key: string, downloadName: string): Promise<string> {
  const c = client();
  if (!c) throw new Error("r2_not_configured");
  if (!isValidReportKey(key)) throw new Error("invalid_report_key");
  const safeName = downloadName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "report.pdf";
  return getSignedUrl(
    c.s3,
    new GetObjectCommand({
      Bucket: c.env.bucket,
      Key: key,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
    }),
    { expiresIn: SIGNED_URL_TTL_SECONDS },
  );
}

/** Deletes objects; throws if R2 reports any failure so callers can abort and avoid orphans. */
export async function deleteReports(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const c = client();
  if (!c) throw new Error("r2_not_configured");
  const valid = keys.filter(isValidReportKey);
  for (let i = 0; i < valid.length; i += 500) {
    const res = await c.s3.send(
      new DeleteObjectsCommand({ Bucket: c.env.bucket, Delete: { Objects: valid.slice(i, i + 500).map((Key) => ({ Key })), Quiet: true } }),
    );
    if (res.Errors && res.Errors.length > 0) throw new Error("r2_delete_failed");
  }
}
