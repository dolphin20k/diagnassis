import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/server/auth";
import { PageHeader, StateBlock } from "@/components/ui/States";
import { NotificationList } from "@/components/student/NotificationList";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireStudent();
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return <><PageHeader title="Notifications" /><StateBlock tone="error" icon="cloud-off" title="We could not load notifications" body="Check your connection and try again." /></>;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" />
      {data.length === 0 ? <StateBlock icon="inbox" title="You are all caught up" body="Results, reports and platform updates will appear here." /> : <NotificationList items={data} />}
    </div>
  );
}
