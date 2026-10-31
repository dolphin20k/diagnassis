"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { ProfileForm, type RoleOption } from "@/components/student/ProfileForm";
import { skipDetails } from "@/app/(student)/actions";
import type { ProfileRow } from "@/lib/types/database";

/** "Basic details" pop-up shown after the first login. Saving unlocks diagnostics; skipping locks them. */
export function DetailsGate({ profile, roles, skills }: { profile: ProfileRow; roles: RoleOption[]; skills: string[]; roleLabel?: string | null }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  async function skip() {
    await skipDetails();
    setOpen(false);
    router.refresh();
  }
  return (
    <Dialog open={open} onClose={skip} title="Tell us about yourself" description="This takes a minute and personalises your diagnostic. You can edit it later in My Profile." wide dismissible={false}>
      <ProfileForm profile={profile} roles={roles} skills={skills} mode="onboard" onDone={() => setOpen(false)} onSkip={skip} />
    </Dialog>
  );
}
