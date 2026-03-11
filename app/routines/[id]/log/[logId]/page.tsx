import { prisma } from "@/lib/prisma";
import EditWorkoutLogForm from "./EditWorkoutLogForm";

export const dynamic = "force-dynamic";

type Params = { id: string; logId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function EditWorkoutLogPage(props: {
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

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      id: true,
      name: true,
      category: true,
      kind: true,
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
    },
  });
  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  if (routine.kind !== "WORKOUT") return <div style={{ padding: 20 }}>This routine is not a workout routine.</div>;

  const log = await prisma.routineLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      notes: true,
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
  if (!log || log.routineId !== routineId) return <div style={{ padding: 20 }}>Log not found for this routine.</div>;

  const availableExercises = await prisma.exercise.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      unit: true,
      supportsWeight: true,
    },
  });

  const logExerciseMap = new Map(
    log.exercises.map((sessionExercise) => [
      sessionExercise.exerciseId,
      {
        name: sessionExercise.exercise.name,
        unit: sessionExercise.exercise.unit,
        supportsWeight: sessionExercise.exercise.supportsWeight,
        rows:
          sessionExercise.sets.length > 0
            ? sessionExercise.sets.map((set) => ({
                setNumber: set.setNumber,
                reps: set.reps === null ? "" : String(set.reps),
                seconds: set.seconds === null ? "" : String(set.seconds),
                weightLb: set.weightLb === null ? "" : String(set.weightLb),
              }))
            : [{ setNumber: 1 }],
      },
    ])
  );

  const initialExercises = [
    ...routine.exercises.map((routineExercise) => {
      const fromLog = logExerciseMap.get(routineExercise.exerciseId);
      return {
        exerciseId: routineExercise.exerciseId,
        name: routineExercise.exercise.name,
        unit: routineExercise.exercise.unit,
        supportsWeight: routineExercise.exercise.supportsWeight,
        rows:
          fromLog?.rows
            ?? Array.from({ length: Math.max(1, routineExercise.defaultSets ?? 3) }, (_, index) => ({
              setNumber: index + 1,
            })),
      };
    }),
    ...log.exercises
      .filter((sessionExercise) => !routine.exercises.some((item) => item.exerciseId === sessionExercise.exerciseId))
      .map((sessionExercise) => ({
        exerciseId: sessionExercise.exerciseId,
        name: sessionExercise.exercise.name,
        unit: sessionExercise.exercise.unit,
        supportsWeight: sessionExercise.exercise.supportsWeight,
        rows:
          sessionExercise.sets.length > 0
            ? sessionExercise.sets.map((set) => ({
                setNumber: set.setNumber,
                reps: set.reps === null ? "" : String(set.reps),
                seconds: set.seconds === null ? "" : String(set.seconds),
                weightLb: set.weightLb === null ? "" : String(set.weightLb),
              }))
            : [{ setNumber: 1 }],
      })),
  ];

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{routine.name} - Edit Workout Log</h1>
      <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{routine.category}</div>
      <div style={{ marginTop: 16, border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "rgba(128,128,128,0.14)", borderBottom: "1px solid rgba(128,128,128,0.25)", fontWeight: 900 }}>
          WORKOUT LOG
        </div>
        <div style={{ padding: 14 }}>
          <EditWorkoutLogForm
            routineId={routineId}
            logId={log.id}
            returnTo={returnTo}
            initialNotes={log.notes ?? ""}
            initialPerformedAt={log.performedAt}
            initialExercises={initialExercises}
            availableExercises={availableExercises}
          />
        </div>
      </div>
    </div>
  );
}
