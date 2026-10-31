import { Logo } from "@/components/ui/Logo";
import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <Logo height={44} />
        <p className="font-display text-6xl font-extrabold text-primary">404</p>
        <h1 className="text-2xl">We could not find that page</h1>
        <p className="text-ink-2">The link may be old, or the page may belong to another account.</p>
        <LinkButton href="/">Back to home</LinkButton>
      </div>
    </main>
  );
}
