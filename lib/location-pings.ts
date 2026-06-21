import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";

// Passive location breadcrumbs (see prisma model LocationPing). Reads are
// best-effort: the table is new, so a missing-table / DB hiccup returns [] and
// the dashboard renders without breadcrumb weather rather than erroring.
export type LocationPing = { lat: number; lng: number; capturedAt: Date };

export async function getRecentPings(start: Date, end: Date): Promise<LocationPing[]> {
  try {
    const session = await getAppSession();
    return await prisma.locationPing.findMany({
      where: { profileKey: session.profileKey, capturedAt: { gte: start, lt: end } },
      orderBy: { capturedAt: "asc" },
      select: { lat: true, lng: true, capturedAt: true },
    });
  } catch {
    return [];
  }
}
