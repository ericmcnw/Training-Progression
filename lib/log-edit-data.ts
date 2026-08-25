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
import { TYPE_SLUG_TO_REGISTRY_SLUG } from "@/lib/activities/endurance-palette";
import { parsePoolSwimData, type PoolSwimData } from "@/lib/pool-swim";
import { sportSlugFromRoutineId } from "@/lib/synthetic-sport-routines";
import { getLogGearPicks } from "@/lib/gear";
import type { GearPick } from "@/lib/gear-pick-types";
import type { SpotPickerValue } from "@/lib/spot-picker-types";
import {
  climbingDisciplineForTemplateKey,
  type ClimbAttemptDraft,
  type ClimbLocationBasic,
  type ClimbingDiscipline,
} from "@/lib/climb-types";

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
  climbAttempts: Array<{ id: string }>;
}, routineKind: string): RoutineKind {
  if (log.distanceMi !== null) return "CARDIO";
  if (log.exercises.length > 0) return "WORKOUT";
  // climbAttempts is the definitive climbing-session signal: a quick climb
  // log carries no duration, no `location` string (it uses climbLocationId),
  // and no session-metric values, so without this check a durationless climb
  // falls through to COMPLETION and its attempts become uneditable.
  if (log.climbAttempts.length > 0 || log.location || log.sessionMetricValues.length > 0) return "SESSION";
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
  /** Stored perceived effort 1-10, or null if never rated. Backfillable. */
  initialEffort: number | null;
  initialExercises: Array<{
    exerciseId: string;
    name: string;
    unit: ExerciseUnitValue;
    supportsWeight: boolean;
    rows: Array<{ setNumber: number; reps?: string; seconds?: string; weightLb?: string }>;
  }>;
  availableExercises: Array<{ id: string; name: string; unit: ExerciseUnitValue; supportsWeight: boolean; libraryKind: ExerciseLibraryKind }>;
};

export type EditCardioActivityTypeOption = {
  id: string;
  slug: string;
  name: string;
  familyId: string;
  familyName: string;
  familySortOrder: number;
  sortOrder: number;
  hasElevation: boolean;
  usesIntervals: boolean;
};

export type EditCardioIntervals = {
  reps: number | null;
  workDistanceM: number | null;
  workDurationSec: number | null;
  restSec: number | null;
};

