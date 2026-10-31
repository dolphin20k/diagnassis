import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateQuestions } from "@/lib/ai/features";
import { dbLogger } from "@/lib/ai/log";
import { sanitizeLabel } from "@/lib/sanitize";
import { QUESTIONS_PER_SKILL } from "@/lib/scoring";

const GENERATE_COUNT = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * Makes sure each skill has at least QUESTIONS_PER_SKILL active questions, generating missing ones
 * with the NVIDIA model. Students cannot write to the bank, so this runs with the service role
 * after the caller has been authenticated. Returns the number of active questions per skill.
 */
export async function ensureQuestionBank(skills: string[], userId: string | null): Promise<Record<string, number>> {
  const admin = createAdminClient();
  const log = dbLogger(userId);
  const counts: Record<string, number> = {};
  const unique = [...new Set(skills.map((s) => sanitizeLabel(s)).filter(Boolean))];

  await Promise.all(
    unique.map(async (skill) => {
      let { data: row } = await admin.from("skills").select("id,name").ilike("name", escapeLike(skill)).maybeSingle();
      if (!row) {
        const ins = await admin.from("skills").insert({ name: skill }).select("id,name").single();
        if (ins.error) ({ data: row } = await admin.from("skills").select("id,name").ilike("name", escapeLike(skill)).maybeSingle());
        else row = ins.data;
      }
      if (!row) {
        counts[skill] = 0;
        return;
      }
      const skillId = row.id;
      const canonical = row.name;
      const countActive = async () =>
        (await admin.from("questions").select("id", { count: "exact", head: true }).eq("skill_id", skillId).eq("status", "active")).count ?? 0;

      let have = await countActive();
      if (have < QUESTIONS_PER_SKILL) {
        try {
          const { questions, model } = await generateQuestions(canonical, GENERATE_COUNT, log);
          for (const q of questions) {
            const ins = await admin
              .from("questions")
              .insert({ skill_id: skillId, prompt: q.prompt, options: q.options, source: "ai", model })
              .select("id")
              .single();
            if (ins.error || !ins.data) continue; // duplicate prompt etc.
            const key = await admin.from("question_keys").insert({ question_id: ins.data.id, correct_index: q.correct_index, explanation: q.explanation || null });
            if (key.error) await admin.from("questions").delete().eq("id", ins.data.id); // never leave a question without a key
          }
        } catch {
          /* generation failure is reported through the count below */
        }
        have = await countActive();
      }
      counts[skill] = have;
    }),
  );
  return counts;
}
