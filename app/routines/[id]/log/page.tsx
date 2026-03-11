import { prisma } from "@/lib/prisma";
import LogWorkoutForm from "./ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function LogWorkoutPage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  const routineId = params?.id;

  if (!routineId) return <div style={{ padding: 20 }}>Missing routine id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: true },
      },
    },
  });

  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;

  const availableExercises = await prisma.exercise.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      unit: true,
      supportsWeight: true,
    },
  });

  const recentLogs = await prisma.routineLog.findMany({
    where: { routineId, exercises: { some: {} } },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      id: true,
      performedAt: true,
      notes: true,
      exercises: { select: { id: true, sets: { select: { id: true } } } },
    },
  });

  const initialBlocks = routine.exercises.map((re) => ({
    exerciseId: re.exerciseId,
    name: re.exercise.name,
    unit: re.exercise.unit, // REPS or TIME
    supportsWeight: re.exercise.supportsWeight,
    rows: Array.from({ length: Math.max(1, re.defaultSets ?? 3) }, (_, index) => ({
      setNumber: index + 1,
    })),
  }));

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
        {routine.name} — Log Workout
      </h1>
      <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>{routine.category}</div>

      <LogWorkoutForm
        routineId={routineId}
        initialBlocks={initialBlocks}
        availableExercises={availableExercises}
      />

      <section style={{ marginTop: 18, border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "rgba(128,128,128,0.14)", borderBottom: "1px solid rgba(128,128,128,0.25)", fontWeight: 900 }}>
          RECENT WORKOUT LOGS
        </div>
        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {recentLogs.length === 0 && <div style={{ opacity: 0.75 }}>No workout logs yet.</div>}
          {recentLogs.map((log) => {
            const setCount = log.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
            return (
              <div key={log.id} style={{ border: "1px solid rgba(128,128,128,0.28)", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", background: "rgba(128,128,128,0.06)" }}>
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 800 }}>{new Date(log.performedAt).toLocaleString()}</div>
                  <div style={{ opacity: 0.8, marginTop: 2 }}>Sets: {setCount}</div>
                  {log.notes ? <div style={{ opacity: 0.75, marginTop: 2 }}>{log.notes}</div> : null}
                </div>
                <Link href={`/routines/${routineId}/log/${log.id}`} style={{ padding: "8px 10px", border: "1px solid rgba(128,128,128,0.7)", borderRadius: 10, textDecoration: "none", color: "inherit", background: "rgba(128,128,128,0.12)", fontWeight: 800 }}>
                  Edit
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
