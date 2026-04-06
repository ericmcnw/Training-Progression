import { cache } from "react";
import { formatAppDate, formatAppDateTime } from "@/lib/dates";
import { isMissingExerciseLibraryKindError, withDerivedExerciseLibraryKind } from "@/lib/exercise-library";
import { inferExerciseMetadataSlugs, inferGuidedStepMetadataSlugs, inferRoutineMetadataSlugs } from "@/lib/metadata";
import { prisma } from "@/lib/prisma";
import { aggregateExerciseSessionRow, countGoalMetWeeks, descendantGroupIds, fillWeeklySeries, hasSessionLikeKinds, hasWorkoutKinds, incrementWeekMap, isCardioOnlyKinds, lastOrNull, performedAtWhere, weeksWithActivity, ytdSessions, type ProgressRange, type SeriesPoint } from "@/lib/progress-v2";
import { isMissingRoutineFrequencyColumnsError, withNullRoutineFrequencyTargets } from "@/lib/routine-query-compat";
import { formatRoutineSubtype, normalizeRoutineKind } from "@/lib/routines";

export type RoutineLogWithRelations = Awaited<ReturnType<typeof getRoutineLogs>>[number];

const routineScalarSelect = {
  id: true,
  name: true,
  category: true,
  subtype: true,
  domain: true,
  kind: true,
  timesPerWeek: true,
  isActive: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} as const;

const routineScalarSelectWithFrequency = {
  ...routineScalarSelect,
  targetFrequencyCount: true,
  targetFrequencyUnit: true,
  targetFrequencyInterval: true,
  frequencyGoalEnabled: true,
} as const;

const routineRelationSelectBase = {
  ...routineScalarSelect,
  metadataGroups: {
    include: { group: true },
  },
  sessionDetails: {
    include: {
      template: {
        include: {
          metricDefinitions: {
            orderBy: { sortOrder: "asc" as const },
          },
          metadataGroups: {
            include: { group: true },
          },
        },
      },
    },
  },
} as const;

const routineRelationSelectWithFrequency = {
  ...routineRelationSelectBase,
  targetFrequencyCount: true,
  targetFrequencyUnit: true,
  targetFrequencyInterval: true,
  frequencyGoalEnabled: true,
} as const;

export const getRoutineIndex = cache(async function getRoutineIndex() {
  try {
    return await prisma.routine.findMany({
      where: { isDeleted: false },
      orderBy: [{ isActive: "desc" }, { category: "asc" }, { name: "asc" }],
      select: {
        ...routineScalarSelectWithFrequency,
        exercises: {
          include: {
            exercise: {
              include: {
                metadataGroups: {
                  include: { group: true },
                },
              },
            },
          },
        },
        metadataGroups: {
          include: { group: true },
        },
      },
    });
  } catch (error) {
    if (!isMissingRoutineFrequencyColumnsError(error)) throw error;
    const routines = await prisma.routine.findMany({
      where: { isDeleted: false },
      orderBy: [{ isActive: "desc" }, { category: "asc" }, { name: "asc" }],
      select: {
        ...routineScalarSelect,
        exercises: {
          include: {
            exercise: {
              include: {
                metadataGroups: {
                  include: { group: true },
                },
              },
            },
          },
        },
        metadataGroups: {
          include: { group: true },
        },
      },
    });
    return routines.map((routine) => withNullRoutineFrequencyTargets(routine));
  }
});

