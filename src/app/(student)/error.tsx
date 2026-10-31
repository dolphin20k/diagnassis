"use client";
import { Button } from "@/components/ui/Button";
import { StateBlock } from "@/components/ui/States";

export default function SectionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StateBlock tone="error" icon="cloud-off" title="Something went wrong loading this page" body="Nothing has been lost. Check your connection and try again." action={<Button onClick={reset}>Try again</Button>} />;
}
