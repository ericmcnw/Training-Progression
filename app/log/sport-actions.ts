"use server";

// Server actions for the Sports section on /log. Three operations:
//   - addSportAction(slug) — create the synthetic per-sport routine
//   - removeSportAction(slug) — soft-delete it (logs preserved)
//   - logSportAction — create a RoutineLog against the synthetic routine
//
// Logging is intentionally minimal: when + duration + notes + optional
// activity-type-style sub-tag (e.g. basketball: "Pickup"). Per-sport
// rich schemas (climbing per-attempt, golf range/course) come in
// later phases — Phase 1 just lands the model end-to-end.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ensureSportSelected,
  getSyntheticSportRoutineId,
  isSyntheticSportRoutineId,
  unselectSport,
} from "@/lib/synthetic-sport-routines";
import { getActivityEntry } from "@/lib/activity-families";
import {
  buildSpotPickerItems,
  compatibleActivitySlugs,
  getActivitySpotConfig,
  normalizeSpotName,
  type ActivitySpotConfig,
  type SpotPickerItem,
} from "@/lib/activity-spots";
import type { SpotPickerValue } from "@/lib/spot-picker-types";
import { personExtraKeys } from "@/app/routines/sportLogConfig";
import { clampEffort } from "@/lib/strain";
import { createActivityZoneActivitiesForLog } from "@/lib/zone-activities";
import { stampLogWeather } from "@/lib/weather-stamp";
import { setLogGear, type GearPickInput } from "@/lib/gear";

