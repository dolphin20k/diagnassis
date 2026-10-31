import { describe, expect, it } from "vitest";
import { BAND_COPY, bandFor, deltaLabel, fallbackAction, rankGaps, searchUrl } from "@/lib/scoring";
import { normalizeWeights, priorityForWeight, weightsTotal } from "@/lib/scoring/weights";
import type { ResultRow } from "@/lib/types/database";

const row = (o: Partial<ResultRow> & { skill: string }): ResultRow => ({
  weight: 10, priority: "medium", trend: "stable", trend_change: null, why: null, tested: true, proficiency: 0, status: "weak", points: 0, ...o,
});

describe("bandFor", () => {
  it.each([[100, "Ready"], [80, "Ready"], [79, "Competitive"], [60, "Competitive"], [59, "Developing"], [40, "Developing"], [39, "Early stage"], [0, "Early stage"]])(
    "score %i -> %s", (score, band) => expect(bandFor(score)).toBe(band));
  it("has copy for every band", () => {
    for (const b of ["Ready", "Competitive", "Developing", "Early stage"] as const) expect(BAND_COPY[b].text.length).toBeGreaterThan(20);
  });
});

describe("rankGaps", () => {
  it("excludes matched skills and returns at most the limit", () => {
    const rows = [row({ skill: "A", status: "matched", proficiency: 90 }), row({ skill: "B" }), row({ skill: "C" }), row({ skill: "D" }), row({ skill: "E" })];
    const r = rankGaps(rows, 3);
    expect(r).toHaveLength(3);
    expect(r.find((x) => x.skill === "A")).toBeUndefined();
  });
  it("matches the prototype ranking: weight x headroom, weak x1.7, rising x1.2", () => {
    const rows = [
      row({ skill: "TypeScript", weight: 13, status: "missing", proficiency: 0, tested: false, trend: "rising" }), // 13*100*1.2 = 1560
      row({ skill: "React", weight: 17, status: "weak", proficiency: 60 }), // 17*40*1.7 = 1156
      row({ skill: "REST APIs", weight: 10, status: "weak", proficiency: 40 }), // 10*60*1.7 = 1020
      row({ skill: "Next.js", weight: 8, status: "missing", proficiency: 0, tested: false, trend: "rising" }), // 960
      row({ skill: "Accessibility", weight: 7, status: "missing", proficiency: 0, tested: false, trend: "rising" }), // 840
    ];
    expect(rankGaps(rows).map((r) => r.skill)).toEqual(["TypeScript", "React", "REST APIs"]);
  });
  it("returns nothing when every skill matched", () => {
    expect(rankGaps([row({ skill: "A", status: "matched", proficiency: 100 })])).toEqual([]);
  });
});

describe("helpers", () => {
  it("builds YouTube and web search URLs with encoded queries only", () => {
    expect(searchUrl("React & hooks", "video")).toBe("https://www.youtube.com/results?search_query=React%20%26%20hooks");
    expect(searchUrl("sql joins", "docs").startsWith("https://www.google.com/search?q=")).toBe(true);
    expect(searchUrl("x".repeat(500), "video").length).toBeLessThan(200);
  });
  it("formats deltas", () => {
    expect(deltaLabel(null, null)).toBeNull();
    expect(deltaLabel(8, "2026-08-12T10:00:00Z")).toBe("+8 since 12 Aug 2026");
    expect(deltaLabel(-3, null)).toBe("-3");
  });
  it("produces role-specific fallback actions without claiming AI authorship", () => {
    const a = fallbackAction("Frontend Developer", row({ skill: "TypeScript", status: "missing", tested: false, trend: "rising", priority: "high" }));
    expect(a.ai_generated).toBe(false);
    expect(a.why).toContain("Demand for it is rising");
    expect(a.resources).toHaveLength(2);
    const w = fallbackAction("Frontend Developer", row({ skill: "React", proficiency: 60, weight: 17 }));
    expect(w.why).toContain("You scored 60% on React");
  });
});

describe("normalizeWeights", () => {
  it("always totals exactly 100 with every weight >= 1", () => {
    for (let n = 1; n <= 14; n++) {
      for (let t = 0; t < 40; t++) {
        const items = Array.from({ length: n }, () => ({ weight: Math.random() * 30 + 0.1 }));
        const out = normalizeWeights(items);
        expect(weightsTotal(out)).toBe(100);
        expect(out.every((i) => Number.isInteger(i.weight) && i.weight >= 1)).toBe(true);
      }
    }
  });
  it("keeps proportions and handles degenerate input", () => {
    expect(normalizeWeights([{ weight: 3 }, { weight: 1 }]).map((i) => i.weight)).toEqual([75, 25]);
    expect(weightsTotal(normalizeWeights([{ weight: 0 }, { weight: 0 }, { weight: 0 }]))).toBe(100);
    expect(normalizeWeights([])).toEqual([]);
  });
  it("derives priority labels from weight bands", () => {
    expect([priorityForWeight(18), priorityForWeight(8), priorityForWeight(3)]).toEqual(["high", "medium", "low"]);
  });
});
