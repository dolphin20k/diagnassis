import { describe, expect, it } from "vitest";
import { feedbackSchema, loginSchema, passwordRules, passwordScore, policyPublishSchema, profileSchema, roleItemsSchema, signupSchema } from "@/lib/validation";

describe("passwords", () => {
  it("scores the four design rules", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("abcdefgh")).toBe(1);
    expect(passwordScore("Abcdefg1")).toBe(3);
    expect(passwordScore("Abcdef1!")).toBe(4);
    expect(passwordRules("Ab1!").find(([l]) => l.includes("8 characters"))?.[1]).toBe(false);
  });
});

describe("signup", () => {
  const ok = { name: "Priya Raghavan", email: "priya@college.edu", password: "Str0ng!pass", confirm: "Str0ng!pass", agree: true as const };
  it("accepts valid input", () => expect(signupSchema.safeParse(ok).success).toBe(true));
  it("reports each rule violation with the design copy", () => {
    const r = signupSchema.safeParse({ ...ok, email: "nope", password: "weak", confirm: "other", agree: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      const m = Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
      expect(m.email).toBe("Enter a valid email, like name@college.edu.");
      expect(m.password).toBe("Meet all four password rules below.");
      expect(m.agree).toBe("You need to accept the terms to create an account.");
    }
  });
  it("requires matching confirmation", () => {
    const r = signupSchema.safeParse({ ...ok, confirm: "Different1!" });
    expect(!r.success && r.error.issues[0]?.message).toBe("Passwords do not match.");
  });
  it("login requires both fields", () => expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false));
});

describe("profile", () => {
  const base = { name: "A", college: "C", branch: "CSE", year: "4th" as const, skills: ["Git"], roleId: "0b6f5d3e-1c2a-4f10-9a77-3d9b2c1a8e55", roleOther: null };
  it("accepts a curated role or a typed role", () => {
    expect(profileSchema.safeParse(base).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, roleId: null, roleOther: "Game Developer" }).success).toBe(true);
  });
  it("rejects missing role, empty skills and other years", () => {
    expect(profileSchema.safeParse({ ...base, roleId: null, roleOther: null }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, roleId: null, roleOther: "x" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, skills: [] }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, year: "1st" }).success).toBe(false);
  });
});

describe("feedback, policy, role items", () => {
  it("enforces design validation copy", () => {
    const r = feedbackSchema.safeParse({ rating: 0, topic: null, message: "short" });
    expect(r.success).toBe(false);
    expect(feedbackSchema.safeParse({ rating: 5, topic: "Test questions", message: "More pandas questions please" }).success).toBe(true);
  });
  it("validates policy versions", () => {
    expect(policyPublishSchema.safeParse({ type: "terms", version: "2.2", body: "x".repeat(30) }).success).toBe(true);
    expect(policyPublishSchema.safeParse({ type: "terms", version: "v2", body: "x".repeat(30) }).success).toBe(false);
  });
  it("validates role item shapes", () => {
    expect(roleItemsSchema.safeParse([{ skill: "A", weight: 100, priority: "high" }]).success).toBe(true);
    expect(roleItemsSchema.safeParse([{ skill: "A", weight: 0, priority: "high" }]).success).toBe(false);
    expect(roleItemsSchema.safeParse([]).success).toBe(false);
  });
});
