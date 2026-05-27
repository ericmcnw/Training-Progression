// Server-side fetcher for log-edit form props. One source of truth shared
// between:
//   - the full edit page (app/routines/[id]/logs/[logId]/edit)
//   - the EditLogDrawer (opens from the View drawer's Edit button)
//   - any future surface that needs to mount an edit form (deep-link, share)
//
// Discriminated union by inferred kind. Date fields remain Date here; the
// API route serializes via JSON.stringify (becomes ISO string), and the
// drawer hydrates back to Date before mounting forms. The page consumes
// Dates directly and passes them through unchanged.

import { prisma } from "@/lib/prisma";
import {
  exerciseLibraryWhereForKinds,
  guidedPreferredLibraryKinds,
  isMissingExerciseLibraryKindError,
  orderExercisesForLibraryContext,
  withDerivedExerciseLibraryKind,
  workoutLibraryKinds,
} from "@/lib/exercise-library";
import {
  isCardioKind,
  isGuidedKind,
  isSessionKind,
  isWorkoutKind,
} from "@/lib/routines";
import type { Prisma, RoutineKind, GuidedStepKind, ExerciseLibraryKind } from "@/generated/prisma";
import type { ExerciseUnitValue } from "@/lib/exercises";
import {
  isClimbingTemplateKey,
  withSessionMetricConfig,
  type SessionMetricDefinitionWithConfig,
} from "@/lib/session-templates";
import {
  buildSpotPickerItems,
  compatibleActivitySlugs,
  resolveRoutineActivitySlug,
  type SpotPickerItem,
} from "@/lib/activity-spots";
import type { SpotPickerValue } from "@/lib/spot-picker-types";
import type { ClimbLocationBasic } from "@/lib/climb-types";

// Mirror the page's inference — kind comes from what the log actually
// carries, not just the routine's declared kind (legacy routines may have
// mixed-kind logs after migrations).
function inferLogKind(log: {
  distanceMi: number | null;
  durationSec: number | null;
  location: string | null;
  exercises: Array<{ id: string }>;
  guidedSteps: Array<{ id: string }>;
  sessionMetricValues: Array<{ id: string }>;
}, routineKind: string): RoutineKind {
  if (log.distanceMi !== null) return "CARDIO";
  if (log.exercises.length > 0) return "WORKOUT";
  if (log.location || log.sessionMetricValues.length > 0) return "SESSION";
  if (log.durationSec !== null && log.guidedSteps.length > 0) return isSessionKind(routineKind) ? "SESSION" : "GUIDED";
  if (log.durationSec !== null && isSessionKind(routineKind)) return "SESSION";
  if (log.guidedSteps.length > 0) return isSessionKind(routineKind) ? "SESSION" : "GUIDED";
  return "COMPLETION";
}

function parsePreferredClimbingGrades(value: Prisma.JsonValue | null | undefined): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).preferredClimbingGrades;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

// ── Per-kind shapes ───────────────────────────────────────────────────

export type EditWorkoutData = {
  kind: "WORKOUT";
  routineId: string;
  routineName: string;
  logId: string;
  initialPerformedAt: Date;
  initialNotes: string;
  initialExercises: Array<{
    exerciseId: string;
    name: string;
    unit: ExerciseUnitValue;
    supportsWeight: boolean;
    rows: Array<{ setNumber: number; reps?: string; seconds?: string; weightLb?: string }>;
  }>;
  availableExercises: Array<{ id: string; name: string; unit: ExerciseUnitValue; supportsWeight: boolean; libraryKind: ExerciseLibraryKind }>;
};

export type EditCardioData = {
  kind: "CARDIO";
  routineId: string;
  routineName: string;
  logId: string;
  initialDistanceMi: number;
  initialElevationGainFt: number | null;
  initialDurationSec: number;
  initialNotes: string;
  initialPerformedAt: Date;
  activitySlug: string | null;
  savedSpots: SpotPickerItem[];
  initialSpot: SpotPickerValue;
};

