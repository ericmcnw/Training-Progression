import { prisma } from "@/lib/prisma";
import { ensureAppProfile } from "@/lib/stimulus-preferences";

export type ProfileIdentity = {
  displayName: string | null;
  avatarEmoji: string | null;
  avatarColor: string | null;
};

// The user's chosen name + avatar, resolved per the active profile (same
// session-keyed AppProfile the rest of the app uses). All null until set —
// ProfileHeader falls back to a default look.
export async function getProfileIdentity(): Promise<ProfileIdentity> {
  const profile = await ensureAppProfile();
  if (!profile) return { displayName: null, avatarEmoji: null, avatarColor: null };
  const row = await prisma.appProfile.findUnique({
    where: { id: profile.id },
    select: { displayName: true, avatarEmoji: true, avatarColor: true },
  });
  return {
    displayName: row?.displayName ?? null,
    avatarEmoji: row?.avatarEmoji ?? null,
    avatarColor: row?.avatarColor ?? null,
  };
}
