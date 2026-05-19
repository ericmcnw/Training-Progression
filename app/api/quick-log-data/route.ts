import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exerciseLibraryWhereForKinds,
  isMissingExerciseLibraryKindError,
  withDerivedExerciseLibraryKind,
  workoutLibraryKinds,
} from "@/lib/exercise-library";
import {
  QUICK_WORKOUT_DOMAIN_OPTIONS,
  QUICK_WORKOUT_SUBTYPE_OPTIONS,
  DEFAULT_QUICK_WORKOUT_DOMAIN,
  DEFAULT_QUICK_WORKOUT_SUBTYPE,
} from "@/lib/quick-log";

// Fetched by LogDrawer when activeRoutineId === "quick-log". Mirrors the
// server-side prep that used to live in QuickWorkoutLogPageContent: workout
// exercise library + a seed pulled from the user's most recent quick-log so
// the form opens with their previous (domain, subtype, set/rep numbers).
export async function GET() {
  const [availableExercises, lastQuickLog] = await Promise.all([
    (async () => {
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
    })(),
    prisma.routineLog.findFirst({
      where: {
        routine: { isPlaceholder: true, kind: "WORKOUT" },
        exercises: { some: {} },
      },
      orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
      select: {
        performedAt: true,
        routine: { select: { domain: true, subtype: true } },
        exercises: {
          orderBy: { createdAt: "asc" },
          select: {
            exerciseId: true,
            exercise: {
              select: {
                name: true,
                unit: true,
                supportsWeight: true,
              },
            },
            sets: {
              orderBy: { setNumber: "asc" },
              select: {
                setNumber: true,
                reps: true,
                seconds: true,
                weightLb: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const initialBlocks =
    lastQuickLog?.exercises
      .map((exercise) => {
        const rows = exercise.sets
          .filter((set) => set.reps !== null || set.seconds !== null || set.weightLb !== null)
          .map((set) => ({
            setNumber: set.setNumber,
            reps: set.reps !== null ? String(set.reps) : undefined,
            seconds: set.seconds !== null ? String(set.seconds) : undefined,
            weightLb: set.weightLb !== null ? String(set.weightLb) : undefined,
          }));
        return {
          exerciseId: exercise.exerciseId,
          name: exercise.exercise.name,
          unit: exercise.exercise.unit,
          supportsWeight: exercise.exercise.supportsWeight,
          rows: rows.length > 0 ? rows : [{ setNumber: 1 }],
        };
      })
      .filter((exercise) => exercise.rows.length > 0) ?? [];

  const lastDomain = lastQuickLog?.routine?.domain;
  const lastSubtype = lastQuickLog?.routine?.subtype;
  const initialDomain =
    QUICK_WORKOUT_DOMAIN_OPTIONS.find((opt) => opt.value === lastDomain)?.value ?? DEFAULT_QUICK_WORKOUT_DOMAIN;
  const initialSubtype =
    QUICK_WORKOUT_SUBTYPE_OPTIONS.find((opt) => opt.value === lastSubtype)?.value ?? DEFAULT_QUICK_WORKOUT_SUBTYPE;

  return NextResponse.json({
    kind: "QUICK" as const,
    availableExercises,
    initialBlocks,
    initialDomain,
    initialSubtype,
    domainOptions: QUICK_WORKOUT_DOMAIN_OPTIONS,
    subtypeOptions: QUICK_WORKOUT_SUBTYPE_OPTIONS,
  });
}
