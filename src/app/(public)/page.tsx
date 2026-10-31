import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { SkillBar } from "@/components/ui/SkillBar";
import { LinkButton } from "@/components/ui/Button";
import { GoogleCta } from "@/components/auth/AuthForms";
import { getCurrentUser } from "@/lib/server/auth";

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "log-in", title: "Create your account", body: "Sign up with email or Google. Add your college, year and skills once." },
  { icon: "target", title: "Choose a target role", body: "Frontend, Backend, Data Analyst, ML, DevOps and more. Confirm the skills you already have." },
  { icon: "list-checks", title: "Take a short test", body: "Five multiple-choice questions per skill, up to eight skills. No timer, and you can pause any time." },
  { icon: "chart-column", title: "Get your diagnosis", body: "A readiness score, your skill gaps, market trends and the three things to work on next." },
];

export const dynamic = "force-dynamic";

export default async function Landing() {
  const user = await getCurrentUser();
  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="DIAGNASSIS home"><Logo height={36} priority /></Link>
          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-3">
            <a href="#how" className="hidden rounded-md px-3 py-2 text-[15px] text-ink-2 hover:text-ink sm:inline">How it works</a>
            <a href="#sample" className="hidden rounded-md px-3 py-2 text-[15px] text-ink-2 hover:text-ink sm:inline">Sample result</a>
            {user ? (
              <LinkButton href="/dashboard" size="sm">Open dashboard</LinkButton>
            ) : (
              <>
                <LinkButton href="/login" variant="ghost" size="sm">Log in</LinkButton>
                <LinkButton href="/signup" size="sm">Sign up</LinkButton>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="text-white [background:linear-gradient(180deg,#4f46e5_0%,#6366f1_55%,#06b6d4_100%)] md:[background:var(--gradient-hero)]">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-24">
            <div className="flex flex-col gap-5">
              <p className="font-display text-[13px] font-semibold uppercase tracking-wide text-indigo-100">For 3rd and 4th year CSE students</p>
              <h1 className="text-[clamp(36px,4.8vw,56px)] font-extrabold leading-[1.05] tracking-tight text-white">Know where you stand before placement season.</h1>
              <p className="max-w-xl text-lg text-indigo-50">Pick the role you want, take a short test on your skills, and see how your results compare with what employers are asking for right now.</p>
              <div className="flex flex-wrap items-center gap-4">
                <GoogleCta />
                <span className="text-sm text-indigo-100">Free. Takes 15 to 20 minutes.</span>
              </div>
            </div>
            <div className="rounded-xl bg-white p-6 text-ink shadow-pop" aria-label="Sample readiness card">
              <div className="flex items-center gap-5">
                <ScoreRing value={64} size={96} />
                <div className="min-w-0">
                  <p className="text-[13px] text-ink-2">Backend Developer · Readiness (sample)</p>
                  <p className="font-display text-lg font-bold">Competitive, with two gaps to close</p>
                  <Badge tone="strong" className="mt-1.5">+9 since last attempt</Badge>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                <SkillBar label="Java" value={86} status="matched" />
                <SkillBar label="SQL" value={72} status="matched" />
                <SkillBar label="Spring Boot" value={58} status="weak" />
                <SkillBar label="Docker" value={0} status="none" />
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <p className="font-display text-[13px] font-semibold uppercase tracking-wide text-primary">How it works</p>
          <h2 className="mt-1 text-[clamp(28px,3.4vw,40px)]">Four steps, one honest picture</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-lg bg-surface p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-lg bg-indigo-50 text-primary"><Icon name={s.icon} size={20} /></span>
                  <span aria-hidden className="font-display text-3xl font-bold text-slate-500">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 text-lg">{s.title}</h3>
                <p className="mt-1.5 text-[15px] text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              ["Tested, not self-rated", "Your score comes from your answers, so it reflects what you can do today rather than what you hope you can do."],
              ["Based on current requirements", "Role requirements and skill trends are reviewed automatically every two days with AI assistance."],
              ["A clear next step", "Every result ends with three priorities, why each matters for your role, and where to start learning."],
            ].map(([t, b]) => (
              <div key={t} className="border-t-2 border-primary pt-4">
                <h3 className="text-xl">{t}</h3>
                <p className="mt-2 text-ink-2">{b}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="sample" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6">
          <p className="font-display text-[13px] font-semibold uppercase tracking-wide text-primary">Sample result</p>
          <h2 className="mt-1 text-[clamp(28px,3.4vw,40px)]">What you get at the end</h2>
          <p className="mt-2 text-ink-2">A sample for a Frontend Developer diagnostic. Your result is built from your own answers.</p>
          <div className="mt-6 grid gap-8 rounded-xl bg-surface p-6 shadow-card md:grid-cols-3 md:p-8">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">Readiness score</p>
              <div className="mt-3 flex flex-col gap-3"><ScoreRing value={46} size={112} /><p>A solid base in core web skills. Closing three gaps would move you into a competitive range.</p></div>
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">Skill gaps</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="strong">JavaScript</Badge><Badge tone="strong">HTML &amp; CSS</Badge><Badge tone="attention">React</Badge>
                <Badge tone="attention">REST APIs</Badge><Badge tone="critical">TypeScript</Badge><Badge tone="critical">Next.js</Badge>
              </div>
              <p className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-ink-2">Market trends</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-[15px]">
                <li className="flex items-center gap-2"><Icon name="trending-up" className="text-emerald-600" /> TypeScript is rising in listings</li>
                <li className="flex items-center gap-2"><Icon name="trending-down" className="text-rose-600" /> jQuery is declining</li>
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">Work on next</p>
              <ol className="mt-3 flex flex-col gap-4">
                {[["TypeScript", "Asked for in most frontend listings, and rising."], ["React", "You know the basics. Hooks and state need work."], ["REST APIs", "Needed to connect any UI to real data."]].map(([t, b], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-primary-dark">{i + 1}</span>
                    <span><strong className="block font-display">{t}</strong><span className="text-sm text-ink-2">{b}</span></span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 rounded-xl bg-sidebar p-8 text-white md:flex-row md:items-center md:p-12">
            <div>
              <h2 className="text-[clamp(26px,3vw,36px)] text-white">Find out what to work on this week.</h2>
              <p className="mt-1 text-indigo-100">One diagnostic, about 20 minutes, three clear next steps.</p>
            </div>
            <LinkButton href="/signup" size="lg">Create your free account</LinkButton>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-2 sm:px-6">
          <div className="flex items-center gap-4"><Logo height={30} /><span>A career readiness diagnostic for CSE students.</span></div>
          <div className="flex items-center gap-5"><Link href="/terms">Terms &amp; Conditions</Link><Link href="/privacy">Privacy Policy</Link><span>© 2026 DIAGNASSIS</span></div>
        </div>
      </footer>
    </div>
  );
}
