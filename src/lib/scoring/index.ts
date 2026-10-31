import type { ActionItem, AttemptResult, Band, ResultRow, SkillPriority, SkillTrend } from "@/lib/types/database";

/** Mirrors public.band_for() in the database (the DB value is authoritative). */
export function bandFor(score: number): Band {
  if (score >= 80) return "Ready";
  if (score >= 60) return "Competitive";
  if (score >= 40) return "Developing";
  return "Early stage";
}

export const BAND_COPY: Record<Band, { tone: "strong" | "info" | "attention" | "critical"; text: string }> = {
  Ready: { tone: "strong", text: "You are well prepared for this role. Keep your strongest skills current and you are in good shape." },
  Competitive: { tone: "info", text: "You meet most of what this role asks for. A few targeted gaps stand between you and a strong profile." },
  Developing: { tone: "attention", text: "You have a solid base to build on. Closing your top three gaps would move you into a competitive range." },
  "Early stage": { tone: "critical", text: "You are at the start for this role, which is a fine place to be. The three steps below are the quickest way to build a base." },
};

/** Proficiency (0-100) at or above this counts as a matched skill. Mirrors submit_attempt(). */
export const MATCH_THRESHOLD = 70;
export const QUESTIONS_PER_SKILL = 5;
export const MAX_TESTED_SKILLS = 8;

const PRIORITY_RANK: Record<SkillPriority, number> = { high: 3, medium: 2, low: 1 };

/**
 * Ranks the skills a student should work on next:
 * weight x remaining headroom, weak skills ranked above missing at equal headroom, rising skills boosted.
 */
export function rankGaps(rows: ResultRow[], limit = 3): ResultRow[] {
  return rows
    .filter((r) => r.status !== "matched")
    .map((r) => ({
      r,
      rank: r.weight * (100 - r.proficiency) * (r.status === "weak" ? 1.7 : 1) * (r.trend === "rising" ? 1.2 : 1),
    }))
    .sort((a, b) => b.rank - a.rank || PRIORITY_RANK[b.r.priority] - PRIORITY_RANK[a.r.priority] || a.r.skill.localeCompare(b.r.skill))
    .slice(0, limit)
    .map((x) => x.r);
}

export function searchUrl(query: string, kind: string): string {
  const q = encodeURIComponent(query.slice(0, 120));
  return kind === "video" ? `https://www.youtube.com/results?search_query=${q}` : `https://www.google.com/search?q=${q}`;
}

export function fallbackAction(role: string, row: ResultRow): ActionItem {
  const rising = row.trend === "rising";
  return {
    skill: row.skill,
    status: row.status === "missing" ? "missing" : "weak",
    priority: row.priority,
    trend: row.trend,
    why:
      row.status === "missing"
        ? `${role} listings ask for ${row.skill} (${row.priority} priority) and it is not on your profile yet.${rising ? " Demand for it is rising." : ""}`
        : `You scored ${row.proficiency}% on ${row.skill}. It carries ${Math.round(row.weight)}% of the ${role} score, so improving it lifts your result directly.`,
    next_step:
      row.status === "missing"
        ? `Learn the basics of ${row.skill}, then build one small project that uses it.`
        : `Review the questions you missed on ${row.skill} and practise with short exercises.`,
    resources: [
      { title: `${row.skill} full course for beginners`, kind: "video", search_query: `${row.skill} full course for beginners`, level: "Beginner" },
      { title: `${row.skill} explained in 15 minutes`, kind: "video", search_query: `${row.skill} explained in 15 minutes`, level: "Beginner" },
    ],
    ai_generated: false,
  };
}

export function fallbackTrendSummary(role: string, result: AttemptResult, declining: string[]): string {
  const rising = result.rows.filter((r) => r.trend === "rising").map((r) => r.skill);
  const parts: string[] = [];
  if (rising.length) parts.push(`Demand is rising for ${rising.slice(0, 4).join(", ")} in ${role} roles.`);
  if (declining.length) parts.push(`${declining.slice(0, 3).join(", ")} ${declining.length === 1 ? "is" : "are"} losing ground.`);
  return parts.join(" ") || `Requirements for ${role} roles look stable right now.`;
}

export function fallbackSummary(role: string, result: AttemptResult): string {
  return `${BAND_COPY[result.band].text} (${role}, ${result.score}/100)`;
}

/** Splits delta into a readable label like "+8 since 12 Aug 2026". */
export function deltaLabel(delta: number | null, previousDate: string | null): string | null {
  if (delta === null) return null;
  const sign = delta >= 0 ? "+" : "";
  const when = previousDate
    ? ` since ${new Date(previousDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`
    : "";
  return `${sign}${delta}${when}`;
}

export function trendLabel(t: SkillTrend | null | undefined): "Rising" | "Stable" | "Declining" {
  return t === "rising" ? "Rising" : t === "declining" ? "Declining" : "Stable";
}
