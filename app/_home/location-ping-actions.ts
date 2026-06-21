"use server";

import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";

// Don't store more than one breadcrumb per hour — app opens are bursty and we
// only need a rough "where were you that day" signal.
const PING_THROTTLE_MS = 60 * 60 * 1000;

// Record a passive location breadcrumb (the home page captures one on open when
// geolocation permission is already granted). Best-effort + throttled; never
// throws — a failed breadcrumb must not disturb the dashboard.
export async function recordLocationPing(lat: number, lng: number): Promise<void> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return;
  }
  try {
    const session = await getAppSession();
    const last = await prisma.locationPing.findFirst({
      where: { profileKey: session.profileKey },
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    });
    if (last && Date.now() - last.capturedAt.getTime() < PING_THROTTLE_MS) return;
    await prisma.locationPing.create({ data: { profileKey: session.profileKey, lat, lng } });
  } catch {
    // best-effort
  }
}
