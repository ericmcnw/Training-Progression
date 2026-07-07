import Link from "next/link";
import { formatAppDate } from "@/lib/dates";
import { getStrengthGoals, frequencyChipFor } from "@/lib/activity-goals";
import { startOfWeekMonday } from "@/lib/week";
import { loadStrengthWorld } from "@/app/progress/details/strength-world-loader";
import { buildStrengthPulse } from "@/app/progress/details/sport-pulse";
import { applyGoalsToPulseSlots } from "@/app/progress/details/pulse-goal-slots";
import ActivityPulseStrip from "@/app/progress/details/ActivityPulseStrip";
import ActivityGoalsSection from "@/app/progress/details/ActivityGoalsSection";
import ActivityCoverageHeatmap from "@/app/progress/details/ActivityCoverageHeatmap";
import { SectionCard, SectionLinkButton, EmptyState } from "@/app/progress/ui";
import ActivityHeader from "@/app/activities/_shared/ActivityHeader";
import { domainColor } from "@/lib/routines";
import { buildStrengthChartData } from "@/lib/activities/strength-chart";
import WeeklyBarChartWithSessions from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";
import QuickLogDrawerButton from "@/app/routines/QuickLogDrawerButton";
import { domainRgb } from "@/lib/routines";

export const dynamic = "force-dynamic";

// ── Style tokens ─────────────────────────────────────────────────────────────

// All strength-tinted chrome on this page derives from the canonical
// strength domain color via domainRgb — so a future palette tweak in
// lib/routines propagates to every soft variant without a sweep.
const STRENGTH_RGB = domainRgb("strength");
const STRENGTH_TEXT = "rgba(134,239,172,0.95)";

const strengthCtaStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 14px",
  borderRadius: 10,
  border: `1px solid rgba(${STRENGTH_RGB},0.5)`,
  background: `rgba(${STRENGTH_RGB},0.14)`,
  color: STRENGTH_TEXT,
  fontSize: 12,
  fontWeight: 900,
  textDecoration: "none",
  cursor: "pointer",
  minHeight: 36,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number) {
  if (n >= 100000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function StrengthWorldPage() {
  const [strength, strengthGoals] = await Promise.all([
    loadStrengthWorld(),
    getStrengthGoals(),
  ]);

  if (strength.totalSessions === 0) {
    return (
      <>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "14px 14px 20px", display: "grid", gap: 16 }}>
          <ActivityHeader
            title="Strength"
            accent={domainColor("strength")}
            actions={
              <NewRoutineDrawerButton presetDomain="strength" style={strengthCtaStyle}>
                + New routine
              </NewRoutineDrawerButton>
            }
          />
          <SectionCard title="No strength data yet" subtitle="Log a workout to start seeing your strength world here.">
            <EmptyState message="Log a workout routine with sets/reps/weight to populate this view." />
          </SectionCard>
        </div>
      </>
    );
  }

  // ── Pulse aggregates ──────────────────────────────────────────────────────
  const now = new Date();
  const thisWeekStart = startOfWeekMonday(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const sessionsThisWeek = strength.sessionDates.filter((d) => d >= thisWeekStart).length;
  let setsThisWeek = 0;
  let setsLastWeek = 0;
  for (const stat of strength.sessionStats) {
    if (stat.date >= thisWeekStart) setsThisWeek += stat.sets;
    else if (stat.date >= lastWeekStart) setsLastWeek += stat.sets;
  }

  // Recent PR — most recently set new max weight in last 30 days, by date desc
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentPRCandidates = strength.allExercises
    .filter((e) => e.recentPR && e.lastDate && e.lastDate >= thirtyDaysAgo && e.allTimePR)
    .map((e) => ({
      exerciseName: e.name,
      weight: e.allTimePR!.weightLb,
      reps: e.allTimePR!.reps,
      date: e.lastDate!,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const recentPR = recentPRCandidates[0] ?? null;

  // All-time top weight set across all exercises
  const allTimeBest = strength.allExercises
    .filter((e) => e.allTimePR && e.allTimePR.weightLb > 0)
    .sort((a, b) => (b.allTimePR!.weightLb - a.allTimePR!.weightLb))
    [0];
  const allTimePR = allTimeBest
    ? { exerciseName: allTimeBest.name, weight: allTimeBest.allTimePR!.weightLb, reps: allTimeBest.allTimePR!.reps }
    : null;

  const defaultSlots = buildStrengthPulse(
    {
      sessionDates: strength.sessionDates,
      thisWeekSets: setsThisWeek,
      lastWeekSets: setsLastWeek,
      thisWeekSessions: sessionsThisWeek,
      recentPR,
      allTimePR,
    },
    now
  );
  const pulseSlots = applyGoalsToPulseSlots(defaultSlots, strengthGoals);

  // 12w sessions + volume series for the interactive bar charts.
  // Pure derivation from the data already loaded by loadStrengthWorld
  // (no extra Prisma roundtrip).
  const chartData = buildStrengthChartData(strength.sessionStats, now);
  const hasChartData = chartData.sessionsSeries.some((s) =>
    s.weeklyValues.some((v) => v > 0)
  );

  return (
    <>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "14px 14px 20px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, minWidth: 0 }}>
        <ActivityHeader
          title="Strength"
          accent={domainColor("strength")}
          frequencyChip={frequencyChipFor(strengthGoals)}
          actions={
            <>
              {/* Logging is the everyday action — it leads. Routine creation
                  stays available but secondary. */}
              <QuickLogDrawerButton label="📋 Log workout" style={strengthCtaStyle} />
              <NewRoutineDrawerButton presetDomain="strength" style={strengthCtaStyle}>
                + New routine
              </NewRoutineDrawerButton>
            </>
          }
        />

        {/* Pulse strip */}
        <ActivityPulseStrip slots={pulseSlots} />

        {/* Interactive 12w sessions + volume charts. Both fall back to
            being hidden when there's no strength data yet — the
            EmptyState branch above already handles that case. */}
        {hasChartData ? (
          <>
            <WeeklyBarChartWithSessions
              title="Strength Sessions per Week — Last 12 Weeks"
              weekLabels={chartData.weekLabels}
              series={chartData.sessionsSeries}
              sessionsByWeek={chartData.sessionsByWeek}
              unit="sess"
              decimals={0}
              secondaryLabel="Sets"
            />
            <WeeklyBarChartWithSessions
              title="Weekly Volume (lb) — Last 12 Weeks"
              weekLabels={chartData.weekLabels}
              series={chartData.volumeSeries}
              sessionsByWeek={chartData.sessionsByWeek}
              unit="lb"
              decimals={0}
              primaryLabel="Volume"
            />
          </>
        ) : null}

        {/* Active goals */}
        <ActivityGoalsSection
          goals={strengthGoals}
          activitySlug="strength"
          activityLabel="Strength"
        />

        {/* Activity coverage heatmap (single row, sessions only) */}
        {strength.heatmapWeeks.length > 1 ? (
          <SectionCard
            title="Activity Coverage"
            subtitle="Strength sessions over the last 52 weeks. Tap any week to see what you trained."
          >
            <ActivityCoverageHeatmap
              weeks={strength.heatmapWeeks}
              sessionLabel="Strength session"
              sessionRowLabel="Strength"
              hideTrainingRow
            />
          </SectionCard>
        ) : null}

        {/* Top exercises */}
        {strength.topExercises.length > 0 ? (
          <SectionCard
            title="Top Exercises"
            subtitle="Your most-trained lifts, with all-time top weight and recent progression."
            actions={<SectionLinkButton href="/exercises" label="All exercises" />}
          >
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {strength.topExercises.slice(0, 8).map((ex) => (
                <ExerciseCard key={ex.exerciseId} exercise={ex} />
              ))}
            </div>
          </SectionCard>
        ) : null}

        {/* Strength routines */}
        {strength.routines.length > 0 ? (
          <SectionCard
            title="Strength Routines"
            subtitle="Click a routine to dive into per-exercise progression and recent sessions."
            actions={<SectionLinkButton href="/log" label="All routines" />}
          >
            <div style={{ display: "grid", gap: 8 }}>
              {strength.routines.map((r) => (
                <RoutineRow key={r.routineId} routine={r} />
              ))}
            </div>
          </SectionCard>
        ) : null}

        {/* Recent sessions */}
        {strength.recentSessions.length > 0 ? (
          <SectionCard
            title="Recent Sessions"
            subtitle="Last 8 strength workouts at a glance — tap a card to drill in."
          >
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
              {strength.recentSessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ExerciseCard({ exercise }: { exercise: import("@/app/progress/details/strength-world-loader").StrengthExerciseSummary }) {
  const sparkline = exercise.recentTopWeights.filter((p) => p.weight > 0);
  const maxSpark = Math.max(1, ...sparkline.map((p) => p.weight));
  const minSpark = Math.min(...sparkline.map((p) => p.weight));
  const sparkRange = Math.max(1, maxSpark - minSpark);

  return (
    <Link
      href={exercise.routineLink}
      style={{
        display: "grid",
        gap: 10,
        padding: "14px 16px",
        borderRadius: 14,
        border: `1px solid rgba(${STRENGTH_RGB},0.18)`,
        background: `linear-gradient(180deg, rgba(${STRENGTH_RGB},0.06), rgba(255,255,255,0.02))`,
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 120ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.2 }}>{exercise.name}</span>
          <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>
            {exercise.totalSessions} session{exercise.totalSessions !== 1 ? "s" : ""} · {exercise.totalSets} set{exercise.totalSets !== 1 ? "s" : ""}
          </span>
        </div>
        {exercise.recentPR ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              padding: "2px 7px",
              borderRadius: 999,
              border: "1px solid rgba(74,222,128,0.4)",
              background: "rgba(74,222,128,0.15)",
              color: "rgba(134,239,172,0.95)",
              letterSpacing: 0.4,
              whiteSpace: "nowrap",
              textTransform: "uppercase",
            }}
          >
            New PR
          </span>
        ) : null}
      </div>

      {exercise.allTimePR ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ display: "grid", gap: 2 }}>
            <span style={{ fontSize: 9, opacity: 0.55, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>Top set</span>
            <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1, color: `rgba(${STRENGTH_RGB},0.95)` }}>
              {exercise.allTimePR.weightLb} lb
            </span>
            <span style={{ fontSize: 11, opacity: 0.65 }}>
              {exercise.allTimePR.reps} rep{exercise.allTimePR.reps !== 1 ? "s" : ""}
            </span>
          </div>
          {sparkline.length >= 2 ? (
            <Sparkline points={sparkline.map((p) => ({ value: p.weight, label: formatAppDate(p.date, { month: "short", day: "numeric" }) }))} min={minSpark} range={sparkRange} />
          ) : null}
        </div>
      ) : (
        <div style={{ fontSize: 11, opacity: 0.5 }}>No weighted sets logged yet</div>
      )}

      {exercise.lastDate ? (
        <div style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>
          Last {formatAppDate(exercise.lastDate, { month: "short", day: "numeric" })}
        </div>
      ) : null}
    </Link>
  );
}

function Sparkline({
  points,
  min,
  range,
}: {
  points: Array<{ value: number; label: string }>;
  min: number;
  range: number;
}) {
  const w = 64;
  const h = 28;
  const stepX = points.length > 1 ? w / (points.length - 1) : 0;
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = h - ((p.value - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const lastValue = points[points.length - 1]?.value ?? 0;
  const lastY = h - ((lastValue - min) / range) * h;
  const lastX = (points.length - 1) * stepX;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible", flexShrink: 0 }} aria-hidden="true">
      <path
        d={`${path} L ${(points.length - 1) * stepX} ${h} L 0 ${h} Z`}
        fill={`rgba(${STRENGTH_RGB},0.12)`}
        stroke="none"
      />
      <path d={path} stroke={`rgba(${STRENGTH_RGB},0.85)`} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.4} fill={`rgba(${STRENGTH_RGB},1)`} />
    </svg>
  );
}

function RoutineRow({ routine }: { routine: import("@/app/progress/details/strength-world-loader").StrengthRoutineSummary }) {
  return (
    <Link
      href={`/routines/${routine.routineId}`}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.07)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 120ms ease",
      }}
    >
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>{routine.name}</span>
        <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>
          {routine.totalSessions} session{routine.totalSessions !== 1 ? "s" : ""} · {routine.totalSets} sets · {formatNumber(Math.round(routine.totalVolume))} lb volume
        </span>
      </div>
      <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700, whiteSpace: "nowrap" }}>
        {routine.lastDate ? `Last ${formatAppDate(routine.lastDate, { month: "short", day: "numeric" })}` : "—"}
      </span>
    </Link>
  );
}

