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

// Type accents match the goal-form tile picker so a user picking
// FREQUENCY in the drawer and then seeing FREQUENCY goals here gets the
// same purple cue across surfaces.
const TYPE_ACCENT: Record<string, { color: string; bg: string; border: string; weak: string }> = {
  FREQUENCY:   { color: "rgb(129,140,248)", bg: "rgba(129,140,248,0.10)", border: "rgba(129,140,248,0.45)", weak: "rgba(129,140,248,0.18)" },
  VOLUME:      { color: "rgb(34,211,238)",  bg: "rgba(34,211,238,0.10)",  border: "rgba(34,211,238,0.45)",  weak: "rgba(34,211,238,0.18)"  },
  PERFORMANCE: { color: "rgb(251,191,36)",  bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.45)",  weak: "rgba(251,191,36,0.18)"  },
  COMPLETION:  { color: "rgb(74,222,128)",  bg: "rgba(74,222,128,0.10)",  border: "rgba(74,222,128,0.45)",  weak: "rgba(74,222,128,0.18)"  },
};

const TYPE_ICON: Record<string, string> = {
  FREQUENCY: "↻",
  VOLUME: "∑",
  PERFORMANCE: "◆",
  COMPLETION: "✓",
};

// Status colors are intentionally muted — see feedback_habit_lens.
const STATUS_COLOR: Record<HabitRow["status"], string> = {
  complete: "rgba(74,222,128,0.7)",  // green check
  ahead:    "rgba(74,222,128,0.55)", // softer green
  on_track: "rgba(148,163,184,0.5)", // neutral
  behind:   "rgba(251,191,36,0.6)",  // gentle amber, not red
  at_risk:  "rgba(251,146,60,0.65)", // warmer amber, still not red
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

  return (
    <Link href={detailHref} className="goalRow" style={rowStyle(accent, statusKey)}>
      <div className="goalRowIcon" style={iconBlockStyle(accent)} aria-hidden>
        <span style={iconGlyphStyle(accent)}>{icon}</span>
      </div>

      <div style={textBlockStyle}>
        <div style={nameLineStyle}>
          <span className="goalRowName" style={nameStyle}>{insight.goal.name}</span>
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
          aria-label={STATUS_LABEL[statusKey]}
        >
          {STATUS_LABEL[statusKey]}
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
        width: 12,
        height: 12,
        borderRadius: 3,
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
  gap: 4,
  justifyItems: "end",
};

const dotRowStyle: CSSProperties = {
  display: "flex",
  gap: 4,
};

const frequencyFractionStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.7,
  fontWeight: 800,
};

const scalarBlockStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  width: 140,
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
  fontSize: 11,
  opacity: 0.6,
  fontWeight: 700,
};

const progressTrackStyle: CSSProperties = {
  height: 5,
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
