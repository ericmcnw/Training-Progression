"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureAppProfile } from "@/lib/stimulus-preferences";

// Persist the lightweight profile identity. Values are sanitized at this
// boundary: name trimmed + length-capped, emoji reduced to a single glyph,
// color kept as-is (chosen from a fixed palette client-side).
export async function setProfileIdentity(input: {
  displayName?: string | null;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
}): Promise<void> {
  const profile = await ensureAppProfile();
  if (!profile) throw new Error("Profile unavailable.");

  const displayName = input.displayName?.trim().slice(0, 40) || null;
  const trimmedEmoji = input.avatarEmoji?.trim();
  const avatarEmoji = trimmedEmoji ? [...trimmedEmoji][0] : null;
  const avatarColor = input.avatarColor?.trim() || null;

  await prisma.appProfile.update({
    where: { id: profile.id },
    data: { displayName, avatarEmoji, avatarColor },
  });

  revalidatePath("/profile");
  revalidatePath("/profile/settings");
}
