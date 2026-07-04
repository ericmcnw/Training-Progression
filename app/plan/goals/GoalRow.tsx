// Unified goal row — replaces the split frequency-heatmap + non-freq-cards
// rendering with one consistent visual language. Per CLAUDE.md + the
// project_roadmap "habit lens = gentle visibility" decision: no aggressive
// red, no nagging — behind state is subtle amber on the left edge, status
// chips are quiet, missed days are dimmed dots rather than alarm markers.
//
// Layout: horizontal row at all screen sizes (chosen over tiles because
// row density beats tile density on mobile — see the C+D conversation in
// the goals-page redesign thread). Mobile shows a single column of rows,
// desktop shows the same rows wider in the container — same data, no
// layout switch.

import Link from "next/link";
import type { CSSProperties } from "react";
import type { GoalInsight } from "@/lib/goals";
import type { HabitRow } from "@/app/_home/types";
import { TYPE_ACCENT, TYPE_ICON } from "./goal-type-accent";

// Status colors are intentionally muted — see feedback_habit_lens.
// behind and at_risk share the same amber dot to avoid collision with
// the sport-domain orange (which was identical RGB to the old at_risk
// at lower alpha). The status LABEL still distinguishes severity; the
// row's left border + container border already collapsed both warning
// states into amber, so the dot now matches.
const STATUS_COLOR: Record<HabitRow["status"], string> = {
  complete: "rgba(74,222,128,0.7)",  // green check
  ahead:    "rgba(74,222,128,0.55)", // softer green
  on_track: "rgba(148,163,184,0.5)", // neutral
  behind:   "rgba(251,191,36,0.6)",  // gentle amber, not red
  at_risk:  "rgba(251,191,36,0.75)", // same amber, slightly stronger alpha
};

const STATUS_LABEL: Record<HabitRow["status"], string> = {
  complete: "Hit",
  ahead:    "Ahead",
  on_track: "On pace",
  behind:   "Behind",
  at_risk:  "At risk",
};

export default function GoalRow({
  insight,
  habitRow,
  today,
}: {
  insight: GoalInsight;
  /** For FREQUENCY goals, the matching HabitRow provides daily state for
   *  the week strip + week fraction. Optional — frequency goals that aren't
   *  in homeData.habitRows fall back to summary numbers only. */
  habitRow?: HabitRow;
  today: string;
}) {
  const accent = TYPE_ACCENT[insight.goal.goalType] ?? TYPE_ACCENT.FREQUENCY;
  const icon = TYPE_ICON[insight.goal.goalType] ?? "•";

  // Status for the left-edge accent. Frequency goals use their habit-row
  // status (the same calculation home page does); non-frequency goals
  // derive from achieved + fractionComplete with a "on pace" middle band.
  const statusKey: HabitRow["status"] = habitRow
    ? habitRow.status
    : insight.isAchieved
      ? "complete"
      : insight.fractionComplete >= 0.6
        ? "on_track"
        : insight.fractionComplete >= 0.3
          ? "behind"
          : "at_risk";

  const detailHref = insight.detailHref ?? `/plan/goals/${encodeURIComponent(insight.goal.id)}`;

  // Stalled = active, older than two weeks, and nothing has EVER counted
  // toward it — usually a mis-aimed target. Quiet hint, not an alarm.
  const ageDays = (Date.now() - insight.goal.createdAt.getTime()) / (24 * 60 * 60 * 1000);
  const isStalled = insight.goal.isActive && !insight.hasData && ageDays > 14;

  // One-time achieved milestones read "Achieved" (they latch forever);
  // recurring goals keep "Hit" (the window refills next cycle).
  const statusLabel =
    statusKey === "complete" && insight.goal.timeframe === "ONE_TIME"
      ? "Achieved"
      : STATUS_LABEL[statusKey];

  return (
    <Link href={detailHref} className="goalRow" style={rowStyle(accent, statusKey)}>
      <div className="goalRowIcon" style={iconBlockStyle(accent)} aria-hidden>
        <span style={iconGlyphStyle(accent)}>{icon}</span>
      </div>

      <div style={textBlockStyle}>
        <div style={nameLineStyle}>
          <span className="goalRowName" style={nameStyle}>{insight.goal.name}</span>
          <TriggerBadge
            exerciseCount={insight.triggerExerciseCount ?? 0}
            subtypeCount={insight.triggerSubtypeCount ?? 0}
          />
          {isStalled ? (
            <span
              style={stalledChipStyle}
              title="Nothing has counted toward this goal yet — its target may not match how you log. Tap to review."
            >
              No data yet
            </span>
          ) : null}
          {!insight.goal.isActive ? <span style={inactiveChipStyle}>Inactive</span> : null}
        </div>
        <div className="goalRowMeta" style={metaLineStyle}>
          <span>{insight.timeframeLabel}</span>
          <span style={metaDotStyle} aria-hidden>·</span>
          <span style={{ opacity: 0.85 }}>{insight.targetKindLabel}</span>
        </div>
      </div>

      <div className="goalRowProgress" style={progressBlockStyle}>
        {insight.goal.goalType === "FREQUENCY" && habitRow ? (
          <FrequencyVisual habitRow={habitRow} today={today} accent={accent} />
        ) : (
          <ScalarVisual insight={insight} accent={accent} />
        )}
      </div>

      <div className="goalRowStatus" style={statusBlockStyle}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: STATUS_COLOR[statusKey],
            flexShrink: 0,
          }}
        />
        <span
          className="goalRowStatusLabel"
          style={statusLabelStyle}
          aria-label={statusLabel}
        >
          {statusLabel}
        </span>
      </div>
    </Link>
  );
}