export const getExerciseIndex = cache(async function getExerciseIndex() {
  try {
    try {
      return await prisma.exercise.findMany({
        orderBy: [{ name: "asc" }],
        include: {
          metadataGroups: {
            include: { group: true },
          },
          routines: {
            include: {
              routine: {
                select: routineScalarSelectWithFrequency,
              },
            },
          },
        },
      });
    } catch (error) {
      if (!isMissingRoutineFrequencyColumnsError(error)) throw error;
      const exercises = await prisma.exercise.findMany({
        orderBy: [{ name: "asc" }],
        include: {
          metadataGroups: {
            include: { group: true },
          },
          routines: {
            include: {
              routine: {
                select: routineScalarSelect,
              },
            },
          },
        },
      });
      return exercises.map((exercise) => ({
        ...exercise,
        routines: exercise.routines.map((entry) => ({
          ...entry,
          routine: withNullRoutineFrequencyTargets(entry.routine),
        })),
      }));
    }
  } catch (error) {
    if (!isMissingExerciseLibraryKindError(error)) throw error;
    return withDerivedExerciseLibraryKind(
      await prisma.exercise.findMany({
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          unit: true,
          supportsWeight: true,
          createdAt: true,
          updatedAt: true,
          metadataGroups: {
            include: { group: true },
          },
          routines: {
            include: {
              routine: {
                select: routineScalarSelect,
              },
            },
          },
        },
      })
    );
  }
});

export const getMetadataIndex = cache(async function getMetadataIndex() {
  return prisma.metadataGroup.findMany({
    orderBy: [{ kind: "asc" }, { label: "asc" }],
    include: {
      parentRelations: true,
      childRelations: true,
      routineAssignments: true,
      exerciseAssignments: true,
      guidedStepAssignments: true,
    },
  });
});

export const getRoutineLogs = cache(async function getRoutineLogs(range: ProgressRange, filter?: {
  logIds?: string[];
  routineIds?: string[];
  exerciseIds?: string[];
  guidedStepIds?: string[];
  guidedExerciseIds?: string[];
}) {
  const where = {
    ...(performedAtWhere(range) ? { performedAt: performedAtWhere(range) } : {}),
    ...(filter?.logIds && filter.logIds.length > 0 ? { id: { in: filter.logIds } } : {}),
    ...(
      filter?.logIds && filter.logIds.length > 0
        ? {}
        : filter?.routineIds && filter.routineIds.length > 0
        ? {
            OR: [
              { routineId: { in: filter.routineIds } },
              ...(filter.exerciseIds && filter.exerciseIds.length > 0
                ? [{ exercises: { some: { exerciseId: { in: filter.exerciseIds } } } }]
                : []),
              ...(filter.guidedStepIds && filter.guidedStepIds.length > 0
                ? [{ guidedSteps: { some: { guidedStepId: { in: filter.guidedStepIds } } } }]
                : []),
              ...(filter.guidedExerciseIds && filter.guidedExerciseIds.length > 0
                ? [{ guidedSteps: { some: { exerciseId: { in: filter.guidedExerciseIds } } } }]
                : []),
            ],
          }
        : filter?.exerciseIds && filter.exerciseIds.length > 0
        ? { exercises: { some: { exerciseId: { in: filter.exerciseIds } } } }
        : filter?.guidedStepIds && filter.guidedStepIds.length > 0
        ? { guidedSteps: { some: { guidedStepId: { in: filter.guidedStepIds } } } }
        : filter?.guidedExerciseIds && filter.guidedExerciseIds.length > 0
        ? { guidedSteps: { some: { exerciseId: { in: filter.guidedExerciseIds } } } }
        : {}),
  };

  const sharedInclude = {
    exercises: {
      include: {
        exercise: {
          include: {
            metadataGroups: {
              include: { group: true },
            },
          },
        },
        sets: true,
      },
    },
    metrics: true,
    sessionMetricValues: {
      include: {
        metricDefinition: true,
      },
    },
    guidedSteps: {
      include: {
        guidedStep: {
          include: {
            metadataGroups: {
              include: { group: true },
            },
          },
        },
        exercise: {
          include: {
            metadataGroups: {
              include: { group: true },
            },
          },
        },
      },
    },
  } as const;

  try {
    return await prisma.routineLog.findMany({
      where,
      orderBy: [{ performedAt: "asc" }],
      include: {
        routine: {
          select: routineRelationSelectWithFrequency,
        },
        ...sharedInclude,
      },
    });
  } catch (error) {
    if (!isMissingRoutineFrequencyColumnsError(error)) throw error;
    const logs = await prisma.routineLog.findMany({
      where,
      orderBy: [{ performedAt: "asc" }],
      include: {
        routine: {
          select: routineRelationSelectBase,
        },
        ...sharedInclude,
      },
    });
    return logs.map((log) => ({
      ...log,
      routine: withNullRoutineFrequencyTargets(log.routine),
    }));
  }
});

