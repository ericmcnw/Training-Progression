import Link from "next/link";
import {
  exerciseLibraryWhereForKinds,
  isMissingExerciseLibraryKindError,
  withDerivedExerciseLibraryKind,
  workoutLibraryKinds,
} from "@/lib/exercise-library";
import { prisma } from "@/lib/prisma";
import QuickWorkoutLogForm from "./log-workout-quick/QuickWorkoutLogForm";

export const dynamic = "force-dynamic";

const QUICK_WORKOUT_DOMAIN = "quick-workout-log";

async function ensureQuickWorkoutRoutine() {
  const existing = await prisma.routine.findFirst({
    where: {
      domain: QUICK_WORKOUT_DOMAIN,
      isDeleted: false,
      kind: "WORKOUT",
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      name: true,
    },
  });

  if (existing) return existing;

  return prisma.routine.create({
    data: {
      name: "Quick Workout Log",
      domain: QUICK_WORKOUT_DOMAIN,
      kind: "WORKOUT",
      subtype: "OTHER",
      isActive: false,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
    },
  });
}

export default async function QuickWorkoutLogPage() {
  const selectedRoutine = await ensureQuickWorkoutRoutine();
  const [availableExercises, lastWorkoutLog] = await Promise.all([
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
      where: { routineId: selectedRoutine.id, exercises: { some: {} } },
      orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
      select: {
        performedAt: true,
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
    lastWorkoutLog?.exercises
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

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Quick Workout Log</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Start a blank workout log and add whatever exercises you want. This quick log does not change any saved template.
          </div>
        </div>
        <Link
          href="/routines"
          style={{
            padding: "8px 12px",
            border: "1px solid rgba(128,128,128,0.8)",
            borderRadius: 10,
            textDecoration: "none",
            color: "inherit",
            fontWeight: 800,
            background: "rgba(128,128,128,0.12)",
          }}
        >
          Back
        </Link>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Blank Workout</div>
        <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
          One-off workout entry
        </div>
        <QuickWorkoutLogForm
          routineId={selectedRoutine.id}
          availableExercises={availableExercises}
          initialBlocks={initialBlocks}
        />
      </div>
    </div>
  );
}
