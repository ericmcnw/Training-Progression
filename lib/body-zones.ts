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

export type ZoneGroupDetailResult = {
  slug: string;
  label: string;
  isGroup: boolean;
  includedZoneCount: number;
  freshness: ZoneFreshness;
  painLevel?: number;
  activityCount?: number;
  daysSinceWorked: number | null;
  activeInjuries: Array<{
    id: string;
    name: string;
    severity: number;
    status: string;
    startedAt: string;
    notes: string | null;
  }>;
  recentActivities: Array<{
    id: string;
    label: string;
    performedAt: string;
    source: string;
    intensity: string | null;
    zoneLabel: string;
  }>;
  // 7 most recent days, used by the zone-panel "this week" rollup.
  weekActivityCounts: Record<string, number>;
  // 28 most recent days, oldest → newest, used by the zone-panel sparkline.
  dailyActivityCounts: Array<{ ymd: string; count: number }>;
  today: string;
};

export function daysSinceDate(value: Date | null | undefined, now = new Date()) {
  if (!value) return null;
  return Math.max(0, diffYmdDays(toAppYmd(now), toAppYmd(value)));
}

const BODY_ZONE_ALIASES: Record<string, string> = {
  "left-hamstring": "left-hamstring-proximal",
  "right-hamstring": "right-hamstring-proximal",
  "left-shoulder": "left-shoulder-front",
  "right-shoulder": "right-shoulder-front",
  "left-forearm": "left-forearm-front",
  "right-forearm": "right-forearm-front",
  "left-knee": "left-knee-front",
  "right-knee": "right-knee-front",
};

async function resolveBodyZoneSlug(slug: string) {
  const normalized = decodeURIComponent(slug).trim();
  if (!normalized) return null;

  const exact = await prisma.bodyZone.findUnique({
    where: { slug: normalized },
    select: { slug: true },
  });
  if (exact) return exact.slug;

  const alias = BODY_ZONE_ALIASES[normalized];
  if (alias) {
    const aliasZone = await prisma.bodyZone.findUnique({
      where: { slug: alias },
      select: { slug: true },
    });
    if (aliasZone) return aliasZone.slug;
  }

  const groupZone = await prisma.bodyZone.findFirst({
    where: { metadataGroupSlug: normalized },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { slug: true },
  });
  if (groupZone) return groupZone.slug;

  const side = normalized.startsWith("left-") ? "LEFT" : normalized.startsWith("right-") ? "RIGHT" : null;
  if (side) {
    const region = normalized
      .replace(/^left-/, "")
      .replace(/^right-/, "")
      .replace(/-(front|back|proximal|distal)$/, "");
    const sideRegionZone = await prisma.bodyZone.findFirst({
      where: { side, region },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { slug: true },
    });
    if (sideRegionZone) return sideRegionZone.slug;
  }

  return null;
}

function maxFreshness(states: ZoneFreshness[]) {
  const rank: Record<ZoneFreshness, number> = {
    FRESH: 0,
    RECOVERING: 1,
    RECENTLY_WORKED: 2,
    WORKED_TODAY: 3,
    INJURED: 4,
  };
  return states.reduce<ZoneFreshness>((best, current) => (rank[current] > rank[best] ? current : best), "FRESH");
}

export function computeFreshness(lastWorkedAt: Date | null, injuries: InjuryLike[] = [], now = new Date()): ZoneFreshness {
  if (injuries.some((injury) => injury.status === "ACTIVE" || injury.status === "FLARED")) {
    return "INJURED";
  }

  const daysSinceWorked = daysSinceDate(lastWorkedAt, now);
  let freshness: ZoneFreshness = "FRESH";

  if (daysSinceWorked === 0) {
    freshness = "WORKED_TODAY";
  } else if (daysSinceWorked != null && daysSinceWorked <= 3) {
    freshness = "RECENTLY_WORKED";
  } else if (daysSinceWorked != null && daysSinceWorked <= 6) {
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
      daysSinceWorked: computed.daysSinceWorked,
      groupSlug: zone.metadataGroupSlug ?? null,
      recentWorkEntries: zone.activities.slice(0, 4).map((activity) => ({
        id: activity.id,
        label: activity.label,
        performedAt: activity.performedAt.toISOString(),
        source: activity.source,
        intensity: activity.intensity ?? null,
        routineLogId: activity.routineLogId ?? null,
      })),
    };
  });
}

