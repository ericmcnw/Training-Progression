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
import ActivityGoalsSection from "./ActivityGoalsSection";
import { PulseCard } from "./ActivityPulseStrip";
import { getActivityGoals } from "@/lib/activity-goals";

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
// Outcomes shown in the pyramid bars. Falls are excluded — the pyramid is a
// snapshot of what you sent, not what you tried.
const PYRAMID_OUTCOMES: ClimbOutcome[] = ["FLASH", "ONSIGHT", "SEND", "REDPOINT", "PROJECT"];

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
    if (a.outcome === "FELL") continue;
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

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weeklyStreak(sessionDates: Date[], now: Date): { current: number; longest: number } {
  if (sessionDates.length === 0) return { current: 0, longest: 0 };
  const weekKeys = new Set<string>();
  for (const d of sessionDates) {
    weekKeys.add(startOfWeek(d).toISOString().slice(0, 10));
  }
  const sortedWeeks = [...weekKeys].sort();

  // longest streak across history
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedWeeks.length; i += 1) {
    const prev = new Date(sortedWeeks[i - 1]);
    const curr = new Date(sortedWeeks[i]);
    const gap = Math.round((curr.getTime() - prev.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (gap === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  // current streak: walk back from this week
  let current = 0;
  let cursor = startOfWeek(now);
  while (weekKeys.has(cursor.toISOString().slice(0, 10))) {
    current += 1;
    cursor = new Date(cursor.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return { current, longest };
}

function trendArrow(curr: number, prev: number): { arrow: string; tone: "up" | "down" | "flat"; delta: string } {
  if (curr === prev) return { arrow: "→", tone: "flat", delta: "0" };
  if (curr > prev) return { arrow: "↑", tone: "up", delta: `+${curr - prev}` };
  return { arrow: "↓", tone: "down", delta: `${curr - prev}` };
}

// ── Sub-components ───────────────────────────────────────────────────────────

type TimelineSession = {
  id: string;
  routineId: string;
  date: Date;
  venue: "GYM" | "CRAG" | "UNKNOWN";
  locationName: string | null;
  attempts: number;
  topGrade: string | null;
  topGradeOutcome: ClimbOutcome | null;
  topGradeSystem: ClimbGradeSystem | null;
};

function SessionTimeline({ sessions }: { sessions: TimelineSession[] }) {
  if (sessions.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        overflowX: "auto",
        scrollSnapType: "x proximity",
        paddingBottom: 6,
        marginBottom: -6,
      }}
    >
      {sessions.map((s) => {
        const venueColor = s.venue === "GYM" ? "rgba(78,148,255,0.85)" : s.venue === "CRAG" ? "rgba(74,222,128,0.85)" : "rgba(255,255,255,0.55)";
        const venueBg = s.venue === "GYM" ? "rgba(78,148,255,0.10)" : s.venue === "CRAG" ? "rgba(74,222,128,0.10)" : "rgba(255,255,255,0.04)";
        const venueLabel = s.venue === "GYM" ? "Indoor" : s.venue === "CRAG" ? "Outdoor" : "—";
        const dateLabel = s.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const weekdayLabel = s.date.toLocaleDateString("en-US", { weekday: "short" });

        return (
          <Link
            key={s.id}
            href={`/routines/${s.routineId}/logs/${s.id}/details`}
            style={{
              flex: "0 0 auto",
              width: 168,
              scrollSnapAlign: "start",
              display: "grid",
              gap: 8,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              textDecoration: "none",
              color: "inherit",
              transition: "border-color 120ms ease, transform 120ms ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{dateLabel}</span>
              <span style={{ fontSize: 10, opacity: 0.55, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6 }}>{weekdayLabel}</span>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "2px 7px",
                  borderRadius: 999,
                  border: `1px solid ${venueColor.replace("0.85)", "0.3)")}`,
                  background: venueBg,
                  color: venueColor,
                  letterSpacing: 0.3,
                }}
              >
                {venueLabel}
              </span>
              {s.locationName ? (
                <span style={{ fontSize: 10, opacity: 0.55, fontWeight: 700, alignSelf: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                  {s.locationName}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8, marginTop: 2 }}>
              <div style={{ display: "grid", gap: 2 }}>
                <span style={{ fontSize: 10, opacity: 0.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6 }}>Climbs</span>
                <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{s.attempts}</span>
              </div>
              {s.topGrade && s.topGradeOutcome ? (
                <div
                  style={{
                    padding: "4px 9px",
                    borderRadius: 9,
                    background: climbOutcomeBg(s.topGradeOutcome),
                    border: `1px solid ${climbOutcomeColor(s.topGradeOutcome).replace("0.9)", "0.32)")}`,
                    color: climbOutcomeColor(s.topGradeOutcome),
                    fontWeight: 900,
                    fontSize: 13,
                    lineHeight: 1.1,
                  }}
                >
                  {s.topGrade}
                </div>
              ) : null}
            </div>
          </Link>
        );
      })}
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
  const segments = PYRAMID_OUTCOMES.map((o) => ({ outcome: o, count: row.counts[o] ?? 0 })).filter((s) => s.count > 0);

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
      ? [{ outcome: "FLASH" as ClimbOutcome, label: "Flash" }, { outcome: "SEND" as ClimbOutcome, label: "Send" }, { outcome: "PROJECT" as ClimbOutcome, label: "Project" }]
      : [{ outcome: "ONSIGHT" as ClimbOutcome, label: "Onsight" }, { outcome: "SEND" as ClimbOutcome, label: "Send" }, { outcome: "PROJECT" as ClimbOutcome, label: "Project" }];
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

  const [attempts, rawTrainingLogs, climbingGoals] = await Promise.all([
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
    getActivityGoals("climbing"),
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
  const allRecentSessions = [...recentSessionMap.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  const recentSessions = allRecentSessions.slice(0, 6);

  // ── Pulse-strip aggregates ─────────────────────────────────────────────────
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = daysAgo(now, 30);
  const sixtyDaysAgo = daysAgo(now, 60);

  const attemptsThisWeek = attempts.filter((a) => a.sessionLog.performedAt >= thisWeekStart);
  const attemptsLastWeek = attempts.filter((a) => a.sessionLog.performedAt >= lastWeekStart && a.sessionLog.performedAt < thisWeekStart);
  const sessionsThisWeek = new Set(attemptsThisWeek.map((a) => a.sessionLogId)).size;
  const sessionsLastWeek = new Set(attemptsLastWeek.map((a) => a.sessionLogId)).size;
  const climbsThisWeek = attemptsThisWeek.length;

  const attempts30d = attempts.filter((a) => a.sessionLog.performedAt >= thirtyDaysAgo);
  const attemptsPrior30d = attempts.filter((a) => a.sessionLog.performedAt >= sixtyDaysAgo && a.sessionLog.performedAt < thirtyDaysAgo);
  const sessions30d = new Set(attempts30d.map((a) => a.sessionLogId)).size;

  const top30dRows = buildPyramidRows(attempts30d);
  const top30dGrade =
    hardestGrade(top30dRows.boulderRows, sends) ??
    hardestGrade(top30dRows.yosemiteRows, sends);
  const priorTop30dRows = buildPyramidRows(attemptsPrior30d);
  const priorTop30dGrade =
    hardestGrade(priorTop30dRows.boulderRows, sends) ??
    hardestGrade(priorTop30dRows.yosemiteRows, sends);

  const sessionDates = [...new Set([...uniqueSessionMap.values()].map((s) => s.performedAt.toISOString().slice(0, 10)))].map((iso) => new Date(iso));
  const streak = weeklyStreak(sessionDates, now);

  // ── Recent session timeline ────────────────────────────────────────────────
  const sendOutcomes: ClimbOutcome[] = ["FLASH", "ONSIGHT", "SEND", "REDPOINT"];
  const timelineSessions: TimelineSession[] = allRecentSessions.slice(0, 8).map((s) => {
    // Pick the hardest sent attempt; fall back to hardest attempted.
    const sentAttempts = s.attempts.filter((a) => sendOutcomes.includes(a.outcome));
    const pool = sentAttempts.length > 0 ? sentAttempts : s.attempts;
    const top = pool.reduce<typeof pool[number] | null>((best, a) => {
      if (!best) return a;
      const aRank = gradeSort(a.grade, a.gradeSystem);
      const bRank = gradeSort(best.grade, best.gradeSystem);
      return aRank > bRank ? a : best;
    }, null);
    return {
      id: s.id,
      routineId: s.attempts[0]?.sessionLog.routineId ?? "",
      date: s.date,
      venue: s.venueLabel === "Indoor" ? "GYM" : s.venueLabel === "Outdoor" ? "CRAG" : "UNKNOWN",
      locationName: s.locationName,
      attempts: s.attempts.length,
      topGrade: top?.grade ?? null,
      topGradeOutcome: top?.outcome ?? null,
      topGradeSystem: top?.gradeSystem ?? null,
    };
  });

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

  const sessionsTrend = trendArrow(sessionsThisWeek, sessionsLastWeek);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* ── Pulse strip — momentum at a glance ── */}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <PulseCard
          label="This Week"
          value={String(sessionsThisWeek)}
          sub={sessionsThisWeek === 0
            ? "No sessions yet"
            : `${climbsThisWeek} climb${climbsThisWeek !== 1 ? "s" : ""} logged`}
          trend={
            sessionsLastWeek > 0 || sessionsThisWeek > 0
              ? { ...sessionsTrend, suffix: " vs last wk" }
              : undefined
          }
          accent="rgba(78,148,255,0.9)"
        />
        <PulseCard
          label="30-Day Top"
          value={top30dGrade ?? "—"}
          sub={top30dGrade
            ? priorTop30dGrade && priorTop30dGrade !== top30dGrade
              ? `Prior 30d top: ${priorTop30dGrade}`
              : `${sessions30d} session${sessions30d !== 1 ? "s" : ""} in window`
            : "Send something in the next 30 days"}
          accent="rgba(251,146,60,0.9)"
        />
        <PulseCard
          label="Highpoint"
          value={bestGrade}
          sub={bestGradeLabel}
          accent="rgba(251,191,36,0.9)"
        />
        <PulseCard
          label="Weekly Streak"
          value={`${streak.current}w`}
          sub={streak.longest > streak.current ? `Best run: ${streak.longest} weeks` : streak.current > 0 ? "Personal best — keep going" : "Climb this week to start"}
          accent="rgba(74,222,128,0.9)"
        />
      </div>

      {/* ── Active climbing goals — slot reserved between pulse and timeline ── */}
      <ActivityGoalsSection
        goals={climbingGoals}
        activitySlug="climbing"
        activityLabel="Climbing"
      />

      {/* ── Recent session timeline (glanceable horizontal strip) ── */}
      {timelineSessions.length > 0 && (
        <SectionCard
          title="Recent Sessions"
          subtitle="Last 8 sessions at a glance — tap a card to drill into the log."
          actions={
            totalSessions > timelineSessions.length ? (
              <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.55, letterSpacing: 0.4 }}>
                {totalSessions - timelineSessions.length} more in history
              </span>
            ) : undefined
          }
        >
          <SessionTimeline sessions={timelineSessions} />
        </SectionCard>
      )}

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

      {/* ── Session Detail — full grade breakdown per session ── */}
      {recentSessions.length > 0 && (
        <SectionCard title="Session Detail" subtitle="Full grade breakdown of each recent session.">
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
              const routineId = session.attempts[0]?.sessionLog.routineId ?? "";

              return (
                <Link
                  key={session.id}
                  href={`/routines/${routineId}/logs/${session.id}/details`}
                  style={{
                    display: "grid",
                    gap: 8,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                    color: "inherit",
                    textDecoration: "none",
                    transition: "border-color 120ms ease",
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
                </Link>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
