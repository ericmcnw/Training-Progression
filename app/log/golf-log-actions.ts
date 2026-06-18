"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureSportSelected, getSyntheticSportRoutineId } from "@/lib/synthetic-sport-routines";
import { normalizeSpotName } from "@/lib/activity-spots";
import type { SpotPickerValue } from "@/lib/spot-picker-types";
import { clampEffort } from "@/lib/strain";
import { createActivityZoneActivitiesForLog } from "@/lib/zone-activities";

// Server action for golf logging. Persists session-level fields on
// RoutineLog (performedAt, durationSec, notes) + the round detail as
// a discriminated-shape JSON blob on the new RoutineLog.sportData
// column. Two modes today: COURSE (per-hole detail) and RANGE
// (per-club shot detail).

export type GolfCourseHole = {
  number: number;
  par?: number;
  score?: number;
  club?: string;
  notes?: string;
};

export type GolfRangeShot = {
  club: string;
  distanceYards?: number;
  ballCount?: number;
  notes?: string;
};

export type GolfLogInput = {
  performedAtIso: string;
  durationMinutes?: number;
  notes?: string;
  /** Spot picker value — tied to the ActivitySpot library for golf
   *  ("course" noun). Same mapping/recents UX as other sports. */
  spotValue?: SpotPickerValue;
  /** Perceived effort 1-10 (RPE). null/omitted = unrated. */
  effort?: number | null;
} & (
  | {
      mode: "COURSE";
      holes: GolfCourseHole[];
    }
  | {
      mode: "RANGE";
      ballCount?: number;
      shots: GolfRangeShot[];
    }
);

export async function logGolfAction(input: GolfLogInput): Promise<{ logId: string }> {
  await ensureSportSelected("golf");
  const routineId = getSyntheticSportRoutineId("golf");

  const performedAt = new Date(input.performedAtIso);
  if (Number.isNaN(performedAt.getTime())) {
    throw new Error("Invalid performedAt timestamp");
  }
  const durationSec =
    input.durationMinutes && input.durationMinutes > 0
      ? Math.round(input.durationMinutes * 60)
      : null;

  // Resolve the spot picker value into an ActivitySpot FK + display
  // string. The course/range name still lands in sportData for the
  // golf-specific JSON shape, but the link to ActivitySpot is what
  // ties the log into the mapping/recents system.
  const spotResolved = await resolveGolfSpot(input.spotValue);

  // Build the discriminated sportData JSON payload. Filter out empty
  // detail rows so a saved log doesn't carry meaningless blanks.
  const sportData =
    input.mode === "COURSE"
      ? {
          sport: "golf" as const,
          mode: "COURSE" as const,
          course: {
            location: spotResolved.displayLocation ?? undefined,
            holes: input.holes
              .filter((h) => h.par !== undefined || h.score !== undefined || h.club || h.notes)
              .map((h) => ({
                number: h.number,
                par: h.par,
                score: h.score,
                club: h.club?.trim() || undefined,
                notes: h.notes?.trim() || undefined,
              })),
          },
        }
      : {
          sport: "golf" as const,
          mode: "RANGE" as const,
          range: {
            ballCount: input.ballCount,
            shots: input.shots
              .filter((s) => s.club.trim().length > 0)
              .map((s) => ({
                club: s.club.trim(),
                distanceYards: s.distanceYards,
                ballCount: s.ballCount,
                notes: s.notes?.trim() || undefined,
              })),
          },
        };

  const log = await prisma.routineLog.create({
    data: {
      routineId,
      performedAt,
      durationSec: durationSec ?? undefined,
      notes: input.notes?.trim() || undefined,
      location: spotResolved.displayLocation ?? undefined,
      effort: input.effort != null ? clampEffort(input.effort) : null,
      activitySpotId: spotResolved.activitySpotId ?? undefined,
      sportData,
    },
    select: { id: true },
  });

  await createActivityZoneActivitiesForLog(prisma, log.id);

  revalidatePath("/log");
  revalidatePath("/activities/sports");
  revalidatePath("/activities/golf");

  return { logId: log.id };
}