export type EditGuidedData = {
  kind: "GUIDED";
  routineId: string;
  routineName: string;
  logId: string;
  initialDurationSec: number;
  initialNotes: string;
  initialPerformedAt: Date;
  availableExercises: Array<{ id: string; name: string; unit: ExerciseUnitValue; supportsWeight: boolean; libraryKind: ExerciseLibraryKind }>;
  steps: Array<{
    guidedStepId: string | null;
    kind: GuidedStepKind;
    title: string;
    exerciseId: string | null;
    exerciseName: string | null;
    durationSec: number | null;
    restSec: number | null;
    repeatCount: number;
    repCount: number | null;
    setCount: number | null;
    weightLb: number | null;
    sortOrder: number;
  }>;
};

export type EditSessionData = {
  kind: "SESSION";
  routineId: string;
  routineName: string;
  logId: string;
  initialDurationSec: number;
  initialNotes: string;
  initialPerformedAt: Date;
  templateKey: string | null;
  templateName: string | null;
  definitions: SessionMetricDefinitionWithConfig[];
  initialValues: Record<string, { numberValue?: string; textValue?: string; booleanValue?: boolean }>;
  preferredClimbingGrades: string[];
  activitySlug: string | null;
  savedSpots: SpotPickerItem[];
  savedClimbLocations: ClimbLocationBasic[];
  initialSpot: SpotPickerValue;
};

export type EditCompletionData = {
  kind: "COMPLETION";
  routineId: string;
  routineName: string;
  logId: string;
  initialCompletionCount: number | null;
  initialNotes: string;
  initialPerformedAt: Date;
};

export type LogEditData =
  | EditWorkoutData
  | EditCardioData
  | EditGuidedData
  | EditSessionData
  | EditCompletionData;

// ── Fetcher ───────────────────────────────────────────────────────────

