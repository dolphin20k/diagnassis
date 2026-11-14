"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/components/ui/cn";
import { createClient } from "@/lib/supabase/client";
import { fmtRelative, initials } from "@/lib/format";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(student)/actions";
import type { NotificationRow, NotificationType } from "@/lib/types/database";

const ICON: Record<NotificationType, IconName> = { results: "chart-column", report: "file-text", platform: "megaphone", policy: "shield-check", deletion: "user-x", roles: "briefcase", trends: "trending-up", rating: "star" };
const PAGE = 15;

/** Closes a popover when the user clicks/taps outside it or presses Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

/**
 * YouTube-style notification bell: opens a scrollable panel right below the bell instead of navigating away.
 * Older notifications load as you scroll; unread ones are tinted, bold and carry a dot. "View all" opens the full page.
 */
export function NotificationBell({ unread, allHref }: { unread: number; allHref: string }) {
  const router = useRouter();
  const { open, setOpen, ref } = usePopover();
  const panelId = useId();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [more, setMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [count, setCount] = useState(unread);
  const [, start] = useTransition();
  useEffect(() => setCount(unread), [unread]);

  const fetchPage = useCallback(async (from: number) => {
    const { data, error } = await createClient().from("notifications").select("*").order("created_at", { ascending: false }).range(from, from + PAGE - 1);
    if (error || !data) throw error ?? new Error("load_failed");
    return data;
  }, []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setStatus("loading");
    fetchPage(0)
      .then((d) => { if (!live) return; setItems(d); setMore(d.length === PAGE); setStatus("ready"); })
      .catch(() => live && setStatus("error"));
    return () => { live = false; };
  }, [open, fetchPage]);

  async function loadMore() {
    if (loadingMore || !more || status !== "ready") return;
    setLoadingMore(true);
    try {
      const d = await fetchPage(items.length);
      setItems((cur) => [...cur, ...d.filter((n) => !cur.some((c) => c.id === n.id))]);
      setMore(d.length === PAGE);
    } catch { /* keep what we have; user can scroll again */ }
    setLoadingMore(false);
  }

  const openItem = (n: NotificationRow) => {
    if (!n.read_at) {
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setCount((c) => Math.max(0, c - 1));
      start(async () => { await markNotificationRead(n.id); router.refresh(); });
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };
  const readAll = () => {
    const now = new Date().toISOString();
    setItems((cur) => cur.map((x) => ({ ...x, read_at: x.read_at ?? now })));
    setCount(0);
    start(async () => { await markAllNotificationsRead(); router.refresh(); });
  };
  const anyUnread = count > 0 || items.some((n) => !n.read_at);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={count ? `Notifications, ${count} unread` : "Notifications"} className={cn("relative grid size-11 place-items-center rounded-lg border border-border bg-surface text-ink hover:bg-slate-50", open && "bg-indigo-50")}>
        <Icon name="bell" />
        {count > 0 ? <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">{count > 99 ? "99+" : count}</span> : null}
      </button>
      {open ? (
        <div id={panelId} role="dialog" aria-label="Notifications" className="fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[26rem]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-base font-bold">Notifications</h2>
            {anyUnread ? <button type="button" onClick={readAll} className="text-[13px] font-semibold text-primary hover:underline">Mark all as read</button> : null}
          </div>
          <div className="max-h-[min(26rem,70dvh)] overflow-y-auto overscroll-contain" onScroll={(e) => { const t = e.currentTarget; if (t.scrollHeight - t.scrollTop - t.clientHeight < 80) void loadMore(); }}>
            {status === "loading" ? <p role="status" className="px-4 py-10 text-center text-sm text-ink-2">Loading…</p> : null}
            {status === "error" ? <p role="alert" className="px-4 py-10 text-center text-sm text-rose-700">We could not load notifications. Close this and try again.</p> : null}
            {status === "ready" && items.length === 0 ? <div className="px-4 py-10 text-center"><Icon name="inbox" size={28} className="mx-auto text-ink-3" /><p className="mt-2 font-display font-semibold">You are all caught up</p><p className="text-sm text-ink-2">New notifications will appear here.</p></div> : null}
            {status === "ready" && items.length > 0 ? (
              <ul>
                {items.map((n) => {
                  const unreadItem = !n.read_at;
                  return (
                    <li key={n.id} className="border-b border-border last:border-b-0">
                      <button type="button" onClick={() => openItem(n)} className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50", unreadItem && "bg-indigo-50/70 hover:bg-indigo-50")}>
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", unreadItem ? "bg-primary text-white" : "bg-slate-100 text-ink-2")}><Icon name={ICON[n.type] ?? "bell"} size={16} /></span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm leading-snug", unreadItem ? "font-bold text-ink" : "font-medium text-ink-2")}>{n.title}{unreadItem ? <span className="sr-only"> (unread)</span> : null}</span>
                          <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-2">{n.body}</span>
                          <span className="mt-1 block text-xs text-ink-3">{fmtRelative(n.created_at)}</span>
                        </span>
                        {unreadItem ? <span aria-hidden className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" /> : null}
                      </button>
                    </li>
                  );
                })}
                {loadingMore ? <li className="px-4 py-3 text-center text-xs text-ink-3" role="status">Loading older notifications…</li> : null}
                {!more && items.length > PAGE ? <li className="px-4 py-3 text-center text-xs text-ink-3">You have reached the oldest notification</li> : null}
              </ul>
            ) : null}
          </div>
          <Link href={allHref} onClick={() => setOpen(false)} className="block border-t border-border bg-bg px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-indigo-50">View all notifications</Link>
        </div>
      ) : null}
    </div>
  );
}

/** Avatar button that opens a small popover with the user's name, email, a profile link and Log out. Same for students and admins. */
export function ProfileMenu({ name, email, profileHref, profileLabel = "My profile", settingsHref }: { name: string; email: string; profileHref?: string; profileLabel?: string; settingsHref?: string }) {
  const { open, setOpen, ref } = usePopover();
  const panelId = useId();
  const item = "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-slate-100";
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={`Account menu for ${name}`} className="grid size-11 place-items-center rounded-full bg-primary font-display text-sm font-bold text-white ring-offset-2 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary">{initials(name)}</button>
      {open ? (
        <div id={panelId} role="menu" aria-label="Account" className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-pop">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-white">{initials(name)}</span>
            <div className="min-w-0"><p className="truncate font-display text-[15px] font-bold">{name}</p><p className="truncate text-[13px] text-ink-2">{email}</p></div>
          </div>
          <div className="p-1.5">
            {profileHref ? <Link role="menuitem" href={profileHref} onClick={() => setOpen(false)} className={item}><Icon name="user" size={16} />{profileLabel}</Link> : null}
            {settingsHref ? <Link role="menuitem" href={settingsHref} onClick={() => setOpen(false)} className={item}><Icon name="settings" size={16} />Settings</Link> : null}
            <form action="/auth/signout" method="post"><button role="menuitem" type="submit" className={cn(item, "text-rose-700 hover:bg-rose-50")}><Icon name="log-out" size={16} />Log out</button></form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
