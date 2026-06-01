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
  logKind: RoutineKind;
  routine: LogSummaryRoutine;
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
      // Pull activityType info so getRoutineDisplayName can resolve a
      // typed endurance log to its activity type name. Without these the
      // ViewLogDrawer would render "Endurance" literally for every typed
      // log against the synthetic routine.
      activityType: { select: { name: true } },
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
    logKind,
    routine: { ...log.routine, name: displayName },
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
