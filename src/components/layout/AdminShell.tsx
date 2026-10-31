"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/components/ui/cn";
import { initials } from "@/lib/format";

const NAV: { href: string; label: string; icon: IconName; badge?: "queue" | "deletions" | "notifs" }[] = [
  { href: "/admin", label: "Dashboard", icon: "layout-dashboard" },
  { href: "/admin/students", label: "Students", icon: "users" },
  { href: "/admin/analytics", label: "Analytics", icon: "chart-line" },
  { href: "/admin/roles", label: "Roles & skills", icon: "briefcase", badge: "queue" },
  { href: "/admin/feedback", label: "Feedback", icon: "message-square" },
  { href: "/admin/policies", label: "Policies", icon: "shield-check" },
  { href: "/admin/deletions", label: "Deletion requests", icon: "user-x", badge: "deletions" },
  { href: "/admin/notifications", label: "Notifications", icon: "bell", badge: "notifs" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

export function AdminShell({ name, counts, children }: { name: string; counts: { queue: number; deletions: number; notifs: number }; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  const current = NAV.find((n) => active(n.href));

  const links = (
    <nav aria-label="Admin" className="flex flex-1 flex-col gap-1">
      {NAV.map((n) => {
        const c = n.badge ? counts[n.badge] : 0;
        return (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={cn("flex items-center gap-3 rounded-lg px-3.5 py-3 font-display text-[15px] font-medium", active(n.href) ? "bg-primary text-white" : "text-slate-300 hover:bg-white/10 hover:text-white")}>
            <Icon name={n.icon} /><span className="flex-1">{n.label}</span>
            {c > 0 ? <span className="grid min-w-5 place-items-center rounded-full bg-cyan px-1.5 text-xs font-bold text-sidebar" aria-label={`${c} pending`}>{c}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="min-h-dvh bg-bg lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar p-4 lg:flex" aria-label="Sidebar">
        <div className="mb-6 grid h-12 place-items-center rounded-lg bg-white"><Logo height={34} /></div>
        {links}
        <p className="mt-4 rounded-lg bg-white/10 px-3 py-2 text-[13px] text-slate-200">Signed in as administrator</p>
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar p-4"><div className="mb-6 grid h-12 place-items-center rounded-lg bg-white"><Logo height={34} /></div>{links}</aside>
        </div>
      ) : null}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-bg/95 px-4 backdrop-blur lg:px-10">
        <div className="flex items-center gap-3">
          <button className="grid size-11 place-items-center rounded-lg border border-border bg-surface lg:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button>
          <span className="font-display text-[15px] font-semibold text-ink-2">{current?.label ?? "Admin"}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/notifications" aria-label={counts.notifs ? `Notifications, ${counts.notifs} unread` : "Notifications"} className="relative grid size-11 place-items-center rounded-lg border border-border bg-surface"><Icon name="bell" />{counts.notifs > 0 ? <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">{counts.notifs}</span> : null}</Link>
          <form action="/auth/signout" method="post"><button className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 font-display text-sm font-semibold" aria-label={`Log out ${name}`}><span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-white">{initials(name)}</span><span className="hidden sm:inline">Log out</span></button></form>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1280px] px-4 pb-14 pt-6 lg:px-10 lg:pt-8">{children}</main>
    </div>
  );
}