// ── Per-type visuals ──────────────────────────────────────────────────────

function FrequencyVisual({
  habitRow,
  today,
  accent,
}: {
  habitRow: HabitRow;
  today: string;
  accent: typeof TYPE_ACCENT[string];
}) {
  // Last 7 days of the trailing30 strip — same ordering home page uses so
  // the rightmost dot is always today.
  const last7 = habitRow.trailing30.slice(-7);
  // Anchor "today" by index so we don't trust ymd math at the edges.
  const todayIndex = last7.findIndex((d) => d.ymd === today);
  return (
    <div style={frequencyBlockStyle}>
      <div className="goalRowDotRow" style={dotRowStyle}>
        {last7.map((day, i) => {
          const isToday = i === todayIndex;
          return <DayDot key={day.ymd} state={day.state} isToday={isToday} accent={accent} />;
        })}
      </div>
      <div style={frequencyFractionStyle}>
        {habitRow.weekFraction.progress}/{habitRow.weekFraction.target} this week
      </div>
    </div>
  );
}

function DayDot({
  state,
  isToday,
  accent,
}: {
  state: "done" | "covered" | "missed" | "rest" | "future";
  isToday: boolean;
  accent: typeof TYPE_ACCENT[string];
}) {
  // done = filled accent; covered = filled but lighter; missed = dim outline;
  // rest/future = quiet placeholder. No red anywhere — see lens decision.
  const styles: CSSProperties =
    state === "done"
      ? { background: accent.color, border: `1px solid ${accent.color}` }
      : state === "covered"
      ? { background: accent.weak, border: `1px solid ${accent.border}` }
      : state === "missed"
      ? { background: "transparent", border: "1px solid rgba(255,255,255,0.18)" }
      : { background: "transparent", border: "1px dashed rgba(255,255,255,0.10)" };
  return (
    <span
      className="goalRowDot"
      aria-label={state}
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        display: "inline-block",
        ...(isToday ? { outline: "1px solid rgba(255,255,255,0.45)", outlineOffset: 2 } : {}),
        ...styles,
      }}
    />
  );
}

function ScalarVisual({
  insight,
  accent,
}: {
  insight: GoalInsight;
  accent: typeof TYPE_ACCENT[string];
}) {
  const pct = Math.min(100, Math.max(0, Math.round(insight.fractionComplete * 100)));
  return (
    <div className="goalRowScalar" style={scalarBlockStyle}>
      <div style={scalarLineStyle}>
        <span style={scalarValueStyle}>{insight.actualDisplay}</span>
        <span style={scalarTargetStyle}>/ {insight.targetDisplay}</span>
      </div>
      <div style={progressTrackStyle}>
        <div
          style={{
            ...progressFillStyle,
            width: `${pct}%`,
            background: accent.color,
          }}
        />
      </div>
    </div>
  );
}