export async function getLogEditData(logId: string): Promise<LogEditData | null> {
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
      climbLocationId: true,
      activitySpotId: true,
      climbLocation: {
        select: { id: true, name: true, region: true, type: true, osmType: true, osmId: true, latitude: true, longitude: true },
      },
      activitySpot: {
        select: { id: true, activitySlug: true, name: true, region: true, type: true, osmType: true, osmId: true, latitude: true, longitude: true },
      },
      metrics: { select: { id: true } },
      sessionMetricValues: {
        include: { metricDefinition: true },
      },
      guidedSteps: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          guidedStepId: true,
          kind: true,
          title: true,
          exerciseId: true,
          durationSec: true,
          restSec: true,
          repeatCount: true,
          repCount: true,
          setCount: true,
          weightLb: true,
          sortOrder: true,
          exercise: { select: { name: true } },
        },
      },
      exercises: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          exerciseId: true,
          exercise: { select: { name: true, unit: true, supportsWeight: true } },
          sets: {
            orderBy: { setNumber: "asc" },
            select: { setNumber: true, reps: true, seconds: true, weightLb: true },
          },
        },
      },
    },
  });
  if (!log) return null;

  const routine = await prisma.routine.findUnique({
    where: { id: log.routineId },
    select: {
      id: true,
      name: true,
      kind: true,
      subtype: true,
      metadataGroups: { select: { group: { select: { slug: true } } } },
      exercises: {
        orderBy: { sortOrder: "asc" },
        select: {
          exerciseId: true,
          defaultSets: true,
          exercise: { select: { name: true, unit: true, supportsWeight: true } },
        },
      },
      sessionDetails: {
        select: {
          templateConfig: true,
          template: {
            include: {
              metricDefinitions: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!routine) return null;

  const logKind = inferLogKind(log, routine.kind);
  const base = {
    routineId: routine.id,
    routineName: routine.name,
    logId: log.id,
    initialNotes: log.notes ?? "",
    initialPerformedAt: log.performedAt,
  };

  if (isWorkoutKind(logKind)) {
    const availableExercises = await fetchWorkoutExercises();
    const initialExercises = [
      ...routine.exercises.map((routineExercise) => {
        const fromLog = log.exercises.find((exercise) => exercise.exerciseId === routineExercise.exerciseId);
        return {
          exerciseId: routineExercise.exerciseId,
          name: routineExercise.exercise.name,
          unit: routineExercise.exercise.unit,
          supportsWeight: routineExercise.exercise.supportsWeight,
          rows:
            fromLog?.sets.length
              ? fromLog.sets.map((set) => ({
                  setNumber: set.setNumber,
                  reps: set.reps === null ? "" : String(set.reps),
                  seconds: set.seconds === null ? "" : String(set.seconds),
                  weightLb: set.weightLb === null ? "" : String(set.weightLb),
                }))
              : Array.from({ length: Math.max(1, routineExercise.defaultSets ?? 3) }, (_, index) => ({
                  setNumber: index + 1,
                })),
        };
      }),
      ...log.exercises
        .filter((exercise) => !routine.exercises.some((item) => item.exerciseId === exercise.exerciseId))
        .map((exercise) => ({
          exerciseId: exercise.exerciseId,
          name: exercise.exercise.name,
          unit: exercise.exercise.unit,
          supportsWeight: exercise.exercise.supportsWeight,
          rows:
            exercise.sets.length > 0
              ? exercise.sets.map((set) => ({
                  setNumber: set.setNumber,
                  reps: set.reps === null ? "" : String(set.reps),
                  seconds: set.seconds === null ? "" : String(set.seconds),
                  weightLb: set.weightLb === null ? "" : String(set.weightLb),
                }))
              : [{ setNumber: 1 }],
        })),
    ];
    return { kind: "WORKOUT", ...base, initialExercises, availableExercises };
  }

  if (isGuidedKind(logKind)) {
    const availableExercises = await fetchGuidedExercises();
    return {
      kind: "GUIDED",
      ...base,
      initialDurationSec: log.durationSec ?? 0,
      availableExercises,
      steps: log.guidedSteps.map((step) => ({
        guidedStepId: step.guidedStepId,
        kind: step.kind,
        title: step.title,
        exerciseId: step.exerciseId,
        exerciseName: step.exercise?.name ?? null,
        durationSec: step.durationSec,
        restSec: step.restSec,
        repeatCount: step.repeatCount,
        repCount: step.repCount,
        setCount: step.setCount,
        weightLb: step.weightLb,
        sortOrder: step.sortOrder,
      })),
    };
  }

  if (isCardioKind(logKind) || isSessionKind(logKind)) {
    const isSessionLog = isSessionKind(logKind);
    const isClimbingSession =
      isSessionLog && isClimbingTemplateKey(routine.sessionDetails?.template?.key);
    const editSpotActivitySlug = isClimbingSession
      ? "climbing"
      : resolveRoutineActivitySlug(routine.metadataGroups, routine.subtype);
    const editSpotCompatibleSlugs = editSpotActivitySlug
      ? compatibleActivitySlugs(editSpotActivitySlug)
      : [];
    const editSpotIncludesClimbing = editSpotCompatibleSlugs.includes("climbing");

    const [editActivitySpotRows, editClimbCrossRows, editSavedClimbLocations] = await Promise.all([
      editSpotActivitySlug && !isClimbingSession && editSpotCompatibleSlugs.length > 0
        ? prisma.activitySpot.findMany({
            where: { activitySlug: { in: editSpotCompatibleSlugs } },
            select: { id: true, activitySlug: true, name: true, type: true, region: true, osmType: true, osmId: true, latitude: true, longitude: true },
            orderBy: [{ name: "asc" }],
          })
        : Promise.resolve([] as Array<{ id: string; activitySlug: string; name: string; type: string | null; region: string | null; osmType: string | null; osmId: string | null; latitude: number | null; longitude: number | null }>),
      editSpotIncludesClimbing && !isClimbingSession
        ? prisma.climbLocation.findMany({
            select: { id: true, name: true, type: true, region: true, osmType: true, osmId: true, latitude: true, longitude: true },
            orderBy: [{ name: "asc" }],
          })
        : Promise.resolve([] as Array<{ id: string; name: string; type: "GYM" | "CRAG"; region: string | null; osmType: string | null; osmId: string | null; latitude: number | null; longitude: number | null }>),
      isClimbingSession
        ? prisma.climbLocation.findMany({
            select: { id: true, name: true, type: true, region: true, osmType: true, osmId: true, latitude: true, longitude: true },
            orderBy: [{ type: "asc" }, { name: "asc" }],
          })
        : Promise.resolve([] as Array<{ id: string; name: string; type: "GYM" | "CRAG"; region: string | null; osmType: string | null; osmId: string | null; latitude: number | null; longitude: number | null }>),
    ]);

    const editSavedSpots = editSpotActivitySlug
      ? buildSpotPickerItems({
          ownActivitySlug: editSpotActivitySlug,
          activitySpots: editActivitySpotRows,
          climbLocations: editClimbCrossRows,
        })
      : [];

    const initialEditSpot: SpotPickerValue = log.climbLocation
      ? {
          kind: "saved",
          ref: { kind: "climbLocation", id: log.climbLocation.id },
          display: { name: log.climbLocation.name, region: log.climbLocation.region },
        }
      : log.activitySpot
        ? {
            kind: "saved",
            ref: { kind: "activitySpot", id: log.activitySpot.id },
            display: { name: log.activitySpot.name, region: log.activitySpot.region },
          }
        : log.location && log.location.trim()
          ? {
              kind: "new",
              draft: {
                source: "custom",
                name: log.location.trim(),
                type: null,
                region: null,
                latitude: null,
                longitude: null,
                osmType: null,
                osmId: null,
              },
            }
          : null;

    if (isCardioKind(logKind)) {
      return {
        kind: "CARDIO",
        ...base,
        initialDistanceMi: log.distanceMi ?? 0,
        initialElevationGainFt: log.elevationGainFt,
        initialDurationSec: log.durationSec ?? 0,
        activitySlug: editSpotActivitySlug,
        savedSpots: editSavedSpots,
        initialSpot: initialEditSpot,
      };
    }

    // SESSION
    const sessionDefinitions =
      routine.sessionDetails?.template?.metricDefinitions.map(withSessionMetricConfig) ?? [];
    const initialSessionValues = Object.fromEntries(
      log.sessionMetricValues.map((value) => [
        value.metricDefinitionId,
        {
          numberValue:
            value.numberValue !== null && value.numberValue !== undefined ? String(value.numberValue) : undefined,
          textValue: value.textValue ?? undefined,
          booleanValue: value.booleanValue ?? undefined,
        },
      ])
    );
    const currentClimbingGrades = Array.from(
      new Set(
        log.sessionMetricValues
          .map((value) => withSessionMetricConfig(value.metricDefinition).config?.gradeBucket)
          .filter((value): value is string => Boolean(value))
      )
    );

    return {
      kind: "SESSION",
      ...base,
      initialDurationSec: log.durationSec ?? 0,
      templateKey: routine.sessionDetails?.template?.key ?? null,
      templateName: routine.sessionDetails?.template?.name ?? null,
      definitions: sessionDefinitions,
      initialValues: initialSessionValues,
      preferredClimbingGrades:
        currentClimbingGrades.length > 0
          ? currentClimbingGrades
          : parsePreferredClimbingGrades(routine.sessionDetails?.templateConfig),
      activitySlug: editSpotActivitySlug,
      savedSpots: editSavedSpots,
      savedClimbLocations: editSavedClimbLocations,
      initialSpot: initialEditSpot,
    };
  }

  // COMPLETION
  return {
    kind: "COMPLETION",
    ...base,
    initialCompletionCount: log.completionCount,
  };
}

// ── Exercise library helpers (mirror the page's resilient lookups) ────

async function fetchWorkoutExercises() {
  try {
    return await prisma.exercise.findMany({
      where: exerciseLibraryWhereForKinds(workoutLibraryKinds()),
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, supportsWeight: true, libraryKind: true },
    });
  } catch (error) {
    if (!isMissingExerciseLibraryKindError(error)) throw error;
    return withDerivedExerciseLibraryKind(
      await prisma.exercise.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, unit: true, supportsWeight: true },
      })
    ).filter((exercise) => workoutLibraryKinds().includes(exercise.libraryKind));
  }
}

async function fetchGuidedExercises() {
  try {
    return orderExercisesForLibraryContext(
      await prisma.exercise.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, unit: true, supportsWeight: true, libraryKind: true },
      }),
      guidedPreferredLibraryKinds()
    );
  } catch (error) {
    if (!isMissingExerciseLibraryKindError(error)) throw error;
    return orderExercisesForLibraryContext(
      withDerivedExerciseLibraryKind(
        await prisma.exercise.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, unit: true, supportsWeight: true },
        })
      ),
      guidedPreferredLibraryKinds()
    );
  }
}
