import { prisma } from "@/lib/prisma";
import { toAppYmd } from "@/lib/dates";

export type HomeInjury = {
  id: string;
  name: string;
  status: string;
  /** Affected zones — first one is used as the default target for logging
   *  pain against this injury. */
  zones: { slug: string; label: string }[];
  aggravatingFactors: string[];
  /** Latest logged pain level on any of the injury's zones, 0-10, or null. */
  recentPainScore: number | null;
  /** Per-day max pain across the injury's zones, oldest → newest, for the
   *  expanded sparkline. */
  painTrend: { ymd: string; level: number }[];
};

// Active (ACTIVE / FLARED) injuries with their recent pain trend + factors,
// for the home page injuries section.
export async function getHomeInjuries(): Promise<HomeInjury[]> {
  const injuries = await prisma.activeInjury.findMany({
    where: { status: { in: ["ACTIVE", "FLARED"] } },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    include: {
      zones: {
        include: { zone: { select: { id: true, slug: true, label: true } } },
        orderBy: { zone: { sortOrder: "asc" } },
      },
    },
  });
  if (injuries.length === 0) return [];

  const allZoneIds = injuries.flatMap((injury) => injury.zones.map((z) => z.zone.id));
  const since = new Date(Date.now() - 60 * 86_400_000);
  const painLogs = await prisma.painLog.findMany({
    where: { zoneId: { in: allZoneIds }, loggedAt: { gte: since } },
    orderBy: { loggedAt: "asc" },
    select: { zoneId: true, level: true, loggedAt: true },
  });

  const byZone = new Map<string, Array<{ ymd: string; level: number }>>();
  for (const log of painLogs) {
    const list = byZone.get(log.zoneId) ?? [];
    list.push({ ymd: toAppYmd(log.loggedAt), level: log.level });
    byZone.set(log.zoneId, list);
  }

  return injuries.map((injury) => {
    const zoneIds = injury.zones.map((z) => z.zone.id);
    const dayMax = new Map<string, number>();
    for (const id of zoneIds) {
      for (const entry of byZone.get(id) ?? []) {
        dayMax.set(entry.ymd, Math.max(dayMax.get(entry.ymd) ?? 0, entry.level));
      }
    }
    const painTrend = [...dayMax.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ymd, level]) => ({ ymd, level }))
      .slice(-16);
    const recentPainScore = painTrend.length ? painTrend[painTrend.length - 1].level : null;

    return {
      id: injury.id,
      name: injury.name,
      status: injury.status,
      zones: injury.zones.map((z) => ({ slug: z.zone.slug, label: z.zone.label })),
      aggravatingFactors: injury.aggravatingFactors,
      recentPainScore,
      painTrend,
    };
  });
}
