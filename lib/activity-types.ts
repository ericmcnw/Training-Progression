// Constants for the endurance type model. The Prisma seed creates these
// rows with stable IDs and slugs; this file is the canonical lookup for
// app code that needs to reference a specific family / type by name
// (e.g. "match a Run-family goal against this log").
//
// Slugs are the public identifier (used in URL params, JSON payloads,
// migration heuristics). IDs are private and stable across deploys.

export const ENDURANCE_FAMILY_SLUGS = {
  RUNNING: "running",
  WALKING: "walking",
  CYCLING: "cycling",
  SWIMMING: "swimming",
  ROWING: "rowing",
} as const;

export type EnduranceFamilySlug =
  (typeof ENDURANCE_FAMILY_SLUGS)[keyof typeof ENDURANCE_FAMILY_SLUGS];

export const ACTIVITY_TYPE_SLUGS = {
  // Running
  RUN: "run",
  TRAIL_RUN: "trail-run",
  LONG_RUN: "long-run",
  TEMPO_RUN: "tempo-run",
  EASY_RUN: "easy-run",
  INTERVAL_RUN: "interval-run",
  SPRINT: "sprint",
  // Walking
  WALK: "walk",
  HIKE: "hike",
  // Cycling
  BIKE: "bike",
  MTB: "mtb",
  ROAD_BIKE: "road-bike",
  GRAVEL_BIKE: "gravel-bike",
  // Swimming
  SWIM: "swim",
  OPEN_WATER_SWIM: "open-water-swim",
  // Rowing
  ROW: "row",
  ERG_ROW: "erg-row",
} as const;

export type ActivityTypeSlug =
  (typeof ACTIVITY_TYPE_SLUGS)[keyof typeof ACTIVITY_TYPE_SLUGS];

// Stable id for the single placeholder Routine row that holds every
// typed-endurance log's routineId FK. The seed creates this in the
// initial migration; never delete it.
//
// Display layer always resolves an endurance log's name via its
// activityType (see getRoutineDisplayName), not the routine name — users
// never see the literal "Endurance" string from this routine.
export const SYNTHETIC_ENDURANCE_ROUTINE_ID = "endurance-synthetic";

// Generic types (one per family) — the "I don't want to specify" pick.
// Useful for family-rollup heuristics: a goal targeting the Running family
// includes every type listed under RUNNING_TYPE_SLUGS below.
export const FAMILY_GENERIC_TYPE_SLUGS = {
  [ENDURANCE_FAMILY_SLUGS.RUNNING]: ACTIVITY_TYPE_SLUGS.RUN,
  [ENDURANCE_FAMILY_SLUGS.WALKING]: ACTIVITY_TYPE_SLUGS.WALK,
  [ENDURANCE_FAMILY_SLUGS.CYCLING]: ACTIVITY_TYPE_SLUGS.BIKE,
  [ENDURANCE_FAMILY_SLUGS.SWIMMING]: ACTIVITY_TYPE_SLUGS.SWIM,
  [ENDURANCE_FAMILY_SLUGS.ROWING]: ACTIVITY_TYPE_SLUGS.ROW,
} as const;

// Per-family member type lists. Kept in sync with the seed; if a new type
// is added in a future migration, add its slug here too so family rollups
// pick it up. Used by goal-matching, progress-view sub-filters, and the
// Phase 2 migration heuristic.
export const FAMILY_TYPE_SLUGS: Record<EnduranceFamilySlug, readonly ActivityTypeSlug[]> = {
  [ENDURANCE_FAMILY_SLUGS.RUNNING]: [
    ACTIVITY_TYPE_SLUGS.RUN,
    ACTIVITY_TYPE_SLUGS.TRAIL_RUN,
    ACTIVITY_TYPE_SLUGS.LONG_RUN,
    ACTIVITY_TYPE_SLUGS.TEMPO_RUN,
    ACTIVITY_TYPE_SLUGS.EASY_RUN,
    ACTIVITY_TYPE_SLUGS.INTERVAL_RUN,
    ACTIVITY_TYPE_SLUGS.SPRINT,
  ],
  [ENDURANCE_FAMILY_SLUGS.WALKING]: [
    ACTIVITY_TYPE_SLUGS.WALK,
    ACTIVITY_TYPE_SLUGS.HIKE,
  ],
  [ENDURANCE_FAMILY_SLUGS.CYCLING]: [
    ACTIVITY_TYPE_SLUGS.BIKE,
    ACTIVITY_TYPE_SLUGS.MTB,
    ACTIVITY_TYPE_SLUGS.ROAD_BIKE,
    ACTIVITY_TYPE_SLUGS.GRAVEL_BIKE,
  ],
  [ENDURANCE_FAMILY_SLUGS.SWIMMING]: [
    ACTIVITY_TYPE_SLUGS.SWIM,
    ACTIVITY_TYPE_SLUGS.OPEN_WATER_SWIM,
  ],
  [ENDURANCE_FAMILY_SLUGS.ROWING]: [
    ACTIVITY_TYPE_SLUGS.ROW,
    ACTIVITY_TYPE_SLUGS.ERG_ROW,
  ],
};
