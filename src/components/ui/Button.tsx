import Link from "next/link";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "white";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-white border-primary hover:bg-primary-dark hover:border-primary-dark",
  secondary: "bg-surface text-primary border-border hover:bg-indigo-50",
  ghost: "bg-transparent text-primary border-transparent hover:bg-indigo-50",
  danger: "bg-rose-600 text-white border-rose-600 hover:bg-rose-700",
  white: "bg-white text-primary-dark border-white hover:bg-indigo-50 shadow-pop",
};
const SIZE: Record<Size, string> = { sm: "px-3 py-1.5 text-[13px]", md: "px-[18px] py-2.5 text-sm", lg: "px-6 py-3.5 text-base" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md border font-display font-semibold transition-colors duration-150 ease-[var(--ease)] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    VARIANT[variant], SIZE[size], extra,
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean };
export function Button({ variant, size, loading, className, children, disabled, type = "button", ...rest }: BtnProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant, size, className, children, ...rest }: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
