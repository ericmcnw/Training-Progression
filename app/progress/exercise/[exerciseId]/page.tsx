import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { aggregateExerciseProgression } from "@/lib/progress";

export const dynamic = "force-dynamic";

type Params = { exerciseId: string };

export default async function ProgressExerciseDetailPage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  const exerciseId = params?.exerciseId;

  if (!exerciseId) return <div style={{ padding: 20 }}>Missing exercise id.</div>;

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { id: true, name: true, unit: true, supportsWeight: true },
  });

  if (!exercise) return <div style={{ padding: 20 }}>Exercise not found.</div>;

  const sessions = await prisma.sessionExercise.findMany({
    where: { exerciseId },
    orderBy: { routineLog: { performedAt: "asc" } },
    select: {
      id: true,
      routineLog: {
        select: {
          performedAt: true,
          routine: { select: { id: true, name: true, category: true } },
        },
      },
      sets: {
        orderBy: { setNumber: "asc" },
        select: { reps: true, seconds: true, weightLb: true },
      },
    },
  });

  const aggregated = aggregateExerciseProgression(sessions);
  const topWeight = Math.max(0, ...aggregated.sessions.map((s) => s.topWeight));
  const maxTime = Math.max(0, ...aggregated.sessions.map((s) => s.maxTimeSeconds));
  const totalReps = aggregated.sessions.reduce((sum, s) => sum + s.totalReps, 0);
  const totalVolume = aggregated.sessions.reduce((sum, s) => sum + s.totalVolume, 0);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Exercise Progress: {exercise.name}</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Unit: {exercise.unit} | Supports weight: {exercise.supportsWeight ? "Yes" : "No"}
          </div>
        </div>
        <Link href="/progress?view=progression" style={linkBtn}>
          Back to Progress
        </Link>
      </div>

      <section style={panel}>
        <div style={panelHeader}>AGGREGATED METRICS</div>
        <div style={{ padding: 12, display: "grid", gap: 6 }}>
          <div>Sessions: {aggregated.sessions.length}</div>
          <div>Top weight: {topWeight.toFixed(1)}</div>
          <div>Total reps: {totalReps}</div>
          <div>Total volume: {totalVolume.toFixed(1)}</div>
          <div>Max time: {maxTime}s</div>
        </div>
      </section>

      <section style={panel}>
        <div style={panelHeader}>ROUTINES USING THIS EXERCISE</div>
        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {aggregated.routines.length === 0 && <div style={{ opacity: 0.75 }}>No routines found.</div>}
          {aggregated.routines.map((routine) => (
            <Link key={routine.id} href={`/progress/routine/${routine.id}?view=progression`} style={cardLink}>
              {routine.name} | {routine.category}
            </Link>
          ))}
        </div>
      </section>

      <section style={panel}>
        <div style={panelHeader}>SESSIONS (CHRONOLOGICAL)</div>
        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {aggregated.sessions.length === 0 && <div style={{ opacity: 0.75 }}>No session data yet.</div>}
          {aggregated.sessions.map((session) => (
            <div key={session.sessionId} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{new Date(session.performedAt).toLocaleDateString()}</div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
                    Routine:{" "}
                    <Link href={`/progress/routine/${session.routine.id}?view=progression`} style={{ textDecoration: "underline" }}>
                      {session.routine.name}
                    </Link>
                  </div>
                </div>
                <div style={{ fontSize: 13, opacity: 0.85, textAlign: "right" }}>
                  <div>Top wt: {session.topWeight.toFixed(1)}</div>
                  <div>Total reps: {session.totalReps}</div>
                  <div>Total volume: {session.totalVolume.toFixed(1)}</div>
                  <div>Max time: {session.maxTimeSeconds}s</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const panel: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
  letterSpacing: 0.4,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.06)",
};

const cardLink: React.CSSProperties = {
  ...card,
  textDecoration: "none",
  color: "inherit",
  display: "block",
};

const linkBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.12)",
};
