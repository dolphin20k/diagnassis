import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/server", () => ({ NextResponse: { json: (b: unknown, i: unknown) => ({ b, i }) } }));
import { readJson } from "@/lib/server/api";

const post = (body: string, headers: Record<string, string> = {}) => new Request("http://x/api", { method: "POST", body, headers });

describe("readJson", () => {
  it("parses small JSON bodies", async () => {
    expect(await readJson(post('{"a":1}'))).toEqual({ a: 1 });
  });
  it("rejects oversized bodies by declared length and by streamed size", async () => {
    const big = JSON.stringify({ skills: Array.from({ length: 20000 }, (_, i) => `skill-${i}`) });
    expect(big.length).toBeGreaterThan(32_768);
    expect(await readJson(post(big))).toBeNull();
    expect(await readJson(post(big, { "content-length": "10" }))).toBeNull(); // lying content-length is still capped while streaming
  });
  it("returns null for empty or malformed bodies instead of throwing", async () => {
    expect(await readJson(post(""))).toBeNull();
    expect(await readJson(post("{bad"))).toBeNull();
    expect(await readJson(new Request("http://x/api", { method: "POST" }))).toBeNull();
  });
});
