// Server-side helper for the global /activities/map page (Phase 3 of the
// spots-map build). Unions ClimbLocation + ActivitySpot rows that have
// coordinates into a single normalized shape, with the activity slug + label
// + family attached so the map can color-code pins and the sidebar can
// filter / drill back to the per-activity map.
//
// Spots without coords are skipped — they only matter on per-activity edit
// pages, not the world view.

import { prisma } from "@/lib/prisma";
import { ACTIVITY_FAMILY_META, getActivityEntry, type ActivityFamily } from "./activity-families";
import { getActivitySpotConfig, spotTypeColor } from "./activity-spots";

export type GlobalSpot = {
  /** Unique within the global pin set — namespaced by source. */
  uid: string;
  /** Underlying row id (without namespace prefix). */
  sourceId: string;
  source: "climbing" | "activity-spot";
  activitySlug: string;
  activityLabel: string;
  family: ActivityFamily;
  name: string;
  type: string | null;
  latitude: number;
  longitude: number;
  visitCount: number;
  /** Pin color resolved through the per-activity config (or climbing's
   *  GYM/CRAG palette). */
  pinColor: string;
  /** Where to deep-link the user when they want to edit this spot. */
  editHref: string;
};

const CLIMBING_GYM_COLOR = "rgba(78,148,255,0.95)";
const CLIMBING_CRAG_COLOR = "rgba(74,222,128,0.95)";

export async function getAllSpots(): Promise<GlobalSpot[]> {
  const [climbingRows, activityRows] = await Promise.all([
    prisma.climbLocation.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        latitude: true,
        longitude: true,
        _count: { select: { routineLogs: true } },
      },
    }),
    prisma.activitySpot.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        activitySlug: true,
        name: true,
        type: true,
        latitude: true,
        longitude: true,
        _count: { select: { routineLogs: true } },
      },
    }),
  ]);

  const climbingEntry = getActivityEntry("climbing");
  const climbingFamily: ActivityFamily = climbingEntry?.family ?? "sports";
  const climbingLabel = climbingEntry?.label ?? "Climbing";

  const climbingSpots: GlobalSpot[] = climbingRows.map((row) => ({
    uid: `climbing:${row.id}`,
    sourceId: row.id,
    source: "climbing",
    activitySlug: "climbing",
    activityLabel: climbingLabel,
    family: climbingFamily,
    name: row.name,
    type: row.type,
    latitude: row.latitude!,
    longitude: row.longitude!,
    visitCount: row._count.routineLogs,
    pinColor: row.type === "GYM" ? CLIMBING_GYM_COLOR : CLIMBING_CRAG_COLOR,
    editHref: `/activities/climbing/map`,
  }));

  const activitySpots: GlobalSpot[] = activityRows.flatMap((row) => {
    const entry = getActivityEntry(row.activitySlug);
    if (!entry) return [];
    const config = getActivitySpotConfig(row.activitySlug);
    const familyAccent = ACTIVITY_FAMILY_META[entry.family].accent;
    const pinColor = config ? spotTypeColor(config, row.type) : familyAccent;
    return [
      {
        uid: `activity-spot:${row.id}`,
        sourceId: row.id,
        source: "activity-spot",
        activitySlug: row.activitySlug,
        activityLabel: entry.label,
        family: entry.family,
        name: row.name,
        type: row.type,
        latitude: row.latitude!,
        longitude: row.longitude!,
        visitCount: row._count.routineLogs,
        pinColor,
        editHref: `/activities/${row.activitySlug}/map`,
      },
    ];
  });

  return [...climbingSpots, ...activitySpots].sort((a, b) => a.name.localeCompare(b.name));
}
