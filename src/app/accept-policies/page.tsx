import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GlassPage } from "@/components/layout/GlassPage";
import { AcceptPoliciesForm } from "@/components/student/AcceptPoliciesForm";
import { requireProfile } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Review and accept" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/admin");
  const supabase = await createClient();
  const { data: pending } = await supabase.rpc("pending_policies");
  if (!pending || pending.length === 0) redirect("/dashboard");
  const { data: policies } = await supabase.from("policies").select("*").in("id", pending.map((p) => p.id));
  const { count } = await supabase.from("policy_acceptances").select("policy_id", { count: "exact", head: true });
  return (
    <GlassPage back={false} wide>
      <AcceptPoliciesForm policies={policies ?? []} isUpdate={(count ?? 0) > 0} />
    </GlassPage>
  );
}
