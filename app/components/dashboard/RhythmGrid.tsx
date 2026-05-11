"use client";

// RhythmGrid — side-by-side dense view of habits + frequency targets, sized
// to live as a footer under the Week-at-a-Glance section. Each column shows
// the top 3 by urgency (at-risk → behind → streak desc → name) with an
// inline `Show N more ▾` toggle to reveal the rest in place.
//
// Single-line rows. The per-day visualization for habits lives in WaG cell
// aggregate dots above; here we focus on cadence + this-week count + streak.
//
//   • Habit row: dot · name · cadence · this-week count · streak
//   • Freq target row: dot · name · cadence · pie-fill dot + X/Y · streak

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import {
  formatMaskLabel,
  frequencyStatusColor,
  getStreakLabel,
  type FrequencyState,
  type FrequencyTarget,
} from "@/lib/frequency-state";
import { domainColor } from "@/lib/routines";
import type { HabitLaneRow } from "./HabitLane";
import type { FrequencyTargetRow } from "./FrequencyTargetsCard";

const COLLAPSED_LIMIT = 3;

export default function RhythmGrid({
  habits,
  frequencyTargets,
  today,
}: {
  habits: HabitLaneRow[];
  frequencyTargets: FrequencyTargetRow[];
  today: string;
}) {
  if (habits.length === 0 && frequencyTargets.length === 0) {
    return (
      <div style={emptyInline}>
        <span style={{ opacity: 0.65 }}>No habits or frequency targets yet —</span>
        <Link href="/routines?domain=habit" style={emptyHabitLink}>set a habit routine</Link>
        <span style={{ opacity: 0.45 }}>or</span>
        <Link href="/goals?type=FREQUENCY&mode=new" style={emptyFreqLink}>create a frequency goal</Link>
      </div>
    );
  }

  return (
    <div style={grid}>
      {habits.length > 0 ? (
        <Column
          label="HABITS"
          count={habits.length}
          rows={habits.map((h) => (
            <HabitRow key={h.routineId} habit={h} today={today} />
          ))}
        />
      ) : null}
      {frequencyTargets.length > 0 ? (
        <Column
          label="FREQUENCY TARGETS"
          count={frequencyTargets.length}
          rows={frequencyTargets.map((t) => (
            <FrequencyRow key={t.goalId} target={t} />
          ))}
        />
      ) : null}
    </div>
  );
}

function Column({
  label,
  count,
  rows,
}: {
  label: string;
  count: number;
  rows: React.ReactElement[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_LIMIT);
  const hidden = rows.length - visible.length;

  return (
    <div style={columnShell}>
      <div style={subhead}>
        <span style={subheadLabel}>{label}</span>
        <span style={subheadCount}>{count}</span>
      </div>
      <div style={rowList}>{visible}</div>
      {hidden > 0 ? (
        <button type="button" onClick={() => setExpanded(true)} style={expandBtn}>
          Show {hidden} more <span aria-hidden="true">▾</span>
        </button>
      ) : expanded && rows.length > COLLAPSED_LIMIT ? (
        <button type="button" onClick={() => setExpanded(false)} style={expandBtn}>
          Show fewer <span aria-hidden="true">▴</span>
        </button>
      ) : null}
    </div>
  );
}

function HabitRow({ habit }: { habit: HabitLaneRow; today: string }) {
  const accent = frequencyStatusColor(habit.state.currentWindow.status);
  const sub = habit.weekdayMask ? formatMaskLabel(habit.weekdayMask) : (habit.goalLabel ?? "Daily");
  const habitTarget: FrequencyTarget | null = habit.state.currentWindow.target > 0
    ? {
        targetCount: habit.state.currentWindow.target,
        targetInterval: 1,
        targetUnit: habit.weekdayMask ? "WEEK" : "DAY",
        weekdayMask: habit.weekdayMask,
      }
    : null;
  const streak = getStreakLabel(habit.state, habitTarget);
  const progress = habit.state.currentWindow.progress;
  const target = habit.state.currentWindow.target;

  return (
    <Link href={`/routines/${habit.routineId}`} style={rowCard}>
      <div style={{ ...rowAccent, background: accent }} />
      <div style={col1}>
        <div style={nameLine}>
          <span style={nameText}>{habit.routineName}</span>
        </div>
        <div style={subText}>{sub}</div>
      </div>
      <div style={progressArea}>
        <ProgressDot done={progress} target={target} color={accent} />
        <span style={progressNumber}>
          <span style={{ ...progressNumberValue, color: accent }}>{progress}</span>
          <span style={progressNumberDenom}>/{target}</span>
        </span>
      </div>
      <div style={trailing}>
        {streak ? (
          <span style={streakChip} title={streak.tooltip} aria-label={streak.long}>
            {streak.value}
            <span style={streakUnitText}>{streak.unit}</span>
          </span>
        ) : (
          <span style={{ ...streakChip, opacity: 0.35 }} title="No streak yet">—</span>
        )}
      </div>
    </Link>
  );
}

function FrequencyRow({ target }: { target: FrequencyTargetRow }) {
  const accent = domainColor(target.primaryDomain);
  const detailHref = target.isGroup
    ? `/goals/group-frequency:${target.goalId}?mode=edit`
    : `/routines/${target.goalId.replace(/^fg_/, "")}`;
  const cadence = formatCadence(target.target);
  const streak = getStreakLabel(target.state, target.target);

  return (
    <Link href={detailHref} style={rowCard}>
      <div style={{ ...rowAccent, background: accent }} />
      <div style={col1}>
        <div style={nameLine}>
          <span style={nameText}>{target.goalName}</span>
        </div>
        <div style={subText}>{cadence}</div>
      </div>
      <div style={progressArea}>
        <ProgressDot
          done={target.state.currentWindow.progress}
          target={target.state.currentWindow.target}
          color={accent}
        />
        <span style={progressNumber}>
          <span style={{ ...progressNumberValue, color: accent }}>
            {target.state.currentWindow.progress}
          </span>
          <span style={progressNumberDenom}>/{target.state.currentWindow.target}</span>
        </span>
      </div>
      <div style={trailing}>
        {streak ? (
          <span style={streakChip} title={streak.tooltip} aria-label={streak.long}>
            {streak.value}
            <span style={streakUnitText}>{streak.unit}</span>
          </span>
        ) : (
          <span style={{ ...streakChip, opacity: 0.35 }} title="No streak yet">—</span>
        )}
      </div>
    </Link>
  );
}

// Pie-fill dot — same vocabulary as the WaG cell aggregate dot, but
// parameterized by domain color so each frequency target is colored by its
// primary routine's domain.
function ProgressDot({ done, target, color }: { done: number; target: number; color: string }) {
  const fraction = target > 0 ? Math.max(0, Math.min(1, done / target)) : 0;
  const fillState: 0 | 1 | 2 | 3 | 4 =
    fraction <= 0 ? 0 : fraction < 0.25 ? 1 : fraction < 0.5 ? 2 : fraction < 0.75 ? 3 : 4;
  const SIZE = 12;
  const R = 5;
  const C = 6;
  const trackColor = withAlpha(color, 0.15);
  const outlineColor = withAlpha(color, 0.55);

  const ARC_PATHS: Record<1 | 2 | 3, string> = {
    1: `M ${C} ${C} L ${C} ${C - R} A ${R} ${R} 0 0 1 ${C + R} ${C} Z`,
    2: `M ${C} ${C} L ${C} ${C - R} A ${R} ${R} 0 0 1 ${C} ${C + R} Z`,
    3: `M ${C} ${C} L ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - R} ${C} Z`,
  };

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      {fillState > 0 && fillState < 4 ? <circle cx={C} cy={C} r={R} fill={trackColor} /> : null}
      {fillState === 4 ? <circle cx={C} cy={C} r={R} fill={color} /> : null}
      {fillState >= 1 && fillState <= 3 ? (
        <path d={ARC_PATHS[fillState as 1 | 2 | 3]} fill={color} />
      ) : null}
      <circle cx={C} cy={C} r={R} fill="none" stroke={outlineColor} strokeWidth={1} />
    </svg>
  );
}

