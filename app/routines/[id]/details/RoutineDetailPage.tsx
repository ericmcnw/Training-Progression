import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { todayAppYmd, formatAppDate } from "@/lib/dates";
import { effectiveRoutineDomain, domainColor, formatRoutineSubtype, formatRoutineTypeLabel } from "@/lib/routines";
import { formatDuration, formatPace, getWorkoutSessionMetrics } from "@/lib/progress";
import { getRoutineGoalContributions } from "@/lib/routine-frequency-context";
import InteractiveSparkline from "@/app/activities/_shared/InteractiveSparkline";

// Bare /routines/[id] content. The directory's [[...segments]]/page.tsx
// dispatches the empty-segments case to this component (Next.js doesn't
// let us add a sibling page.tsx because the catch-all is optional and
// matches the bare path too).
//
// Render: header + cadence/contribution row + per-exercise charts (for
// WORKOUT) + recent sessions list + frequency-goal contributions.
// Other kinds (SESSION / CARDIO / GUIDED / COMPLETION) render a simpler
// variant of the same layout — no per-exercise breakdown, but header +
// cadence + recent sessions still work.

const DOMAIN_LABEL: Record<string, string> = {
  strength: "Strength",
  cardio: "Endurance",
  sport: "Sport",
  mobility: "Mobility",
  lifestyle: "Lifestyle",
};

