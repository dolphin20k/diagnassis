"use client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function GlobalRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div role="alert" className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-rose-50 text-rose-600"><Icon name="circle-alert" size={28} /></span>
        <h1 className="text-2xl">Something went wrong</h1>
        <p className="text-ink-2">Nothing has been lost. Check your connection and try again.</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
