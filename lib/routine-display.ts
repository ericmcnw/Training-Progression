// Display-name resolution for routine references throughout the app.
//
// The endurance type unification routes every typed-endurance log against
// one synthetic "Endurance" placeholder routine (see
// SYNTHETIC_ENDURANCE_ROUTINE_ID). Without this helper, every list of
// recent logs would render that synthetic name literally — the user
// would see a wall of "Endurance" rows instead of "Run", "Hike",
// "MTB", etc.
//
// Resolve in this priority order:
//   1. Log has activityType → use activityType.name ("Run", "Trail Run")
//   2. Routine is the synthetic placeholder → "Endurance" (rare; means
//      the log was created without picking a type — should never happen
//      via UI but the helper is defensive)
//   3. Routine has activityType (legacy endurance routines after the
//      migration) → use the routine's type name
//   4. Fall back to routine.name (everything else: workouts, sport
//      sessions, climbing, lifestyle, etc.)

import { SYNTHETIC_ENDURANCE_ROUTINE_ID } from "./activity-types";
import { freeformActivityName, isFreeformActivityRoutineId } from "./freeform-activity";

export type RoutineDisplayInput = {
  routineId: string;
  routineName: string;
  /** Activity type carried by the log itself (preferred source). */
  logActivityTypeName?: string | null;
  /** Activity type stored on the routine — fallback for legacy
   *  endurance routines whose logs don't carry the type yet. */
  routineActivityTypeName?: string | null;
  /** Freeform "Activity" log's sportData — surfaces its tags as the name
   *  ("Swim · Walk") instead of the bare routine name. */
  sportData?: unknown;
};

export function getRoutineDisplayName(input: RoutineDisplayInput): string {
  // Freeform activity → show what you did (tags), falling through to
  // "Activity" when untagged.
  if (isFreeformActivityRoutineId(input.routineId)) {
    const name = freeformActivityName(input.sportData);
    if (name) return name;
  }
  if (input.logActivityTypeName) return input.logActivityTypeName;
  if (input.routineId === SYNTHETIC_ENDURANCE_ROUTINE_ID) return "Endurance";
  if (input.routineActivityTypeName) return input.routineActivityTypeName;
  return input.routineName;
}

/** Same logic but optimized for the common log-row shape used across the
 *  app (recent logs feeds, history, WaG). */
export function getLogDisplayName(log: {
  routineId: string;
  routine?: { name: string; activityType?: { name: string } | null } | null;
  activityType?: { name: string } | null;
  /** Optional — when the log's query selects sportData, freeform "Activity"
   *  logs render their tags. Absent → falls back to the routine name. */
  sportData?: unknown;
}): string {
  return getRoutineDisplayName({
    routineId: log.routineId,
    routineName: log.routine?.name ?? "",
    logActivityTypeName: log.activityType?.name ?? null,
    routineActivityTypeName: log.routine?.activityType?.name ?? null,
    sportData: log.sportData,
  });
}

/** Venue for a log row. SpotPicker writes a FK — ClimbLocation for climbing,
 *  ActivitySpot for every other sport — so the free-text `location` column
 *  only carries a value on logs predating the picker. Reading `location`
 *  alone renders modern logs as venue-less. */
export function getLogVenue(log: {
  climbLocation?: { name: string; type?: string | null } | null;
  activitySpot?: { name: string } | null;
  location?: string | null;
}): { label: string; glyph: string } | null {
  if (log.climbLocation) {
    const glyph =
      log.climbLocation.type === "GYM" ? "🏠" : log.climbLocation.type === "CRAG" ? "🪨" : "📍";
    return { label: log.climbLocation.name, glyph };
  }
  if (log.activitySpot) return { label: log.activitySpot.name, glyph: "📍" };
  const freeText = log.location?.trim();
  return freeText ? { label: freeText, glyph: "📍" } : null;
}
