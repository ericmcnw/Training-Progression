import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getWeekBoundsSunday } from "@/lib/week";
import {
  addDaysYmd,
  formatAppDateTime,
  formatUtcDateLabel,
  toAppYmd,
  todayAppYmd,
} from "@/lib/dates";
import {
  formatRoutineSubtype,
  formatRoutineTypeLabel,
  isCardioKind,
  isCompletionKind,
  isGuidedKind,
  isSessionKind,
  isWorkoutKind,
  routineKindColor,
} from "@/lib/routines";
import { formatDuration, formatPace, getWorkoutSessionMetrics } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams?: Promise<{ week?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const weekParam = params?.week;

  const now = new Date();
  const todayYmd = todayAppYmd(now);
  const currentWeekBounds = getWeekBoundsSunday(now);

  let weekBounds: { start: Date; end: Date; startYmd: string };
  if (weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    weekBounds = getWeekBoundsSunday(new Date(`${weekParam}T12:00:00.000Z`));
  } else {
    weekBounds = currentWeekBounds;
  }

  const weekStartYmd = weekBounds.startYmd;
  const weekEndYmd = addDaysYmd(weekStartYmd, 6);
  const prevWeekYmd = addDaysYmd(weekStartYmd, -7);
  const nextWeekYmd = addDaysYmd(weekStartYmd, 7);
  const isCurrentWeek = weekStartYmd === currentWeekBounds.startYmd;

  // Fetch all logs for the week with full details
  const logs = await prisma.routineLog.findMany({
    where: {
      performedAt: { gte: weekBounds.start, lt: weekBounds.end },
    },
    orderBy: [{ performedAt: "asc" }],
    include: {
      routine: {
        select: { id: true, name: true, subtype: true, kind: true },
      },
      exercises: {
        include: {
          exercise: { select: { id: true, name: true, unit: true } },
          sets: { orderBy: { setNumber: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      guidedSteps: {
        orderBy: { sortOrder: "asc" },
      },
      sessionMetricValues: {
        include: { metricDefinition: true },
      },
    },
  });

  // Group logs by day
  const byDay = new Map<string, typeof logs>();
  for (const log of logs) {
    const ymd = toAppYmd(log.performedAt);
    if (!byDay.has(ymd)) byDay.set(ymd, []);
    byDay.get(ymd)!.push(log);
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStartYmd, i));

  // Calculate totals
  let totalVolume = 0;
  let totalSets = 0;
  let totalCardioMi = 0;
  let totalDurationSec = 0;
  let hasWorkouts = false;
  let hasCardio = false;

  for (const log of logs) {
    const kind = String(log.routine.kind);
    if (isWorkoutKind(kind)) {
      hasWorkouts = true;
      for (const ex of log.exercises) {
        const m = getWorkoutSessionMetrics(ex.sets);
        totalVolume += m.totalVolume;
        totalSets += m.totalSets;
      }
    }
    if (isCardioKind(kind) && log.distanceMi) {
      hasCardio = true;
      totalCardioMi += log.distanceMi;
    }
    if (log.durationSec) {
      totalDurationSec += log.durationSec;
    }
  }

  // Build totals summary line
  const totalsParts: string[] = [];
  totalsParts.push(`${logs.length} session${logs.length !== 1 ? "s" : ""}`);
  if (hasWorkouts && totalSets > 0) totalsParts.push(`${totalSets} sets`);
  if (hasWorkouts && totalVolume > 0) {
    totalsParts.push(
      totalVolume >= 1000
        ? `${(totalVolume / 1000).toFixed(1)}k lb volume`
        : `${totalVolume.toLocaleString()} lb volume`
    );
  }
  if (hasCardio && totalCardioMi > 0) totalsParts.push(`${totalCardioMi.toFixed(1)} mi cardio`);
  if (totalDurationSec > 0) totalsParts.push(`${formatDuration(totalDurationSec)} active`);

  const startLabel = formatUtcDateLabel(weekStartYmd, { month: "short", day: "numeric" });
  const endLabel = formatUtcDateLabel(weekEndYmd, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 12px", display: "grid", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/" style={backLink}>← Dashboard</Link>
          <Link href="/manual-log" style={backLink}>Profile</Link>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Weekly Report</h1>
            {isCurrentWeek && <div style={{ fontSize: 12, opacity: 0.45, marginTop: 2 }}>Current week</div>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link href={`/reports/weekly?week=${prevWeekYmd}`} style={navBtn}>← Prev</Link>
            <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.85, whiteSpace: "nowrap" }}>
              {startLabel} – {endLabel}
            </span>
            {!isCurrentWeek ? (
              <Link href={`/reports/weekly?week=${nextWeekYmd}`} style={navBtn}>Next →</Link>
            ) : (
              <span style={{ ...navBtn, opacity: 0.25, pointerEvents: "none" }}>Next →</span>
            )}
          </div>
        </div>
      </div>

      {/* Totals */}
      {logs.length > 0 && (
        <section style={panel}>
          <div style={panelHeader}>TOTALS</div>
          <div style={{ padding: "12px 16px" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.6 }}>
              {totalsParts.join("  ·  ")}
            </p>
          </div>
        </section>
      )}

      {/* Sessions by day */}
      <section style={panel}>
        <div style={panelHeader}>SESSIONS BY DAY</div>
        <div style={{ padding: "8px 16px 16px" }}>
          {logs.length === 0 && (
            <p style={{ margin: "16px 0", opacity: 0.45, fontSize: 14 }}>No sessions logged this week.</p>
          )}

          {weekDays.map((dayYmd) => {
            const dayLogs = byDay.get(dayYmd) ?? [];
            const dayLabel = formatUtcDateLabel(dayYmd, {
              weekday: "long",
              month: "long",
              day: "numeric",
            });
            const isToday = dayYmd === todayYmd;
            const isRestDay = dayLogs.length === 0;

            return (
              <div key={dayYmd} style={{ marginTop: 18 }}>
                {/* Day heading */}
                <div style={dayHeadingStyle(isToday)}>
                  <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.3 }}>
                    {dayLabel.toUpperCase()}
                    {isToday ? "  —  Today" : ""}
                  </span>
                  {isRestDay && (
                    <span style={{ fontSize: 12, opacity: 0.35, fontWeight: 600 }}>Rest</span>
                  )}
                  {dayLogs.length > 1 && (
                    <span style={{ fontSize: 12, opacity: 0.5, fontWeight: 600 }}>
                      {dayLogs.length} sessions
                    </span>
                  )}
                </div>

                {/* Logs */}
                <div style={{ display: "grid", gap: 14, marginTop: 10 }}>
                  {dayLogs.map((log) => {
                    const kind = String(log.routine.kind);
                    const kindColor = routineKindColor(kind);
                    const timeLabel = formatAppDateTime(log.performedAt, {
                      hour: "numeric",
                      minute: "2-digit",
                    });
                    const subtypeLabel = formatRoutineSubtype(log.routine.subtype);
                    const typeLabel = subtypeLabel || formatRoutineTypeLabel(kind);

                    // Per-log workout totals
                    let logVolume = 0;
                    let logSets = 0;
                    if (isWorkoutKind(kind)) {
                      for (const ex of log.exercises) {
                        const m = getWorkoutSessionMetrics(ex.sets);
                        logVolume += m.totalVolume;
                        logSets += m.totalSets;
                      }
                    }

                    return (
                      <div key={log.id} style={logEntryStyle(kindColor)}>
                        {/* Log title line */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 900, fontSize: 15 }}>{log.routine.name}</span>
                          <span style={{ fontSize: 12, opacity: 0.5, whiteSpace: "nowrap" }}>
                            {typeLabel}  ·  {timeLabel}
                          </span>
                        </div>

                        {/* WORKOUT */}
                        {isWorkoutKind(kind) && log.exercises.length > 0 && (
                          <div style={{ marginTop: 6, display: "grid", gap: 3 }}>
                            {log.exercises.map((ex) => {
                              const isTimeBased = ex.exercise.unit === "TIME";
                              const setsText = ex.sets
                                .map((set) => {
                                  if (isTimeBased) return `${set.seconds ?? 0}s`;
                                  if (set.weightLb && set.weightLb > 0) return `${set.reps ?? 0} × ${set.weightLb} lb`;
                                  return `${set.reps ?? 0} reps`;
                                })
                                .join(",  ");
                              return (
                                <p key={ex.id} style={bodyLine}>
                                  <span style={{ fontWeight: 700 }}>{ex.exercise.name}:</span>{" "}
                                  {setsText}
                                </p>
                              );
                            })}
                            <p style={mutedLine}>
                              {logSets} sets
                              {logVolume > 0
                                ? `  ·  ${logVolume >= 1000 ? `${(logVolume / 1000).toFixed(1)}k` : logVolume.toLocaleString()} lb total volume`
                                : ""}
                            </p>
                          </div>
                        )}

                        {/* CARDIO */}
                        {isCardioKind(kind) && (
                          <div style={{ marginTop: 6 }}>
                            {(() => {
                              const parts: string[] = [];
                              if (log.distanceMi != null) parts.push(`${log.distanceMi.toFixed(2)} mi`);
                              if (log.durationSec != null) parts.push(formatDuration(log.durationSec));
                              if (log.distanceMi && log.durationSec && log.distanceMi > 0) {
                                parts.push(`${formatPace(log.durationSec / log.distanceMi)} /mi`);
                              }
                              if (log.elevationGainFt != null && log.elevationGainFt > 0) {
                                parts.push(`${log.elevationGainFt.toLocaleString()} ft gain`);
                              }
                              if (log.location) parts.push(log.location);
                              return <p style={bodyLine}>{parts.join("  ·  ")}</p>;
                            })()}
                          </div>
                        )}

                        {/* GUIDED */}
                        {isGuidedKind(kind) && (
                          <div style={{ marginTop: 6, display: "grid", gap: 3 }}>
                            {log.durationSec != null && (
                              <p style={mutedLine}>Duration: {formatDuration(log.durationSec)}</p>
                            )}
                            {log.guidedSteps.map((step) => {
                              const parts: string[] = [];
                              if (step.durationSec != null) parts.push(`${step.durationSec}s`);
                              if (step.setCount > 1 || step.repCount > 1) parts.push(`${step.setCount} × ${step.repCount} reps`);
                              if (step.weightLb) parts.push(`${step.weightLb} lb`);
                              if (step.repeatCount > 1) parts.push(`× ${step.repeatCount}`);
                              return (
                                <p key={step.id} style={bodyLine}>
                                  <span style={{ fontWeight: 700 }}>{step.title}</span>
                                  {parts.length > 0 ? `  —  ${parts.join("  ·  ")}` : ""}
                                </p>
                              );
                            })}
                          </div>
                        )}

                        {/* SESSION */}
                        {isSessionKind(kind) && (
                          <div style={{ marginTop: 6 }}>
                            {(() => {
                              const parts: string[] = [];
                              if (log.durationSec != null) parts.push(formatDuration(log.durationSec));
                              if (log.location) parts.push(log.location);
                              for (const mv of log.sessionMetricValues) {
                                const val =
                                  mv.metricDefinition.valueType === "BOOLEAN"
                                    ? mv.booleanValue ? "Yes" : "No"
                                    : mv.metricDefinition.valueType === "TEXT"
                                      ? mv.textValue
                                      : mv.numberValue != null
                                        ? `${mv.numberValue}${mv.metricDefinition.unit ? ` ${mv.metricDefinition.unit}` : ""}`
                                        : null;
                                if (val != null) parts.push(`${mv.metricDefinition.label}: ${val}`);
                              }
                              if (parts.length === 0) return null;
                              return <p style={bodyLine}>{parts.join("  ·  ")}</p>;
                            })()}
                          </div>
                        )}

                        {/* COMPLETION */}
                        {isCompletionKind(kind) && (
                          <div style={{ marginTop: 6 }}>
                            <p style={mutedLine}>
                              {log.completionCount != null && log.completionCount > 0
                                ? `Count: ${log.completionCount}`
                                : "Completed"}
                            </p>
                          </div>
                        )}

                        {/* Notes */}
                        {log.notes && (
                          <p style={notesLine}>{log.notes}</p>
                        )}

                        {/* Edit */}
                        <div style={{ marginTop: 4 }}>
                          <Link
                            href={`/routines/${log.routineId}/logs/${log.id}/edit?returnTo=${encodeURIComponent(`/reports/weekly?week=${weekStartYmd}`)}`}
                            style={editLink}
                          >
                            Edit log
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom nav */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Link href={`/reports/weekly?week=${prevWeekYmd}`} style={navBtn}>← Previous Week</Link>
        {!isCurrentWeek && (
          <Link href={`/reports/weekly?week=${nextWeekYmd}`} style={navBtn}>Next Week →</Link>
        )}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 16,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

const panelHeader: React.CSSProperties = {
  padding: "8px 16px",
  background: "rgba(128,128,128,0.11)",
  borderBottom: "1px solid rgba(128,128,128,0.2)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
};

const backLink: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  opacity: 0.65,
  textDecoration: "none",
  padding: "4px 10px",
  borderRadius: 8,
  border: "1px solid rgba(128,128,128,0.2)",
  background: "rgba(128,128,128,0.06)",
};

const navBtn: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "6px 14px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.24)",
  background: "rgba(128,128,128,0.08)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

function dayHeadingStyle(isToday: boolean): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 10,
    paddingBottom: 6,
    borderBottom: isToday
      ? "1px solid rgba(84,203,130,0.35)"
      : "1px solid rgba(128,128,128,0.18)",
    color: isToday ? "rgba(84,203,130,0.9)" : undefined,
  };
}

function logEntryStyle(kindColor: string): React.CSSProperties {
  return {
    paddingLeft: 14,
    borderLeft: `2px solid ${kindColor.replace(/[\d.]+\)$/, "0.55)")}`,
  };
}

const bodyLine: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.65,
};

const mutedLine: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  opacity: 0.55,
  fontWeight: 600,
  lineHeight: 1.65,
  marginTop: 2,
};

const notesLine: React.CSSProperties = {
  margin: 0,
  marginTop: 6,
  fontSize: 13,
  opacity: 0.6,
  fontStyle: "italic",
  lineHeight: 1.6,
};

const editLink: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.4,
  textDecoration: "none",
};
