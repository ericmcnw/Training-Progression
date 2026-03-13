import Link from "next/link";
import { formatAppDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { isCardioKind, isCompletionKind, isGuidedKind, isSessionKind, isWorkoutKind } from "@/lib/routines";

export const dynamic = "force-dynamic";

type Params = { id: string; logId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatSeconds(value: number | null | undefined) {
  if (!value || value <= 0) return "0s";
  const total = Math.floor(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatMetricValue(value: number, unit?: string | null) {
  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  return unit ? `${normalized} ${unit}` : normalized;
}

function getEditHref(routineId: string, logId: string, kind: string, returnTo: string) {
  const encoded = encodeURIComponent(returnTo);
  if (isWorkoutKind(kind)) return `/routines/${routineId}/log/${logId}?returnTo=${encoded}`;
  if (isCardioKind(kind)) return `/routines/${routineId}/log-cardio/${logId}?returnTo=${encoded}`;
  if (isGuidedKind(kind)) return `/routines/${routineId}/log-guided/${logId}?returnTo=${encoded}`;
  if (isSessionKind(kind)) return `/routines/${routineId}/log-session/${logId}?returnTo=${encoded}`;
  return `/routines/${routineId}/log-check/${logId}?returnTo=${encoded}`;
}

export default async function RoutineLogDetailPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const routineId = params?.id;
  const logId = params?.logId;
  const returnToRaw = String(getParam(searchParams, "returnTo") || "").trim();
  const returnTo = returnToRaw.startsWith("/") ? returnToRaw : "/schedule";

  if (!routineId || !logId) return <div style={{ padding: 20 }}>Missing routine/log id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { id: true, name: true, category: true, kind: true },
  });
  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;

  const log = await prisma.routineLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      notes: true,
      completionCount: true,
      distanceMi: true,
      durationSec: true,
      location: true,
      metrics: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, value: true, unit: true },
      },
      guidedSteps: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, durationSec: true, restSec: true },
      },
      exercises: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          exercise: {
            select: { name: true, unit: true, supportsWeight: true },
          },
          sets: {
            orderBy: { setNumber: "asc" },
            select: { id: true, setNumber: true, reps: true, seconds: true, weightLb: true },
          },
        },
      },
    },
  });
  if (!log || log.routineId !== routineId) return <div style={{ padding: 20 }}>Log not found for this routine.</div>;

  const editHref = getEditHref(routineId, logId, routine.kind, returnTo);

  return (
    <div style={container}>
      <div style={topRow}>
        <div>
          <h1 style={title}>{routine.name} Log</h1>
          <div style={subText}>
            {routine.category} | {formatAppDateTime(log.performedAt)}
          </div>
        </div>
        <div style={actionRow}>
          <Link href={returnTo} style={linkBtn}>
            Back
          </Link>
          <Link href={editHref} style={editBtn}>
            Edit Log
          </Link>
        </div>
      </div>

      <section style={panel}>
        <div style={panelHeader}>SUMMARY</div>
        <div style={summaryGrid}>
          {isCompletionKind(routine.kind) && (
            <div style={statCard}>
              <div style={statLabel}>Count</div>
              <div style={statValue}>{log.completionCount ?? 1}</div>
            </div>
          )}
          {isCardioKind(routine.kind) && (
            <>
              <div style={statCard}>
                <div style={statLabel}>Distance</div>
                <div style={statValue}>{(log.distanceMi ?? 0).toFixed(2)} mi</div>
              </div>
              <div style={statCard}>
                <div style={statLabel}>Duration</div>
                <div style={statValue}>{formatSeconds(log.durationSec)}</div>
              </div>
            </>
          )}
          {isGuidedKind(routine.kind) && (
            <>
              <div style={statCard}>
                <div style={statLabel}>Duration</div>
                <div style={statValue}>{formatSeconds(log.durationSec)}</div>
              </div>
              <div style={statCard}>
                <div style={statLabel}>Steps</div>
                <div style={statValue}>{log.guidedSteps.length}</div>
              </div>
            </>
          )}
          {isSessionKind(routine.kind) && (
            <>
              <div style={statCard}>
                <div style={statLabel}>Duration</div>
                <div style={statValue}>{formatSeconds(log.durationSec)}</div>
              </div>
              <div style={statCard}>
                <div style={statLabel}>Location</div>
                <div style={statValue}>{log.location || "Not set"}</div>
              </div>
            </>
          )}
          {isWorkoutKind(routine.kind) && (
            <>
              <div style={statCard}>
                <div style={statLabel}>Exercises</div>
                <div style={statValue}>{log.exercises.length}</div>
              </div>
              <div style={statCard}>
                <div style={statLabel}>Sets</div>
                <div style={statValue}>{log.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)}</div>
              </div>
            </>
          )}
        </div>
      </section>

      {isWorkoutKind(routine.kind) && (
        <section style={panel}>
          <div style={panelHeader}>EXERCISES</div>
          <div style={contentPad}>
            <div style={{ display: "grid", gap: 10 }}>
              {log.exercises.map((exercise) => (
                <div key={exercise.id} style={itemCard}>
                  <div style={{ fontWeight: 900 }}>{exercise.exercise.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                    {exercise.exercise.unit} | Weight: {exercise.exercise.supportsWeight ? "Yes" : "No"}
                  </div>
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {exercise.sets.map((set) => (
                      <div key={set.id} style={setRow}>
                        <div style={{ fontWeight: 700 }}>Set {set.setNumber}</div>
                        <div style={{ fontSize: 12, opacity: 0.82 }}>
                          {exercise.exercise.unit === "TIME"
                            ? `${formatSeconds(set.seconds)}`
                            : `${set.reps ?? 0} reps`}
                          {set.weightLb !== null ? ` | ${set.weightLb} lb` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isGuidedKind(routine.kind) && (
        <section style={panel}>
          <div style={panelHeader}>GUIDED STEPS</div>
          <div style={contentPad}>
            <div style={{ display: "grid", gap: 8 }}>
              {log.guidedSteps.map((step, index) => (
                <div key={step.id} style={itemCard}>
                  <div style={{ fontWeight: 900 }}>{index + 1}. {step.title}</div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.82 }}>
                    Work: {formatSeconds(step.durationSec)} | Rest: {formatSeconds(step.restSec)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isSessionKind(routine.kind) && log.metrics.length > 0 && (
        <section style={panel}>
          <div style={panelHeader}>METRICS</div>
          <div style={contentPad}>
            <div style={{ display: "grid", gap: 8 }}>
              {log.metrics.map((metric) => (
                <div key={metric.id} style={itemCard}>
                  <div style={{ fontWeight: 900 }}>{metric.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.82 }}>{formatMetricValue(metric.value, metric.unit)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {log.notes ? (
        <section style={panel}>
          <div style={panelHeader}>NOTES</div>
          <div style={contentPad}>
            <div style={itemCard}>{log.notes}</div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const container: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 16,
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  flexWrap: "wrap",
};

const title: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  margin: 0,
};

const subText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  opacity: 0.78,
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const panel: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 0.3,
};

const contentPad: React.CSSProperties = {
  padding: 14,
};

const summaryGrid: React.CSSProperties = {
  padding: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const statCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 10,
  padding: 12,
  background: "rgba(128,128,128,0.05)",
};

const statLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.72,
  textTransform: "uppercase",
};

const statValue: React.CSSProperties = {
  marginTop: 6,
  fontSize: 18,
  fontWeight: 900,
};

const itemCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 10,
  padding: 10,
  background: "rgba(128,128,128,0.05)",
};

const setRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  paddingTop: 6,
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

const editBtn: React.CSSProperties = {
  ...linkBtn,
  border: "1px solid rgba(84,203,130,0.8)",
  background: "rgba(84,203,130,0.16)",
};
