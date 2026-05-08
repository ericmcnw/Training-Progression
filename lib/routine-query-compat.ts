// This file is intentionally a thin shim.
//
// Pre-Phase-1: this file held a try/catch fallback for queries that selected
// the now-dropped per-routine frequency columns (targetFrequencyCount, etc.).
// After Phase 1, those columns no longer exist and the FrequencyGoal model is
// the single source of truth — see lib/routine-frequency.ts for the helpers.
//
// The function below is kept as a compatibility export for downstream callers
// that still import it; it now derives the frequency-target shape from any
// FrequencyGoal links present on the routine (or returns the null target).
//
// Future cleanup: callers should switch to importing routineWithFrequencyTarget
// from lib/routine-frequency.ts directly. This re-export will be removed in a
// later phase once the call sites are migrated.

export { routineWithFrequencyTarget as withNullRoutineFrequencyTargets } from "@/lib/routine-frequency";
