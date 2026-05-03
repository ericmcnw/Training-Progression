import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeRoutineKind, isWorkoutKind, isSessionKind } from "@/lib/routines";
import {
  exerciseLibraryWhereForKinds,
  isMissingExerciseLibraryKindError,
  withDerivedExerciseLibraryKind,
  workoutLibraryKinds,
} from "@/lib/exercise-library";
import { withSessionMetricConfig } from "@/lib/session-templates";
import { getRoutinePainCheckZones } from "@/lib/injury-warnings";
import type { Prisma } from "@/generated/prisma";

// TODO: accept userId from session when auth is added — add `where: { id: routineId, userId }` to each query
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: routineId } = await params;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      id: true,
      name: true,
      kind: true,
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

  if (!routine) {
    return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  }

  const kind = normalizeRoutineKind(routine.kind);

  if (isWorkoutKind(kind)) {
    const [availableExercises, lastWorkoutLog, activePainZones] = await Promise.all([
      fetchAvailableExercises(),
      prisma.routineLog.findFirst({
        where: { routineId, exercises: { some: {} } },
        orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
        select: {
          performedAt: true,
          exercises: {
            orderBy: { createdAt: "asc" },
            select: {
              exerciseId: true,
              sets: {
                orderBy: { setNumber: "asc" },
                select: { setNumber: true, reps: true, seconds: true, weightLb: true },
              },
            },
          },
        },
      }),
      getRoutinePainCheckZones(routineId),
    ]);

    const lastWorkoutExerciseMap = new Map(
      (lastWorkoutLog?.exercises ?? []).map((e) => [e.exerciseId, e])
    );

    const initialBlocks = routine.exercises.map((exercise) => {
      const prev = lastWorkoutExerciseMap.get(exercise.exerciseId);
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

      return {
        exerciseId: exercise.exerciseId,
        name: exercise.exercise.name,
        unit: exercise.exercise.unit,
        supportsWeight: exercise.exercise.supportsWeight,
        rows: Array.from({ length: defaultSetCount }, (_, i) => ({ setNumber: i + 1 })),
        lastRows: lastRows.length > 0 ? lastRows : undefined,
      };
    });

    const smartDefaultLabel = lastWorkoutLog?.performedAt
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(lastWorkoutLog.performedAt)
      : null;

    return NextResponse.json({
      kind: "WORKOUT",
      routineId,
      routineName: routine.name,
      initialBlocks,
      availableExercises,
      smartDefaultLabel,
      activePainZones,
    });
  }

  if (isSessionKind(kind)) {
    const activePainZones = await getRoutinePainCheckZones(routineId);
    const definitions =
      routine.sessionDetails?.template?.metricDefinitions.map(withSessionMetricConfig) ?? [];

    const preferredClimbingGrades = parsePreferredClimbingGrades(
      routine.sessionDetails?.templateConfig
    );

    return NextResponse.json({
      kind: "SESSION",
      routineId,
      routineName: routine.name,
      templateKey: routine.sessionDetails?.template?.key ?? null,
      templateName: routine.sessionDetails?.template?.name ?? null,
      definitions,
      preferredClimbingGrades,
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