export async function getZoneGroupDetail(slug: string): Promise<ZoneGroupDetailResult | null> {
  const now = new Date();
  const today = toAppYmd(now);
  const since = daysAgo(30, now);
  const weekSince = daysAgo(7, now);
  const painSince = daysAgo(30, now);
  const resolvedSlug = await resolveBodyZoneSlug(slug);
  if (!resolvedSlug) return null;

  const clickedZone = await prisma.bodyZone.findUnique({ where: { slug: resolvedSlug } });
  if (!clickedZone) return null;

  const groupSlug = clickedZone.metadataGroupSlug;
  const [zonesInGroup, group] = await Promise.all([
    groupSlug
      ? prisma.bodyZone.findMany({
          where: { metadataGroupSlug: groupSlug },
          include: {
            activities: {
              where: { performedAt: { gte: since } },
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
        })
      : prisma.bodyZone.findMany({
          where: { id: clickedZone.id },
          include: {
            activities: {
              where: { performedAt: { gte: since } },
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
        }),
    groupSlug ? prisma.metadataGroup.findUnique({ where: { slug: groupSlug } }) : Promise.resolve(null),
  ]);

  const zoneIds = zonesInGroup.map((zone) => zone.id);
  // Pull 28 days for the sparkline; recentActivities + weekActivityCounts
  // are derived by filtering the same array, so the larger window
  // doesn't cost an extra query.
  const sparkSince = daysAgo(27, now);
  const allActivities = await prisma.zoneActivity.findMany({
    where: { zoneId: { in: zoneIds }, performedAt: { gte: sparkSince } },
    orderBy: { performedAt: "desc" },
    include: { zone: { select: { label: true } } },
  });
  const activities = allActivities.filter((entry) => entry.performedAt >= weekSince).slice(0, 30);

  const computedStates = zonesInGroup.map((zone) =>
    toZoneState({
      zone,
      activities: zone.activities,
      painLogs: zone.painLogs,
      injuries: zone.injuryZones.map((entry) => entry.injury),
      now,
    })
  );
  const latestWorked = computedStates
    .map((state) => state.lastWorkedAt)
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  const painLevels = computedStates
    .map((state) => state.painLevel)
    .filter((value): value is number => value != null);

  const seenInjuryIds = new Set<string>();
  const activeInjuries = zonesInGroup
    .flatMap((zone) => zone.injuryZones.map((entry) => entry.injury))
    .filter((injury) => injury.status === "ACTIVE" || injury.status === "FLARED" || injury.status === "RECOVERING")
    .filter((injury) => {
      if (seenInjuryIds.has(injury.id)) return false;
      seenInjuryIds.add(injury.id);
      return true;
    });

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() + index - 6);
    return toAppYmd(date);
  });
  const weekActivityCounts: Record<string, number> = {};
  for (const day of weekDays) weekActivityCounts[day] = 0;
  for (const activity of activities) {
    const ymd = toAppYmd(activity.performedAt);
    if (ymd in weekActivityCounts) weekActivityCounts[ymd]++;
  }

  // 28-day daily bucket, oldest → newest, for the zone-panel sparkline.
  const dailyBuckets = new Map<string, number>();
  for (let i = 27; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dailyBuckets.set(toAppYmd(date), 0);
  }
  for (const activity of allActivities) {
    const ymd = toAppYmd(activity.performedAt);
    if (dailyBuckets.has(ymd)) dailyBuckets.set(ymd, (dailyBuckets.get(ymd) ?? 0) + 1);
  }
  const dailyActivityCounts = Array.from(dailyBuckets.entries()).map(([ymd, count]) => ({ ymd, count }));

  return {
    slug: clickedZone.slug,
    label: group?.label ?? clickedZone.label,
    isGroup: Boolean(group),
    includedZoneCount: zonesInGroup.length,
    freshness: maxFreshness(computedStates.map((state) => state.freshness)),
    painLevel: painLevels.length > 0 ? Math.max(...painLevels) : undefined,
    activityCount: activities.length,
    daysSinceWorked: daysSinceDate(latestWorked, now),
    activeInjuries: activeInjuries.map((injury) => ({
      id: injury.id,
      name: injury.name,
      severity: injury.severity,
      status: injury.status,
      startedAt: injury.startedAt.toISOString(),
      notes: injury.notes ?? null,
    })),
    recentActivities: activities.map((activity) => ({
      id: activity.id,
      label: activity.label,
      performedAt: activity.performedAt.toISOString(),
      source: activity.source,
      intensity: activity.intensity ?? null,
      zoneLabel: activity.zone.label,
    })),
    weekActivityCounts,
    dailyActivityCounts,
    today,
  };
}

export async function getZoneState(slug: string): Promise<ZoneStateDetail | null> {
  const now = new Date();
  const since = daysAgo(30, now);
  const resolvedSlug = await resolveBodyZoneSlug(slug);
  if (!resolvedSlug) return null;

  const zone = await prisma.bodyZone.findUnique({
    where: { slug: resolvedSlug },
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
