import type { Metadata } from "next";
import { GlassPage } from "@/components/layout/GlassPage";
import { ForgotForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Forgot password" };
export default function Page() {
  return (
    <GlassPage>
      <ForgotForm />
    </GlassPage>
  );
}
