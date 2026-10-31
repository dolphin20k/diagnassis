import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-redirect";

describe("safeNext", () => {
  it("allows relative paths", () => {
    expect(safeNext("/results/abc?x=1")).toBe("/results/abc?x=1");
  });
  it("blocks open redirects", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined, "/a\nb"]) expect(safeNext(bad as string)).toBe("/dashboard");
  });
});
