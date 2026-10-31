import type { Metadata } from "next";
import { GlassPage } from "@/components/layout/GlassPage";
import { SignupForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Sign up" };
export default function Page() {
  return (
    <GlassPage>
      <SignupForm />
    </GlassPage>
  );
}