export default async function RoutineDetailPage({ id }: { id: string }) {
  const today = todayAppYmd();
  const since = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);

  const [routine, logs, goalContributions] = await Promise.all([
    prisma.routine.findUnique({
      where: { id, isDeleted: false },
      select: {
        id: true,
        name: true,
        kind: true,
        subtype: true,
        domain: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.routineLog.findMany({
      where: { routineId: id, performedAt: { gte: since } },
      orderBy: { performedAt: "desc" },
      select: {
        id: true,
        performedAt: true,
        notes: true,
        durationSec: true,
        distanceMi: true,
        elevationGainFt: true,
        completionCount: true,
        exercises: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            exerciseId: true,
            exercise: { select: { name: true, unit: true } },
            sets: {
              orderBy: { setNumber: "asc" },
              select: { setNumber: true, reps: true, seconds: true, weightLb: true },
            },
          },
        },
      },
    }),
    getRoutineGoalContributions(id, today),
  ]);

  if (!routine) return notFound();

  const kind = String(routine.kind);
  const domain = effectiveRoutineDomain(routine.domain, routine.kind, routine.subtype);
  const accent = domainColor(domain);
  const subtypeLabel = formatRoutineSubtype(routine.subtype);
  const typeLabel = subtypeLabel || formatRoutineTypeLabel(kind);
  const lastSession = logs[0]?.performedAt ?? null;
  const sessions12w = logs.length;

  // Per-exercise rollup (workout kind only).
  type ExerciseRollup = {
    exerciseId: string;
    name: string;
    unit: string;
    sessions: number;
    topWeightLb: number;
    topReps: number;
    totalSets: number;
    totalVolume: number;
    lastSet: { date: Date; weightLb: number | null; reps: number | null; seconds: number | null } | null;
    recentTopWeights: Array<{ date: Date; weight: number }>;
  };
  const isWorkoutKind = kind === "WORKOUT";
  const exerciseRollups = new Map<string, ExerciseRollup>();
  if (isWorkoutKind) {
    for (const log of logs) {
      for (const ex of log.exercises) {
        const existing = exerciseRollups.get(ex.exerciseId);
        const metrics = getWorkoutSessionMetrics(ex.sets);
        const lastSetRow = ex.sets[ex.sets.length - 1] ?? null;
        if (existing) {
          existing.sessions += 1;
          existing.totalSets += metrics.totalSets;
          existing.totalVolume += metrics.totalVolume;
          if (metrics.topWeight > existing.topWeightLb) {
            existing.topWeightLb = metrics.topWeight;
            const topSet = ex.sets.find((s) => (s.weightLb ?? 0) === metrics.topWeight);
            existing.topReps = topSet?.reps ?? 0;
          }
          if (!existing.lastSet || log.performedAt > existing.lastSet.date) {
            existing.lastSet = lastSetRow
              ? { date: log.performedAt, weightLb: lastSetRow.weightLb, reps: lastSetRow.reps, seconds: lastSetRow.seconds }
              : null;
          }
          if (metrics.topWeight > 0) {
            existing.recentTopWeights.push({ date: log.performedAt, weight: metrics.topWeight });
          }
        } else {
          const topSet = ex.sets.find((s) => (s.weightLb ?? 0) === metrics.topWeight);
          exerciseRollups.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            name: ex.exercise.name,
            unit: ex.exercise.unit,
            sessions: 1,
            topWeightLb: metrics.topWeight,
            topReps: topSet?.reps ?? 0,
            totalSets: metrics.totalSets,
            totalVolume: metrics.totalVolume,
            lastSet: lastSetRow
              ? { date: log.performedAt, weightLb: lastSetRow.weightLb, reps: lastSetRow.reps, seconds: lastSetRow.seconds }
              : null,
            recentTopWeights: metrics.topWeight > 0 ? [{ date: log.performedAt, weight: metrics.topWeight }] : [],
          });
        }
      }
    }
  }
  const sortedExercises = Array.from(exerciseRollups.values()).sort(
    (a, b) => b.sessions - a.sessions || b.topWeightLb - a.topWeightLb || a.name.localeCompare(b.name)
  );

  return (
    <div style={pageStyle}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header style={headerStyle(accent)}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <Link href="/log" style={backLinkStyle}>← All routines</Link>
          <div style={eyebrowStyle}>
            {DOMAIN_LABEL[domain] ?? domain} · {typeLabel}
          </div>
          <h1 style={titleStyle}>{routine.name}</h1>
          {!routine.isActive ? (
            <span style={archivedBadgeStyle}>Archived</span>
          ) : null}
        </div>
        <div style={headerActionsStyle}>
          <Link href={`/routines/${routine.id}/log`} style={primaryActionStyle(accent)}>
            Log now
          </Link>
          <Link href={`/routines/${routine.id}/edit`} style={secondaryActionStyle}>
            Edit
          </Link>
        </div>
      </header>

      {/* ── Cadence summary ─────────────────────────────────────────── */}
      <section style={statRowStyle}>
        <Stat
          label={sessions12w === 1 ? "session 12w" : "sessions 12w"}
          value={String(sessions12w)}
          accent={accent}
        />
        <Stat
          label="last logged"
          value={lastSession ? formatAppDate(lastSession, { month: "short", day: "numeric" }) : "—"}
          accent={accent}
          dim={!lastSession}
        />
        {goalContributions.length > 0 ? (
          <Stat
            label={goalContributions.length === 1 ? "goal" : "goals"}
            value={String(goalContributions.length)}
            accent={accent}
          />
        ) : null}
      </section>

      {/* ── Frequency goal contributions ─────────────────────────────── */}
      {goalContributions.length > 0 ? (
        <Section title="Goals this routine contributes to">
          <div style={{ display: "grid", gap: 6 }}>
            {goalContributions.map((g) => (
              <Link key={g.goalId} href={`/goals/${g.goalId}`} style={goalRowStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={goalNameStyle}>{g.goalName}</div>
                  <div style={goalSubStyle}>
                    {g.cadenceLabel} · {g.role === "PRIMARY" ? "primary" : "substitute"}
                    {g.isGroup ? " · group" : ""}
                  </div>
                </div>
                <span style={goalProgressStyle(accent, g.progress >= g.target)}>
                  {g.progress}/{g.target}
                  {g.hitToday ? " ✓" : ""}
                </span>
                <span style={caretStyle}>›</span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {/* ── Per-exercise breakdown (WORKOUT only) ────────────────────── */}
      {isWorkoutKind && sortedExercises.length > 0 ? (
        <Section
          title="Exercises"
          subtitle={`${sortedExercises.length} exercise${sortedExercises.length === 1 ? "" : "s"} trained in the last 12 weeks`}
        >
          <div style={{ display: "grid", gap: 8 }}>
            {sortedExercises.map((ex) => (
              <ExerciseRow key={ex.exerciseId} ex={ex} accent={accent} />
            ))}
          </div>
        </Section>
      ) : null}

      {/* ── Recent sessions ─────────────────────────────────────────── */}
      {logs.length > 0 ? (
        <Section title="Recent sessions" subtitle={`Last ${Math.min(logs.length, 10)} of ${logs.length} in the 12-week window`}>
          <div style={{ display: "grid", gap: 8 }}>
            {logs.slice(0, 10).map((log) => (
              <SessionRow key={log.id} log={log} routineId={routine.id} accent={accent} kind={kind} />
            ))}
          </div>
        </Section>
      ) : (
        <Section title="No recent sessions">
          <EmptyHint>
            This routine has no logs in the last 12 weeks.{" "}
            <Link href={`/routines/${routine.id}/log`} style={{ color: accent, fontWeight: 800 }}>
              Log one now →
            </Link>
          </EmptyHint>
        </Section>
      )}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <header style={sectionHeaderStyle}>
        <div style={sectionTitleStyle}>{title}</div>
        {subtitle ? <div style={sectionSubtitleStyle}>{subtitle}</div> : null}
      </header>
      <div style={{ padding: 12 }}>{children}</div>
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "8px 4px", fontSize: 13, opacity: 0.65, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

function Stat({ label, value, accent, dim }: { label: string; value: string; accent: string; dim?: boolean }) {
  return (
    <div style={statTileStyle}>
      <div style={{ ...statValueStyle, color: accent, opacity: dim ? 0.45 : 1 }}>{value}</div>
      <div style={statLabelStyle}>{label}</div>
    </div>
  );
}

function ExerciseRow({
  ex,
  accent,
}: {
  ex: {
    exerciseId: string;
    name: string;
    sessions: number;
    topWeightLb: number;
    topReps: number;
    totalSets: number;
    totalVolume: number;
    lastSet: { date: Date; weightLb: number | null; reps: number | null; seconds: number | null } | null;
    recentTopWeights: Array<{ date: Date; weight: number }>;
  };
  accent: string;
}) {
  const sparkPoints = [...ex.recentTopWeights].sort((a, b) => a.date.getTime() - b.date.getTime());
  // Row is a div (not a Link) so the InteractiveSparkline's hover/tap
  // events don't compete with row-wide navigation. A small "View →"
  // pill at the bottom of the row provides the navigation to
  // /exercises/<id> when the user wants the full multi-metric chart.
  return (
    <div style={exerciseRowStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={exerciseNameStyle}>{ex.name}</div>
          <div style={exerciseSubStyle}>
            {ex.sessions} session{ex.sessions === 1 ? "" : "s"} · {ex.totalSets} sets · {formatVolume(ex.totalVolume)}
          </div>
        </div>
        {ex.topWeightLb > 0 ? (
          <div style={{ display: "grid", gap: 1, textAlign: "right" }}>
            <div style={topWeightLabelStyle}>Top weight</div>
            <div style={{ ...topWeightValueStyle, color: accent }}>
              {ex.topWeightLb} lb × {ex.topReps}
            </div>
          </div>
        ) : null}
      </div>
      {sparkPoints.length >= 2 ? (
        <div style={{ marginTop: 8 }}>
          <InteractiveSparkline
            points={sparkPoints.map((p) => ({
              date: p.date,
              value: p.weight,
              label: `${p.weight} lb top set`,
            }))}
            accent={accent}
            height={32}
          />
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6 }}>
        {ex.lastSet ? (
          <div style={lastSetLineStyle}>
            Last: {formatSet(ex.lastSet)} · {formatAppDate(ex.lastSet.date, { month: "short", day: "numeric" })}
          </div>
        ) : <span />}
        <Link href={`/exercises/${ex.exerciseId}`} style={viewDetailLinkStyle(accent)}>
          View →
        </Link>
      </div>
    </div>
  );
}


function SessionRow({
  log,
  routineId,
  accent,
  kind,
}: {
  log: {
    id: string;
    performedAt: Date;
    notes: string | null;
    durationSec: number | null;
    distanceMi: number | null;
    elevationGainFt: number | null;
    completionCount: number | null;
    exercises: Array<{
      exerciseId: string;
      exercise: { name: string; unit: string };
      sets: Array<{ setNumber: number; reps: number | null; seconds: number | null; weightLb: number | null }>;
    }>;
  };
  routineId: string;
  accent: string;
  kind: string;
}) {
  const summary = buildSessionSummary(log, kind);
  return (
    <Link href={`/routines/${routineId}/logs/${log.id}/details`} style={sessionRowStyle(accent)}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={sessionDateStyle}>
          {formatAppDate(log.performedAt, { weekday: "short", month: "short", day: "numeric" })}
        </div>
        {summary ? <div style={sessionSummaryStyle}>{summary}</div> : null}
        {log.notes ? <div style={sessionNotesStyle}>{log.notes}</div> : null}
      </div>
      <span style={caretStyle}>›</span>
    </Link>
  );
}

function buildSessionSummary(
  log: {
    durationSec: number | null;
    distanceMi: number | null;
    elevationGainFt: number | null;
    completionCount: number | null;
    exercises: Array<{ exercise: { name: string }; sets: Array<{ reps: number | null; seconds: number | null; weightLb: number | null }> }>;
  },
  kind: string
): string | null {
  if (kind === "WORKOUT" && log.exercises.length > 0) {
    const parts: string[] = [];
    for (const ex of log.exercises) {
      const m = getWorkoutSessionMetrics(ex.sets);
      const heaviestReps = ex.sets.find((s) => (s.weightLb ?? 0) === m.topWeight)?.reps ?? 0;
      if (m.topWeight > 0 && heaviestReps > 0) {
        parts.push(`${ex.exercise.name} ${m.totalSets}×${heaviestReps} @ ${m.topWeight}`);
      } else if (m.totalReps > 0) {
        parts.push(`${ex.exercise.name} ${m.totalSets}×${Math.round(m.totalReps / m.totalSets)}`);
      } else if (m.maxTimeSeconds > 0) {
        parts.push(`${ex.exercise.name} ${m.totalSets}×${m.maxTimeSeconds}s`);
      }
      if (parts.length >= 4) {
        if (log.exercises.length > parts.length) parts.push(`+${log.exercises.length - parts.length} more`);
        break;
      }
    }
    return parts.join(" · ");
  }
  if (kind === "CARDIO") {
    const bits: string[] = [];
    if (log.distanceMi != null) bits.push(`${log.distanceMi.toFixed(2)} mi`);
    if (log.durationSec != null) bits.push(formatDuration(log.durationSec));
    if (log.distanceMi && log.durationSec && log.distanceMi > 0) {
      bits.push(`${formatPace(log.durationSec / log.distanceMi)} /mi`);
    }
    if (log.elevationGainFt != null && log.elevationGainFt > 0) {
      bits.push(`${log.elevationGainFt.toLocaleString()} ft`);
    }
    return bits.join(" · ") || null;
  }
  if (kind === "GUIDED" || kind === "SESSION") {
    if (log.durationSec != null) return formatDuration(log.durationSec);
  }
  if (kind === "COMPLETION") {
    if (log.completionCount != null && log.completionCount > 0) return `${log.completionCount}×`;
    return "Completed";
  }
  return null;
}

function formatSet(s: { weightLb: number | null; reps: number | null; seconds: number | null }): string {
  if (s.weightLb != null && s.weightLb > 0 && s.reps != null) return `${s.reps} × ${s.weightLb} lb`;
  if (s.reps != null) return `${s.reps} reps`;
  if (s.seconds != null) return `${s.seconds}s`;
  return "—";
}

function formatVolume(lb: number): string {
  if (lb <= 0) return "—";
  if (lb >= 10000) return `${(lb / 1000).toFixed(0)}k lb`;
  if (lb >= 1000) return `${(lb / 1000).toFixed(1)}k lb`;
  return `${lb.toLocaleString()} lb`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "16px 14px 60px",
  display: "grid",
  gap: 14,
};

function headerStyle(accent: string): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    flexWrap: "wrap",
    padding: "12px 14px",
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: accent.replace("0.9)", "0.22)"),
    background: `linear-gradient(135deg, ${accent.replace("0.9)", "0.12)")}, rgba(255,255,255,0.025))`,
  };
}

const backLinkStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.6,
  textDecoration: "none",
  color: "inherit",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  opacity: 0.65,
  marginTop: 6,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: -0.4,
  lineHeight: 1.15,
};

const archivedBadgeStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.4,
  padding: "2px 7px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.14)",
  alignSelf: "flex-start",
  textTransform: "uppercase",
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexShrink: 0,
};

function primaryActionStyle(accent: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 14px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: accent.replace("0.9)", "0.42)"),
    background: accent.replace("0.9)", "0.15)"),
    color: accent,
    fontSize: 12,
    fontWeight: 900,
    textDecoration: "none",
    whiteSpace: "nowrap",
    minHeight: 36,
  };
}

const secondaryActionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  minHeight: 36,
};

const statRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
};

const statTileStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "10px 12px",
  borderRadius: 12,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.05,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};

