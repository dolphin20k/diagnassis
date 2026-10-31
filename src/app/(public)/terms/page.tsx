import type { Metadata } from "next";
import Link from "next/link";
import { GlassPage } from "@/components/layout/GlassPage";
import { PolicyBody } from "@/components/layout/PolicyBody";
import { StateBlock } from "@/components/ui/States";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Terms & Conditions" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: policy } = await supabase.from("policies").select("*").eq("type", "terms").order("published_at", { ascending: false }).limit(1).maybeSingle();
  return (
    <GlassPage wide>
      {policy ? (
        <article>
          <h1 className="text-[clamp(26px,3vw,34px)]">Terms & Conditions</h1>
          <p className="mb-6 mt-1 text-sm text-ink-2">Version {policy.version} · Updated {fmtDate(policy.published_at)}</p>
          <PolicyBody body={policy.body} />
          <p className="mt-8 text-sm"><Link href="/">Back to home</Link></p>
        </article>
      ) : (
        <StateBlock icon="file-text" title="Not available yet" body="This document has not been published yet. Please check back soon." />
      )}
    </GlassPage>
  );
}
