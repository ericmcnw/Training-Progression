import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import { formatAppDate } from "@/lib/dates";
import {
  climbOutcomeColor,
  climbOutcomeBg,
  climbOutcomeLabel,
  type ClimbGradeSystem,
  type ClimbOutcome,
} from "@/lib/climb-types";
import ActivityCoverageHeatmap from "./ActivityCoverageHeatmap";
import { buildWeeklyGrid, type SessionEventInput } from "./activity-coverage";

// ── Types ────────────────────────────────────────────────────────────────────

type AttemptRow = {
  id: string;
  grade: string;
  gradeSystem: ClimbGradeSystem;
  outcome: ClimbOutcome;
  sessionLogId: string;
  sessionLog: {
    performedAt: Date;
    routineId: string;
    climbLocation: { id: string; name: string; type: "GYM" | "CRAG" } | null;
    routine: {
      name: string;
      sessionDetails: { template: { key: string } | null } | null;
    };
  };
};

type PyramidRow = {
  grade: string;
  system: ClimbGradeSystem;
  counts: Partial<Record<ClimbOutcome, number>>;
  total: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const ORDERED_OUTCOMES: ClimbOutcome[] = ["FLASH", "ONSIGHT", "SEND", "REDPOINT", "FELL", "PROJECT"];

function gradeSort(grade: string, system: ClimbGradeSystem): number {
  if (system === "BOULDER_V") return parseInt(grade.replace(/^V/, ""), 10) || 0;
  const m = grade.match(/^5\.(\d+)([abcd]?)$/i);
  if (!m) return 0;
  const sub = ({ "": 0, a: 0, b: 1, c: 2, d: 3 } as Record<string, number>)[m[2].toLowerCase()] ?? 0;
  return parseInt(m[1], 10) * 4 + sub;
}

function buildPyramidRows(attempts: AttemptRow[]) {
  const map = new Map<string, PyramidRow>();
  for (const a of attempts) {
    const key = `${a.gradeSystem}::${a.grade}`;
    const row = map.get(key) ?? { grade: a.grade, system: a.gradeSystem, counts: {}, total: 0 };
    row.counts[a.outcome] = (row.counts[a.outcome] ?? 0) + 1;
    row.total++;
    map.set(key, row);
  }
  const boulderRows = [...map.values()].filter((r) => r.system === "BOULDER_V").sort((a, b) => gradeSort(a.grade, "BOULDER_V") - gradeSort(b.grade, "BOULDER_V"));
  const yosemiteRows = [...map.values()].filter((r) => r.system === "YOSEMITE").sort((a, b) => gradeSort(a.grade, "YOSEMITE") - gradeSort(b.grade, "YOSEMITE"));
  return { boulderRows, yosemiteRows };
}

function venueType(a: AttemptRow): "GYM" | "CRAG" | null {
  const key = a.sessionLog.routine.sessionDetails?.template?.key ?? "";
  if (key.startsWith("indoor-") || a.sessionLog.climbLocation?.type === "GYM") return "GYM";
  if (key.startsWith("outdoor-") || a.sessionLog.climbLocation?.type === "CRAG") return "CRAG";
  return null;
}

function hardestGrade(rows: PyramidRow[], filter: Set<ClimbOutcome>) {
  const eligible = rows.filter((r) => ORDERED_OUTCOMES.some((o) => filter.has(o) && (r.counts[o] ?? 0) > 0));
  return eligible.length > 0 ? eligible[eligible.length - 1].grade : null;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function HeroStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 120px",
        display: "grid",
        gap: 4,
        padding: "18px 16px",
        borderRadius: 16,
        border: `1px solid ${accent ? accent.replace("0.9)", "0.28)") : "rgba(255,255,255,0.1)"}`,
        background: accent
          ? `radial-gradient(circle at top left, ${accent.replace("0.9)", "0.10)")}, transparent 60%), rgba(255,255,255,0.03)`
          : "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", opacity: 0.55, fontWeight: 900 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 950, lineHeight: 1, color: accent ?? "inherit" }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.4 }}>{sub}</div> : null}
    </div>
  );
}