// Shared pool of people you've logged with/against, gathered from every
// sport log's person-typed extras (+ legacy free-text opponent fields).
// Powers the searchable/creatable person inputs so teammates/opponents
// build a reusable roster across sessions and sports.
export async function listSportPeople(): Promise<string[]> {
  const personKeys = personExtraKeys();
  const logs = await prisma.routineLog.findMany({
    where: { routineId: { startsWith: "sports-" } },
    select: { sportData: true },
  });
  const names = new Set<string>();
  for (const log of logs) {
    const sd = log.sportData;
    if (!sd || typeof sd !== "object" || Array.isArray(sd)) continue;
    const extras = (sd as Record<string, unknown>).extras;
    if (!extras || typeof extras !== "object") continue;
    for (const key of personKeys) {
      const raw = (extras as Record<string, unknown>)[key];
      if (typeof raw !== "string") continue;
      for (const part of raw.split(",")) {
        const name = part.trim();
        if (name) names.add(name);
      }
    }
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export async function addSportAction(slug: string): Promise<void> {
  await ensureSportSelected(slug);
  revalidatePath("/log");
  revalidatePath("/activities/sports");
}

export async function removeSportAction(slug: string): Promise<void> {
  await unselectSport(slug);
  revalidatePath("/log");
  revalidatePath("/activities/sports");
}

export type LogSportInput = {
  sportSlug: string;
  performedAtIso: string;
  /** Total session length in minutes. */
  durationMinutes?: number;
  notes?: string;
  /** Structured location picked via SpotPicker — references an
   *  existing ActivitySpot/ClimbLocation or creates one on save.
   *  Resolved server-side into activitySpotId / climbLocationId
   *  + a denormalized RoutineLog.location string for log-list
   *  display. Pass null when no location was attached. */
  spotValue?: SpotPickerValue;
  /** Sport-specific subtype dropdown — e.g. basketball: "Game" /
   *  "Pickup" / "Shoot around" / "Drills". Stored in sportData. */
  sessionType?: string;
  /** Free-form per-sport extras (wave count, runs, opponent,
   *  conditions, etc.). Shape varies per sport. Stored verbatim
   *  inside RoutineLog.sportData under `extras`. */
  extras?: Record<string, string | number | undefined>;
  /** Perceived effort 1-10 (RPE). null/omitted = unrated; estimated
   *  downstream by the strain model. */
  effort?: number | null;
  /** Gear used (boards etc.) — linked to the log via RoutineLogGear. */
  gearPicks?: GearPickInput[];
};

// Server-side: resolve a SpotPickerValue into the right FK + display
// string. For "saved" → returns the existing id by kind. For "new" →
// upserts an ActivitySpot (or ClimbLocation when origin is climbing)
// keyed on either OSM identity or normalized name within the activity,
// so a fresh OSM pin shared between activities reuses one row.
async function resolveSpotForLog(
  value: SpotPickerValue | undefined,
  activitySlug: string,
): Promise<{
  activitySpotId: string | null;
  climbLocationId: string | null;
  displayLocation: string | null;
}> {
  if (!value) return { activitySpotId: null, climbLocationId: null, displayLocation: null };

  if (value.kind === "saved") {
    // Trust the picker's reference. Look up the display name so we
    // can also stamp RoutineLog.location for legacy log-list code.
    if (value.ref.kind === "activitySpot") {
      // Defensive: only accept spots from compatible activities to
      // prevent a corrupted client payload from cross-linking (e.g.
      // attaching a basketball court to a surfing log).
      const { compatibleActivitySlugs } = await import("@/lib/activity-spots");
      const compatible = compatibleActivitySlugs(activitySlug);
      const spot = await prisma.activitySpot.findFirst({
        where: { id: value.ref.id, activitySlug: { in: compatible } },
        select: { id: true, name: true },
      });
      return {
        activitySpotId: spot?.id ?? null,
        climbLocationId: null,
        displayLocation: spot?.name ?? value.display.name ?? null,
      };
    }
    const climb = await prisma.climbLocation.findUnique({
      where: { id: value.ref.id },
      select: { id: true, name: true },
    });
    return {
      activitySpotId: null,
      climbLocationId: climb?.id ?? null,
      displayLocation: climb?.name ?? value.display.name ?? null,
    };
  }

  // kind === "new" — create or reuse an ActivitySpot. Generic sport
  // logs don't go through ClimbLocation; climbing has its own path.
  const draft = value.draft;
  const cleanName = draft.name.trim();
  if (!cleanName) {
    return { activitySpotId: null, climbLocationId: null, displayLocation: null };
  }

  // OSM dedup: if this draft carries an osmType+osmId, prefer reusing
  // any existing ActivitySpot with the same OSM identity (even across
  // activities) — physical place, one row.
  if (draft.osmType && draft.osmId) {
    const existing = await prisma.activitySpot.findFirst({
      where: { osmType: draft.osmType, osmId: draft.osmId },
      select: { id: true, name: true },
    });
    if (existing) {
      return {
        activitySpotId: existing.id,
        climbLocationId: null,
        displayLocation: existing.name,
      };
    }
  }

  // Name dedup within the activity: avoids "Half Dome" + "Half-Dome"
  // as two separate rows for the same place.
  const normalized = normalizeSpotName(cleanName);
  const sameNameSameActivity = await prisma.activitySpot.findFirst({
    where: { activitySlug },
    select: { id: true, name: true },
  }).then(async () => {
    // Prisma can't filter on a derived normalized-name in SQL without
    // a generated column, so fetch the slug's spots and dedup in JS.
    // The set is small (a single user's spots for one sport).
    const candidates = await prisma.activitySpot.findMany({
      where: { activitySlug },
      select: { id: true, name: true },
    });
    return candidates.find((c) => normalizeSpotName(c.name) === normalized) ?? null;
  });
  if (sameNameSameActivity) {
    return {
      activitySpotId: sameNameSameActivity.id,
      climbLocationId: null,
      displayLocation: sameNameSameActivity.name,
    };
  }

  const created = await prisma.activitySpot.create({
    data: {
      activitySlug,
      name: cleanName,
      type: draft.type,
      region: draft.region,
      latitude: draft.latitude,
      longitude: draft.longitude,
      osmType: draft.osmType,
      osmId: draft.osmId,
    },
    select: { id: true, name: true },
  });
  return {
    activitySpotId: created.id,
    climbLocationId: null,
    displayLocation: created.name,
  };
}

export type SportLogContext = {
  config: ActivitySpotConfig | null;
  spotNoun: string;
  savedSpots: SpotPickerItem[];
  recentSpots: Array<{
    ref: { kind: "activitySpot" | "climbLocation"; id: string };
    name: string;
    region: string | null;
  }>;
};

// Loads the SpotPicker context for a sport: spot config, the user's
// saved spots (own + cross-activity), and the most-recently-used
// chips. Called from the sport log sheets on open via a useEffect.
// Returns config=null for sports without spot support — the form
// can skip the picker entirely.
export async function loadSportLogContext(sportSlug: string): Promise<SportLogContext> {
  const config = getActivitySpotConfig(sportSlug);
  if (!config) {
    return { config: null, spotNoun: "spot", savedSpots: [], recentSpots: [] };
  }
  const compatible = compatibleActivitySlugs(sportSlug);
  const includesClimbing = compatible.includes("climbing");

  const [activitySpots, climbLocations, recentRows] = await Promise.all([
    prisma.activitySpot.findMany({
      where: { activitySlug: { in: compatible } },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        activitySlug: true,
        name: true,
        type: true,
        region: true,
        osmType: true,
        osmId: true,
      },
    }),
    includesClimbing
      ? prisma.climbLocation.findMany({
          orderBy: [{ name: "asc" }],
          select: {
            id: true,
            name: true,
            type: true,
            region: true,
            osmType: true,
            osmId: true,
          },
        })
      : Promise.resolve([]),
    // Recent chips — most-recent 5 spots used in the last 180 days.
    prisma.routineLog.findMany({
      where: {
        performedAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
        OR: [
          { activitySpot: { activitySlug: { in: compatible } } },
          ...(includesClimbing ? [{ climbLocationId: { not: null } }] : []),
        ],
      },
      orderBy: { performedAt: "desc" },
      take: 50,
      select: {
        activitySpot: { select: { id: true, name: true, region: true } },
        climbLocation: { select: { id: true, name: true, region: true } },
      },
    }),
  ]);

  const savedSpots = buildSpotPickerItems({
    ownActivitySlug: sportSlug,
    activitySpots,
    climbLocations,
  });

  // Build recent list — dedup by spot identity, top 5.
  const recentSpots: SportLogContext["recentSpots"] = [];
  const seenRecent = new Set<string>();
  for (const row of recentRows) {
    const r = row.activitySpot
      ? {
          ref: { kind: "activitySpot" as const, id: row.activitySpot.id },
          name: row.activitySpot.name,
          region: row.activitySpot.region,
        }
      : row.climbLocation
      ? {
          ref: { kind: "climbLocation" as const, id: row.climbLocation.id },
          name: row.climbLocation.name,
          region: row.climbLocation.region,
        }
      : null;
    if (!r) continue;
    const key = `${r.ref.kind}:${r.ref.id}`;
    if (seenRecent.has(key)) continue;
    seenRecent.add(key);
    recentSpots.push(r);
    if (recentSpots.length >= 5) break;
  }

  return { config, spotNoun: config.spotNoun, savedSpots, recentSpots };
}

export async function logSportAction(input: LogSportInput): Promise<{ logId: string }> {
  const entry = getActivityEntry(input.sportSlug);
  if (!entry || entry.family !== "sports") {
    throw new Error(`Unknown sport slug: ${input.sportSlug}`);
  }
  const routineId = getSyntheticSportRoutineId(input.sportSlug);

  // Ensure the routine exists in case the user logs against a sport
  // they hadn't yet "selected" via the picker — the log itself opts
  // them in. Idempotent.
  await ensureSportSelected(input.sportSlug);

  const performedAt = new Date(input.performedAtIso);
  if (Number.isNaN(performedAt.getTime())) {
    throw new Error("Invalid performedAt timestamp");
  }
  const durationSec =
    input.durationMinutes && input.durationMinutes > 0
      ? Math.round(input.durationMinutes * 60)
      : null;

  // Strip empty extras so the JSON blob only carries fields the user
  // actually filled in.
  const cleanExtras: Record<string, string | number> = {};
  if (input.extras) {
    for (const [k, v] of Object.entries(input.extras)) {
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (typeof v === "number" && Number.isNaN(v)) continue;
      cleanExtras[k] = typeof v === "string" ? v.trim() : v;
    }
  }

  const sportType = input.sessionType?.trim();
  const sportData =
    sportType || Object.keys(cleanExtras).length > 0
      ? {
          sport: input.sportSlug,
          ...(sportType ? { sessionType: sportType } : {}),
          ...(Object.keys(cleanExtras).length > 0 ? { extras: cleanExtras } : {}),
        }
      : undefined;

  // Resolve the spot picker value into FK ids + a display string for
  // the legacy RoutineLog.location column (still read by log-list UIs
  // that don't yet know about activitySpot/climbLocation joins).
  const spotResolved = await resolveSpotForLog(input.spotValue, input.sportSlug);

  const log = await prisma.routineLog.create({
    data: {
      routineId,
      performedAt,
      durationSec: durationSec ?? undefined,
      notes: input.notes?.trim() || undefined,
      location: spotResolved.displayLocation ?? undefined,
      effort: input.effort != null ? clampEffort(input.effort) : null,
      activitySpotId: spotResolved.activitySpotId ?? undefined,
      climbLocationId: spotResolved.climbLocationId ?? undefined,
      sportData,
    },
    select: { id: true },
  });

  await createActivityZoneActivitiesForLog(prisma, log.id);
  await stampLogWeather(log.id);
  await setLogGear(log.id, input.gearPicks ?? [], input.sportSlug);

  revalidatePath("/log");
  revalidatePath("/activities/sports");
  revalidatePath(`/activities/${input.sportSlug}`);

  return { logId: log.id };
}

// Update an existing sport log (the non-climbing, non-golf flavor).
// Editable fields: when/duration/notes, spot (re-pickable), session
// type, generic extras. Sport slug + routine binding don't change —
// you can't migrate a basketball log into a surfing log via edit.
export async function updateSportLogAction(input: {
  logId: string;
  performedAtIso: string;
  durationMinutes?: number;
  notes?: string;
  spotValue?: SpotPickerValue;
  sessionType?: string;
  extras?: Record<string, string | number | undefined>;
  sportSlug: string;
  /** Perceived effort 1-10, or null to clear. Backfillable on edit. */
  effort?: number | null;
  /** Gear used. Omit to leave links untouched; pass [] to clear. */
  gearPicks?: GearPickInput[];
}): Promise<void> {
  const performedAt = new Date(input.performedAtIso);
  if (Number.isNaN(performedAt.getTime())) {
    throw new Error("Invalid performedAt timestamp");
  }
  const durationSec =
    input.durationMinutes && input.durationMinutes > 0
      ? Math.round(input.durationMinutes * 60)
      : null;

  const cleanExtras: Record<string, string | number> = {};
  if (input.extras) {
    for (const [k, v] of Object.entries(input.extras)) {
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (typeof v === "number" && Number.isNaN(v)) continue;
      cleanExtras[k] = typeof v === "string" ? v.trim() : v;
    }
  }
  const sportType = input.sessionType?.trim();
  const sportData =
    sportType || Object.keys(cleanExtras).length > 0
      ? {
          sport: input.sportSlug,
          ...(sportType ? { sessionType: sportType } : {}),
          ...(Object.keys(cleanExtras).length > 0 ? { extras: cleanExtras } : {}),
        }
      : null;

  const spotResolved = await resolveSpotForLog(input.spotValue, input.sportSlug);

  await prisma.routineLog.update({
    where: { id: input.logId },
    data: {
      performedAt,
      durationSec,
      notes: input.notes?.trim() || null,
      ...(input.effort !== undefined
        ? { effort: input.effort == null ? null : clampEffort(input.effort) }
        : {}),
      location: spotResolved.displayLocation,
      activitySpotId: spotResolved.activitySpotId,
      // Explicit (not undefined) so a previously-set link gets
      // cleared on edit instead of orphaned. resolveSpotForLog
      // returns null for non-climbing sports.
      climbLocationId: spotResolved.climbLocationId,
      sportData: sportData ?? undefined,
    },
  });

  await createActivityZoneActivitiesForLog(prisma, input.logId);
  if (input.gearPicks !== undefined) {
    await setLogGear(input.logId, input.gearPicks, input.sportSlug);
  }

  revalidatePath("/log");
  revalidatePath("/activities/sports");
  revalidatePath(`/activities/${input.sportSlug}`);
  revalidatePath(`/routines/${getSyntheticSportRoutineId(input.sportSlug)}/logs/${input.logId}/details`);
}

// Re-export the predicate for client code that needs to know if a
// given routine id is a synthetic sport routine.
export { isSyntheticSportRoutineId };
