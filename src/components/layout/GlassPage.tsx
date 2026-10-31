import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Icon } from "@/components/ui/Icon";

/** Full-bleed "Futuristic Growth Pathway" background with a glass card (auth, policies, acceptance). */
export function GlassPage({ children, back = true, wide }: { children: React.ReactNode; back?: boolean; wide?: boolean }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0b1437]">
      <Image src="/brand/growth-bg.png" alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full flex-col items-center px-4 py-8" style={{ maxWidth: wide ? 760 : 460 }}>
        <div className="mb-4 flex w-full items-center justify-between">
          {back ? (
            <Link href="/" className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-white hover:text-white/80">
              <Icon name="arrow-left" size={16} /> Back to home
            </Link>
          ) : <span />}
          <span className="rounded-lg bg-white/90 px-3 py-1.5"><Logo height={28} priority /></span>
        </div>
        <div className="w-full rounded-[28px] border border-white/40 bg-white/80 p-6 shadow-[0_20px_60px_rgba(11,20,55,0.45)] backdrop-blur-xl sm:p-10">{children}</div>
      </div>
    </div>
  );
}
