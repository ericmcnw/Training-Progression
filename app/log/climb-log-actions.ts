"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logSession } from "@/app/routines/actions";
import { getSyntheticSportRoutineId, ensureSportSelected } from "@/lib/synthetic-sport-routines";
import { buildSpotPickerItems, type SpotPickerItem } from "@/lib/activity-spots";
import { toAppDateTimeLocal } from "@/lib/dates";
import type { ClimbingDiscipline, ClimbGradeSystem, ClimbOutcome } from "@/lib/climb-types";

// Surfaces the user's most-recently-used climb locations for the
// quick-pick chips in ClimbLogSheet. Keeps the picker zero-effort
// for the 95% case (same gym, same crag) while still allowing a
// fresh location to be typed inline.
// Loads the saved sub-areas for a climb location so the area picker
// can offer them as quick-pick chips before falling back to a fresh
// name. Lets the user re-attribute a session to "Cave Wall" without
// re-typing it every time.
export async function listAreasForClimbLocation(
  locationId: string | null
): Promise<Array<{ id: string; name: string }>> {
  if (!locationId) return [];
  const rows = await prisma.climbArea.findMany({
    where: { locationId },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }],
  });
  return rows;
}

export async function listRecentClimbLocations(): Promise<
  Array<{ id: string; name: string; type: "GYM" | "CRAG"; region: string | null }>
> {
  const recent = await prisma.routineLog.findMany({
    where: {
      climbLocationId: { not: null },
      performedAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
    },
    select: { climbLocationId: true, performedAt: true },
    orderBy: { performedAt: "desc" },
    take: 100,
  });
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  for (const row of recent) {
    if (!row.climbLocationId || seen.has(row.climbLocationId)) continue;
    seen.add(row.climbLocationId);
    orderedIds.push(row.climbLocationId);
    if (orderedIds.length >= 5) break;
  }
  if (orderedIds.length === 0) return [];

  const locations = await prisma.climbLocation.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, name: true, type: true, region: true },
  });
  // Preserve the recency-ranked order.
  const byId = new Map(locations.map((l) => [l.id, l]));
  return orderedIds.flatMap((id) => {
    const l = byId.get(id);
    return l ? [l] : [];
  });
}

// Full SpotPicker dataset for the climb log: every saved ClimbLocation as a
// searchable item (so the user can look up any past crag/gym, not just the
// recent few) plus recent-location chips. Climbing-only — activitySpots are
// left empty so saved picks always resolve to a ClimbLocation, never an
// ActivitySpot (climbing must stay on the ClimbLocation side per the data
// model). New OSM pins flow through logSession's newClimbLocation* path.
export async function loadClimbSpotPickerData(): Promise<{
  savedSpots: SpotPickerItem[];
  recentSpots: Array<{ ref: { kind: "climbLocation"; id: string }; name: string; region: string | null }>;
}> {
  const [climbLocations, recent] = await Promise.all([
    prisma.climbLocation.findMany({
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, type: true, region: true, osmType: true, osmId: true },
    }),
    listRecentClimbLocations(),
  ]);

  const savedSpots = buildSpotPickerItems({
    ownActivitySlug: "climbing",
    activitySpots: [],
    climbLocations,
  });

  const recentSpots = recent.map((l) => ({
    ref: { kind: "climbLocation" as const, id: l.id },
    name: l.name,
    region: l.region,
  }));

  return { savedSpots, recentSpots };
}

export type ClimbLogInput = {
  performedAtIso: string;
  durationMinutes?: number;
  notes?: string;
  /** Perceived effort 1-10 (RPE) — session-level. null/omitted = unrated. */
  effort?: number | null;
  /** Strength work done alongside the climb — the "Also did" section. */
  exercises?: Array<{
    exerciseId: string;
    sets: Array<{ setNumber: number; reps?: number | null; seconds?: number | null; weightLb?: number | null }>;
  }>;
  /** Either pick an existing location… */
  climbLocationId?: string;
  /** …or create a new one inline. Both name and type required for new.
   *  When the new location was pinned to an OSM place, the coordinate +
   *  OSM-identity fields ride along so it lands on the climbing map and
   *  dedups against an existing pin. */
  newLocationName?: string;
  newLocationType?: "GYM" | "CRAG";
  newLocationRegion?: string | null;
  newLocationLatitude?: number | null;
  newLocationLongitude?: number | null;
  newLocationOsmType?: string | null;
  newLocationOsmId?: string | null;
  attempts: Array<{
    discipline: ClimbingDiscipline;
    grade: string;
    gradeSystem: ClimbGradeSystem;
    outcome: ClimbOutcome;
    /** Existing ClimbProblem picked from the name combobox — wins over
     *  `name` so repeats link by id regardless of grade edits. */
    problemId?: string;
    /** Optional climb/route name. Resolved server-side: if a problem
     *  with this name+grade already exists at this location, link by
     *  id; otherwise create a new ClimbProblem row. */
    name?: string;
    /** Pick from a saved area at the location. */
    areaId?: string;
    /** OR type a fresh area name; server dedupes against ClimbArea
     *  by name within the location and creates as needed. */
    area?: string;
    /** How many goes this climb took. Set for any outcome except
     *  FLASH/ONSIGHT, which are definitionally one try. */
    triesCount?: number;
    /** Declared or derived repeat — see ClimbAttempt.isRepeat. */
    isRepeat?: boolean;
    notes?: string;
  }>;
};