// Update an existing golf log — same shape as logGolfAction but
// patches rather than creates. Editable: when / duration / notes /
// spot / mode / holes / shots / ballCount.
export async function updateGolfLogAction(
  input: { logId: string } & GolfLogInput
): Promise<void> {
  const performedAt = new Date(input.performedAtIso);
  if (Number.isNaN(performedAt.getTime())) {
    throw new Error("Invalid performedAt timestamp");
  }
  const durationSec =
    input.durationMinutes && input.durationMinutes > 0
      ? Math.round(input.durationMinutes * 60)
      : null;

  const spotResolved = await resolveGolfSpot(input.spotValue);

  const sportData =
    input.mode === "COURSE"
      ? {
          sport: "golf" as const,
          mode: "COURSE" as const,
          course: {
            location: spotResolved.displayLocation ?? undefined,
            holes: input.holes
              .filter(
                (h) => h.par !== undefined || h.score !== undefined || h.club || h.notes
              )
              .map((h) => ({
                number: h.number,
                par: h.par,
                score: h.score,
                club: h.club?.trim() || undefined,
                notes: h.notes?.trim() || undefined,
              })),
          },
        }
      : {
          sport: "golf" as const,
          mode: "RANGE" as const,
          range: {
            ballCount: input.ballCount,
            shots: input.shots
              .filter((s) => s.club.trim().length > 0)
              .map((s) => ({
                club: s.club.trim(),
                distanceYards: s.distanceYards,
                ballCount: s.ballCount,
                notes: s.notes?.trim() || undefined,
              })),
          },
        };

  await prisma.routineLog.update({
    where: { id: input.logId },
    data: {
      performedAt,
      durationSec,
      notes: input.notes?.trim() || null,
      effort: input.effort == null ? null : clampEffort(input.effort),
      location: spotResolved.displayLocation,
      activitySpotId: spotResolved.activitySpotId,
      // Explicit null so a previously-set climbLocationId (e.g. the
      // user picked a climbing crag for a golf log by mistake on
      // an earlier save) gets cleared instead of orphaned.
      climbLocationId: null,
      sportData,
    },
  });

  await createActivityZoneActivitiesForLog(prisma, input.logId);

  revalidatePath("/log");
  revalidatePath("/activities/sports");
  revalidatePath("/activities/golf");
  revalidatePath(`/routines/${getSyntheticSportRoutineId("golf")}/logs/${input.logId}/details`);
}

// Resolves a SpotPicker value into ActivitySpot FK + display string.
// Golf always uses ActivitySpot (not ClimbLocation), activitySlug =
// "golf". OSM-identity dedup + normalized-name dedup avoid duplicate
// course rows.
async function resolveGolfSpot(
  value: SpotPickerValue | undefined
): Promise<{ activitySpotId: string | null; displayLocation: string | null }> {
  if (!value) return { activitySpotId: null, displayLocation: null };

  if (value.kind === "saved") {
    if (value.ref.kind !== "activitySpot") {
      return { activitySpotId: null, displayLocation: value.display.name ?? null };
    }
    // Defensive: only attach spots that actually belong to golf.
    // Prevents a corrupted/forged client payload from linking a
    // climbing or basketball spot to a golf log.
    const spot = await prisma.activitySpot.findFirst({
      where: { id: value.ref.id, activitySlug: "golf" },
      select: { id: true, name: true },
    });
    return {
      activitySpotId: spot?.id ?? null,
      displayLocation: spot?.name ?? value.display.name ?? null,
    };
  }

  const draft = value.draft;
  const cleanName = draft.name.trim();
  if (!cleanName) return { activitySpotId: null, displayLocation: null };

  if (draft.osmType && draft.osmId) {
    const existing = await prisma.activitySpot.findFirst({
      where: { osmType: draft.osmType, osmId: draft.osmId },
      select: { id: true, name: true },
    });
    if (existing) {
      return { activitySpotId: existing.id, displayLocation: existing.name };
    }
  }

  const normalized = normalizeSpotName(cleanName);
  const candidates = await prisma.activitySpot.findMany({
    where: { activitySlug: "golf" },
    select: { id: true, name: true },
  });
  const sameName = candidates.find((c) => normalizeSpotName(c.name) === normalized);
  if (sameName) return { activitySpotId: sameName.id, displayLocation: sameName.name };

  const created = await prisma.activitySpot.create({
    data: {
      activitySlug: "golf",
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
  return { activitySpotId: created.id, displayLocation: created.name };
}
