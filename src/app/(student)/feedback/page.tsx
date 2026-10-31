import type { Metadata } from "next";
import { requireStudent } from "@/lib/server/auth";
import { PageHeader } from "@/components/ui/States";
import { FeedbackForm } from "@/components/student/FeedbackForm";

export const metadata: Metadata = { title: "Feedback" };

export default async function Page() {
  await requireStudent();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Feedback" subtitle="Tell us what worked and what did not. A person reads every message." />
      <FeedbackForm />
    </div>
  );
}