export type EditCardioData = {
  kind: "CARDIO";
  routineId: string;
  routineName: string;
  logId: string;
  initialDistanceMi: number | null;
  initialElevationGainFt: number | null;
  initialDurationSec: number | null;
  initialNotes: string;
  initialPerformedAt: Date;
  activitySlug: string | null;
  savedSpots: SpotPickerItem[];
  initialSpot: SpotPickerValue;
  // Endurance type machinery — same data the create form receives via
  // /api/routines/[id]/log-data. Surfaces the activity type picker
  // (so users can switch a Trail Run → Long Run after saving) and the
  // structured interval block for Sprint / Interval Run logs.
  availableActivityTypes: EditCardioActivityTypeOption[];
  initialActivityTypeId: string | null;
  initialIntervals: EditCardioIntervals | null;
  // Stored pool-swim payload (pool geometry + set list) off sportData.
  // null for every non-pool cardio log.
  initialPoolSwim: PoolSwimData | null;
  // Stored perceived effort 1-10, or null if never rated. The edit form
  // pre-fills the slider with this (null → slider sits at the predicted
  // guess, untouched, so historical logs can be backfilled).
  initialEffort: number | null;
  // Gear linked to this log (footwear/boards) — pre-filled into the picker.
  initialGear: GearPick[];
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
  // Per-climb attempts that were saved alongside this session. Empty for
  // legacy quick-only logs. Edit form opens in per-climb mode when this is
  // non-empty so users see the actual climbs (with names/areas/notes), not
  // a stripped-down grade-count grid.
  initialClimbAttempts: ClimbAttemptDraft[];
  // Template-derived default discipline. Used as the starting discipline
  // for the per-climb stage when the form opens in per-climb mode but
  // has no attempts to anchor on.
  climbDefaultDiscipline: ClimbingDiscipline | null;
  /** Stored perceived effort 1-10, or null if never rated. Backfillable. */
  initialEffort: number | null;
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

// Edit-time data for sport logs that go through the new sport-tile
// flow (golf scorecard, basketball/surfing/snow/etc. with extras +
// sessionType). Distinct from EditSessionData (which is climbing-
// shaped) — these sports don't have ClimbAttempts.
export type EditSportData = {
  kind: "SPORT";
  routineId: string;
  routineName: string;
  logId: string;
  /** Sport slug — pulled from the synthetic routine id. Drives which
   *  rich form to render. */
  sportSlug: string;
  initialDurationSec: number;
  initialNotes: string;
  initialPerformedAt: Date;
  /** Raw sportData JSON from the log row — parsed and re-rendered by
   *  the sport-specific edit form. */
  sportData: unknown;
  /** Existing spot link — passed through so the picker pre-fills. */
  activitySlug: string | null;
  savedSpots: SpotPickerItem[];
  initialSpot: SpotPickerValue;
  /** Stored perceived effort 1-10, or null if never rated. */
  initialEffort: number | null;
  /** Gear linked to this log (footwear/boards) — pre-fills the picker. */
  initialGear: GearPick[];
};

export type LogEditData =
  | EditWorkoutData
  | EditCardioData
  | EditGuidedData
  | EditSessionData
  | EditSportData
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
      effort: true,
      climbLocationId: true,
      activitySpotId: true,
      activityTypeId: true,
      intervalsConfig: true,
      climbLocation: {
        select: { id: true, name: true, region: true, type: true, osmType: true, osmId: true, latitude: true, longitude: true },
      },
      activitySpot: {
        select: { id: true, activitySlug: true, name: true, region: true, type: true, osmType: true, osmId: true, latitude: true, longitude: true },
      },
      // The activity type's slug lets us derive a spot library for cardio
      // logged against the synthetic Endurance routine (which has no tag).
      activityType: { select: { slug: true } },
      // Sport-specific structured payload (golf scorecard, basketball
      // mode/extras, etc.). Powers the edit-time per-sport panels.
      sportData: true,
      metrics: { select: { id: true } },
      // Lightweight presence signal for kind inference — a climbing quick
      // log with attempts but no duration must classify as SESSION, not
      // COMPLETION. Full attempt rows are fetched separately below.
      climbAttempts: { select: { id: true } },
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
    return { kind: "WORKOUT", ...base, initialEffort: log.effort ?? null, initialExercises, availableExercises };
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
    // Climbing sessions come in two shapes: template-based routines
    // (indoor-bouldering etc.) and quick logs against the synthetic
    // sports-climbing-synthetic routine, which has no session template.
    // Both need the ClimbAttempt editor.
    const isClimbingSession =
      isSessionLog &&
      (isClimbingTemplateKey(routine.sessionDetails?.template?.key) ||
        sportSlugFromRoutineId(log.routineId) === "climbing");
    let editSpotActivitySlug = isClimbingSession
      ? "climbing"
      : resolveRoutineActivitySlug(routine.metadataGroups, routine.subtype);
    // Synthetic routines (Endurance, sports-{slug}-synthetic) carry no
    // metadata tags, so resolveRoutineActivitySlug returns null and the edit
    // form couldn't show the spot picker or load saved spots — meaning you
    // couldn't add a location after the fact. Derive the spot library from
    // the log's own identity instead: cardio from its activity type, sport
    // from the synthetic routine id.
    if (!editSpotActivitySlug) {
      if (isCardioKind(logKind)) {
        editSpotActivitySlug = log.activityType?.slug
          ? TYPE_SLUG_TO_REGISTRY_SLUG[log.activityType.slug] ?? null
          : null;
      } else if (isSessionKind(logKind)) {
        editSpotActivitySlug = sportSlugFromRoutineId(log.routineId);
      }
    }
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
      // Load activity types + user preferences alongside the cardio log
      // so the edit form can offer the type picker and (when the type
      // uses intervals) the structured workout block.
      const activityTypeRows = await prisma.activityType.findMany({
        include: {
          family: { select: { name: true, sortOrder: true } },
          userPreferences: { select: { enabled: true } },
        },
        orderBy: [{ family: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      });
      const availableActivityTypes = activityTypeRows
        .filter((t) => t.userPreferences[0]?.enabled !== false)
        .map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          familyId: t.familyId,
          familyName: t.family.name,
          familySortOrder: t.family.sortOrder,
          sortOrder: t.sortOrder,
          hasElevation: t.hasElevation,
          usesIntervals: t.usesIntervals,
        }));
      // Parse the stored interval payload into the typed shape. Tolerates
      // legacy / hand-edited rows where some fields might be missing.
      const intervals = parseStoredIntervals(log.intervalsConfig);
      return {
        kind: "CARDIO",
        ...base,
        initialDistanceMi: log.distanceMi ?? null,
        initialElevationGainFt: log.elevationGainFt,
        initialDurationSec: log.durationSec ?? null,
        activitySlug: editSpotActivitySlug,
        savedSpots: editSavedSpots,
        initialSpot: initialEditSpot,
        availableActivityTypes,
        initialActivityTypeId: log.activityTypeId ?? null,
        initialIntervals: intervals,
        initialPoolSwim: parsePoolSwimData(log.sportData),
        initialEffort: log.effort ?? null,
        initialGear: await getLogGearPicks(logId),
      };
    }

    // Branch SESSION-shaped logs based on routine identity. Sport
    // synthetic routines (sports-{slug}-synthetic) — except climbing,
    // which keeps the rich ClimbAttempt editor in SessionLogForm —
    // route to the sport-specific edit form. Everything else stays on
    // EditSessionLogForm.
    if (isSessionKind(logKind)) {
      const sportSlug = sportSlugFromRoutineId(log.routineId);
      if (sportSlug && sportSlug !== "climbing") {
        // Synthetic sport routines have no metadata-group tags, so
        // resolveRoutineActivitySlug returns null. Use the routine
        // id's encoded slug instead so spot-picker compatibility
        // (saved spots, cross-activity reuse) works correctly.
        return {
          kind: "SPORT",
          ...base,
          sportSlug,
          initialDurationSec: log.durationSec ?? 0,
          sportData: log.sportData,
          activitySlug: sportSlug,
          savedSpots: editSavedSpots,
          initialSpot: initialEditSpot,
          initialEffort: log.effort ?? null,
          initialGear: await getLogGearPicks(logId),
        };
      }
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

    // Per-climb attempts saved for this log. Re-used as initial state in
    // edit's per-climb mode. The DB id doubles as the localId — fresh nanoids
    // are only needed for attempts the user adds in the editor.
    const templateKey = routine.sessionDetails?.template?.key ?? null;
    const climbAttemptRows = isClimbingSession
      ? await prisma.climbAttempt.findMany({
          where: { sessionLogId: log.id },
          orderBy: { attemptOrder: "asc" },
          select: {
            id: true,
            discipline: true,
            grade: true,
            gradeSystem: true,
            outcome: true,
            area: true,
            areaId: true,
            climbArea: { select: { name: true } },
            movesCompleted: true,
            totalMoves: true,
            triesCount: true,
            notes: true,
            attemptOrder: true,
            problemId: true,
          },
        })
      : [];
    // Template-less (synthetic) climbing logs derive the default discipline
    // from what was actually climbed; quick logs are mostly bouldering.
    const climbDefaultDiscipline = isClimbingSession
      ? templateKey
        ? climbingDisciplineForTemplateKey(templateKey)
        : climbAttemptRows[0]?.discipline ?? "BOULDER"
      : null;
    const initialClimbAttempts: ClimbAttemptDraft[] = climbAttemptRows.map((row) => ({
      localId: row.id,
      discipline: row.discipline,
      grade: row.grade,
      gradeSystem: row.gradeSystem,
      outcome: row.outcome,
      // Prefer the linked area's canonical name (so casing matches what
      // the user sees in the picker); fall back to the legacy free-text
      // for older rows that pre-date the FK.
      area: row.climbArea?.name ?? row.area,
      areaId: row.areaId,
      newAreaName: null,
      movesCompleted: row.movesCompleted ?? undefined,
      totalMoves: row.totalMoves ?? undefined,
      triesCount: row.triesCount,
      notes: row.notes ?? undefined,
      attemptOrder: row.attemptOrder,
      problemId: row.problemId,
      newProblemName: null,
    }));

    return {
      kind: "SESSION",
      ...base,
      initialDurationSec: log.durationSec ?? 0,
      templateKey,
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
      initialClimbAttempts,
      climbDefaultDiscipline,
      initialEffort: log.effort ?? null,
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

// Parse RoutineLog.intervalsConfig (Prisma Json) into the typed shape
// the edit form expects. Mirrors the helper in log-summary.ts but
// returns the edit-flavored shape (no separate flatten). Returns null
// when the field is missing or empty so the form skips the structure.
function parseStoredIntervals(raw: unknown): EditCardioIntervals | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const out: EditCardioIntervals = {
    reps: num(obj.reps),
    workDistanceM: num(obj.workDistanceM),
    workDurationSec: num(obj.workDurationSec),
    restSec: num(obj.restSec),
  };
  if (
    out.reps === null &&
    out.workDistanceM === null &&
    out.workDurationSec === null &&
    out.restSec === null
  ) {
    return null;
  }
  return out;
}
