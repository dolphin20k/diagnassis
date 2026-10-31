import { Icon, type IconName } from "./Icon";
import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-4 w-full", className)} />;
}

export function StateBlock({ icon, title, body, action, tone = "neutral" }: { icon: IconName; title: string; body?: string; action?: React.ReactNode; tone?: "neutral" | "error" }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className="flex flex-col items-center gap-3 rounded-lg bg-surface px-6 py-12 text-center shadow-card">
      <span className={cn("grid size-14 place-items-center rounded-full", tone === "error" ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-primary")}><Icon name={icon} size={26} /></span>
      <h2 className="text-xl">{title}</h2>
      {body ? <p className="max-w-md text-ink-2">{body}</p> : null}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action, back }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; back?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back}
        <h1 className="text-[clamp(26px,3vw,34px)] tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-ink-2">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} className={i <= value ? "text-amber-400" : "text-slate-300"} fill={i <= value ? "#FBBF24" : "none"} />)}
    </span>
  );
}
