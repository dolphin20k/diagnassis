import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/server/auth";
import { UUID } from "@/lib/server/api";
import { TestRunner, type RunnerQuestion } from "@/components/student/TestRunner";

export const metadata: Metadata = { title: "Diagnostic test" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const profile = await requireStudent();
  const supabase = await createClient();
  const { data: attempt } = await supabase.from("attempts").select("id,role_name,status,current_position,is_custom_role").eq("id", id).eq("user_id", profile.id).maybeSingle();
  if (!attempt) notFound();
  if (attempt.status === "submitted") redirect(`/results/${id}`);

  const { data: rows } = await supabase
    .from("attempt_questions")
    .select("position,skill_name,selected_index,flagged,questions(prompt,options)")
    .eq("attempt_id", id)
    .order("position");
  const questions: RunnerQuestion[] = ((rows ?? []) as unknown as { position: number; skill_name: string; selected_index: number | null; flagged: boolean; questions: { prompt: string; options: string[] } | { prompt: string; options: string[] }[] | null }[])
    .map((r) => {
      const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
      return q ? { position: r.position, skill: r.skill_name, prompt: q.prompt, options: q.options, selected: r.selected_index, flagged: r.flagged } : null;
    })
    .filter((q): q is RunnerQuestion => q !== null);
  if (questions.length === 0) notFound();
  const resumed = questions.some((q) => q.selected !== null);
  return <TestRunner attemptId={id} role={attempt.role_name} custom={attempt.is_custom_role} questions={questions} startAt={Math.min(attempt.current_position, questions.length - 1)} resumed={resumed} />;
}
