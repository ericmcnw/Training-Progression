import Link from "next/link";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { addDaysYmd, formatAppDateTime, formatUtcDateLabel, toAppYmd } from "@/lib/dates";
import { formatDuration, formatHoursMinutes, formatPace, getWorkoutSessionMetrics } from "@/lib/progress";
import {
  domainColor,
  effectiveRoutineDomain,
  formatRoutineSubtype,
  formatRoutineTypeLabel,
  isCardioKind,
  isCompletionKind,
  isGuidedKind,
  isSessionKind,
  isWorkoutKind,
  routineKindColor,
} from "@/lib/routines";
import {
  PROFILE_DOMAIN_LABELS as DOMAIN_LABELS,
  PROFILE_DOMAIN_ORDER as DOMAIN_ORDER,
  ymdWeekday,
  type ProfileDomain as Domain,
} from "@/lib/profile-summary";
import type { Period } from "@/lib/reports/period";
import { loadPeriodGoals } from "@/lib/reports/evaluate";
import GoalsBlock from "./GoalsBlock";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

// Week report content. Self-fetches the rich per-log detail it needs (this is
// the only report with a per-session breakdown), and derives the descriptive
// KPI/rhythm/domain/highlights layer from the same rows — one fetch.
export default async function WeekReport({ period }: { period: Period }) {
  const todayYmd = toAppYmd(new Date());
  const weekStartYmd = period.key; // Sunday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStartYmd, i));
  const returnTo = `/reports/week?week=${weekStartYmd}`;

  const logs = await prisma.routineLog.findMany({
    where: { performedAt: { gte: period.start, lt: period.end } },
    orderBy: [{ performedAt: "asc" }],
    include: {
      routine: { select: { id: true, name: true, subtype: true, kind: true, domain: true } },
      exercises: {
        include: {
          exercise: { select: { id: true, name: true, unit: true } },
          sets: { orderBy: { setNumber: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      guidedSteps: { orderBy: { sortOrder: "asc" } },
      sessionMetricValues: { include: { metricDefinition: true } },
    },
  });

  const domainOf = (l: (typeof logs)[number]): Domain =>
    effectiveRoutineDomain(l.routine.domain, l.routine.kind, l.routine.subtype) as Domain;

  // ── Descriptive aggregation ───────────────────────────────────────────────
  const sessions = logs.length;
  const totalSec = logs.reduce((s, l) => s + (l.durationSec ?? 0), 0);
  const totalMi = logs.reduce((s, l) => s + (l.distanceMi ?? 0), 0);
  const activeDays = new Set(logs.map((l) => toAppYmd(l.performedAt))).size;

  const perDomain: Record<Domain, number> = {
    strength: 0, cardio: 0, mobility: 0, sport: 0, lifestyle: 0,
  };
  for (const l of logs) perDomain[domainOf(l)]++;
  const activeDomains = DOMAIN_ORDER.filter((d) => perDomain[d] > 0);

  // Strength volume + sets (not in the KPI strip — surfaced in the totals line).
  let totalVolume = 0;
  let totalSets = 0;
  for (const l of logs) {
    if (!isWorkoutKind(String(l.routine.kind))) continue;
    for (const ex of l.exercises) {
      const m = getWorkoutSessionMetrics(ex.sets);
      totalVolume += m.totalVolume;
      totalSets += m.totalSets;
    }
  }

  const byDay = new Map<string, typeof logs>();
  for (const l of logs) {
    const ymd = toAppYmd(l.performedAt);
    if (!byDay.has(ymd)) byDay.set(ymd, []);
    byDay.get(ymd)!.push(l);
  }

  const dayCells = weekDays.map((ymd) => ({
    ymd,
    letter: DAY_LETTERS[ymdWeekday(ymd)],
    domains: (byDay.get(ymd) ?? []).map(domainOf),
    isToday: ymd === todayYmd,
  }));

  const highlights = buildHighlights(logs, byDay);
  const goals = period.isCurrent ? await loadPeriodGoals("week") : [];

  // ── Totals line (rule 1: keep the old report's strength/cardio detail) ─────
  const totalsParts: string[] = [`${sessions} session${sessions === 1 ? "" : "s"}`];
  if (totalSets > 0) totalsParts.push(`${totalSets} sets`);
  if (totalVolume > 0) {
    totalsParts.push(
      totalVolume >= 1000
        ? `${(totalVolume / 1000).toFixed(1)}k lb volume`
        : `${totalVolume.toLocaleString()} lb volume`
    );
  }
  if (totalMi > 0) totalsParts.push(`${totalMi.toFixed(1)} mi`);
  if (totalSec > 0) totalsParts.push(`${formatDuration(totalSec)} active`);

  if (sessions === 0) {
    return (
      <section style={panel}>
        <div style={panelHeader}>THIS WEEK (SUN–SAT)</div>
        <div style={emptyBody}>Rest week — nothing logged.</div>
      </section>
    );
  }

  return (
    <>
      <GoalsBlock goals={goals} />

      {/* KPI strip */}
      <section style={panel}>
        <div style={panelHeader}>THIS WEEK (SUN–SAT)</div>
        <div style={body}>
          <div style={kpiRow}>
            <Kpi label="Sessions" value={String(sessions)} />
            <Kpi label="Time" value={totalSec > 0 ? formatHoursMinutes(totalSec) : "—"} />
            <Kpi label="Distance" value={totalMi > 0 ? `${totalMi.toFixed(1)}mi` : "—"} />
            <Kpi label="Active" value={`${activeDays}/7`} />
          </div>

          {/* Rhythm */}
          <div>
            <div style={sectionLabel}>RHYTHM</div>
            <div style={dayRow}>
              {dayCells.map((d) => {
                const count = d.domains.length;
                const rest = count === 0;
                return (
                  <div key={d.ymd} style={dayCard(d.isToday, rest)}>
                    <div style={dayLetter(d.isToday)}>{d.letter}</div>
                    <div style={dayDotsBox}>
                      {rest ? (
                        <span style={restDash} aria-hidden>—</span>
                      ) : (
                        d.domains.slice(0, 4).map((dom, i) => (
                          <span key={i} style={{ ...dayDot, background: domainColor(dom) }} aria-hidden />
                        ))
                      )}
                    </div>
                    <div style={dayCount(rest)}>{rest ? "rest" : `${count}`}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By domain */}
          {activeDomains.length > 0 && (
            <div>
              <div style={sectionLabel}>BY DOMAIN</div>
              <div style={stackTrack} aria-hidden>
                {activeDomains.map((d) => (
                  <div
                    key={d}
                    title={`${DOMAIN_LABELS[d]}: ${perDomain[d]}`}
                    style={{ width: `${(perDomain[d] / sessions) * 100}%`, background: domainColor(d) }}
                  />
                ))}
              </div>
              <div style={domainLegend}>
                {activeDomains.map((d) => (
                  <div key={d} style={legendItem}>
                    <span style={{ ...legendDot, background: domainColor(d) }} aria-hidden />
                    <span style={legendLabel}>{DOMAIN_LABELS[d]}</span>
                    <span style={legendCount}>{perDomain[d]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlights */}
          {highlights.length > 0 && (
            <div>
              <div style={sectionLabel}>HIGHLIGHTS</div>
              <ul style={highlightList}>
                {highlights.map((h, i) => (
                  <li key={i} style={highlightItem}>
                    <span style={highlightIcon} aria-hidden>{h.icon}</span>
                    <span style={highlightText}>{h.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Totals line */}
          <p style={totalsLine}>{totalsParts.join("  ·  ")}</p>
        </div>
      </section>

      {/* Sessions by day — ported from the legacy /reports/weekly detail view */}
      <section style={panel}>
        <div style={panelHeader}>SESSIONS BY DAY</div>
        <div style={{ padding: "8px 16px 16px" }}>
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
                <div style={dayHeadingStyle(isToday)}>
                  <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.3 }}>
                    {dayLabel.toUpperCase()}
                    {isToday ? "  —  Today" : ""}
                  </span>
                  {isRestDay && <span style={{ fontSize: 12, opacity: 0.35, fontWeight: 600 }}>Rest</span>}
                  {dayLogs.length > 1 && (
                    <span style={{ fontSize: 12, opacity: 0.5, fontWeight: 600 }}>
                      {dayLogs.length} sessions
                    </span>
                  )}
                </div>

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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 900, fontSize: 15 }}>{log.routine.name}</span>
                          <span style={{ fontSize: 12, opacity: 0.5, whiteSpace: "nowrap" }}>
                            {typeLabel}  ·  {timeLabel}
                          </span>
                        </div>

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
                                  <span style={{ fontWeight: 700 }}>{ex.exercise.name}:</span> {setsText}
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

                        {isCompletionKind(kind) && (
                          <div style={{ marginTop: 6 }}>
                            <p style={mutedLine}>
                              {log.completionCount != null && log.completionCount > 0
                                ? `Count: ${log.completionCount}`
                                : "Completed"}
                            </p>
                          </div>
                        )}

                        {log.notes && <p style={notesLine}>{log.notes}</p>}

                        <div style={{ marginTop: 4 }}>
                          <Link
                            href={`/routines/${log.routineId}/logs/${log.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
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
    </>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────

type Highlight = { icon: string; text: string };

type HighlightLog = {
  durationSec: number | null;
  distanceMi: number | null;
  routine: { name: string };
};

function buildHighlights<T extends HighlightLog>(logs: T[], byDay: Map<string, T[]>): Highlight[] {
  const out: Highlight[] = [];

  const longest = logs.reduce<T | null>(
    (best, l) => ((l.durationSec ?? 0) > (best?.durationSec ?? 0) ? l : best),
    null
  );
  if (longest && (longest.durationSec ?? 0) > 0) {
    out.push({ icon: "⏱", text: `Longest: ${longest.routine.name} — ${formatHoursMinutes(longest.durationSec!)}` });
  }

  const furthest = logs.reduce<T | null>(
    (best, l) => (l.distanceMi && (l.distanceMi ?? 0) > (best?.distanceMi ?? 0) ? l : best),
    null
  );
  if (furthest && (furthest.distanceMi ?? 0) > 0) {
    out.push({ icon: "📍", text: `Furthest: ${furthest.routine.name} — ${furthest.distanceMi!.toFixed(2)} mi` });
  }

  let biggestDay: { ymd: string; count: number } | null = null;
  for (const [ymd, dl] of byDay) {
    if (dl.length > (biggestDay?.count ?? 0)) biggestDay = { ymd, count: dl.length };
  }
  if (biggestDay && biggestDay.count >= 2) {
    const full = formatUtcDateLabel(biggestDay.ymd, { weekday: "short" });
    out.push({ icon: "💪", text: `Biggest day: ${full} — ${biggestDay.count} sessions` });
  }

  const activeDayCount = byDay.size;
  if (activeDayCount >= 6) out.push({ icon: "🔥", text: `${activeDayCount}/7 days active` });

  return out.slice(0, 4);
}

// ── subcomponents ───────────────────────────────────────────────────────────

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={kpiTile}>
      <div style={kpiValue}>{value}</div>
      <div style={kpiLabel}>{label}</div>
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

const panel: CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 16,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

const panelHeader: CSSProperties = {
  padding: "8px 16px",
  background: "rgba(128,128,128,0.11)",
  borderBottom: "1px solid rgba(128,128,128,0.2)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
};

const body: CSSProperties = { padding: 14, display: "grid", gap: 16 };

const emptyBody: CSSProperties = {
  padding: 18,
  fontSize: 13,
  color: "rgba(255,255,255,0.6)",
  fontStyle: "italic",
};

const sectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
  marginBottom: 8,
};

const kpiRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const kpiTile: CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "10px 8px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  textAlign: "center",
  minWidth: 0,
};

const kpiValue: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.05,
  color: "rgba(255,255,255,0.95)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const kpiLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: "rgba(255,255,255,0.5)",
  textTransform: "uppercase",
};

const dayRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 4,
};

function dayCard(isToday: boolean, isRest: boolean): CSSProperties {
  return {
    display: "grid",
    gap: 4,
    padding: "6px 4px 5px",
    borderRadius: 10,
    border: isToday ? "1px solid rgba(51,255,122,0.5)" : "1px solid rgba(255,255,255,0.08)",
    background: isToday
      ? "rgba(51,255,122,0.08)"
      : isRest
        ? "rgba(255,255,255,0.015)"
        : "rgba(255,255,255,0.03)",
    textAlign: "center",
    minHeight: 56,
    alignContent: "start",
    opacity: isRest && !isToday ? 0.7 : 1,
  };
}

function dayLetter(isToday: boolean): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.4,
    color: isToday ? "rgba(51,255,122,0.95)" : "rgba(255,255,255,0.55)",
    textTransform: "uppercase",
  };
}

const dayDotsBox: CSSProperties = {
  display: "flex",
  gap: 2,
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
  minHeight: 14,
};

const dayDot: CSSProperties = { width: 6, height: 6, borderRadius: 999 };

const restDash: CSSProperties = { fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 800 };

function dayCount(isRest: boolean): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 800,
    color: isRest ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)",
    lineHeight: 1,
  };
}

const stackTrack: CSSProperties = {
  display: "flex",
  width: "100%",
  height: 10,
  borderRadius: 999,
  overflow: "hidden",
  background: "rgba(255,255,255,0.05)",
};

const domainLegend: CSSProperties = { marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" };
const legendItem: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5 };
const legendDot: CSSProperties = { width: 8, height: 8, borderRadius: 999, flexShrink: 0 };
const legendLabel: CSSProperties = { fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" };
const legendCount: CSSProperties = { fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.95)" };

const highlightList: CSSProperties = { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 };
const highlightItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
};
const highlightIcon: CSSProperties = { fontSize: 14, lineHeight: 1 };
const highlightText: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "rgba(255,255,255,0.85)",
  flex: 1,
  minWidth: 0,
};

const totalsLine: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.6,
  opacity: 0.85,
};

// Day-list styles (ported verbatim from legacy /reports/weekly)
function dayHeadingStyle(isToday: boolean): CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 10,
    paddingBottom: 6,
    borderBottom: isToday ? "1px solid rgba(84,203,130,0.35)" : "1px solid rgba(128,128,128,0.18)",
    color: isToday ? "rgba(84,203,130,0.9)" : undefined,
  };
}

function logEntryStyle(kindColor: string): CSSProperties {
  return {
    paddingLeft: 14,
    borderLeft: `2px solid ${kindColor.replace(/[\d.]+\)$/, "0.55)")}`,
  };
}

const bodyLine: CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.65 };
const mutedLine: CSSProperties = { margin: 0, fontSize: 12, opacity: 0.55, fontWeight: 600, lineHeight: 1.65, marginTop: 2 };
const notesLine: CSSProperties = { margin: 0, marginTop: 6, fontSize: 13, opacity: 0.6, fontStyle: "italic", lineHeight: 1.6 };
const editLink: CSSProperties = { fontSize: 11, fontWeight: 700, opacity: 0.4, textDecoration: "none" };
