// Habit lane — compact, single-row layout. Renders a list of habits with a
// 7-day default strip and a leading streak chip. The owning RhythmPanel
// provides the panel chrome; this component is list-only.
//
// Per-day cells use four states:
//   • done   — soft amber fill
//   • missed — red outline only
//   • rest   — faint dot
//   • future — dashed outline

import Link from "next/link";
import type { CSSProperties } from "react";
import { addDaysYmd, formatUtcDateLabel } from "@/lib/dates";
import {
  formatMaskLabel,
  frequencyStatusColor,
  type FrequencyState,
} from "@/lib/frequency-state";

export type HabitLaneRow = {
  routineId: string;
  routineName: string;
  goalId: string | null;
  goalLabel: string | null;
  weekdayMask: number | null;
  state: FrequencyState;
};

const CELL_GAP = 3;

export default function HabitLane({
  rows,
  today,
  trailingDays = 7,
}: {
  rows: HabitLaneRow[];
  today: string;
  trailingDays?: 7 | 14 | 30;
}) {
  if (rows.length === 0) {
    return (
      <div style={emptyInline}>
        <span style={{ opacity: 0.65 }}>No habits yet —</span>
        <Link href="/routines?domain=lifestyle" style={emptyInlineLink}>
          set a routine&apos;s domain to Lifestyle
        </Link>
      </div>
    );
  }

  const stripStart = addDaysYmd(today, -(trailingDays - 1));

  return (
    <div style={listShell}>
      {rows.map((row) => (
        <HabitRow
          key={row.routineId}
          row={row}
          today={today}
          stripStart={stripStart}
          trailingDays={trailingDays}
        />
      ))}
    </div>
  );
}

function HabitRow({
  row,
  today,
  stripStart,
  trailingDays,
}: {
  row: HabitLaneRow;
  today: string;
  stripStart: string;
  trailingDays: number;
}) {
  const { state } = row;
  const accent = frequencyStatusColor(state.currentWindow.status);
  const detailHref = `/routines/${row.routineId}`;
  const subLabel = row.weekdayMask ? formatMaskLabel(row.weekdayMask) : (row.goalLabel ?? "Daily");
  const streakValue = state.windowStreak > 0 ? state.windowStreak : state.currentDayStreak;
  const streakUnit = state.windowStreak > 0 ? "wk" : "d";
  const showStreak = streakValue > 0;
  const isAtRisk = state.currentWindow.status === "at_risk";

  return (
    <Link href={detailHref} style={rowCard}>
      <div style={{ ...rowAccent, background: accent }} />

      <div style={col1}>
        <div style={nameLine}>
          <span style={nameText}>{row.routineName}</span>
          <span style={subText}>· {subLabel}</span>
        </div>
      </div>

      <div style={strip}>
        {Array.from({ length: trailingDays }, (_, i) => {
          const ymd = addDaysYmd(stripStart, i);
          const cellState = state.dailyState[ymd] ?? "rest";
          const isToday = ymd === today;
          return (
            <div
              key={ymd}
              title={`${formatUtcDateLabel(ymd, { weekday: "short", month: "short", day: "numeric" })} — ${cellState}`}
              style={{ ...cellStyle(cellState, accent), ...(isToday ? todayBadge : null) }}
            />
          );
        })}
      </div>

      <div style={trailing}>
        {isAtRisk ? <span style={{ ...riskDot, background: accent }} title="At risk" /> : null}
        {showStreak ? (
          <span style={streakChip}>
            {streakValue}
            <span style={streakUnitText}>{streakUnit}</span>
          </span>
        ) : (
          <span style={{ ...streakChip, opacity: 0.35, color: "inherit" }}>—</span>
        )}
      </div>
    </Link>
  );
}

function cellStyle(state: "done" | "covered" | "missed" | "rest" | "future", accent: string): CSSProperties {
  switch (state) {
    case "done":
      return {
        ...cellBase,
        background: "rgba(251,191,36,0.85)",
        border: "1px solid rgba(251,191,36,0.65)",
      };
    case "covered":
      return {
        ...cellBase,
        background: "rgba(132,204,255,0.75)",
        border: "1px solid rgba(132,204,255,0.55)",
      };
    case "missed":
      return {
        ...cellBase,
        background: "transparent",
        border: "1px solid rgba(248,113,113,0.55)",
      };
    case "rest":
      return {
        ...cellBase,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.05)",
      };
    case "future":
      return {
        ...cellBase,
        background: "transparent",
        border: "1px dashed rgba(255,255,255,0.13)",
      };
  }
}

const cellBase: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  height: 14,
  borderRadius: 3,
};

const todayBadge: CSSProperties = {
  outline: "1.5px solid rgba(255,255,255,0.5)",
  outlineOffset: 1,
};

const listShell: CSSProperties = {
  display: "grid",
  gap: 4,
};

const emptyInline: CSSProperties = {
  fontSize: 12,
  padding: "10px 4px",
  display: "inline-flex",
  gap: 5,
  flexWrap: "wrap",
  alignItems: "center",
};

const emptyInlineLink: CSSProperties = {
  color: "rgba(251,191,36,0.95)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const rowCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "3px minmax(110px, 1.4fr) minmax(0, 2.2fr) 52px",
  gap: 8,
  alignItems: "center",
  padding: "6px 8px 6px 0",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.015)",
  color: "inherit",
  textDecoration: "none",
  minHeight: 32,
};

const rowAccent: CSSProperties = {
  height: 18,
  width: 3,
  borderRadius: "0 2px 2px 0",
  marginLeft: 0,
};

const col1: CSSProperties = {
  minWidth: 0,
};

const nameLine: CSSProperties = {
  display: "flex",
  gap: 4,
  alignItems: "baseline",
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const nameText: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  lineHeight: 1.1,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const subText: CSSProperties = {
  fontSize: 10.5,
  opacity: 0.55,
  fontWeight: 600,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const strip: CSSProperties = {
  display: "flex",
  gap: CELL_GAP,
  alignItems: "center",
};

const trailing: CSSProperties = {
  display: "flex",
  gap: 4,
  alignItems: "center",
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

const riskDot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  flexShrink: 0,
  boxShadow: "0 0 0 2px rgba(248,113,113,0.18)",
};
