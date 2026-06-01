import { routineAccessWhere } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeRoutineKind, isWorkoutKind, isSessionKind, isCardioKind, isGuidedKind } from "@/lib/routines";
import {
  exerciseLibraryWhereForKinds,
  isMissingExerciseLibraryKindError,
  withDerivedExerciseLibraryKind,
  workoutLibraryKinds,
} from "@/lib/exercise-library";
import { withSessionMetricConfig, isClimbingTemplateKey } from "@/lib/session-templates";
import { SYNTHETIC_ENDURANCE_ROUTINE_ID } from "@/lib/activity-types";
import { getRoutinePainCheckZones } from "@/lib/injury-warnings";
import { getTemplateDefaultZones } from "@/lib/template-zone-defaults";
import {
  buildSpotPickerItems,
  compatibleActivitySlugs,
  getActivitySpotConfig,
  resolveRoutineActivitySlug,
} from "@/lib/activity-spots";
import type { Prisma } from "@/generated/prisma";

// TODO: accept userId from session when auth is added — add `where: { id: routineId, userId }` to each query
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: routineId } = await params;
  const where = await routineAccessWhere(routineId);

  const routine = await prisma.routine.findUnique({
    where,
    select: {
      id: true,
      name: true,
      kind: true,
      subtype: true,
      activityTypeId: true,
      metadataGroups: {
        select: { group: { select: { slug: true } } },
      },
      exercises: {
        orderBy: { sortOrder: "asc" },
        select: {
          exerciseId: true,
          defaultSets: true,
          exercise: { select: { name: true, unit: true, supportsWeight: true } },
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
          sortOrder: true,
          exercise: { select: { name: true } },
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

  if (!routine) {
    return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  }

  const kind = normalizeRoutineKind(routine.kind);

  if (isWorkoutKind(kind)) {
    const exerciseIds = routine.exercises.map((e) => e.exerciseId);
    const [availableExercises, lastExerciseEntries, activePainZones] = await Promise.all([
      fetchAvailableExercises(),
      Promise.all(
        exerciseIds.map((eid) =>
          prisma.sessionExercise.findFirst({
            where: {
              exerciseId: eid,
              sets: { some: { OR: [{ reps: { not: null } }, { seconds: { not: null } }, { weightLb: { not: null } }] } },
            },
            orderBy: { routineLog: { performedAt: "desc" } },
            select: {
              exerciseId: true,
              routineLog: { select: { performedAt: true } },
              sets: {
                orderBy: { setNumber: "asc" },
                select: { setNumber: true, reps: true, seconds: true, weightLb: true },
              },
            },
          })
        )
      ),
      getRoutinePainCheckZones(routineId),
    ]);

    const lastExerciseMap = new Map(
      lastExerciseEntries
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .map((e) => [e.exerciseId, e])
    );

    const initialBlocks = routine.exercises.map((exercise) => {
      const prev = lastExerciseMap.get(exercise.exerciseId);
      const lastRows =
        prev?.sets
          .filter((s) => s.reps !== null || s.seconds !== null || s.weightLb !== null)
          .map((s) => ({
            setNumber: s.setNumber,
            reps: s.reps !== null ? String(s.reps) : undefined,
            seconds: s.seconds !== null ? String(s.seconds) : undefined,
            weightLb: s.weightLb !== null ? String(s.weightLb) : undefined,
          })) ?? [];
      const defaultSetCount = lastRows.length > 0 ? lastRows.length : Math.max(1, exercise.defaultSets ?? 3);
      const lastDate = prev?.routineLog?.performedAt
        ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(prev.routineLog.performedAt)
        : undefined;

      return {
        exerciseId: exercise.exerciseId,
        name: exercise.exercise.name,
        unit: exercise.exercise.unit,
        supportsWeight: exercise.exercise.supportsWeight,
        rows: Array.from({ length: defaultSetCount }, (_, i) => ({ setNumber: i + 1 })),
        lastRows: lastRows.length > 0 ? lastRows : undefined,
        lastDate,
      };
    });

    return NextResponse.json({
      kind: "WORKOUT",
      routineId,
      routineName: routine.name,
      initialBlocks,
      availableExercises,
      activePainZones,
    });
  }

  if (isSessionKind(kind)) {
    const templateKey = routine.sessionDetails?.template?.key ?? null;
    const definitions =
      routine.sessionDetails?.template?.metricDefinitions.map(withSessionMetricConfig) ?? [];

    const preferredClimbingGrades = parsePreferredClimbingGrades(
      routine.sessionDetails?.templateConfig
    );

    // Climbing keeps its bespoke ClimbLocation library + picker. For
    // non-climbing sport sessions, resolve the activity slug and fetch
    // saved spots from compatible activities (cross-sport sharing — e.g.
    // climbing crags appear in trail-running pickers).
    const isClimbing = isClimbingTemplateKey(templateKey);
    const activitySlug = isClimbing
      ? null
      : resolveRoutineActivitySlug(routine.metadataGroups, routine.subtype);
    const activitySpotConfig = activitySlug ? getActivitySpotConfig(activitySlug) : null;
    const compatibleSlugs = activitySlug ? compatibleActivitySlugs(activitySlug) : [];
    const includeClimbingSpots = compatibleSlugs.includes("climbing");

    const sessionTemplateId = routine.sessionDetails?.template?.id ?? null;

    const [activePainZones, savedClimbLocations, activitySpotRows, climbingCrossRows, templateDefaultZones, allBodyZones] = await Promise.all([
      getRoutinePainCheckZones(routineId),
      isClimbing
        ? prisma.climbLocation.findMany({
            select: { id: true, name: true, type: true, region: true, latitude: true, longitude: true, osmType: true, osmId: true },
            orderBy: [{ type: "asc" }, { name: "asc" }],
          })
        : Promise.resolve([]),
      activitySlug && activitySpotConfig?.supportsMap && compatibleSlugs.length > 0
        ? prisma.activitySpot.findMany({
            where: { activitySlug: { in: compatibleSlugs } },
            select: { id: true, activitySlug: true, name: true, type: true, region: true, latitude: true, longitude: true, osmType: true, osmId: true },
            orderBy: [{ name: "asc" }],
          })
        : Promise.resolve([]),
      activitySlug && includeClimbingSpots && !isClimbing
        ? prisma.climbLocation.findMany({
            select: { id: true, name: true, type: true, region: true, latitude: true, longitude: true, osmType: true, osmId: true },
            orderBy: [{ name: "asc" }],
          })
        : Promise.resolve([]),
      sessionTemplateId ? getTemplateDefaultZones(sessionTemplateId) : Promise.resolve([]),
      sessionTemplateId
        ? prisma.bodyZone.findMany({
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            select: { slug: true, label: true },
          })
        : Promise.resolve([]),
    ]);

    const savedSpots = activitySlug
      ? buildSpotPickerItems({
          ownActivitySlug: activitySlug,
          activitySpots: activitySpotRows,
          climbLocations: climbingCrossRows,
        })
      : [];

    return NextResponse.json({
      kind: "SESSION",
      routineId,
      routineName: routine.name,
      templateKey,
      templateName: routine.sessionDetails?.template?.name ?? null,
      definitions,
      preferredClimbingGrades,
      activePainZones,
      savedClimbLocations,
      activitySlug,
      savedSpots,
      availableZones: allBodyZones.map((zone) => ({ slug: zone.slug, label: zone.label })),
      defaultZoneSlugs: templateDefaultZones.map((zone) => zone.slug),
    });
  }

  if (isCardioKind(kind)) {
    const activitySlug = resolveRoutineActivitySlug(routine.metadataGroups, routine.subtype);
    const activitySpotConfig = activitySlug ? getActivitySpotConfig(activitySlug) : null;
    const compatibleSlugs = activitySlug ? compatibleActivitySlugs(activitySlug) : [];
    const includeClimbingSpots = compatibleSlugs.includes("climbing");
    const routineIsSynthetic = routine.id === SYNTHETIC_ENDURANCE_ROUTINE_ID;

    const [activePainZones, activitySpotRows, climbingCrossRows, activityTypeRows] = await Promise.all([
      getRoutinePainCheckZones(routineId),
      activitySlug && activitySpotConfig?.supportsMap && compatibleSlugs.length > 0
        ? prisma.activitySpot.findMany({
            where: { activitySlug: { in: compatibleSlugs } },
            select: { id: true, activitySlug: true, name: true, type: true, region: true, latitude: true, longitude: true, osmType: true, osmId: true },
            orderBy: [{ name: "asc" }],
          })
        : Promise.resolve([]),
      activitySlug && includeClimbingSpots
        ? prisma.climbLocation.findMany({
            select: { id: true, name: true, type: true, region: true, latitude: true, longitude: true, osmType: true, osmId: true },
            orderBy: [{ name: "asc" }],
          })
        : Promise.resolve([]),
      // Activity types + their families. UserActivityTypePreference can
      // disable specific types; the form filters them out via the disabled
      // join below. Sort by (family.sortOrder, type.sortOrder) so the
      // dropdown reads family-by-family in the expected order.
      prisma.activityType.findMany({
        include: {
          family: { select: { id: true, name: true, sortOrder: true } },
          userPreferences: { select: { enabled: true } },
        },
        orderBy: [{ family: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      }),
    ]);

    const savedSpots = activitySlug
      ? buildSpotPickerItems({
          ownActivitySlug: activitySlug,
          activitySpots: activitySpotRows,
          climbLocations: climbingCrossRows,
        })
      : [];

    // Filter out user-disabled types (preference.enabled === false). When
    // no preference row exists, type is visible by default.
    const activityTypes = activityTypeRows
      .filter((t) => t.userPreferences[0]?.enabled !== false)
      .map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        familyId: t.familyId,
        familyName: t.family.name,
        familySortOrder: t.family.sortOrder,
        sortOrder: t.sortOrder,
        hasDistance: t.hasDistance,
        hasElevation: t.hasElevation,
        hasPace: t.hasPace,
        usesIntervals: t.usesIntervals,
      }));

    return NextResponse.json({
      kind: "CARDIO",
      routineId,
      routineName: routine.name,
      activePainZones,
      activitySlug,
      savedSpots,
      activityTypes,
      initialActivityTypeId: routine.activityTypeId ?? null,
      routineIsSynthetic,
    });
  }

  if (isGuidedKind(kind)) {
    const activePainZones = await getRoutinePainCheckZones(routineId);
    const steps = routine.guidedSteps.map((step) => ({
      id: step.id,
      kind: step.kind,
      title: step.title,
      exerciseId: step.exerciseId,
      exerciseName: step.exercise?.name ?? null,
      durationSec: step.durationSec,
      restSec: step.restSec,
      repeatCount: step.repeatCount,
      repCount: step.repCount,
      setCount: step.setCount,
      sortOrder: step.sortOrder,
    }));
    return NextResponse.json({
      kind: "GUIDED",
      routineId,
      routineName: routine.name,
      steps,
      activePainZones,
    });
  }

  return NextResponse.json({ error: "Unsupported routine kind" }, { status: 400 });
}

async function fetchAvailableExercises() {
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
    ).filter((e) => workoutLibraryKinds().includes(e.libraryKind));
  }
}

function parsePreferredClimbingGrades(value: Prisma.JsonValue | null | undefined): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).preferredClimbingGrades;
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}
