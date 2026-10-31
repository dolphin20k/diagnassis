import { describe, expect, it } from "vitest";
import { applySuggestions, diffProfile, RULES, type ProposedSkill } from "@/lib/ai/research-rules";
import { weightsTotal, type WeightedSkill } from "@/lib/scoring/weights";

const cur: WeightedSkill[] = [
  { skill: "JavaScript", weight: 30, priority: "high" }, { skill: "React", weight: 25, priority: "high" },
  { skill: "CSS", weight: 20, priority: "medium" }, { skill: "Git", weight: 15, priority: "low" }, { skill: "Testing", weight: 10, priority: "low" },
];
const p = (name: string, weight: number): ProposedSkill => ({ name, weight, priority: "medium", rationale: "because" });

describe("diffProfile", () => {
  it("ignores tiny shifts and bounds large ones per run", () => {
    const d = diffProfile(cur, [p("JavaScript", 31), p("React", 45), p("CSS", 20), p("Git", 15), p("Testing", 10)]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ kind: "raise_weight", skill_name: "React", from_weight: 25, to_weight: 25 + RULES.maxWeightShiftPerRun });
  });
  it("caps new skill weight and never removes below the minimum skill count", () => {
    const d = diffProfile(cur, [p("JavaScript", 30), p("Redis", 40)]);
    const add = d.find((x) => x.kind === "add_skill");
    expect(add?.to_weight).toBe(RULES.maxNewSkillWeight);
    expect(d.filter((x) => x.kind === "remove_skill")).toHaveLength(0); // 5 skills = the minimum
  });
  it("allows removal when the role has enough skills", () => {
    const big = [...cur, { skill: "jQuery", weight: 5, priority: "low" as const }];
    const d = diffProfile(big, cur.map((c) => p(c.skill, c.weight)));
    expect(d.map((x) => x.kind)).toContain("remove_skill");
  });
  it("limits the number of changes per run", () => {
    const many = Array.from({ length: 10 }, (_, i) => p(`New${i}`, 6));
    expect(diffProfile(cur, many).length).toBeLessThanOrEqual(RULES.maxChangesPerRun);
  });
});

describe("applySuggestions", () => {
  it("always renormalises to exactly 100", () => {
    const out = applySuggestions(cur, [
      { kind: "add_skill", skill_name: "Redis", from_weight: null, to_weight: 8, from_priority: null, to_priority: "low", rationale: "" },
      { kind: "raise_weight", skill_name: "React", from_weight: 25, to_weight: 31, from_priority: "high", to_priority: "high", rationale: "" },
      { kind: "lower_weight", skill_name: "Git", from_weight: 15, to_weight: 9, from_priority: "low", to_priority: "low", rationale: "" },
    ]);
    expect(weightsTotal(out)).toBe(100);
    expect(out.find((o) => o.skill === "Redis")).toBeTruthy();
  });
  it("refuses to drop below the minimum or exceed the maximum number of skills", () => {
    const rm = applySuggestions(cur, [{ kind: "remove_skill", skill_name: "Git", from_weight: 15, to_weight: null, from_priority: "low", to_priority: null, rationale: "" }]);
    expect(rm).toHaveLength(5);
    const full = Array.from({ length: RULES.maxSkills }, (_, i) => ({ skill: `S${i}`, weight: 100 / RULES.maxSkills, priority: "medium" as const }));
    expect(applySuggestions(full, [{ kind: "add_skill", skill_name: "Extra", from_weight: null, to_weight: 5, from_priority: null, to_priority: "low", rationale: "" }])).toHaveLength(RULES.maxSkills);
  });
  it("ignores suggestions for unknown skills", () => {
    const out = applySuggestions(cur, [{ kind: "raise_weight", skill_name: "Nope", from_weight: 1, to_weight: 9, from_priority: null, to_priority: null, rationale: "" }]);
    expect(out.map((o) => o.weight)).toEqual(cur.map((c) => c.weight));
  });
});