function PyramidSection({
  title,
  rows,
  showBoth,
}: {
  title: string;
  rows: { boulderRows: PyramidRow[]; yosemiteRows: PyramidRow[] };
  showBoth: boolean;
}) {
  const allRows = [...rows.boulderRows, ...rows.yosemiteRows];
  if (allRows.length === 0) return null;
  const maxTotal = Math.max(...allRows.map((r) => r.total), 1);

  return (
    <div
      style={{
        flex: "1 1 260px",
        display: "grid",
        gap: 10,
        padding: "14px 16px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.65 }}>{title}</div>
      {rows.boulderRows.length > 0 && (
        <div style={{ display: "grid", gap: 4 }}>
          {showBoth && rows.boulderRows.length > 0 && rows.yosemiteRows.length > 0 && (
            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.5 }}>Bouldering (V)</div>
          )}
          {[...rows.boulderRows].reverse().map((row) => (
            <PyramidBar key={row.grade} row={row} maxTotal={maxTotal} />
          ))}
        </div>
      )}
      {rows.yosemiteRows.length > 0 && (
        <div style={{ display: "grid", gap: 4 }}>
          {showBoth && rows.boulderRows.length > 0 && rows.yosemiteRows.length > 0 && (
            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.5 }}>Sport / Trad</div>
          )}
          {[...rows.yosemiteRows].reverse().map((row) => (
            <PyramidBar key={row.grade} row={row} maxTotal={maxTotal} />
          ))}
        </div>
      )}
    </div>
  );
}

