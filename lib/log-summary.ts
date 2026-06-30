// Server-side fetcher + shared serializable shape for routine-log summaries.
//
// One source of truth for what "a logged routine looks like." Used by:
//   - The full detail page (app/routines/[id]/logs/[logId]/details)
//   - The future view-log modal (opened from Week at a Glance)
//   - The future /api/logs/summary batch endpoint
//
// Dates are serialized as ISO strings so the same shape can travel over the
// wire to a client component without losing fidelity.

import { prisma } from "@/lib/prisma";
import { isSessionKind } from "@/lib/routines";
import type { ExerciseUnitValue } from "@/lib/exercises";
import type { GuidedStepKind, RoutineKind } from "@/generated/prisma";
import { getRoutineDisplayName } from "@/lib/routine-display";
import { coerceWeatherSnapshot, type WeatherSnapshot } from "@/lib/weather";
import { toAppYmd } from "@/lib/dates";

const GRAMS_PER_OZ = 28.349523125;
const GRAMS_PER_LB = 453.59237;

// Trip-level rollup for a backpacking day-log — every day-log of a trip exposes
// the same parent trip so opening any day shows the whole trip.
export type LogSummaryBackpacking = {
  id: string;
  trail: string | null;
  location: string | null;
  startYmd: string;
  endYmd: string;
  totalMiles: number | null;
  nights: number;
  packLb: number | null;
  baseLb: number | null;
  gear: Array<{ name: string; oz: number | null; quantity: number; consumable: boolean }>;
  days: Array<{ ymd: string; miles: number | null; durationSec: number | null; elevGainFt: number | null; campsite: string | null; notes: string | null }>;
  totalDurationSec: number;
};

export type LogSummaryRoutine = {
  id: string;
  name: string;
  kind: string;
};

export type LogSummaryMetric = {
  id: string;
  name: string;
  value: number;
  unit: string | null;
};

export type LogSummaryClimbAttempt = {
  id: string;
  grade: string;
  gradeSystem: string;
  outcome: string;
  movesCompleted: number | null;
  totalMoves: number | null;
  notes: string | null;
  problem: { id: string; name: string } | null;
};

export type LogSummaryGuidedStep = {
  id: string;
  kind: GuidedStepKind;
  title: string;
  exerciseId: string | null;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount: number | null;
  setCount: number | null;
  weightLb: number | null;
  exerciseName: string | null;
};

export type LogSummarySet = {
  id: string;
  setNumber: number;
  reps: number | null;
  seconds: number | null;
  weightLb: number | null;
};

export type LogSummaryExercise = {
  id: string;
  name: string;
  unit: ExerciseUnitValue;
  supportsWeight: boolean;
  sets: LogSummarySet[];
};

export type LogSummaryIntervals = {
  reps: number | null;
  workDistanceM: number | null;
  workDurationSec: number | null;
  restSec: number | null;
};

// Linked spot (ActivitySpot) for sport / cardio / session logs — the
// new Spot-Picker writes here. Detail page renders this above the
// legacy free-text `location` if both exist.
export type LogSummarySpot = {
  id: string;
  name: string;
  region: string | null;
  type: string | null;
};

// Discriminated sport-specific payload off RoutineLog.sportData. Only
// the shapes the detail page knows how to render are normalized here;
// unknown shapes pass through as `kind: "unknown"` so the detail page
// can render a graceful fallback (or hide them entirely).
export type LogSummarySportData =
  | {
      kind: "golf";
      mode: "COURSE" | "RANGE";
      sessionType?: string;
      course?: {
        location?: string;
        holes: Array<{
          number: number;
          par?: number;
          score?: number;
          club?: string;
          notes?: string;
        }>;
      };
      range?: {
        ballCount?: number;
        shots: Array<{
          club: string;
          distanceYards?: number;
          ballCount?: number;
          notes?: string;
        }>;
      };
    }
  | {
      kind: "generic-sport";
      sport: string;
      sessionType?: string;
      extras?: Record<string, string | number>;
    }
  | { kind: "unknown" };

