"use server";

import { prisma } from "@/lib/prisma";
import { toAppYmd, addDaysYmd, todayAppYmd } from "@/lib/dates";

export type ZoneDetailResult = {
  slug: string;
  /** Muscle group label (e.g. "Lats") or zone label if no group */
  label: string;
  freshness: string;
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
  /** All activities across every zone in the muscle group, last 7 days */
  recentActivities: Array<{
    id: string;
    label: string;
    performedAt: string;
    source: string;
    intensity: string | null;
    zoneLabel: string;
  }>;
  weekActivityCounts: Record<string, number>;
  today: string;
};

export async function fetchZoneDetail(slug: string): Promise<ZoneDetailResult | null> {
  const clickedZone = await prisma.bodyZone.findUnique({ where: { slug } });
  if (!clickedZone) return null;

  const today = todayAppYmd();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const groupSlug = clickedZone.metadataGroupSlug;

  // ── Find all zones in the same muscle group (or just the clicked zone) ───────
  const zonesInGroup = groupSlug
    ? await prisma.bodyZone.findMany({ where: { metadataGroupSlug: groupSlug } })
    : [clickedZone];

  const zoneIds = zonesInGroup.map((z) => z.id);

  // ── Resolve display label ────────────────────────────────────────────────────
  let label = clickedZone.label;
  if (groupSlug) {
    const group = await prisma.metadataGroup.findUnique({ where: { slug: groupSlug } });
    if (group) label = group.label;
  }

  // ── Activities across the whole group, last 7 days ───────────────────────────
  const activities = await prisma.zoneActivity.findMany({
    where: { zoneId: { in: zoneIds }, performedAt: { gte: since } },
    orderBy: { performedAt: "desc" },
    take: 30,
    include: { zone: { select: { label: true } } },
  });

  // ── Injuries across the group (deduplicated) ─────────────────────────────────
  const injuryZones = await prisma.injuryZone.findMany({
    where: { zoneId: { in: zoneIds } },
    include: { injury: true },
  });
  const seenInjuryIds = new Set<string>();
  const activeInjuries = injuryZones
    .map((iz) => iz.injury)
    .filter((inj) => ["ACTIVE", "FLARED", "RECOVERING"].includes(inj.status))
    .filter((inj) => {
      if (seenInjuryIds.has(inj.id)) return false;
      seenInjuryIds.add(inj.id);
      return true;
    });

  // ── Freshness: worst state across zones in group ─────────────────────────────
  const freshnessOrder = ["INJURED", "RECOVERING", "WORKED_TODAY", "RECENTLY_WORKED", "FRESH"];
  const zoneStates = await prisma.bodyZone.findMany({
    where: { id: { in: zoneIds } },
    include: {
      activities: { where: { performedAt: { gte: since } }, orderBy: { performedAt: "desc" }, take: 1 },
      injuryZones: { include: { injury: true } },
    },
  });

  let worstFreshness = "FRESH";
  let latestWorked: Date | null = null;
  let totalActivityCount = 0;
  let maxPainLevel: number | undefined;

  for (const zone of zoneStates) {
    const lastWorked = zone.activities[0]?.performedAt ?? null;
    if (lastWorked && (!latestWorked || lastWorked > latestWorked)) latestWorked = lastWorked;

    const injuries = zone.injuryZones.map((iz) => iz.injury);
    const hasActive = injuries.some((i) => i.status === "ACTIVE" || i.status === "FLARED");
    const hasRecovering = injuries.some((i) => i.status === "RECOVERING");

    let zoneFreshness = "FRESH";
    if (hasActive) {
      zoneFreshness = "INJURED";
    } else {
      const days = lastWorked ? Math.floor((Date.now() - lastWorked.getTime()) / 86_400_000) : null;
      if (days === 0) zoneFreshness = "WORKED_TODAY";
      else if (days != null && days <= 2) zoneFreshness = "RECENTLY_WORKED";
      else if (days != null && days <= 5) zoneFreshness = "RECOVERING";
      if (hasRecovering) zoneFreshness = "RECOVERING";
    }

    if (freshnessOrder.indexOf(zoneFreshness) < freshnessOrder.indexOf(worstFreshness)) {
      worstFreshness = zoneFreshness;
    }

    totalActivityCount += zone.activities.length > 0
      ? activities.filter((a) => a.zoneId === zone.id).length
      : 0;
  }

  // Count all 7-day activities in group
  const weekTotal = activities.length;
  if (activeInjuries.length > 0) {
    const maxSev = Math.max(...activeInjuries.map((i) => i.severity));
    maxPainLevel = Math.min(10, maxSev * 2);
  }

  const daysSinceWorked = latestWorked
    ? Math.floor((Date.now() - latestWorked.getTime()) / 86_400_000)
    : null;

  // ── Week strip counts ────────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysYmd(today, i - 6));
  const weekActivityCounts: Record<string, number> = {};
  for (const day of weekDays) weekActivityCounts[day] = 0;
  for (const a of activities) {
    const ymd = toAppYmd(a.performedAt);
    if (ymd in weekActivityCounts) weekActivityCounts[ymd]++;
  }

  return {
    slug: clickedZone.slug,
    label,
    freshness: worstFreshness,
    painLevel: maxPainLevel,
    activityCount: weekTotal,
    daysSinceWorked,
    activeInjuries: activeInjuries.map((inj) => ({
      id: inj.id,
      name: inj.name,
      severity: inj.severity,
      status: inj.status,
      startedAt: inj.startedAt.toISOString(),
      notes: inj.notes ?? null,
    })),
    recentActivities: activities.map((a) => ({
      id: a.id,
      label: a.label,
      performedAt: a.performedAt.toISOString(),
      source: a.source,
      intensity: a.intensity ?? null,
      zoneLabel: a.zone.label,
    })),
    weekActivityCounts,
    today,
  };
}