// Harvested from the retired FrequencyGoalRow — a compact chip signalling the
// goal counts more than its enrolled routines (trigger exercises / activity
// types). Hover spells out what's matched. Zero counts render nothing, so it's
// inert for non-frequency goals.
function TriggerBadge({
  exerciseCount,
  subtypeCount,
}: {
  exerciseCount: number;
  subtypeCount: number;
}) {
  if (exerciseCount === 0 && subtypeCount === 0) return null;
  const parts: string[] = [];
  if (exerciseCount > 0) parts.push(`${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}`);
  if (subtypeCount > 0) parts.push(`${subtypeCount} activity type${subtypeCount === 1 ? "" : "s"}`);
  const title = `Also counts logs matching: ${parts.join(" + ")}`;
  const label = exerciseCount + subtypeCount === 1 ? "+1 trigger" : `+${exerciseCount + subtypeCount} triggers`;
  return (
    <span title={title} aria-label={title} style={triggerBadgeStyle}>
      {label}
    </span>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

function rowStyle(accent: typeof TYPE_ACCENT[string], status: HabitRow["status"]): CSSProperties {
  const isAttn = status === "behind" || status === "at_risk";
  return {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto auto",
    gap: 12,
    alignItems: "center",
    padding: "12px 14px",
    border: `1px solid ${isAttn ? "rgba(251,191,36,0.32)" : "rgba(128,128,128,0.20)"}`,
    borderLeft: `3px solid ${isAttn ? "rgba(251,191,36,0.65)" : accent.border}`,
    borderRadius: 12,
    background: "rgba(255,255,255,0.02)",
    textDecoration: "none",
    color: "inherit",
    minHeight: 64,
  };
}

function iconBlockStyle(accent: typeof TYPE_ACCENT[string]): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 8,
    background: accent.bg,
    border: `1px solid ${accent.border}`,
    flexShrink: 0,
  };
}

function iconGlyphStyle(accent: typeof TYPE_ACCENT[string]): CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 900,
    color: accent.color,
    lineHeight: 1,
  };
}

const textBlockStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const nameLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const nameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.2,
};

const inactiveChipStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  padding: "2px 7px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  opacity: 0.7,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};

// Quiet "this goal never started" hint — dashed border reads as unfinished
// rather than alarming (no red per the gentle-lens decision).
const stalledChipStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  padding: "2px 7px",
  borderRadius: 999,
  border: "1px dashed rgba(251,191,36,0.45)",
  background: "rgba(251,191,36,0.07)",
  color: "rgba(253,230,138,0.9)",
  letterSpacing: 0.3,
  whiteSpace: "nowrap",
};

const triggerBadgeStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.3,
  padding: "2px 7px",
  borderRadius: 999,
  border: "1px solid rgba(129,140,248,0.42)",
  background: "rgba(129,140,248,0.13)",
  color: "rgb(199,210,254)",
  whiteSpace: "nowrap",
};

const metaLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  opacity: 0.65,
  fontWeight: 700,
};

const metaDotStyle: CSSProperties = {
  opacity: 0.4,
};

const progressBlockStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  minWidth: 0,
};

const frequencyBlockStyle: CSSProperties = {
  display: "grid",
  gap: 3,
  justifyItems: "end",
};

const dotRowStyle: CSSProperties = {
  display: "flex",
  gap: 4,
};

const frequencyFractionStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.7,
  fontWeight: 800,
};

const scalarBlockStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  width: 160,
};

const scalarLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 4,
  justifyContent: "flex-end",
  whiteSpace: "nowrap",
};

const scalarValueStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
};

const scalarTargetStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.6,
  fontWeight: 700,
};

const progressTrackStyle: CSSProperties = {
  height: 10,
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 200ms ease",
};

const statusBlockStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
};

const statusLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.7,
  letterSpacing: 0.2,
  whiteSpace: "nowrap",
};