const sectionStyle: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.08)",
  borderRadius: 14,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "rgba(255,255,255,0.03)",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "rgba(255,255,255,0.05)",
  display: "grid",
  gap: 2,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 0.3,
};

const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
};

const goalRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
  textDecoration: "none",
  color: "inherit",
  minHeight: 48,
};

const goalNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
};

const goalSubStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
  marginTop: 2,
};

function goalProgressStyle(accent: string, achieved: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 900,
    padding: "3px 8px",
    borderRadius: 999,
    background: achieved ? "rgba(74,222,128,0.14)" : accent.replace("0.9)", "0.10)"),
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: achieved ? "rgba(74,222,128,0.4)" : accent.replace("0.9)", "0.28)"),
    color: achieved ? "rgba(134,239,172,0.95)" : accent,
    whiteSpace: "nowrap",
  };
}

const caretStyle: React.CSSProperties = {
  fontSize: 16,
  opacity: 0.4,
  fontWeight: 700,
};

const exerciseRowStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
};

// Small "View →" pill that takes the user from an exercise row on the
// routine detail page to the full /exercises/<id> detail page. Lives
// inside the row alongside the InteractiveSparkline so the row isn't
// itself a Link (which would compete with the sparkline's hover/tap).
function viewDetailLinkStyle(accent: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: accent.replace("0.9)", "0.32)"),
    background: accent.replace("0.9)", "0.10)"),
    color: accent,
    fontSize: 10.5,
    fontWeight: 800,
    textDecoration: "none",
    whiteSpace: "nowrap",
    minHeight: 28,
    letterSpacing: 0.3,
  };
}

const exerciseNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
};

const exerciseSubStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.65,
  marginTop: 2,
};

const topWeightLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.55,
};

const topWeightValueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1.1,
};

const lastSetLineStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.62,
  fontWeight: 700,
  marginTop: 6,
};

function sessionRowStyle(accent: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderLeftColor: accent.replace("0.9)", "0.45)"),
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "rgba(255,255,255,0.06)",
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: "rgba(255,255,255,0.06)",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: "rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    textDecoration: "none",
    color: "inherit",
    minHeight: 52,
  };
}

const sessionDateStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.75,
};

const sessionSummaryStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginTop: 2,
  lineHeight: 1.4,
};

const sessionNotesStyle: React.CSSProperties = {
  fontSize: 11,
  fontStyle: "italic",
  opacity: 0.55,
  marginTop: 3,
};