export function summarizeRoutineLogs(logs: RoutineLogWithRelations[], timesPerWeek: number | null) {
  const sessionWeekMap = new Map<string, number>();
  let totalDistance = 0;
  let totalDurationSec = 0;
  let totalElevationGainFt = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;

  for (const log of logs) {
    incrementWeekMap(sessionWeekMap, log.performedAt, 1);
    totalDistance += log.distanceMi ?? 0;
    totalDurationSec += log.durationSec ?? 0;
    totalElevationGainFt += log.elevationGainFt ?? 0;
    for (const exercise of log.exercises) {
      const metrics = aggregateExerciseSessionRow(exercise.sets);
      totalSets += metrics.totalSets;
      totalReps += metrics.totalReps;
      totalVolume += metrics.totalVolume;
    }
  }

  return {
    sessions: logs.length,
    ytd: ytdSessions(logs),
    weeksActive: weeksWithActivity(sessionWeekMap),
    weeksGoalMet: countGoalMetWeeks(sessionWeekMap, timesPerWeek ?? 0),
    sessionWeekMap,
    totalDistance,
    totalDurationSec,
    totalElevationGainFt,
    totalSets,
    totalReps,
    totalVolume,
    lastSession: lastOrNull(logs)?.performedAt ?? null,
  };
}

export function cardioPerformanceSeries(logs: RoutineLogWithRelations[]) {
  const distancePoints: SeriesPoint[] = [];
  const pacePoints: SeriesPoint[] = [];
  const durationPoints: SeriesPoint[] = [];
  const elevationPoints: SeriesPoint[] = [];

  for (const log of logs) {
    if (!Number.isFinite(log.distanceMi) || !Number.isFinite(log.durationSec)) continue;
    const label = formatAppDate(log.performedAt, { month: "short", day: "numeric" });
    const distanceMi = log.distanceMi ?? 0;
    const durationSec = log.durationSec ?? 0;
    const elevationGainFt = log.elevationGainFt ?? 0;
    distancePoints.push({ label, value: distanceMi });
    durationPoints.push({ label, value: durationSec });
    elevationPoints.push({ label, value: elevationGainFt });
    if (distanceMi > 0) {
      pacePoints.push({ label, value: durationSec / distanceMi });
    }
  }

  return { distancePoints, durationPoints, pacePoints, elevationPoints };
}

export function cardioWorkloadSeries(logs: RoutineLogWithRelations[], range: ProgressRange) {
  const sessions = new Map<string, number>();
  const distance = new Map<string, number>();
  const duration = new Map<string, number>();
  const elevation = new Map<string, number>();

  for (const log of logs) {
    incrementWeekMap(sessions, log.performedAt, 1);
    incrementWeekMap(distance, log.performedAt, log.distanceMi ?? 0);
    incrementWeekMap(duration, log.performedAt, log.durationSec ?? 0);
    incrementWeekMap(elevation, log.performedAt, log.elevationGainFt ?? 0);
  }

  return {
    sessions: fillWeeklySeries(sessions, range),
    distance: fillWeeklySeries(distance, range),
    duration: fillWeeklySeries(duration, range),
    elevation: fillWeeklySeries(elevation, range),
  };
}

