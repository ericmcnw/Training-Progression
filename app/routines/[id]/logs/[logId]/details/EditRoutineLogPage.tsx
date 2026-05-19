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
import type { RoutineKind } from "@/generated/prisma";
import type { Prisma } from "@/generated/prisma";
import { withSessionMetricConfig } from "@/lib/session-templates";
import EditWorkoutLogForm from "../../../log/[logId]/EditWorkoutLogForm";
import EditRunLogForm from "../../../log-cardio/[logId]/EditRunLogForm";
import EditGuidedLogForm from "../../../log-guided/[logId]/EditGuidedLogForm";
import EditSessionLogForm from "../../../log-session/[logId]/EditSessionLogForm";
import EditCompletionLogForm from "../../../log-check/[logId]/EditCompletionLogForm";
import {
  buildSpotPickerItems,
  compatibleActivitySlugs,
  resolveRoutineActivitySlug,
} from "@/lib/activity-spots";
import { isClimbingTemplateKey } from "@/lib/session-templates";

export const dynamic = "force-dynamic";

type Params = { id: string; logId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function preferredClimbingGrades(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).preferredClimbingGrades;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

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

export default async function EditRoutineLogPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const routineId = params?.id;
  const logId = params?.logId;
  const returnToRaw = String(getParam(searchParams, "returnTo") || "").trim();
  const defaultReturnTo = `/routines/${routineId}/log`;
  const returnTo = returnToRaw.startsWith("/") ? returnToRaw : defaultReturnTo;
  if (!routineId || !logId) return <div style={{ padding: 20 }}>Missing routine/log id.</div>;

  const [routine, log] = await Promise.all([
    prisma.routine.findUnique({
      where: { id: routineId },
      select: {
        id: true,
        name: true,
        kind: true,
        subtype: true,
        metadataGroups: {
          select: { group: { select: { slug: true } } },
        },
        exercises: {
          orderBy: { sortOrder: "asc" },
          select: {
            exerciseId: true,
            defaultSets: true,
            exercise: {
              select: {
                name: true,
                unit: true,
                supportsWeight: true,
              },
            },
          },
        },
        sessionDetails: {
          select: {
            templateConfig: true,
            template: {
              include: {
                metricDefinitions: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    }),
    prisma.routineLog.findUnique({
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
          include: {
            metricDefinition: true,
          },
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
    }),
  ]);

  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  if (!log || log.routineId !== routineId) return <div style={{ padding: 20 }}>Log not found for this routine.</div>;

  const logKind = inferLogKind(log, routine.kind);

  const availableExercises = isWorkoutKind(logKind)
    ? await (async () => {
        try {
          return await prisma.exercise.findMany({
            where: exerciseLibraryWhereForKinds(workoutLibraryKinds()),
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              unit: true,
              supportsWeight: true,
              libraryKind: true,
            },
          });
        } catch (error) {
          if (!isMissingExerciseLibraryKindError(error)) throw error;
          return withDerivedExerciseLibraryKind(
            await prisma.exercise.findMany({
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                unit: true,
                supportsWeight: true,
              },
            })
          ).filter((exercise) => workoutLibraryKinds().includes(exercise.libraryKind));
        }
      })()
    : [];
  const availableGuidedExercises = isGuidedKind(logKind)
    ? await (async () => {
        try {
          return orderExercisesForLibraryContext(
            await prisma.exercise.findMany({
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                unit: true,
                supportsWeight: true,
                libraryKind: true,
              },
            }),
            guidedPreferredLibraryKinds()
          );
        } catch (error) {
          if (!isMissingExerciseLibraryKindError(error)) throw error;
          return orderExercisesForLibraryContext(
            withDerivedExerciseLibraryKind(
              await prisma.exercise.findMany({
                orderBy: { name: "asc" },
                select: {
                  id: true,
                  name: true,
                  unit: true,
                  supportsWeight: true,
                },
              })
            ),
            guidedPreferredLibraryKinds()
          );
        }
      })()
    : [];

  const initialExercises = isWorkoutKind(logKind)
    ? [
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
      ]
    : [];

  const sessionDefinitions = routine.sessionDetails?.template?.metricDefinitions.map(withSessionMetricConfig) ?? [];
  const initialSessionValues = Object.fromEntries(
    log.sessionMetricValues.map((value) => [
      value.metricDefinitionId,
      {
        numberValue: value.numberValue !== null && value.numberValue !== undefined ? String(value.numberValue) : undefined,
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

  // ── Spot context for the SpotPicker in session + cardio edit forms ─────
  // Resolves the routine's activity slug, then pulls saved spots from the
  // compatible activity tables so the picker can offer them as quick picks.
  // Cardio + session share the same data shape — only climbing has a
  // template-driven slug override.
  const isSessionLog = isSessionKind(logKind);
  const isCardioLog = isCardioKind(logKind);
  const needsSpotContext = isSessionLog || isCardioLog;
  const isClimbingSession = isSessionLog && isClimbingTemplateKey(routine.sessionDetails?.template?.key);
  const editSpotActivitySlug = needsSpotContext
    ? isClimbingSession
      ? "climbing"
      : resolveRoutineActivitySlug(routine.metadataGroups, routine.subtype)
    : null;
  const editSpotCompatibleSlugs = editSpotActivitySlug ? compatibleActivitySlugs(editSpotActivitySlug) : [];
  const editSpotIncludesClimbing = editSpotCompatibleSlugs.includes("climbing");

  const [editActivitySpotRows, editClimbCrossRows, editSavedClimbLocations] = needsSpotContext
    ? await Promise.all([
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
      ])
    : [[], [], []];

  const editSavedSpots = editSpotActivitySlug
    ? buildSpotPickerItems({
        ownActivitySlug: editSpotActivitySlug,
        activitySpots: editActivitySpotRows,
        climbLocations: editClimbCrossRows,
      })
    : [];

  // Initial spot value for the picker — derived from the log's structured
  // FKs. Falls back to a custom-text seed if only the legacy free-text
  // location exists (lets the user upgrade it to a structured spot).
  const initialEditSpot =
    log.climbLocation
      ? {
          kind: "saved" as const,
          ref: { kind: "climbLocation" as const, id: log.climbLocation.id },
          display: { name: log.climbLocation.name, region: log.climbLocation.region },
        }
      : log.activitySpot
        ? {
            kind: "saved" as const,
            ref: { kind: "activitySpot" as const, id: log.activitySpot.id },
            display: { name: log.activitySpot.name, region: log.activitySpot.region },
          }
        : log.location && log.location.trim()
          ? {
              kind: "new" as const,
              draft: {
                source: "custom" as const,
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

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>
        {routine.name} - Edit {isWorkoutKind(logKind) ? "Workout" : isCardioKind(logKind) ? "Cardio" : isGuidedKind(logKind) ? "Guided" : isSessionKind(logKind) ? "Session" : "Completion"} Log
      </h1>
      <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{routine.name}</div>
      <div style={{ marginTop: 16, border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "rgba(128,128,128,0.14)", borderBottom: "1px solid rgba(128,128,128,0.25)", fontWeight: 900 }}>
          {isWorkoutKind(logKind) ? "WORKOUT LOG" : isCardioKind(logKind) ? "CARDIO LOG" : isGuidedKind(logKind) ? "GUIDED LOG" : isSessionKind(logKind) ? "SESSION LOG" : "COMPLETION LOG"}
        </div>
        <div style={{ padding: 14 }}>
          {isWorkoutKind(logKind) ? (
            <EditWorkoutLogForm
              routineId={routineId}
              logId={log.id}
              returnTo={returnTo}
              initialNotes={log.notes ?? ""}
              initialPerformedAt={log.performedAt}
              initialExercises={initialExercises}
              availableExercises={availableExercises}
            />
          ) : isCardioKind(logKind) ? (
            <EditRunLogForm
              routineId={routineId}
              logId={log.id}
              returnTo={returnTo}
              initialDistanceMi={log.distanceMi ?? 0}
              initialElevationGainFt={log.elevationGainFt}
              initialDurationSec={log.durationSec ?? 0}
              initialNotes={log.notes ?? ""}
              initialPerformedAt={log.performedAt}
              activitySlug={editSpotActivitySlug}
              savedSpots={editSavedSpots}
              initialSpot={initialEditSpot}
            />
          ) : isGuidedKind(logKind) ? (
            <EditGuidedLogForm
              routineId={routineId}
              logId={log.id}
              returnTo={returnTo}
              initialDurationSec={log.durationSec ?? 0}
              initialNotes={log.notes ?? ""}
              initialPerformedAt={log.performedAt}
              availableExercises={availableGuidedExercises}
              steps={log.guidedSteps.map((step) => ({
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
              }))}
            />
          ) : isSessionKind(logKind) ? (
            <EditSessionLogForm
              routineId={routineId}
              logId={log.id}
              returnTo={returnTo}
              initialDurationSec={log.durationSec ?? 0}
              initialNotes={log.notes ?? ""}
              initialPerformedAt={log.performedAt}
              templateKey={routine.sessionDetails?.template?.key ?? null}
              templateName={routine.sessionDetails?.template?.name ?? null}
              definitions={sessionDefinitions}
              initialValues={initialSessionValues}
              preferredClimbingGrades={currentClimbingGrades.length > 0 ? currentClimbingGrades : preferredClimbingGrades(routine.sessionDetails?.templateConfig)}
              activitySlug={editSpotActivitySlug}
              savedSpots={editSavedSpots}
              savedClimbLocations={editSavedClimbLocations}
              initialSpot={initialEditSpot}
            />
          ) : (
            <EditCompletionLogForm
              routineId={routineId}
              logId={log.id}
              returnTo={returnTo}
              initialCompletionCount={log.completionCount}
              initialNotes={log.notes ?? ""}
              initialPerformedAt={log.performedAt}
            />
          )}
        </div>
      </div>
    </div>
  );
}
