import type { Metadata } from "next";
import { Suspense } from "react";
import { GlassPage } from "@/components/layout/GlassPage";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Log in" };
export default function Page() {
  return (
    <GlassPage>
      <Suspense><LoginForm /></Suspense>
    </GlassPage>
  );
}
