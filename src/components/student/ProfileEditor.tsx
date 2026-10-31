"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { ProfileForm, type RoleOption } from "@/components/student/ProfileForm";
import type { ProfileRow } from "@/lib/types/database";

export function ProfileEditor({ profile, roles, skills, startOpen }: { profile: ProfileRow; roles: RoleOption[]; skills: string[]; startOpen?: boolean }) {
  const [open, setOpen] = useState(!!startOpen);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Icon name="pencil" size={16} /> Edit profile</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit profile" description="Changes apply to your next diagnostic." wide>
        <ProfileForm profile={profile} roles={roles} skills={skills} mode="edit" onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