// Routes a climb log through the existing logSession server action so
// the rich per-attempt machinery (problem/area resolution, transaction
// handling, metric synthesis) is unchanged. Auto-creates the synthetic
// climbing routine if the user hasn't added climbing yet — same
// opt-in-on-first-log behavior as logSportAction.
export async function logClimbAction(input: ClimbLogInput): Promise<{ logId: string }> {
  await ensureSportSelected("climbing");
  const routineId = getSyntheticSportRoutineId("climbing");

  const performedAt = new Date(input.performedAtIso);
  if (Number.isNaN(performedAt.getTime())) {
    throw new Error("Invalid performedAt timestamp");
  }
  if (input.attempts.length === 0) {
    throw new Error("Log at least one climb attempt.");
  }

  const logId = await logSession({
    routineId,
    // logSession expects an APP_TIME_ZONE wall-clock YYYY-MM-DDTHH:mm string
    // (parseAppDateTimeLocal re-interprets it in that zone), so the string
    // must be formatted in that zone too — not the server's.
    performedAtLocal: toAppDateTimeLocal(performedAt),
    durationSec: input.durationMinutes ? Math.round(input.durationMinutes * 60) : null,
    notes: input.notes?.trim() || undefined,
    effort: input.effort ?? null,
    exercises: input.exercises,
    climbLocationId: input.climbLocationId,
    newClimbLocationName: input.newLocationName?.trim() || undefined,
    newClimbLocationType: input.newLocationType,
    newClimbLocationRegion: input.newLocationRegion ?? undefined,
    newClimbLocationLatitude: input.newLocationLatitude ?? undefined,
    newClimbLocationLongitude: input.newLocationLongitude ?? undefined,
    newClimbLocationOsmType: input.newLocationOsmType ?? undefined,
    newClimbLocationOsmId: input.newLocationOsmId ?? undefined,
    climbAttempts: input.attempts.map((a, idx) => ({
      discipline: a.discipline,
      grade: a.grade.trim(),
      gradeSystem: a.gradeSystem,
      outcome: a.outcome,
      problemId: a.problemId || undefined,
      newProblemName: a.problemId ? undefined : a.name?.trim() || undefined,
      // Prefer an existing area pick over a typed name — the picker
      // returns areaId when the user tapped a saved chip.
      areaId: a.areaId || undefined,
      newAreaName: a.areaId ? undefined : a.area?.trim() || undefined,
      triesCount: a.triesCount,
      isRepeat: a.isRepeat,
      notes: a.notes?.trim() || undefined,
      attemptOrder: idx,
    })),
  });

  revalidatePath("/log");
  revalidatePath("/activities/sports");
  revalidatePath("/activities/climbing");
  revalidatePath("/activities/climbing/climbs");

  return { logId: logId ?? "" };
}

// Exercise library + recent history for the "Also did" section on sport
// sheets. Loaded lazily when the section is first opened so the climb sheet's
// initial render stays as light as it is today.
//
// `recent` is ordered by how often the exercise has been logged alongside a
// session, falling back to overall frequency — so the chips surface the
// finishers actually done after climbing (pull-ups) rather than the top of an
// alphabetical list. `lastSets` prefills a tapped chip from last time, same
// derive-don't-retype rule the workout form already follows.
export type SessionExerciseOption = {
  id: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  lastSets: { reps: number | null; seconds: number | null; weightLb: number | null }[];
};

export async function loadSessionExerciseOptions(sportSlug?: string): Promise<{
  recent: SessionExerciseOption[];
  all: { id: string; name: string; unit: "REPS" | "TIME"; supportsWeight: boolean }[];
}> {
  const [all, tagged] = await Promise.all([
    prisma.exercise.findMany({
      where: { libraryKind: { in: ["STRENGTH", "CONDITIONING", "SKILL"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, supportsWeight: true },
    }),
    prisma.exercise.findMany({
      where: sportSlug ? { supportsSports: { has: sportSlug } } : { libraryKind: "STRENGTH" },
      select: {
        id: true,
        name: true,
        unit: true,
        supportsWeight: true,
        _count: { select: { sessionExercises: true } },
      },
    }),
  ]);

  // Most-logged first: an exercise tagged for the sport but never done isn't
  // a useful chip, and the ones done often are exactly the finishers.
  const top = tagged
    .filter((exercise) => exercise._count.sessionExercises > 0)
    .sort((a, b) => b._count.sessionExercises - a._count.sessionExercises)
    .slice(0, 6);

  // One query for everyone's last sets, newest first — first row seen per
  // exercise wins, so a tapped chip prefills from the last time it was done.
  const lastByExerciseId = new Map<string, SessionExerciseOption["lastSets"]>();
  if (top.length > 0) {
    const history = await prisma.sessionExercise.findMany({
      where: { exerciseId: { in: top.map((exercise) => exercise.id) } },
      orderBy: { routineLog: { performedAt: "desc" } },
      select: {
        exerciseId: true,
        sets: { orderBy: { setNumber: "asc" }, select: { reps: true, seconds: true, weightLb: true } },
      },
    });
    for (const entry of history) {
      if (!lastByExerciseId.has(entry.exerciseId)) lastByExerciseId.set(entry.exerciseId, entry.sets);
    }
  }

  const recent: SessionExerciseOption[] = top.map(({ _count: _ignored, ...exercise }) => ({
    ...exercise,
    lastSets: lastByExerciseId.get(exercise.id) ?? [],
  }));

  return { recent, all };
}