function PyramidBar({
  row,
  maxTotal,
}: {
  row: PyramidRow;
  maxTotal: number;
}) {
  const BAR_MAX_PCT = 78;
  const barPct = (row.total / maxTotal) * BAR_MAX_PCT;
  const segments = ORDERED_OUTCOMES.map((o) => ({ outcome: o, count: row.counts[o] ?? 0 })).filter((s) => s.count > 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 28px", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, fontWeight: 900, opacity: 0.9, textAlign: "right" }}>{row.grade}</span>
      <div style={{ height: 20, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.05)", display: "flex", gap: 1 }}>
        {segments.map(({ outcome, count }) => (
          <div
            key={outcome}
            title={`${climbOutcomeLabel(outcome, row.system)}: ${count}`}
            style={{
              width: `${(count / row.total) * barPct}%`,
              background: climbOutcomeColor(outcome),
              minWidth: 4,
              flexShrink: 0,
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700, textAlign: "right" }}>{row.total}</span>
    </div>
  );
}

function OutcomeLegend({ system }: { system: ClimbGradeSystem }) {
  const items =
    system === "BOULDER_V"
      ? [{ outcome: "FLASH" as ClimbOutcome, label: "Flash" }, { outcome: "SEND" as ClimbOutcome, label: "Send" }, { outcome: "PROJECT" as ClimbOutcome, label: "Project" }, { outcome: "FELL" as ClimbOutcome, label: "Fell" }]
      : [{ outcome: "ONSIGHT" as ClimbOutcome, label: "Onsight" }, { outcome: "SEND" as ClimbOutcome, label: "Send" }, { outcome: "PROJECT" as ClimbOutcome, label: "Project" }, { outcome: "FELL" as ClimbOutcome, label: "Fell" }];
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {items.map((item) => (
        <span key={item.outcome} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, opacity: 0.8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: climbOutcomeColor(item.outcome), display: "inline-block" }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function VenueBar({ name, sessions, max }: { name: string; sessions: number; max: number }) {
  const pct = Math.round((sessions / max) * 100);
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800 }}>
        <span style={{ opacity: 0.9 }}>{name}</span>
        <span style={{ opacity: 0.55 }}>{sessions}×</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: "rgba(78,148,255,0.75)" }} />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default async function ClimbingWorldPage() {
  const now = new Date();

  const [attempts, rawTrainingLogs] = await Promise.all([
    prisma.climbAttempt.findMany({
      orderBy: { sessionLog: { performedAt: "desc" } },
      select: {
        id: true,
        grade: true,
        gradeSystem: true,
        outcome: true,
        sessionLogId: true,
        sessionLog: {
          select: {
            performedAt: true,
            routineId: true,
            climbLocation: { select: { id: true, name: true, type: true } },
            routine: {
              select: {
                name: true,
                sessionDetails: { select: { template: { select: { key: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.routineLog.findMany({
      where: {
        routine: {
          isDeleted: false,
          kind: { notIn: ["SESSION", "CARDIO"] },
          metadataGroups: { some: { group: { slug: "climbing" } } },
        },
      },
      orderBy: { performedAt: "desc" },
      select: {
        id: true,
        performedAt: true,
        routineId: true,
        durationSec: true,
        routine: { select: { name: true, kind: true } },
        exercises: {
          select: {
            exercise: { select: { name: true } },
            sets: { select: { id: true } },
          },
        },
      },
    }),
  ]);

  if (attempts.length === 0) {
    return (
      <SectionCard title="Climbing" subtitle="Log a climbing session to start seeing your world here.">
        <EmptyState message="No climbing sessions logged yet." />
      </SectionCard>
    );
  }

  // ── Aggregate ─────────────────────────────────────────────────────────────

  const sessionIds = new Set(attempts.map((a) => a.sessionLogId));
  const totalSessions = sessionIds.size;

  const flashes = new Set<ClimbOutcome>(["FLASH", "ONSIGHT"]);
  const sends = new Set<ClimbOutcome>(["FLASH", "ONSIGHT", "SEND", "REDPOINT"]);

  const gymAttempts = attempts.filter((a) => venueType(a) === "GYM");
  const cragAttempts = attempts.filter((a) => venueType(a) === "CRAG");
  const gymSessions = new Set(gymAttempts.map((a) => a.sessionLogId)).size;
  const cragSessions = new Set(cragAttempts.map((a) => a.sessionLogId)).size;

  const overallRows = buildPyramidRows(attempts);
  const gymRows = buildPyramidRows(gymAttempts);
  const cragRows = buildPyramidRows(cragAttempts);

  const hasBoulder = overallRows.boulderRows.length > 0;
  const hasYosemite = overallRows.yosemiteRows.length > 0;

  const hardestBoulderFlash = hardestGrade(overallRows.boulderRows, flashes);
  const hardestBoulderSend = hardestGrade(overallRows.boulderRows, sends);
  const hardestYosemiteFlash = hardestGrade(overallRows.yosemiteRows, flashes);
  const hardestYosemiteSend = hardestGrade(overallRows.yosemiteRows, sends);

  const bestGrade = hardestBoulderFlash ?? hardestBoulderSend ?? hardestYosemiteFlash ?? hardestYosemiteSend ?? "—";
  const bestGradeLabel = hardestBoulderFlash
    ? "best boulder flash"
    : hardestBoulderSend
    ? "best boulder send"
    : hardestYosemiteFlash
    ? "best onsight"
    : "best send";

  // Venue breakdown
  const venueMap = new Map<string, { name: string; sessions: Set<string> }>();
  for (const a of attempts) {
    if (!a.sessionLog.climbLocation) continue;
    const loc = a.sessionLog.climbLocation;
    const entry = venueMap.get(loc.id) ?? { name: loc.name, sessions: new Set() };
    entry.sessions.add(a.sessionLogId);
    venueMap.set(loc.id, entry);
  }
  const venues = [...venueMap.values()]
    .map((v) => ({ name: v.name, sessions: v.sessions.size }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 6);
  const venueMax = venues[0]?.sessions ?? 1;

  // Unique session events for heatmap
  const uniqueSessionMap = new Map<string, SessionEventInput>();
  for (const a of attempts) {
    if (uniqueSessionMap.has(a.sessionLogId)) continue;
    const venue = venueType(a);
    const venueText = venue === "GYM" ? "Indoor" : venue === "CRAG" ? "Outdoor" : null;
    const locationName = a.sessionLog.climbLocation?.name ?? null;
    uniqueSessionMap.set(a.sessionLogId, {
      id: a.sessionLogId,
      routineId: a.sessionLog.routineId,
      performedAt: a.sessionLog.performedAt,
      routineName: a.sessionLog.routine.name,
      venueLabel: venueText && locationName ? `${venueText} · ${locationName}` : venueText ?? locationName,
    });
  }

  const heatmapWeeks = buildWeeklyGrid(
    [...uniqueSessionMap.values()],
    rawTrainingLogs.map((log) => ({
      id: log.id,
      routineId: log.routineId,
      performedAt: log.performedAt,
      routineName: log.routine.name,
    })),
    now
  );

  // Recent climbing sessions
  const recentSessionMap = new Map<string, {
    id: string;
    date: Date;
    routineName: string;
    venueLabel: string;
    locationName: string | null;
    attempts: AttemptRow[];
  }>();
  for (const a of attempts) {
    const existing = recentSessionMap.get(a.sessionLogId) ?? {
      id: a.sessionLogId,
      date: a.sessionLog.performedAt,
      routineName: a.sessionLog.routine.name,
      venueLabel: venueType(a) === "GYM" ? "Indoor" : venueType(a) === "CRAG" ? "Outdoor" : "Unknown",
      locationName: a.sessionLog.climbLocation?.name ?? null,
      attempts: [],
    };
    existing.attempts.push(a);
    recentSessionMap.set(a.sessionLogId, existing);
  }
  const recentSessions = [...recentSessionMap.values()]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 6);

  // Supporting training
  const trainingByRoutine = new Map<string, { name: string; sessions: number; lastDate: Date }>();
  for (const log of rawTrainingLogs) {
    const entry = trainingByRoutine.get(log.routineId) ?? { name: log.routine.name, sessions: 0, lastDate: log.performedAt };
    entry.sessions++;
    if (log.performedAt > entry.lastDate) entry.lastDate = log.performedAt;
    trainingByRoutine.set(log.routineId, entry);
  }
  const trainingRoutines = [...trainingByRoutine.values()].sort((a, b) => b.sessions - a.sessions);
  const trainingMax = trainingRoutines[0]?.sessions ?? 1;
  const recentTrainingSessions = rawTrainingLogs.slice(0, 5);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* ── Hero metrics ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <HeroStat
          label="Sessions"
          value={String(totalSessions)}
          sub="all time"
          accent="rgba(78,148,255,0.9)"
        />
        {bestGrade !== "—" && (
          <HeroStat
            label="Highpoint"
            value={bestGrade}
            sub={bestGradeLabel}
            accent="rgba(251,191,36,0.9)"
          />
        )}
      </div>

      {/* ── Grade pyramids ── */}
      {(hasBoulder || hasYosemite) && (
        <SectionCard
          title="Grade Pyramid"
          subtitle="All-time attempts per grade, segmented by outcome. Hardest at the top."
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {hasBoulder && <OutcomeLegend system="BOULDER_V" />}
              {hasYosemite && !hasBoulder && <OutcomeLegend system="YOSEMITE" />}
            </div>
            {gymSessions > 0 || cragSessions > 0 ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {gymSessions > 0 && (
                  <PyramidSection
                    title={`Indoor (${gymSessions} session${gymSessions !== 1 ? "s" : ""})`}
                    rows={gymRows}
                    showBoth={gymRows.boulderRows.length > 0 && gymRows.yosemiteRows.length > 0}
                  />
                )}
                {cragSessions > 0 && (
                  <PyramidSection
                    title={`Outdoor (${cragSessions} session${cragSessions !== 1 ? "s" : ""})`}
                    rows={cragRows}
                    showBoth={cragRows.boulderRows.length > 0 && cragRows.yosemiteRows.length > 0}
                  />
                )}
              </div>
            ) : (
              <PyramidSection
                title="All sessions"
                rows={overallRows}
                showBoth={hasBoulder && hasYosemite}
              />
            )}
          </div>
        </SectionCard>
      )}

      {/* ── Venue Split + Top Venues ── */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {(gymSessions > 0 || cragSessions > 0) && (
          <SectionCard title="Venue Split">
            <div style={{ display: "grid", gap: 14 }}>
              {[
                { label: "Indoor", sessions: gymSessions, color: "rgba(78,148,255,0.8)" },
                { label: "Outdoor", sessions: cragSessions, color: "rgba(74,222,128,0.8)" },
              ].map((v) => {
                const pct = totalSessions > 0 ? Math.round((v.sessions / totalSessions) * 100) : 0;
                return (
                  <div key={v.label} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800 }}>
                      <span>{v.label}</span>
                      <span style={{ opacity: 0.7 }}>{v.sessions} session{v.sessions !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: v.color, borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.5 }}>{pct}% of sessions</div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}
        {venues.length > 0 && (
          <SectionCard title="Top Venues" subtitle="Where you climb most.">
            <div style={{ display: "grid", gap: 10 }}>
              {venues.map((v) => (
                <VenueBar key={v.name} name={v.name} sessions={v.sessions} max={venueMax} />
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── Activity Coverage ── */}
      {heatmapWeeks.length > 1 && (
        <SectionCard title="Activity Coverage" subtitle="Climbing sessions and supporting training — last 52 weeks. Tap any week to see what happened.">
          <ActivityCoverageHeatmap
            weeks={heatmapWeeks}
            sessionLabel="Climb session"
            trainingLabel="Training"
            sessionRowLabel="Climbing"
            trainingRowLabel="Training"
          />
        </SectionCard>
      )}

      {/* ── Supporting Training ── */}
      {trainingRoutines.length > 0 && (
        <SectionCard
          title="Supporting Training"
          subtitle="Strength, conditioning, and habit work tagged to climbing."
          actions={
            <Link
              href="/manual-log"
              style={{
                fontSize: 12,
                fontWeight: 800,
                opacity: 0.75,
                textDecoration: "none",
                color: "inherit",
                padding: "4px 9px",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
              }}
            >
              View log
            </Link>
          }
        >
          <div style={{ display: "grid", gap: 18 }}>
            {/* Per-routine breakdown */}
            <div style={{ display: "grid", gap: 8 }}>
              {trainingRoutines.map((r) => (
                <div key={r.name} style={{ display: "grid", gap: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>{r.name}</span>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                      <span style={{ fontSize: 11, opacity: 0.5 }}>last {formatAppDate(r.lastDate, { month: "short", day: "numeric" })}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.55 }}>{r.sessions}×</span>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.round((r.sessions / trainingMax) * 100)}%`, borderRadius: 999, background: "rgba(168,85,247,0.75)" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Recent training sessions */}
            {recentTrainingSessions.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.5 }}>Recent</div>
                {recentTrainingSessions.map((log) => {
                  const exerciseNames = [...new Set(log.exercises.map((e) => e.exercise.name))];
                  const totalSets = log.exercises.reduce((s, e) => s + e.sets.length, 0);
                  return (
                    <div
                      key={log.id}
                      style={{
                        display: "grid",
                        gap: 6,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(168,85,247,0.15)",
                        background: "rgba(168,85,247,0.04)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontWeight: 900, fontSize: 13 }}>{log.routine.name}</span>
                        <span style={{ fontSize: 11, opacity: 0.55 }}>{formatAppDate(log.performedAt, { month: "short", day: "numeric" })}</span>
                      </div>
                      {exerciseNames.length > 0 && (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {exerciseNames.slice(0, 6).map((name) => (
                            <span
                              key={name}
                              style={{
                                fontSize: 11,
                                padding: "2px 7px",
                                borderRadius: 999,
                                background: "rgba(168,85,247,0.12)",
                                border: "1px solid rgba(168,85,247,0.2)",
                                fontWeight: 700,
                              }}
                            >
                              {name}
                            </span>
                          ))}
                          {totalSets > 0 && (
                            <span style={{ fontSize: 11, opacity: 0.5, alignSelf: "center" }}>{totalSets} sets</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── Recent Sessions ── */}
      {recentSessions.length > 0 && (
        <SectionCard title="Recent Sessions" subtitle="Latest sessions with grade breakdown.">
          <div style={{ display: "grid", gap: 10 }}>
            {recentSessions.map((session) => {
              const gradeOutcomeCounts = new Map<string, { grade: string; gradeSystem: ClimbGradeSystem; outcome: ClimbOutcome; count: number }>();
              for (const a of session.attempts) {
                const key = `${a.gradeSystem}-${a.grade}-${a.outcome}`;
                const existing = gradeOutcomeCounts.get(key) ?? { grade: a.grade, gradeSystem: a.gradeSystem, outcome: a.outcome, count: 0 };
                existing.count++;
                gradeOutcomeCounts.set(key, existing);
              }
              const badges = [...gradeOutcomeCounts.values()].slice(0, 8);

              return (
                <div
                  key={session.id}
                  style={{
                    display: "grid",
                    gap: 8,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, fontSize: 14 }}>{session.routineName}</div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>
                      {formatAppDate(session.date, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {[
                      session.venueLabel,
                      session.locationName,
                      `${session.attempts.length} climb${session.attempts.length !== 1 ? "s" : ""}`,
                    ]
                      .filter((v): v is string => Boolean(v))
                      .map((chip) => (
                        <span
                          key={chip}
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.09)",
                            fontWeight: 700,
                          }}
                        >
                          {chip}
                        </span>
                      ))}
                  </div>
                  {badges.length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {badges.map((b) => (
                        <span
                          key={`${b.gradeSystem}-${b.grade}-${b.outcome}`}
                          style={{
                            fontSize: 11,
                            padding: "3px 9px",
                            borderRadius: 999,
                            background: climbOutcomeBg(b.outcome),
                            border: `1px solid ${climbOutcomeColor(b.outcome).replace("0.9)", "0.3)")}`,
                            fontWeight: 800,
                            color: climbOutcomeColor(b.outcome),
                          }}
                        >
                          {b.grade} {climbOutcomeLabel(b.outcome, b.gradeSystem)}
                          {b.count > 1 ? ` ×${b.count}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