export type LogSummaryData = {
  id: string;
  routineId: string;
  performedAt: string; // ISO
  notes: string | null;
  completionCount: number | null;
  distanceMi: number | null;
  elevationGainFt: number | null;
  durationSec: number | null;
  location: string | null;
  weather: WeatherSnapshot | null;
  logKind: RoutineKind;
  routine: LogSummaryRoutine;
  // Structured intervals payload — present when the activity type uses
  // intervals (Sprint, Interval Run). null for all other logs.
  intervals: LogSummaryIntervals | null;
  /** Sport-specific structured data (golf scorecard, basketball mode,
   *  surfing extras, etc.). null when the log isn't a sport log. */
  sportData: LogSummarySportData | null;
  /** Backpacking trip rollup — present on every day-log of a trip. null
   *  otherwise. */
  backpacking: LogSummaryBackpacking | null;
  /** ActivitySpot link — name + region for the detail-page heading
   *  when the Spot Picker was used at log time. */
  spot: LogSummarySpot | null;
  metrics: LogSummaryMetric[];
  hasSessionMetricValues: boolean;
  climbAttempts: LogSummaryClimbAttempt[];
  guidedSteps: LogSummaryGuidedStep[];
  exercises: LogSummaryExercise[];
};

type RawLog = {
  id: string;
  routineId: string;
  performedAt: Date;
  notes: string | null;
  completionCount: number | null;
  distanceMi: number | null;
  elevationGainFt: number | null;
  durationSec: number | null;
  location: string | null;
  exercises: Array<{ id: string }>;
  guidedSteps: Array<{ id: string }>;
  sessionMetricValues: Array<{ id: string }>;
  climbAttempts: Array<{ id: string }>;
};

// Coerce the JSON payload off RoutineLog.intervalsConfig into a stable
// shape. Tolerates missing/extra fields — older logs (pre-Sprint) and
// hand-edited records degrade gracefully to nulls.
function parseIntervalsConfig(raw: unknown): LogSummaryIntervals | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const out: LogSummaryIntervals = {
    reps: num(obj.reps),
    workDistanceM: num(obj.workDistanceM),
    workDurationSec: num(obj.workDurationSec),
    restSec: num(obj.restSec),
  };
  // Skip if every field is null — no useful structure to display.
  if (out.reps === null && out.workDistanceM === null && out.workDurationSec === null && out.restSec === null) {
    return null;
  }
  return out;
}

type RawTrip = {
  id: string;
  trail: string | null;
  location: string | null;
  startYmd: string;
  endYmd: string;
  totalMiles: number | null;
  gear: unknown;
  packWeightGrams: number | null;
  baseWeightGrams: number | null;
  dayLogs: Array<{
    performedAt: Date;
    distanceMi: number | null;
    durationSec: number | null;
    elevationGainFt: number | null;
    notes: string | null;
    sportData: unknown;
  }>;
};

// Build the trip rollup from the parent BackpackingTrip + its day-logs. Days
// come from the child logs (not the parent) so per-day miles / elevation stay
// the single source of truth; campsite rides each day-log's sportData.
function parseBackpackingTrip(trip: RawTrip | null | undefined): LogSummaryBackpacking | null {
  if (!trip) return null;
  const gearRaw = Array.isArray(trip.gear) ? (trip.gear as Array<Record<string, unknown>>) : [];
  const gear = gearRaw
    .filter((g) => typeof g.name === "string" && g.name.trim().length > 0)
    .map((g) => ({
      name: g.name as string,
      oz: typeof g.weightGrams === "number" ? Math.round((g.weightGrams / GRAMS_PER_OZ) * 10) / 10 : null,
      quantity: typeof g.quantity === "number" && g.quantity > 0 ? g.quantity : 1,
      consumable: Boolean(g.consumable),
    }));
  const days = trip.dayLogs.map((d) => {
    const sd = (d.sportData && typeof d.sportData === "object" ? d.sportData : {}) as Record<string, unknown>;
    return {
      ymd: toAppYmd(d.performedAt),
      miles: d.distanceMi ?? null,
      durationSec: d.durationSec ?? null,
      elevGainFt: d.elevationGainFt ?? null,
      campsite: typeof sd.campsite === "string" ? sd.campsite : null,
      notes: d.notes ?? null,
    };
  });
  const totalDurationSec = days.reduce((s, d) => s + (d.durationSec ?? 0), 0);
  return {
    id: trip.id,
    trail: trip.trail,
    location: trip.location,
    startYmd: trip.startYmd,
    endYmd: trip.endYmd,
    totalMiles: trip.totalMiles,
    nights: Math.max(0, trip.dayLogs.length - 1),
    packLb: trip.packWeightGrams != null ? Math.round((trip.packWeightGrams / GRAMS_PER_LB) * 10) / 10 : null,
    baseLb: trip.baseWeightGrams != null ? Math.round((trip.baseWeightGrams / GRAMS_PER_LB) * 10) / 10 : null,
    gear,
    days,
    totalDurationSec,
  };
}

