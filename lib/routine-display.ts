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

export type RoutineDisplayInput = {
  routineId: string;
  routineName: string;
  /** Activity type carried by the log itself (preferred source). */
  logActivityTypeName?: string | null;
  /** Activity type stored on the routine — fallback for legacy
   *  endurance routines whose logs don't carry the type yet. */
  routineActivityTypeName?: string | null;
};

export function getRoutineDisplayName(input: RoutineDisplayInput): string {
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
}): string {
  return getRoutineDisplayName({
    routineId: log.routineId,
    routineName: log.routine?.name ?? "",
    logActivityTypeName: log.activityType?.name ?? null,
    routineActivityTypeName: log.routine?.activityType?.name ?? null,
  });
}
