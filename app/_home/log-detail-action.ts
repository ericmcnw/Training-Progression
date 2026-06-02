"use server";

// Server action: fetch a full report-style summary of a single RoutineLog
// for the home v2 sparkline log popover. Returns a flat, serializable shape
// so the client can render without re-shaping.

import { prisma } from "@/lib/prisma";
import { normalizeRoutineKind } from "@/lib/routines";
import { getLogDisplayName } from "@/lib/routine-display";

export type LogReportSet = {
  setNumber: number;
  reps: number | null;
  seconds: number | null;
  weightLb: number | null;
};

export type LogReportExercise = {
  exerciseId: string;
  exerciseName: string;
  unit: "REPS" | "TIME" | null;
  setCount: number;
  sets: LogReportSet[];
  totalReps: number;
  totalSeconds: number;
  topWeight: number | null;
};

export type LogReportGuidedStep = {
  title: string;
  durationSec: number | null;
  weightLb: number | null;
  setCount: number;
  repCount: number;
};

export type LogReportMetric = {
  id: string;
  name: string;
  value: string;
  unit: string | null;
};

export type LogReport = {
  logId: string;
  routineId: string;
  routineName: string;
  kind: "WORKOUT" | "CARDIO" | "GUIDED" | "SESSION" | "COMPLETION";
  performedAt: string;            // ISO string
  performedDateLabel: string;     // "Sun, May 11"
  performedTimeLabel: string;     // "12:30 pm"
  durationSec: number | null;
  distanceMi: number | null;
  elevationGainFt: number | null;
  location: string | null;
  notes: string | null;
  completionCount: number | null;
  exercises: LogReportExercise[];     // WORKOUT / SESSION
  guidedSteps: LogReportGuidedStep[]; // GUIDED
  metrics: LogReportMetric[];         // ad-hoc + session custom metrics
  climbAttempts: Array<{ grade: string; gradeSystem: string; outcome: string }>;
};

export async function getHomeLogReport(logId: string): Promise<LogReport | null> {
  if (!logId) return null;
  const log = await prisma.routineLog.findUnique({
    where: { id: logId },
    include: {
      // Activity type on the log + routine so the popover title reflects an
      // edited type ("Trail Run" after retyping a Long Run log) and synthetic
      // Endurance logs render under their type, not the placeholder name.
      activityType: { select: { name: true } },
      routine: {
        select: {
          id: true,
          name: true,
          kind: true,
          activityType: { select: { name: true } },
        },
      },
      exercises: {
        include: {
          exercise: { select: { id: true, name: true, unit: true } },
          sets: { orderBy: { setNumber: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      guidedSteps: { orderBy: { sortOrder: "asc" } },
      metrics: { orderBy: { createdAt: "asc" } },
      sessionMetricValues: {
        include: { metricDefinition: { select: { label: true, unit: true } } },
        orderBy: { createdAt: "asc" },
      },
      climbAttempts: {
        select: { grade: true, gradeSystem: true, outcome: true },
        orderBy: { attemptOrder: "asc" },
      },
    },
  });
  if (!log) return null;

  const kind = normalizeRoutineKind(log.routine.kind);

  const exercises: LogReportExercise[] = log.exercises.map((se) => {
    const sets = se.sets.map((s) => ({
      setNumber: s.setNumber,
      reps: s.reps,
      seconds: s.seconds,
      weightLb: s.weightLb,
    }));
    return {
      exerciseId: se.exercise.id,
      exerciseName: se.exercise.name,
      unit: (se.exercise.unit as "REPS" | "TIME") ?? null,
      setCount: sets.length,
      sets,
      totalReps: sets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
      totalSeconds: sets.reduce((sum, s) => sum + (s.seconds ?? 0), 0),
      topWeight: sets.reduce<number | null>((max, s) => {
        if (s.weightLb == null) return max;
        return max == null ? s.weightLb : Math.max(max, s.weightLb);
      }, null),
    };
  });

  const guidedSteps: LogReportGuidedStep[] = log.guidedSteps.map((g) => ({
    title: g.title,
    durationSec: g.durationSec,
    weightLb: g.weightLb,
    setCount: g.setCount,
    repCount: g.repCount,
  }));

  const metrics: LogReportMetric[] = [
    ...log.metrics.map((m) => ({
      id: m.id,
      name: m.name,
      value: String(m.value),
      unit: m.unit ?? null,
    })),
    ...log.sessionMetricValues.map((v) => {
      const raw =
        v.numberValue != null ? String(v.numberValue)
          : v.textValue != null ? v.textValue
          : v.booleanValue != null ? (v.booleanValue ? "yes" : "no")
          : "";
      return {
        id: v.id,
        name: v.metricDefinition.label,
        value: raw,
        unit: v.metricDefinition.unit ?? null,
      };
    }),
  ];

  const climbAttempts = log.climbAttempts.map((c) => ({
    grade: c.grade,
    gradeSystem: String(c.gradeSystem),
    outcome: String(c.outcome),
  }));

  const performedDateLabel = log.performedAt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const performedTimeLabel = log.performedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    logId: log.id,
    routineId: log.routine.id,
    routineName: getLogDisplayName(log),
    kind,
    performedAt: log.performedAt.toISOString(),
    performedDateLabel,
    performedTimeLabel,
    durationSec: log.durationSec,
    distanceMi: log.distanceMi,
    elevationGainFt: log.elevationGainFt,
    location: log.location,
    notes: log.notes,
    completionCount: log.completionCount,
    exercises,
    guidedSteps,
    metrics,
    climbAttempts,
  };
}