export function workoutSessionSeries(logs: RoutineLogWithRelations[]) {
  const totalVolume: SeriesPoint[] = [];
  const totalReps: SeriesPoint[] = [];
  const topSetWeight: SeriesPoint[] = [];

  for (const log of logs) {
    let sessionVolume = 0;
    let sessionReps = 0;
    let sessionTopWeight = 0;

    for (const exercise of log.exercises) {
      const metrics = aggregateExerciseSessionRow(exercise.sets);
      sessionVolume += metrics.totalVolume;
      sessionReps += metrics.totalReps;
      sessionTopWeight = Math.max(sessionTopWeight, metrics.topWeight);
    }

    const label = formatAppDate(log.performedAt, { month: "short", day: "numeric" });
    totalVolume.push({ label, value: sessionVolume });
    totalReps.push({ label, value: sessionReps });
    topSetWeight.push({ label, value: sessionTopWeight });
  }

  return { totalVolume, totalReps, topSetWeight };
}

export function workoutWeeklySeries(logs: RoutineLogWithRelations[], range: ProgressRange) {
  const sets = new Map<string, number>();
  const reps = new Map<string, number>();
  const volume = new Map<string, number>();

  for (const log of logs) {
    let sessionSets = 0;
    let sessionReps = 0;
    let sessionVolume = 0;
    for (const exercise of log.exercises) {
      const metrics = aggregateExerciseSessionRow(exercise.sets);
      sessionSets += metrics.totalSets;
      sessionReps += metrics.totalReps;
      sessionVolume += metrics.totalVolume;
    }
    incrementWeekMap(sets, log.performedAt, sessionSets);
    incrementWeekMap(reps, log.performedAt, sessionReps);
    incrementWeekMap(volume, log.performedAt, sessionVolume);
  }

  return {
    sets: fillWeeklySeries(sets, range),
    reps: fillWeeklySeries(reps, range),
    volume: fillWeeklySeries(volume, range),
  };
}

export function durationWeeklySeries(logs: RoutineLogWithRelations[], range: ProgressRange) {
  const sessions = new Map<string, number>();
  const duration = new Map<string, number>();

  for (const log of logs) {
    incrementWeekMap(sessions, log.performedAt, 1);
    incrementWeekMap(duration, log.performedAt, log.durationSec ?? 0);
  }

  return {
    sessions: fillWeeklySeries(sessions, range),
    duration: fillWeeklySeries(duration, range),
  };
}

export function guidedItemWeeklySeries(
  logs: RoutineLogWithRelations[],
  range: ProgressRange,
  filter: { guidedStepIds?: string[]; guidedExerciseIds?: string[] }
) {
  const completions = new Map<string, number>();
  const duration = new Map<string, number>();
  const guidedStepIds = new Set(filter.guidedStepIds ?? []);
  const guidedExerciseIds = new Set(filter.guidedExerciseIds ?? []);

  for (const log of logs) {
    let sessionCompletions = 0;
    let sessionDuration = 0;

    for (const step of log.guidedSteps) {
      const matchesGuidedStep = step.guidedStepId ? guidedStepIds.has(step.guidedStepId) : false;
      const matchesGuidedExercise = step.exerciseId ? guidedExerciseIds.has(step.exerciseId) : false;
      if (!matchesGuidedStep && !matchesGuidedExercise) continue;

      const repeatCount = Math.max(1, step.repeatCount ?? 1);
      const workSec = step.durationSec ?? 0;
      const restSec = step.restSec ?? 0;
      const restMultiplier = restSec > 0 ? (repeatCount > 1 ? repeatCount - 1 : 1) : 0;
      sessionCompletions += repeatCount;
      sessionDuration += workSec * repeatCount + restSec * restMultiplier;
    }

    if (sessionCompletions > 0) {
      incrementWeekMap(completions, log.performedAt, sessionCompletions);
      incrementWeekMap(duration, log.performedAt, sessionDuration);
    }
  }

  return {
    completions: fillWeeklySeries(completions, range),
    duration: fillWeeklySeries(duration, range),
  };
}