// Coerce RoutineLog.sportData JSON into a known discriminated shape.
// Unknown payloads fall through to `kind: "unknown"` so callers can
// hide / skip rendering instead of crashing on a malformed blob.
function parseSportData(raw: unknown): LogSummarySportData | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const sport = typeof obj.sport === "string" ? obj.sport : null;
  if (!sport) return { kind: "unknown" };

  if (sport === "golf") {
    const mode = obj.mode === "RANGE" ? "RANGE" : "COURSE";
    const out: LogSummarySportData = { kind: "golf", mode };
    if (typeof obj.sessionType === "string") out.sessionType = obj.sessionType;
    const course = obj.course as Record<string, unknown> | undefined;
    if (course && Array.isArray(course.holes)) {
      out.course = {
        location: typeof course.location === "string" ? course.location : undefined,
        holes: (course.holes as Array<Record<string, unknown>>).map((h) => ({
          number: typeof h.number === "number" ? h.number : 0,
          par: typeof h.par === "number" ? h.par : undefined,
          score: typeof h.score === "number" ? h.score : undefined,
          club: typeof h.club === "string" ? h.club : undefined,
          notes: typeof h.notes === "string" ? h.notes : undefined,
        })),
      };
    }
    const range = obj.range as Record<string, unknown> | undefined;
    if (range && Array.isArray(range.shots)) {
      out.range = {
        ballCount: typeof range.ballCount === "number" ? range.ballCount : undefined,
        shots: (range.shots as Array<Record<string, unknown>>).map((s) => ({
          club: typeof s.club === "string" ? s.club : "",
          distanceYards: typeof s.distanceYards === "number" ? s.distanceYards : undefined,
          ballCount: typeof s.ballCount === "number" ? s.ballCount : undefined,
          notes: typeof s.notes === "string" ? s.notes : undefined,
        })),
      };
    }
    return out;
  }

  // Generic sport — basketball/surfing/snowboarding/etc. carry sessionType
  // + extras under the same sport: "<slug>" discriminator.
  const extrasRaw = obj.extras as Record<string, unknown> | undefined;
  const extras: Record<string, string | number> = {};
  if (extrasRaw && typeof extrasRaw === "object") {
    for (const [k, v] of Object.entries(extrasRaw)) {
      if (typeof v === "string" || typeof v === "number") extras[k] = v;
    }
  }
  return {
    kind: "generic-sport",
    sport,
    sessionType: typeof obj.sessionType === "string" ? obj.sessionType : undefined,
    extras: Object.keys(extras).length > 0 ? extras : undefined,
  };
}

// Logs predate the strict-kind era — a routine flagged WORKOUT in the schema
// can still hold cardio data if it was migrated, so we infer the kind from
// what fields are populated. This mirrors the previous in-page logic.
function inferLogKind(log: RawLog, routineKind: string): RoutineKind {
  if (log.distanceMi !== null) return "CARDIO";
  if (log.exercises.length > 0) return "WORKOUT";
  if (log.climbAttempts.length > 0 || log.location || log.sessionMetricValues.length > 0) return "SESSION";
  if (log.durationSec !== null && log.guidedSteps.length > 0) return isSessionKind(routineKind) ? "SESSION" : "GUIDED";
  if (log.durationSec !== null && isSessionKind(routineKind)) return "SESSION";
  if (log.guidedSteps.length > 0) return isSessionKind(routineKind) ? "SESSION" : "GUIDED";
  return "COMPLETION";
}

