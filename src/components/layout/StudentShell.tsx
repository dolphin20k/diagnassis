"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/components/ui/cn";
import { initials } from "@/lib/format";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { href: "/diagnostic", label: "Diagnostic", icon: "scan-search" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
  { href: "/profile", label: "My Profile", icon: "user" },
  { href: "/settings", label: "Settings", icon: "settings" },
  { href: "/feedback", label: "Feedback", icon: "message-square" },
];
const TABS: { href: string; label: string; icon: IconName; also?: string[] }[] = [
  { href: "/dashboard", label: "Home", icon: "house" },
  { href: "/diagnostic", label: "Diagnose", icon: "scan-search" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/profile", label: "Profile", icon: "user", also: ["/settings", "/feedback", "/notifications"] },
];
const TITLES: Record<string, string> = { "/dashboard": "Dashboard", "/diagnostic": "Diagnostic", "/history": "History", "/notifications": "Notifications", "/profile": "My Profile", "/settings": "Settings", "/feedback": "Feedback", "/results": "Result" };
const FOCUS = /^\/diagnostic\/[0-9a-f-]{36}/;

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

export function StudentShell({ name, unread, attemptsLeft, limit, children }: { name: string; unread: number; attemptsLeft: number; limit: number; children: React.ReactNode }) {
  const path = usePathname();
  if (FOCUS.test(path)) return <main id="main" className="min-h-dvh bg-bg">{children}</main>;
  const title = TITLES[Object.keys(TITLES).find((k) => isActive(path, k)) ?? ""] ?? "";
  const pct = limit > 0 ? Math.max(0, Math.min(100, (attemptsLeft / limit) * 100)) : 0;
  return (
    <div className="min-h-dvh bg-bg md:pl-60">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar p-4 md:flex" aria-label="Sidebar">
        <Link href="/dashboard" className="mb-6 grid h-12 place-items-center rounded-lg bg-white" aria-label="DIAGNASSIS dashboard"><Logo height={34} /></Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => {
            const active = isActive(path, n.href) || (n.href === "/diagnostic" && path.startsWith("/limit"));
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-lg px-3.5 py-3 font-display text-[15px] font-medium transition-colors", active ? "bg-primary text-white" : "text-slate-300 hover:bg-white/10 hover:text-white")}>
                <Icon name={n.icon} />
                <span className="flex-1">{n.label}</span>
                {n.href === "/notifications" && unread > 0 ? <span className="grid min-w-5 place-items-center rounded-full bg-cyan px-1.5 text-xs font-bold text-sidebar" aria-label={`${unread} unread`}>{unread}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="rounded-lg bg-white/10 p-3 text-[13px] text-slate-200">
          <p>{attemptsLeft} of {limit} diagnostics left</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-cyan" style={{ width: `${pct}%` }} /></div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-bg/95 px-4 backdrop-blur md:px-10">
        <Link href="/dashboard" className="md:hidden" aria-label="DIAGNASSIS dashboard"><Logo height={30} /></Link>
        <span className="hidden font-display text-[15px] font-semibold text-ink-2 md:block">{title}</span>
        <div className="flex items-center gap-3">
          <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative grid size-11 place-items-center rounded-lg border border-border bg-surface text-ink hover:bg-slate-50">
            <Icon name="bell" />
            {unread > 0 ? <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">{unread}</span> : null}
          </Link>
          <Link href="/profile" aria-label="My profile" className="grid size-11 place-items-center rounded-full bg-primary font-display text-sm font-bold text-white">{initials(name)}</Link>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1180px] px-4 pb-28 pt-5 md:px-10 md:pb-14 md:pt-8">{children}</main>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map((t) => {
          const active = isActive(path, t.href) || !!t.also?.some((a) => isActive(path, a));
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold", active ? "text-primary" : "text-ink-2")}>
              <Icon name={t.icon} size={22} />{t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