export function exerciseSessionSeries(rows: Array<{
  performedAt: Date;
  topWeight: number;
  totalReps: number;
  totalVolume: number;
  totalSets: number;
}>) {
  return {
    topWeight: rows.map((row) => ({ label: formatAppDate(row.performedAt, { month: "short", day: "numeric" }), value: row.topWeight })),
    totalReps: rows.map((row) => ({ label: formatAppDate(row.performedAt, { month: "short", day: "numeric" }), value: row.totalReps })),
    totalVolume: rows.map((row) => ({ label: formatAppDate(row.performedAt, { month: "short", day: "numeric" }), value: row.totalVolume })),
    totalSets: rows.map((row) => ({ label: formatAppDate(row.performedAt, { month: "short", day: "numeric" }), value: row.totalSets })),
  };
}

export function exerciseWeeklySeries(rows: Array<{
  performedAt: Date;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
}>, range: ProgressRange) {
  const sets = new Map<string, number>();
  const reps = new Map<string, number>();
  const volume = new Map<string, number>();

  for (const row of rows) {
    incrementWeekMap(sets, row.performedAt, row.totalSets);
    incrementWeekMap(reps, row.performedAt, row.totalReps);
    incrementWeekMap(volume, row.performedAt, row.totalVolume);
  }

  return {
    sets: fillWeeklySeries(sets, range),
    reps: fillWeeklySeries(reps, range),
    volume: fillWeeklySeries(volume, range),
  };
}

export function groupTargetType(logs: RoutineLogWithRelations[]) {
  const kinds = Array.from(new Set(logs.map((log) => normalizeRoutineKind(log.routine.kind))));
  if (isCardioOnlyKinds(kinds)) return "cardio";
  if (kinds.length > 0 && kinds.every((kind) => kind === "SESSION")) return "session";
  if (hasWorkoutKinds(kinds) && !hasSessionLikeKinds(kinds.filter((kind) => kind !== "WORKOUT"))) return "workout";
  return "mixed";
}

