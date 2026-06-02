import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatAppDate } from "@/lib/dates";
import { exerciseUnitLabel } from "@/lib/exercises";
import ExerciseMetricChart, { type ExerciseSessionPoint } from "./ExerciseMetricChart";

export const dynamic = "force-dynamic";

// In-depth detail page for a single exercise. Replaces the previous
// behavior where /exercises/<id> dumped users on the edit form.
//
// Sections:
//   - Header: name, unit, weight-capable badge, library kind, edit pill
//   - Stats row: total sessions, all-time top weight (or top reps for
//     bodyweight), most recent session date
//   - ExerciseMetricChart: interactive overlay of sets/reps/weight/time
//     trends across every session that touched this exercise.
//     Multi-line overlay in "all" view (no Y axis), single-line +
//     Y-axis with units in filtered views.
//   - Recent sessions list: last 8 sessions, each with the actual sets
//     logged ("3 × 185 lb, 5 × 175 lb, 8 × 165 lb"), date, routine
//     name, click-through to the log detail.
//   - Routines that train this exercise: linked rows.

export default async function ExerciseDetailPage({ id }: { id: string }) {
  const [exercise, sessionExercises, routineMemberships] = await Promise.all([
    prisma.exercise.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        unit: true,
        supportsWeight: true,
        libraryKind: true,
      },
    }),
    prisma.sessionExercise.findMany({
      where: { exerciseId: id },
      orderBy: { routineLog: { performedAt: "asc" } },
      select: {
        id: true,
        routineLog: {
          select: {
            id: true,
            routineId: true,
            performedAt: true,
            routine: { select: { name: true } },
          },
        },
        sets: {
          orderBy: { setNumber: "asc" },
          select: { setNumber: true, reps: true, seconds: true, weightLb: true },
        },
      },
    }),
    prisma.routineExercise.findMany({
      where: { exerciseId: id },
      select: {
        routine: {
          select: { id: true, name: true, isActive: true, isDeleted: true },
        },
      },
    }),
  ]);

  if (!exercise) return notFound();

  const isTimeBased = exercise.unit === "TIME";

  // Reduce SessionExercise rows → one ExerciseSessionPoint each (the
  // chart input). Skips sessions with no sets recorded.
  const sessionPoints: ExerciseSessionPoint[] = sessionExercises
    .filter((se) => se.sets.length > 0)
    .map((se) => {
      let topWeightLb = 0;
      let topWeightReps = 0;
      let topReps = 0;
      let totalReps = 0;
      let maxTimeSec = 0;
      for (const s of se.sets) {
        const w = s.weightLb ?? 0;
        const r = s.reps ?? 0;
        const t = s.seconds ?? 0;
        if (w > topWeightLb) {
          topWeightLb = w;
          topWeightReps = r;
        }
        if (r > topReps) topReps = r;
        totalReps += r;
        if (t > maxTimeSec) maxTimeSec = t;
      }
      return {
        logId: se.routineLog.id,
        routineId: se.routineLog.routineId,
        routineName: se.routineLog.routine?.name ?? "Untitled routine",
        performedAt: se.routineLog.performedAt,
        topWeightLb,
        topWeightReps,
        topReps,
        totalSets: se.sets.length,
        maxTimeSec,
        totalReps,
      };
    });

  // All-time records.
  const allTimeTopWeight = sessionPoints.reduce(
    (best, p) => (p.topWeightLb > (best?.topWeightLb ?? 0) ? p : best),
    null as ExerciseSessionPoint | null
  );
  const allTimeTopReps = sessionPoints.reduce(
    (best, p) => (p.topReps > (best?.topReps ?? 0) ? p : best),
    null as ExerciseSessionPoint | null
  );
  const allTimeLongestTime = isTimeBased
    ? sessionPoints.reduce((best, p) => (p.maxTimeSec > (best?.maxTimeSec ?? 0) ? p : best), null as ExerciseSessionPoint | null)
    : null;
  const lastSession = sessionPoints.length > 0 ? sessionPoints[sessionPoints.length - 1] : null;

  // Recent sessions (last 8) — also pull the raw sets per session so
  // we can render "3 × 185 lb, 5 × 175 lb..." breakdowns.
  const sortedNewest = [...sessionExercises].sort(
    (a, b) => b.routineLog.performedAt.getTime() - a.routineLog.performedAt.getTime()
  );
  const recent = sortedNewest.slice(0, 8);

  // De-dupe routines and split active vs archived.
  const seen = new Set<string>();
  const routines = routineMemberships
    .map((rm) => rm.routine)
    .filter((r) => {
      if (!r || r.isDeleted) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .sort((a, b) => Number(b!.isActive) - Number(a!.isActive) || a!.name.localeCompare(b!.name));

  return (
    <div style={pageStyle}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header style={headerStyle}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <Link href="/exercises" style={backLinkStyle}>← All exercises</Link>
          <div style={eyebrowStyle}>
            {exerciseUnitLabel(exercise.unit)}
            {exercise.supportsWeight ? " · weighted" : ""}
            {" · "}{LIBRARY_LABEL[exercise.libraryKind] ?? exercise.libraryKind}
          </div>
          <h1 style={titleStyle}>{exercise.name}</h1>
        </div>
        <div style={headerActionsStyle}>
          <Link href={`/exercises/${exercise.id}/edit`} style={editBtnStyle}>
            Edit
          </Link>
        </div>
      </header>

      {/* ── Stats row ───────────────────────────────────────────────── */}
      <section style={statRowStyle}>
        <Stat
          label={sessionPoints.length === 1 ? "session all-time" : "sessions all-time"}
          value={String(sessionPoints.length)}
        />
        {exercise.supportsWeight ? (
          <Stat
            label="all-time top"
            value={allTimeTopWeight && allTimeTopWeight.topWeightLb > 0
              ? `${allTimeTopWeight.topWeightLb} lb × ${allTimeTopWeight.topWeightReps}`
              : "—"}
            sub={allTimeTopWeight ? formatAppDate(allTimeTopWeight.performedAt, { month: "short", day: "numeric" }) : undefined}
            dim={!allTimeTopWeight || allTimeTopWeight.topWeightLb === 0}
            accent="rgba(251,191,36,0.95)"
          />
        ) : null}
        {!isTimeBased ? (
          <Stat
            label="best reps in a set"
            value={allTimeTopReps && allTimeTopReps.topReps > 0 ? `${allTimeTopReps.topReps}` : "—"}
            sub={allTimeTopReps && allTimeTopReps.topReps > 0 ? formatAppDate(allTimeTopReps.performedAt, { month: "short", day: "numeric" }) : undefined}
            dim={!allTimeTopReps || allTimeTopReps.topReps === 0}
            accent="rgba(132,204,255,0.95)"
          />
        ) : null}
        {isTimeBased && allTimeLongestTime ? (
          <Stat
            label="longest hold"
            value={`${allTimeLongestTime.maxTimeSec}s`}
            sub={formatAppDate(allTimeLongestTime.performedAt, { month: "short", day: "numeric" })}
            accent="rgba(192,132,252,0.95)"
          />
        ) : null}
        <Stat
          label="last logged"
          value={lastSession ? formatAppDate(lastSession.performedAt, { month: "short", day: "numeric" }) : "—"}
          dim={!lastSession}
        />
      </section>

      {/* ── Interactive metric chart ────────────────────────────────── */}
      <Section title="Progression" subtitle="Tap a metric to focus; tap a point to inspect.">
        <ExerciseMetricChart
          sessions={sessionPoints}
          supportsWeight={exercise.supportsWeight}
          isTimeBased={isTimeBased}
        />
      </Section>

      {/* ── Recent sessions ─────────────────────────────────────────── */}
      {recent.length > 0 ? (
        <Section
          title="Recent sessions"
          subtitle={`Latest ${recent.length} of ${sessionExercises.length} all-time`}
        >
          <div style={{ display: "grid", gap: 6 }}>
            {recent.map((se) => (
              <SessionRow
                key={se.id}
                routineId={se.routineLog.routineId}
                logId={se.routineLog.id}
                routineName={se.routineLog.routine?.name ?? "Untitled routine"}
                performedAt={se.routineLog.performedAt}
                sets={se.sets}
                isTimeBased={isTimeBased}
                supportsWeight={exercise.supportsWeight}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {/* ── Routines using this exercise ────────────────────────────── */}
      {routines.length > 0 ? (
        <Section title="Routines using this exercise">
          <div style={{ display: "grid", gap: 6 }}>
            {routines.map((r) =>
              r ? (
                <Link key={r.id} href={`/routines/${r.id}`} style={routineRowStyle}>
                  <span style={routineNameStyle}>{r.name}</span>
                  {!r.isActive ? <span style={archivedBadgeStyle}>Archived</span> : null}
                  <span style={caretStyle}>›</span>
                </Link>
              ) : null
            )}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

const LIBRARY_LABEL: Record<string, string> = {
  STRENGTH: "Strength",
  CARDIO: "Cardio",
  GUIDED: "Guided",
  MOBILITY: "Mobility",
};

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

function Stat({
  label,
  value,
  sub,
  dim,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  dim?: boolean;
  accent?: string;
}) {
  return (
    <div style={statTileStyle}>
      <div style={{ ...statValueStyle, color: accent ?? "inherit", opacity: dim ? 0.45 : 1 }}>{value}</div>
      <div style={statLabelStyle}>{label}</div>
      {sub ? <div style={statSubStyle}>{sub}</div> : null}
    </div>
  );
}

function SessionRow({
  routineId,
  logId,
  routineName,
  performedAt,
  sets,
  isTimeBased,
  supportsWeight,
}: {
  routineId: string;
  logId: string;
  routineName: string;
  performedAt: Date;
  sets: Array<{ setNumber: number; reps: number | null; seconds: number | null; weightLb: number | null }>;
  isTimeBased: boolean;
  supportsWeight: boolean;
}) {
  const summary = sets
    .map((s) => {
      if (isTimeBased) return `${s.seconds ?? 0}s`;
      if (supportsWeight && s.weightLb && s.weightLb > 0) return `${s.reps ?? 0} × ${s.weightLb} lb`;
      return `${s.reps ?? 0} reps`;
    })
    .join(", ");
  return (
    <Link href={`/routines/${routineId}/logs/${logId}/details`} style={sessionRowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={sessionDateStyle}>
          {formatAppDate(performedAt, { weekday: "short", month: "short", day: "numeric" })} · {routineName}
        </div>
        <div style={sessionSetsStyle}>{summary}</div>
      </div>
      <span style={caretStyle}>›</span>
    </Link>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "16px 14px 60px",
  display: "grid",
  gap: 14,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
  padding: "12px 14px",
  borderRadius: 14,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.08)",
  background: "linear-gradient(135deg, rgba(132,204,255,0.10), rgba(255,255,255,0.025))",
};

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

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexShrink: 0,
};

const editBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 14px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  minHeight: 36,
};

const statRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
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
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1.05,
  letterSpacing: -0.2,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};

const statSubStyle: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.55,
  fontWeight: 700,
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

const sessionRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
  textDecoration: "none",
  color: "inherit",
  minHeight: 52,
};

const sessionDateStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.8,
};

const sessionSetsStyle: React.CSSProperties = {
  fontSize: 12,
  marginTop: 2,
  opacity: 0.8,
  lineHeight: 1.4,
};

const caretStyle: React.CSSProperties = {
  fontSize: 16,
  opacity: 0.4,
  fontWeight: 700,
};

const routineRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};

const routineNameStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 13,
  fontWeight: 800,
};

const archivedBadgeStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.4,
  padding: "2px 7px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.14)",
  textTransform: "uppercase",
  opacity: 0.7,
};
