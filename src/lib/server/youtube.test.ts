import { afterEach, describe, expect, it, vi } from "vitest";
import { attachVideos, findVideos } from "@/lib/server/youtube";
import { fallbackAction } from "@/lib/scoring";
import type { ResultRow } from "@/lib/types/database";

const html = (ids: string[]) => ids.map((id) => `{"videoRenderer":{"videoId":"${id}","thumbnail":{}}}`).join(",");
const A = "PkZNo7MFNFg", B = "W6NZfCO5SIk", C = "hdI2bqOjy3c";

function stubFetch(searchIds: string[]) {
  const f = vi.fn(async (url: URL | string) => {
    const u = String(url);
    if (u.includes("/results?")) return new Response(html(searchIds), { status: 200 });
    if (u.includes("/oembed")) {
      const id = decodeURIComponent(u).match(/v=([\w-]{11})/)![1];
      return id === "BAD00000000" ? new Response("nope", { status: 401 }) : new Response(JSON.stringify({ title: `Title ${id}`, author_name: "Chan" }), { status: 200 });
    }
    return new Response("", { status: 404 });
  });
  vi.stubGlobal("fetch", f);
  return f;
}
afterEach(() => vi.unstubAllGlobals());

describe("YouTube resolver", () => {
  it("returns verified, distinct videos and skips unavailable ones", async () => {
    stubFetch(["BAD00000000", A, A, B]);
    const v = await findVideos("react video skip bad", 3);
    expect(v.map((x) => x.id)).toEqual([A, B]);
    expect(v[0]).toMatchObject({ title: `Title ${A}`, channel: "Chan" });
  });

  it("never throws when YouTube is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(findVideos("offline query", 1)).resolves.toEqual([]);
  });

  it("gives each resource of an action a different real video", async () => {
    stubFetch([A, B, C]);
    const row = { skill: "Docker", weight: 10, priority: "high", trend: "stable", trend_change: null, why: null, tested: false, proficiency: 0, status: "missing", points: 0 } as ResultRow;
    const [action] = await attachVideos([fallbackAction("DevOps Engineer", row)]);
    const ids = action!.resources.map((r) => r.video_id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("limits the work a crafted insights document can trigger (no unbounded outbound requests)", async () => {
    const f = stubFetch([A, B]);
    const mkAction = (n: number) => ({ skill: `s${n}`, status: "missing" as const, priority: "high" as const, trend: null, why: "w", next_step: "n", ai_generated: false,
      resources: Array.from({ length: 50 }, (_, i) => ({ title: `t${n}-${i}`, kind: "video", search_query: `unique query ${n} ${i}`, level: null })) });
    const out = await attachVideos(Array.from({ length: 40 }, (_, n) => mkAction(n)));
    const searches = f.mock.calls.filter((c) => String(c[0]).includes("/results?")).length;
    expect(searches).toBeLessThanOrEqual(5 * 3); // 5 actions x 3 resources at most
    expect(out).toHaveLength(40);
    expect(out[39]!.resources.every((r) => !r.video_id)).toBe(true); // beyond the cap: untouched
  });
});
