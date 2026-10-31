"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/components/ui/cn";
import { fmtRelative } from "@/lib/format";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(student)/actions";
import type { NotificationRow, NotificationType } from "@/lib/types/database";

const ICON: Record<NotificationType, IconName> = { results: "chart-column", report: "file-text", platform: "megaphone", policy: "shield-check", deletion: "user-x", roles: "briefcase", trends: "trending-up", rating: "star" };

export function NotificationList({ items, markAll = markAllNotificationsRead, markOne = markNotificationRead }: { items: NotificationRow[]; markAll?: typeof markAllNotificationsRead; markOne?: typeof markNotificationRead }) {
  const router = useRouter();
  const [read, setRead] = useState<Set<string>>(new Set(items.filter((n) => n.read_at).map((n) => n.id)));
  const [, start] = useTransition();
  const unread = items.filter((n) => !read.has(n.id)).length;

  const open = (n: NotificationRow) => {
    if (!read.has(n.id)) { setRead((s) => new Set(s).add(n.id)); start(async () => { await markOne(n.id); router.refresh(); }); }
    if (n.link) router.push(n.link);
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><p className="text-sm text-ink-2" aria-live="polite">{unread} unread</p>{unread > 0 ? <Button variant="secondary" size="sm" onClick={() => { setRead(new Set(items.map((n) => n.id))); start(async () => { await markAll(); router.refresh(); }); }}>Mark all as read</Button> : null}</div>
      <ul className="flex flex-col gap-2">
        {items.map((n) => {
          const isRead = read.has(n.id);
          return (
            <li key={n.id}>
              <button onClick={() => open(n)} className={cn("flex w-full items-start gap-3 rounded-lg p-4 text-left shadow-card transition hover:bg-slate-50", isRead ? "bg-surface" : "border-l-4 border-primary bg-indigo-50/60")}>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", isRead ? "bg-slate-100 text-ink-2" : "bg-primary text-white")}><Icon name={ICON[n.type]} size={18} /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className={cn("font-display text-[15px]", isRead ? "font-semibold" : "font-bold")}>{n.title}</span>{!isRead ? <span className="sr-only">(unread)</span> : null}</span><span className="mt-0.5 block text-sm text-ink-2">{n.body}</span><span className="mt-1 block text-xs text-ink-3">{fmtRelative(n.created_at)}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