function SessionCard({ session }: { session: import("@/app/progress/details/strength-world-loader").StrengthRecentSession }) {
  return (
    <Link
      href={`/routines/${session.routineId}/logs/${session.id}/details`}
      style={{
        flex: "0 0 auto",
        width: 180,
        scrollSnapAlign: "start",
        display: "grid",
        gap: 8,
        padding: "12px 14px",
        borderRadius: 14,
        border: `1px solid rgba(${STRENGTH_RGB},0.18)`,
        background: `linear-gradient(180deg, rgba(${STRENGTH_RGB},0.05), rgba(255,255,255,0.02))`,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{formatAppDate(session.date, { month: "short", day: "numeric" })}</span>
        <span style={{ fontSize: 10, opacity: 0.55, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6 }}>
          {session.date.toLocaleDateString("en-US", { weekday: "short" })}
        </span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {session.routineName}
      </span>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 6, marginTop: 2 }}>
        <div style={{ display: "grid", gap: 2 }}>
          <span style={{ fontSize: 10, opacity: 0.55, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6 }}>Sets</span>
          <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{session.totalSets}</span>
        </div>
        {session.topSet ? (
          <div
            style={{
              padding: "4px 8px",
              borderRadius: 9,
              background: `rgba(${STRENGTH_RGB},0.14)`,
              border: `1px solid rgba(${STRENGTH_RGB},0.32)`,
              color: STRENGTH_TEXT,
              fontWeight: 900,
              fontSize: 12,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
            }}
            title={session.topSet.exerciseName}
          >
            {session.topSet.weight}×{session.topSet.reps}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
