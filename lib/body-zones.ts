import type { ActiveInjury, BodyZone, InjuryStatus, PainLog, ZoneActivity } from "@/generated/prisma";
import type { ZoneFreshness, ZoneState } from "@/app/components/body-map/types";
import { prisma } from "@/lib/prisma";
import { diffYmdDays, toAppYmd } from "@/lib/dates";

type InjuryLike = {
  status: InjuryStatus;
  severity?: number;
};

export type ZoneStateDetail = ZoneState & {
  zone: BodyZone;
  recentActivities: ZoneActivity[];
  painHistory: PainLog[];
  activeInjuries: ActiveInjury[];
  lastWorkedAt: Date | null;
  daysSinceWorked: number | null;
};

export function daysSinceDate(value: Date | null | undefined, now = new Date()) {
  if (!value) return null;
  return Math.max(0, diffYmdDays(toAppYmd(now), toAppYmd(value)));
}

export function computeFreshness(lastWorkedAt: Date | null, injuries: InjuryLike[] = [], now = new Date()): ZoneFreshness {
  if (injuries.some((injury) => injury.status === "ACTIVE" || injury.status === "FLARED")) {
    return "INJURED";
  }

  const daysSinceWorked = daysSinceDate(lastWorkedAt, now);
  let freshness: ZoneFreshness = "FRESH";

  if (daysSinceWorked === 0) {
    freshness = "WORKED_TODAY";
  } else if (daysSinceWorked != null && daysSinceWorked <= 2) {
    freshness = "RECENTLY_WORKED";
  } else if (daysSinceWorked != null && daysSinceWorked <= 5) {
    freshness = "RECOVERING";
  }

  if (injuries.some((injury) => injury.status === "RECOVERING")) {
    return "RECOVERING";
  }

  return freshness;
}

export function computePainLevel({
  recentPainLogs,
  injuries,
}: {
  recentPainLogs: Array<Pick<PainLog, "level">>;
  injuries: InjuryLike[];
}) {
  const loggedPain = recentPainLogs.length > 0 ? Math.max(...recentPainLogs.map((entry) => entry.level)) : null;
  if (loggedPain != null) return loggedPain;

  const activeSeverity = injuries
    .filter((injury) => injury.status === "ACTIVE" || injury.status === "FLARED")
    .map((injury) => injury.severity ?? 0);

  if (activeSeverity.length === 0) return undefined;
  return Math.min(10, Math.max(...activeSeverity) * 2);
}

function daysAgo(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 86_400_000);
}

function toZoneState({
  zone,
  activities,
  painLogs,
  injuries,
  now,
}: {
  zone: BodyZone;
  activities: ZoneActivity[];
  painLogs: PainLog[];
  injuries: ActiveInjury[];
  now: Date;
}): ZoneState & { lastWorkedAt: Date | null; daysSinceWorked: number | null } {
  const lastWorkedAt = activities[0]?.performedAt ?? null;
  const activeInjuries = injuries.filter((injury) => injury.status === "ACTIVE" || injury.status === "FLARED" || injury.status === "RECOVERING");
  const recentPainLogs = painLogs.filter((entry) => entry.loggedAt >= daysAgo(2, now));
  const weeklyActivityCount = activities.filter((entry) => entry.performedAt >= daysAgo(7, now)).length;

  return {
    slug: zone.slug,
    freshness: computeFreshness(lastWorkedAt, activeInjuries, now),
    painLevel: computePainLevel({ recentPainLogs, injuries: activeInjuries }),
    activityCount: weeklyActivityCount,
    lastWorkedAt,
    daysSinceWorked: daysSinceDate(lastWorkedAt, now),
  };
}

export async function getAllZonesWithState(): Promise<ZoneState[]> {
  const now = new Date();
  const activitySince = daysAgo(30, now);
  const painSince = daysAgo(30, now);

  const zones = await prisma.bodyZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    include: {
      activities: {
        where: { performedAt: { gte: activitySince } },
        orderBy: { performedAt: "desc" },
      },
      painLogs: {
        where: { loggedAt: { gte: painSince } },
        orderBy: { loggedAt: "desc" },
      },
      injuryZones: {
        include: { injury: true },
      },
    },
  });

  return zones.map((zone) => {
    const computed = toZoneState({
      zone,
      activities: zone.activities,
      painLogs: zone.painLogs,
      injuries: zone.injuryZones.map((entry) => entry.injury),
      now,
    });

    return {
      slug: computed.slug,
      label: zone.label,
      freshness: computed.freshness,
      painLevel: computed.painLevel,
      activityCount: computed.activityCount,
    };
  });
}

export async function getZoneState(slug: string): Promise<ZoneStateDetail | null> {
  const now = new Date();
  const since = daysAgo(30, now);

  const zone = await prisma.bodyZone.findUnique({
    where: { slug },
    include: {
      activities: {
        where: { performedAt: { gte: since } },
        orderBy: { performedAt: "desc" },
      },
      painLogs: {
        where: { loggedAt: { gte: since } },
        orderBy: { loggedAt: "desc" },
      },
      injuryZones: {
        include: { injury: true },
      },
    },
  });

  if (!zone) return null;

  const activeInjuries = zone.injuryZones
    .map((entry) => entry.injury)
    .filter((injury) => injury.status === "ACTIVE" || injury.status === "FLARED" || injury.status === "RECOVERING");
  const computed = toZoneState({
    zone,
    activities: zone.activities,
    painLogs: zone.painLogs,
    injuries: activeInjuries,
    now,
  });

  return {
    slug: computed.slug,
    freshness: computed.freshness,
    painLevel: computed.painLevel,
    activityCount: computed.activityCount,
    zone,
    recentActivities: zone.activities,
    painHistory: zone.painLogs,
    activeInjuries,
    lastWorkedAt: computed.lastWorkedAt,
    daysSinceWorked: computed.daysSinceWorked,
  };
}
