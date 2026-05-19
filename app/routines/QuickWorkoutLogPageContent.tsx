import Link from "next/link";
import {
  exerciseLibraryWhereForKinds,
  isMissingExerciseLibraryKindError,
  withDerivedExerciseLibraryKind,
  workoutLibraryKinds,
} from "@/lib/exercise-library";
import { prisma } from "@/lib/prisma";
import QuickWorkoutLogForm from "./log-workout-quick/QuickWorkoutLogForm";
import {
  QUICK_WORKOUT_DOMAIN_OPTIONS,
  QUICK_WORKOUT_SUBTYPE_OPTIONS,
  DEFAULT_QUICK_WORKOUT_DOMAIN,
  DEFAULT_QUICK_WORKOUT_SUBTYPE,
} from "@/lib/quick-log";

export const dynamic = "force-dynamic";

export default async function QuickWorkoutLogPage() {
  // Pre-fill seed: most-recent quick-workout log (any placeholder routine).
  // Lets us pre-suggest the user's last (domain, subtype) and pre-populate
  // the exercise editor with their last set/rep numbers as faded "previous"
  // hints — same UX as logging a real routine.
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

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Quick Workout Log</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            One-off workout that doesn&apos;t belong to a saved routine. Pick a Training Balance category so it lands in the right bar, then add what you did.
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
        <QuickWorkoutLogForm
          availableExercises={availableExercises}
          initialBlocks={initialBlocks}
          initialDomain={initialDomain}
          initialSubtype={initialSubtype}
          domainOptions={QUICK_WORKOUT_DOMAIN_OPTIONS}
          subtypeOptions={QUICK_WORKOUT_SUBTYPE_OPTIONS}
        />
      </div>
    </div>
  );
}