export async function resolveGroupTarget(slug: string, range: ProgressRange) {
  const [group, relations] = await Promise.all([
    prisma.metadataGroup.findUnique({
      where: { slug },
      include: {
        parentRelations: {
          include: { parentGroup: true },
        },
      },
    }),
    prisma.metadataGroupRelation.findMany(),
  ]);

  if (!group) {
    const stimulusCategory = await prisma.stimulusCategory.findUnique({
      where: { slug },
    });
    if (!stimulusCategory) return null;

    const stimulusRows = await prisma.routineLogStimulus.findMany({
      where: {
        stimulusCategoryId: stimulusCategory.id,
        ...(performedAtWhere(range)
          ? {
              routineLog: {
                performedAt: performedAtWhere(range),
              },
            }
          : {}),
      },
      select: { routineLogId: true },
    });

    const logIds = Array.from(new Set(stimulusRows.map((row) => row.routineLogId)));
    const logs = logIds.length > 0 ? await getRoutineLogs(range, { logIds }) : [];

    return {
      group: {
        id: stimulusCategory.id,
        slug: stimulusCategory.slug,
        label: stimulusCategory.label,
        kind: "MOVEMENT_PATTERN" as const,
      },
      routineIds: Array.from(new Set(logs.map((log) => log.routineId))),
      exerciseIds: Array.from(new Set(logs.flatMap((log) => log.exercises.map((exercise) => exercise.exerciseId)))),
      guidedStepIds: Array.from(
        new Set(logs.flatMap((log) => log.guidedSteps.map((step) => step.guidedStepId).filter((value): value is string => Boolean(value))))
      ),
      guidedExerciseIds: Array.from(
        new Set(logs.flatMap((log) => log.guidedSteps.map((step) => step.exerciseId).filter((value): value is string => Boolean(value))))
      ),
      logs,
    };
  }

  const relevantGroupIds = descendantGroupIds(group.id, relations);
  const relevantSlugs = new Set(
    (
      await prisma.metadataGroup.findMany({
        where: { id: { in: relevantGroupIds } },
        select: { slug: true },
      })
    ).map((item) => item.slug)
  );
  const [routineAssignments, exerciseAssignments, subtypeRoutines, inferredExercises, sessionTemplateAssignments, sessionTemplateRoutines, guidedStepAssignments, guidedSteps] = await Promise.all([
    prisma.routineMetadataGroup.findMany({
      where: { groupId: { in: relevantGroupIds } },
      select: { routineId: true },
    }),
    prisma.exerciseMetadataGroup.findMany({
      where: { groupId: { in: relevantGroupIds } },
      select: { exerciseId: true },
    }),
    prisma.routine.findMany({
      where: { isDeleted: false },
      select: { id: true, subtype: true },
    }),
    prisma.exercise.findMany({
      select: { id: true, name: true },
    }),
    prisma.sessionTemplateMetadataGroup.findMany({
      where: { groupId: { in: relevantGroupIds } },
      select: { templateId: true },
    }),
    prisma.sessionRoutineDetails.findMany({
      where: { templateId: { not: null } },
      select: { routineId: true, templateId: true },
    }),
    prisma.guidedStepMetadataGroup.findMany({
      where: { groupId: { in: relevantGroupIds } },
      select: { guidedStepId: true },
    }),
    prisma.guidedStep.findMany({
      select: { id: true, routineId: true, kind: true, title: true, exerciseId: true },
    }),
  ]);

  const inferredRoutineIds = subtypeRoutines
    .filter((routine) => inferRoutineMetadataSlugs(routine.subtype).some((slugValue) => relevantSlugs.has(slugValue)))
    .map((routine) => routine.id);
  const inferredExerciseIds = inferredExercises
    .filter((exercise) => inferExerciseMetadataSlugs(exercise.name).some((slugValue) => relevantSlugs.has(slugValue)))
    .map((exercise) => exercise.id);
  const inferredGuidedStepIds = guidedSteps
    .filter((step) => step.kind === "STEP" && inferGuidedStepMetadataSlugs(step.title).some((slugValue) => relevantSlugs.has(slugValue)))
    .map((step) => step.id);
  const guidedStepIds = Array.from(new Set([...guidedStepAssignments.map((item) => item.guidedStepId), ...inferredGuidedStepIds]));
  const guidedExerciseIds = Array.from(
    new Set(
      guidedSteps
        .filter((step) => step.exerciseId && inferredExerciseIds.includes(step.exerciseId))
        .map((step) => step.exerciseId as string)
    )
  );
  const guidedRoutineIds = guidedSteps
    .filter((step) => guidedStepIds.includes(step.id) || (step.exerciseId ? guidedExerciseIds.includes(step.exerciseId) : false))
    .map((step) => step.routineId);

  const templateRoutineIds = sessionTemplateRoutines
    .filter((detail) => detail.templateId && sessionTemplateAssignments.some((assignment) => assignment.templateId === detail.templateId))
    .map((detail) => detail.routineId);
  const routineIds = Array.from(
    new Set([...routineAssignments.map((item) => item.routineId), ...inferredRoutineIds, ...templateRoutineIds, ...guidedRoutineIds])
  );
  const exerciseIds = Array.from(new Set([...exerciseAssignments.map((item) => item.exerciseId), ...inferredExerciseIds]));
  const logs =
    routineIds.length === 0 && exerciseIds.length === 0 && guidedStepIds.length === 0 && guidedExerciseIds.length === 0
      ? []
      : await getRoutineLogs(range, { routineIds, exerciseIds, guidedStepIds, guidedExerciseIds });

  return {
    group,
    routineIds,
    exerciseIds,
    guidedStepIds,
    guidedExerciseIds,
    logs,
  };
}

export function routineSubtitle(routine: { category: string; kind: string; subtype: string | null; isActive: boolean }) {
  return `${routine.category} | ${normalizeRoutineKind(routine.kind)}${routine.subtype ? ` | ${formatRoutineSubtype(routine.subtype)}` : ""}${routine.isActive ? "" : " | Archived"}`;
}

export function humanLogTimestamp(date: Date) {
  return formatAppDateTime(date);
}
