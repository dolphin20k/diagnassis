import { cn } from "./cn";

export function Card({ title, subtitle, action, children, className, as: As = "section" }: { title?: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode; className?: string; as?: React.ElementType }) {
  return (
    <As className={cn("rounded-lg bg-surface p-6 shadow-card", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-lg">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-ink-2">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </As>
  );
}
