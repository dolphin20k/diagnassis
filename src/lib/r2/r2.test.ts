import { beforeEach, describe, expect, it } from "vitest";
import { isValidReportKey, reportKey, signedReportUrl, SIGNED_URL_TTL_SECONDS, putReport } from "@/lib/r2";
import { getR2Env } from "@/lib/env";

const U = "0b6f5d3e-1c2a-4f10-9a77-3d9b2c1a8e55";
const A = "7a1d9c20-55aa-4b0e-8d61-12c3f4e5a6b7";

describe("R2 object keys", () => {
  it("are built only from UUIDs", () => {
    expect(reportKey(U, A)).toBe(`reports/${U}/${A}.pdf`);
    expect(() => reportKey("../../etc", A)).toThrow();
    expect(() => reportKey(U, "x/../y")).toThrow();
  });
  it("validate strictly", () => {
    expect(isValidReportKey(`reports/${U}/${A}.pdf`)).toBe(true);
    for (const bad of ["reports/a/b.pdf", `reports/${U}/${A}.exe`, `../reports/${U}/${A}.pdf`, `reports/${U}/${A}.pdf/../x`, ""]) expect(isValidReportKey(bad)).toBe(false);
  });
});

describe("R2 configuration and signing", () => {
  beforeEach(() => {
    delete process.env.R2_ACCOUNT_ID;
  });
  it("reports unconfigured state instead of faking storage", async () => {
    expect(getR2Env()).toBeNull();
    await expect(putReport(reportKey(U, A), new TextEncoder().encode("%PDF-1.4"))).rejects.toThrow("r2_not_configured");
    await expect(signedReportUrl(reportKey(U, A), "x.pdf")).rejects.toThrow("r2_not_configured");
  });
  it("issues short-lived presigned GET URLs that never contain the secret key", async () => {
    Object.assign(process.env, { R2_ACCOUNT_ID: "acc123", R2_ACCESS_KEY_ID: "AKIATESTKEY", R2_SECRET_ACCESS_KEY: "super-secret-value", R2_BUCKET: "reports-bucket" });
    const url = new URL(await signedReportUrl(reportKey(U, A), "my report?.pdf"));
    expect(url.host).toContain("acc123.r2.cloudflarestorage.com");
    expect(url.searchParams.get("X-Amz-Expires")).toBe(String(SIGNED_URL_TTL_SECONDS));
    expect(url.searchParams.get("response-content-disposition")).toBe('attachment; filename="my_report_.pdf"');
    expect(url.toString()).not.toContain("super-secret-value");
    await expect(signedReportUrl("reports/evil.pdf", "x.pdf")).rejects.toThrow("invalid_report_key");
  });
  it("refuses to store anything that is not a PDF or is oversized", async () => {
    Object.assign(process.env, { R2_ACCOUNT_ID: "acc123", R2_ACCESS_KEY_ID: "AKIATESTKEY", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "b" });
    await expect(putReport(reportKey(U, A), new TextEncoder().encode("<html>"))).rejects.toThrow("invalid_report_content");
    await expect(putReport(reportKey(U, A), new Uint8Array(0))).rejects.toThrow("invalid_report_size");
    await expect(putReport(reportKey(U, A), new Uint8Array(11 * 1024 * 1024))).rejects.toThrow("invalid_report_size");
    await expect(putReport("reports/x.pdf", new TextEncoder().encode("%PDF-1"))).rejects.toThrow("invalid_report_key");
  });
});