function withAlpha(rgba: string, alpha: number): string {
  const match = rgba.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return rgba;
  const parts = match[1].split(",").map((p) => p.trim());
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

function formatCadence(t: FrequencyTarget): string {
  const unit = t.targetUnit === "DAY" ? "day" : t.targetUnit === "WEEK" ? "week" : "month";
  if (t.targetInterval === 1) return `${t.targetCount}× / ${unit}`;
  return `${t.targetCount}× / ${t.targetInterval} ${unit}s`;
}

const grid: CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const columnShell: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const emptyInline: CSSProperties = {
  fontSize: 12,
  padding: "10px 4px",
  display: "inline-flex",
  gap: 5,
  flexWrap: "wrap",
  alignItems: "center",
};

const emptyHabitLink: CSSProperties = {
  color: "rgba(251,191,36,0.95)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const emptyFreqLink: CSSProperties = {
  color: "rgba(100,180,255,0.95)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const subhead: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  paddingLeft: 4,
};

const subheadLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  opacity: 0.65,
};

const subheadCount: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  opacity: 0.6,
  padding: "1px 5px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.05)",
};

const rowList: CSSProperties = {
  display: "grid",
  gap: 4,
};

const expandBtn: CSSProperties = {
  marginTop: 4,
  marginLeft: 4,
  fontSize: 11,
  fontWeight: 700,
  color: "inherit",
  opacity: 0.6,
  background: "transparent",
  border: "none",
  padding: "4px 0",
  cursor: "pointer",
  textAlign: "left",
  letterSpacing: 0.2,
  width: "fit-content",
};

const rowCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "3px minmax(80px, 1.3fr) minmax(0, 1.6fr) 44px",
  gap: 7,
  alignItems: "center",
  padding: "5px 7px 5px 0",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.015)",
  color: "inherit",
  textDecoration: "none",
  minHeight: 36,
};

const rowAccent: CSSProperties = {
  height: 22,
  width: 3,
  borderRadius: "0 2px 2px 0",
};

const col1: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 1,
  paddingLeft: 4,
};

const nameLine: CSSProperties = {
  display: "flex",
  gap: 4,
  alignItems: "baseline",
  minWidth: 0,
};

const nameText: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  lineHeight: 1.1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const subText: CSSProperties = {
  fontSize: 10,
  opacity: 0.55,
  fontWeight: 600,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const progressArea: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
  justifyContent: "flex-start",
};

const progressNumber: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 1,
};

const progressNumberValue: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1,
};

const progressNumberDenom: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  opacity: 0.55,
};

const trailing: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "flex-end",
};

const streakChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 1,
  fontSize: 13,
  fontWeight: 900,
  color: "rgba(251,191,36,0.95)",
  lineHeight: 1,
};

const streakUnitText: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  opacity: 0.65,
  marginLeft: 1,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