export async function getLogSummaryData(logId: string): Promise<LogSummaryData | null> {
  if (!logId) return null;

  const log = await prisma.routineLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      notes: true,
      completionCount: true,
      distanceMi: true,
      elevationGainFt: true,
      durationSec: true,
      location: true,
      weather: true,
      // Pull activityType info so getRoutineDisplayName can resolve a
      // typed endurance log to its activity type name. Without these the
      // ViewLogDrawer would render "Endurance" literally for every typed
      // log against the synthetic routine.
      activityType: { select: { name: true } },
      // Structured interval payload for Sprint / Interval Run logs.
      intervalsConfig: true,
      // Sport-specific structured payload (golf scorecard, basketball
      // mode, surfing wave count, etc.). Discriminated by `sport`.
      // See RoutineLog.sportData in prisma/schema.prisma for shape.
      sportData: true,
      // Parent backpacking trip (if this is a trip day-log). Pulls the
      // trip-level rollup + all sibling day-logs so any day shows the trip.
      backpackingTrip: {
        select: {
          id: true,
          trail: true,
          location: true,
          startYmd: true,
          endYmd: true,
          totalMiles: true,
          gear: true,
          packWeightGrams: true,
          baseWeightGrams: true,
          dayLogs: {
            orderBy: { performedAt: "asc" },
            select: {
              performedAt: true,
              distanceMi: true,
              durationSec: true,
              elevationGainFt: true,
              notes: true,
              sportData: true,
            },
          },
        },
      },
      // ActivitySpot link — sport / endurance logs that picked a spot
      // get the spot name + region rendered alongside the legacy
      // free-text location field.
      activitySpot: {
        select: { id: true, name: true, region: true, type: true },
      },
      routine: {
        select: {
          id: true, name: true, kind: true,
          activityType: { select: { name: true } },
        },
      },
      metrics: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, value: true, unit: true },
      },
      sessionMetricValues: {
        select: { id: true },
      },
      climbAttempts: {
        orderBy: { attemptOrder: "asc" },
        select: {
          id: true,
          grade: true,
          gradeSystem: true,
          outcome: true,
          movesCompleted: true,
          totalMoves: true,
          notes: true,
          problem: { select: { id: true, name: true } },
        },
      },
      guidedSteps: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          kind: true,
          title: true,
          exerciseId: true,
          durationSec: true,
          restSec: true,
          repeatCount: true,
          repCount: true,
          setCount: true,
          weightLb: true,
          exercise: { select: { name: true } },
        },
      },
      exercises: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          exercise: { select: { name: true, unit: true, supportsWeight: true } },
          sets: {
            orderBy: { setNumber: "asc" },
            select: { id: true, setNumber: true, reps: true, seconds: true, weightLb: true },
          },
        },
      },
    },
  });

  if (!log) return null;

  const logKind = inferLogKind(log, log.routine.kind);
  // Display name resolves synthetic Endurance routine logs to their
  // activity type so the drawer / detail page render "Run", "Hike", etc.
  // instead of the placeholder "Endurance" name.
  const displayName = getRoutineDisplayName({
    routineId: log.routineId,
    routineName: log.routine.name,
    logActivityTypeName: log.activityType?.name ?? null,
    routineActivityTypeName: log.routine.activityType?.name ?? null,
  });

  return {
    id: log.id,
    routineId: log.routineId,
    performedAt: log.performedAt.toISOString(),
    notes: log.notes,
    completionCount: log.completionCount,
    distanceMi: log.distanceMi,
    elevationGainFt: log.elevationGainFt,
    durationSec: log.durationSec,
    location: log.location,
    weather: coerceWeatherSnapshot(log.weather),
    logKind,
    routine: { ...log.routine, name: displayName },
    intervals: parseIntervalsConfig(log.intervalsConfig),
    sportData: parseSportData(log.sportData),
    backpacking: parseBackpackingTrip(log.backpackingTrip),
    spot: log.activitySpot
      ? {
          id: log.activitySpot.id,
          name: log.activitySpot.name,
          region: log.activitySpot.region,
          type: log.activitySpot.type,
        }
      : null,
    metrics: log.metrics,
    hasSessionMetricValues: log.sessionMetricValues.length > 0,
    climbAttempts: log.climbAttempts.map((a) => ({
      id: a.id,
      grade: a.grade,
      gradeSystem: a.gradeSystem,
      outcome: a.outcome,
      movesCompleted: a.movesCompleted,
      totalMoves: a.totalMoves,
      notes: a.notes,
      problem: a.problem,
    })),
    guidedSteps: log.guidedSteps.map((s) => ({
      id: s.id,
      kind: s.kind,
      title: s.title,
      exerciseId: s.exerciseId,
      durationSec: s.durationSec,
      restSec: s.restSec,
      repeatCount: s.repeatCount,
      repCount: s.repCount,
      setCount: s.setCount,
      weightLb: s.weightLb,
      exerciseName: s.exercise?.name ?? null,
    })),
    exercises: log.exercises.map((e) => ({
      id: e.id,
      name: e.exercise.name,
      unit: e.exercise.unit as ExerciseUnitValue,
      supportsWeight: e.exercise.supportsWeight,
      sets: e.sets,
    })),
  };
}
