import { prisma } from "@/lib/prisma";
import { ensureAppProfile } from "@/lib/stimulus-preferences";

export type HomeLocation = { lat: number; lng: number; label: string | null };

// The user's home base, or null until set. Resolved per the active profile
// (same session-keyed AppProfile the rest of the app uses). Weather coords
// fall back to this when a log has no picked location, and it anchors the
// home-page live conditions + per-day WaG chips.
export async function getHomeLocation(): Promise<HomeLocation | null> {
  const profile = await ensureAppProfile();
  if (!profile) return null;
  const row = await prisma.appProfile.findUnique({
    where: { id: profile.id },
    select: { homeLat: true, homeLng: true, homeLabel: true },
  });
  if (!row || row.homeLat == null || row.homeLng == null) return null;
  return { lat: row.homeLat, lng: row.homeLng, label: row.homeLabel };
}
