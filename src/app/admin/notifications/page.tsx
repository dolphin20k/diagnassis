import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { NotificationList } from "@/components/student/NotificationList";
import { PageHeader, StateBlock } from "@/components/ui/States";

export const metadata: Metadata = { title: "Notifications" };

export default async function Page() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return <><PageHeader title="Notifications" /><StateBlock tone="error" icon="cloud-off" title="Something went wrong loading this page" body="Check your connection and try again." /></>;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" />
      {data.length === 0 ? <StateBlock icon="inbox" title="No notifications" body="Requests and system updates will appear here." /> : <NotificationList items={data} />}
    </div>
  );
}
