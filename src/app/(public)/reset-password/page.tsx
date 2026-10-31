import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GlassPage } from "@/components/layout/GlassPage";
import { ResetForm } from "@/components/auth/AuthForms";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";
export default async function Page() {
  // The recovery link signs the user in via /auth/callback; without a session there is nothing to reset.
  if (!(await getCurrentUser())) redirect("/forgot-password");
  return (
    <GlassPage back={false}>
      <ResetForm />
    </GlassPage>
  );
}
