import Link from "next/link";
import { formatAppDateTime } from "@/lib/dates";
import { exerciseUnitLabel } from "@/lib/exercises";
import { formatGuidedRepSetSummary, formatGuidedSeconds, formatGuidedStepLabel } from "@/lib/guided";
import { prisma } from "@/lib/prisma";
import { isCardioKind, isCompletionKind, isGuidedKind, isSessionKind, isWorkoutKind } from "@/lib/routines";
import type { RoutineKind } from "@/generated/prisma";
import { climbOutcomeColor, climbOutcomeBg, climbOutcomeLabel } from "@/lib/climb-types";
import type { ClimbOutcome, ClimbGradeSystem } from "@/lib/climb-types";

export const dynamic = "force-dynamic";

type Params = { id: string; logId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

const formatSeconds = formatGuidedSeconds;

function formatMetricValue(value: number, unit?: string | null) {
  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  return unit ? `${normalized} ${unit}` : normalized;
}

function getEditHref(routineId: string, logId: string, kind: string, returnTo: string) {
  const encoded = encodeURIComponent(returnTo);
  return `/routines/${routineId}/logs/${logId}/edit?returnTo=${encoded}`;
}

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
  if (log.climbAttempts.length > 0 || log.location || log.sessionMetricValues.length > 0) return "SESSION";
  if (log.durationSec !== null && log.guidedSteps.length > 0) return isSessionKind(routineKind) ? "SESSION" : "GUIDED";
  if (log.durationSec !== null && isSessionKind(routineKind)) return "SESSION";
  if (log.guidedSteps.length > 0) return isSessionKind(routineKind) ? "SESSION" : "GUIDED";
  return "COMPLETION";
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
    select: { id: true, name: true, kind: true },
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
      elevationGainFt: true,
      durationSec: true,
      location: true,
      metrics: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, value: true, unit: true },
      },
      sessionMetricValues: {
        select: { id: true },
      },
      climbAttempts: {
        orderBy: { attemptOrder: "asc" },
        select: {
          id: true,
          grade: true,
          gradeSystem: true,
          outcome: true,
          movesCompleted: true,
          totalMoves: true,
          notes: true,
          problem: { select: { id: true, name: true } },
        },
      },
      guidedSteps: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, kind: true, title: true, exerciseId: true, durationSec: true, restSec: true, repeatCount: true, repCount: true, setCount: true, weightLb: true, exercise: { select: { name: true } } },
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

  const logKind = inferLogKind(log, routine.kind);
  const editHref = getEditHref(routineId, logId, logKind, returnTo);

  return (
    <div style={container}>
      <div style={topRow}>
        <div>
          <h1 style={title}>{routine.name} Log</h1>
          <div style={subText}>
            {formatAppDateTime(log.performedAt)}
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
          {isCompletionKind(logKind) && (
            <div style={statCard}>
              <div style={statLabel}>Count</div>
              <div style={statValue}>{log.completionCount ?? 1}</div>
            </div>
          )}
          {isCardioKind(logKind) && (
            <>
              <div style={statCard}>
                <div style={statLabel}>Distance</div>
                <div style={statValue}>{(log.distanceMi ?? 0).toFixed(2)} mi</div>
              </div>
              <div style={statCard}>
                <div style={statLabel}>Duration</div>
                <div style={statValue}>{formatSeconds(log.durationSec)}</div>
              </div>
              <div style={statCard}>
                <div style={statLabel}>Elevation</div>
                <div style={statValue}>{log.elevationGainFt ? `${log.elevationGainFt} ft` : "0 ft"}</div>
              </div>
            </>
          )}
          {isGuidedKind(logKind) && (
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
          {isSessionKind(logKind) && (
            <>
              <div style={statCard}>
                <div style={statLabel}>Duration</div>
                <div style={statValue}>{formatSeconds(log.durationSec)}</div>
              </div>
              {log.location && (
                <div style={statCard}>
                  <div style={statLabel}>Location</div>
                  <div style={statValue}>{log.location}</div>
                </div>
              )}
              {log.climbAttempts.length > 0 && (
                <>
                  <div style={statCard}>
                    <div style={statLabel}>Climbs</div>
                    <div style={statValue}>{log.climbAttempts.length}</div>
                  </div>
                  <div style={statCard}>
                    <div style={statLabel}>Sends</div>
                    <div style={{ ...statValue, color: "rgba(74,222,128,0.9)" }}>
                      {log.climbAttempts.filter((a) => a.outcome === "FLASH" || a.outcome === "ONSIGHT" || a.outcome === "SEND" || a.outcome === "REDPOINT").length}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          {isWorkoutKind(logKind) && (
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

      {isWorkoutKind(logKind) && (
        <section style={panel}>
          <div style={panelHeader}>EXERCISES</div>
          <div style={contentPad}>
            <div style={{ display: "grid", gap: 10 }}>
              {log.exercises.map((exercise) => (
                <div key={exercise.id} style={itemCard}>
                  <div style={{ fontWeight: 900 }}>{exercise.exercise.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                    {exerciseUnitLabel(exercise.exercise.unit)} | Weight: {exercise.exercise.supportsWeight ? "Yes" : "No"}
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

      {isGuidedKind(logKind) && (
        <section style={panel}>
          <div style={panelHeader}>GUIDED STEPS</div>
          <div style={contentPad}>
            <div style={{ display: "grid", gap: 8 }}>
              {log.guidedSteps.map((step, index) => (
                <div key={step.id} style={itemCard}>
                  <div style={{ fontWeight: 900 }}>{index + 1}. {formatGuidedStepLabel({ kind: step.kind, title: step.title, exerciseName: step.exercise?.name ?? null })}</div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.82 }}>
                    {step.kind === "EXERCISE" ? "Exercise" : "Step"} | Work: {formatSeconds(step.durationSec)} | Rest: {formatSeconds(step.restSec)}
                    {formatGuidedRepSetSummary(step) ? ` | ${formatGuidedRepSetSummary(step)}` : ""}
                    {step.weightLb !== null && step.weightLb !== undefined ? ` | Weight: ${step.weightLb} lb` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {isSessionKind(logKind) && log.metrics.length > 0 && (
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

      {log.climbAttempts.length > 0 && (
        <section style={panel}>
          <div style={panelHeader}>CLIMBS</div>
          <div style={contentPad}>
            <div style={{ display: "grid", gap: 6 }}>
              {log.climbAttempts.map((attempt) => {
                const outcome = attempt.outcome as ClimbOutcome;
                const system = attempt.gradeSystem as ClimbGradeSystem;
                const color = climbOutcomeColor(outcome);
                const bg = climbOutcomeBg(outcome);
                return (
                  <div key={attempt.id} style={{ ...itemCard, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontWeight: 900, fontSize: 13, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", flexShrink: 0 }}>
                      {attempt.grade}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color, padding: "2px 8px", borderRadius: 999, background: bg, flexShrink: 0 }}>
                      {climbOutcomeLabel(outcome, system)}
                    </span>
                    {attempt.problem && (
                      <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>{attempt.problem.name}</span>
                    )}
                    {attempt.movesCompleted != null && (
                      <span style={{ fontSize: 12, opacity: 0.6 }}>
                        {attempt.movesCompleted}{attempt.totalMoves != null ? `/${attempt.totalMoves}` : ""} moves
                      </span>
                    )}
                    {attempt.notes && (
                      <span style={{ fontSize: 12, opacity: 0.65, width: "100%", marginTop: 2 }}>{attempt.notes}</span>
                    )}
                  </div>
                );
              })}
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
