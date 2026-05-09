// Habit lane — a calendar strip per habit-domain routine, rendered into the
// dashboard right below the Week at a Glance section. One row per habit with
// a 14-day strip (matches default trailing window) and a streak chip.
//
// All math comes from lib/frequency-state.ts so this component stays purely
// presentational. Per-day cells use four states:
//   • done   — solid amber pill
//   • missed — hollow red pill
//   • rest   — faint dot (off-mask day or pre-window noise)
//   • future — outlined ghost cell
//
// If a routine has no FrequencyGoal, daily semantics apply (every past day is
// expected). If it has one with a weekday mask, only mask days are expected.

import Link from "next/link";
import type { CSSProperties } from "react";
import { addDaysYmd, formatUtcDateLabel } from "@/lib/dates";
import {
  formatMaskLabel,
  frequencyStatusColor,
  frequencyStatusLabel,
  type FrequencyState,
} from "@/lib/frequency-state";

export type HabitLaneRow = {
  routineId: string;
  routineName: string;
  goalId: string | null;       // null when habit has no FrequencyGoal
  goalLabel: string | null;    // e.g. "3× / week" or "Mon · Wed · Fri"
  weekdayMask: number | null;  // null for daily / flexible
  state: FrequencyState;
};

const STRIP_DAYS = 14;
const CELL_GAP = 4;

export default function HabitLane({
  rows,
  today,
}: {
  rows: HabitLaneRow[];
  today: string;
}) {
  if (rows.length === 0) {
    return (
      <div style={emptyShell}>
        <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.85 }}>No habits yet</div>
        <div style={{ fontSize: 12, opacity: 0.62, lineHeight: 1.45 }}>
          Set a routine&apos;s domain to <strong>Habit / Routine</strong> to track it here as a daily streak.
        </div>
        <Link href="/routines?domain=habit" style={emptyCta}>Browse habit routines</Link>
      </div>
    );
  }

  const stripStart = addDaysYmd(today, -(STRIP_DAYS - 1));
  const dayHeaders = Array.from({ length: STRIP_DAYS }, (_, i) => addDaysYmd(stripStart, i));

  return (
    <div style={shell}>
      <div style={headerRow}>
        <div style={headerCol1}>Habit</div>
        <div style={stripHeader}>
          {dayHeaders.map((ymd, idx) => {
            const isToday = ymd === today;
            const dayLabel = formatUtcDateLabel(ymd, { weekday: "narrow" });
            return (
              <div
                key={ymd}
                style={{
                  ...headerCell,
                  fontWeight: isToday ? 900 : 700,
                  opacity: isToday ? 1 : idx % 2 === 0 ? 0.7 : 0.55,
                  color: isToday ? "rgba(251,191,36,0.95)" : "inherit",
                }}
              >
                {dayLabel}
              </div>
            );
          })}
        </div>
        <div style={headerColLast}>Streak</div>
      </div>

      <div style={rowsWrap}>
        {rows.map((row) => (
          <HabitRow key={row.routineId} row={row} today={today} stripStart={stripStart} />
        ))}
      </div>

      <div style={legendRow}>
        <Legend swatch={swatchDone} label="Done" />
        <Legend swatch={swatchMissed} label="Missed" />
        <Legend swatch={swatchRest} label="Rest day" />
        <Legend swatch={swatchFuture} label="Upcoming" />
      </div>
    </div>
  );
}

function HabitRow({
  row,
  today,
  stripStart,
}: {
  row: HabitLaneRow;
  today: string;
  stripStart: string;
}) {
  const { state } = row;
  // Routine detail is the canonical landing page — the goal (if any) is
  // accessible from there, and routes always exist regardless of goal type.
  const detailHref = `/routines/${row.routineId}`;
  const subLabel = row.goalLabel ?? "Daily streak";
  const maskLabel = row.weekdayMask ? formatMaskLabel(row.weekdayMask) : null;
  const statusColor = frequencyStatusColor(state.currentWindow.status);
  const statusLabel = frequencyStatusLabel(state.currentWindow.status);
  const streakValue = state.windowStreak > 0 ? state.windowStreak : state.currentDayStreak;
  const streakUnit = state.windowStreak > 0 ? "wk" : "d";

  return (
    <Link href={detailHref} style={rowCard}>
      <div style={col1}>
        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.2 }}>{row.routineName}</div>
        <div style={subline}>
          <span style={{ ...statusPill, color: statusColor, borderColor: statusColor }}>{statusLabel}</span>
          <span style={{ opacity: 0.7 }}>{subLabel}</span>
          {maskLabel ? <span style={{ opacity: 0.55 }}>· {maskLabel}</span> : null}
        </div>
      </div>

      <div style={strip}>
        {Array.from({ length: STRIP_DAYS }, (_, i) => {
          const ymd = addDaysYmd(stripStart, i);
          const cellState = state.dailyState[ymd] ?? "rest";
          const isToday = ymd === today;
          return (
            <div
              key={ymd}
              title={`${formatUtcDateLabel(ymd, { weekday: "short", month: "short", day: "numeric" })} — ${cellState}`}
              style={{ ...cellStyle(cellState), ...(isToday ? todayRing : null) }}
            />
          );
        })}
      </div>

      <div style={colLast}>
        <div style={streakNumber}>{streakValue}</div>
        <div style={streakUnitLabel}>{streakUnit}</div>
      </div>
    </Link>
  );
}

function Legend({ swatch, label }: { swatch: CSSProperties; label: string }) {
  return (
    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <div style={swatch} />
      <span style={{ fontSize: 11, opacity: 0.7 }}>{label}</span>
    </div>
  );
}

function cellStyle(state: "done" | "missed" | "rest" | "future"): CSSProperties {
  switch (state) {
    case "done":
      return {
        ...cellBase,
        background: "linear-gradient(180deg, rgba(251,191,36,0.95), rgba(245,158,11,0.85))",
        border: "1px solid rgba(251,191,36,0.6)",
        boxShadow: "0 0 0 1px rgba(251,191,36,0.18) inset",
      };
    case "missed":
      return {
        ...cellBase,
        background: "rgba(248,113,113,0.10)",
        border: "1px solid rgba(248,113,113,0.55)",
      };
    case "rest":
      return {
        ...cellBase,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      };
    case "future":
      return {
        ...cellBase,
        background: "transparent",
        border: "1px dashed rgba(255,255,255,0.15)",
      };
  }
}

const cellBase: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  height: 22,
  borderRadius: 5,
};

const todayRing: CSSProperties = {
  outline: "1.5px solid rgba(251,191,36,0.65)",
  outlineOffset: 1,
};

const shell: CSSProperties = {
  display: "grid",
  gap: 10,
};

const emptyShell: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "16px 18px",
  borderRadius: 14,
  border: "1px dashed rgba(251,191,36,0.28)",
  background: "rgba(251,191,36,0.04)",
  justifyItems: "start",
};

const emptyCta: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(251,191,36,0.95)",
  textDecoration: "none",
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(251,191,36,0.4)",
  background: "rgba(251,191,36,0.08)",
};

const headerRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(120px, 1.6fr) minmax(0, 4fr) 56px",
  gap: 12,
  alignItems: "center",
  padding: "0 4px 4px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const headerCol1: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.5,
};

const headerColLast: CSSProperties = {
  ...headerCol1,
  textAlign: "right",
};

const stripHeader: CSSProperties = {
  display: "flex",
  gap: CELL_GAP,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const headerCell: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  textAlign: "center",
};

const rowsWrap: CSSProperties = {
  display: "grid",
  gap: 6,
};

const rowCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(120px, 1.6fr) minmax(0, 4fr) 56px",
  gap: 12,
  alignItems: "center",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.02)",
  color: "inherit",
  textDecoration: "none",
  transition: "background 120ms ease, border-color 120ms ease",
};

const col1: CSSProperties = {
  display: "grid",
  gap: 3,
  minWidth: 0,
};

const subline: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  alignItems: "center",
  fontSize: 11,
};

const statusPill: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  border: "1px solid",
  padding: "1px 6px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.02)",
};

const strip: CSSProperties = {
  display: "flex",
  gap: CELL_GAP,
  alignItems: "center",
};

const colLast: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  alignContent: "center",
  borderRadius: 10,
  background: "rgba(251,191,36,0.06)",
  border: "1px solid rgba(251,191,36,0.18)",
  padding: "4px 0",
  minWidth: 50,
};

const streakNumber: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1,
  color: "rgba(251,191,36,0.95)",
};

const streakUnitLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  marginTop: 2,
  opacity: 0.7,
};

const legendRow: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  paddingTop: 4,
};

const swatchBase: CSSProperties = {
  width: 14,
  height: 10,
  borderRadius: 3,
};

const swatchDone: CSSProperties = {
  ...swatchBase,
  background: "linear-gradient(180deg, rgba(251,191,36,0.95), rgba(245,158,11,0.85))",
  border: "1px solid rgba(251,191,36,0.6)",
};

const swatchMissed: CSSProperties = {
  ...swatchBase,
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.55)",
};

const swatchRest: CSSProperties = {
  ...swatchBase,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const swatchFuture: CSSProperties = {
  ...swatchBase,
  background: "transparent",
  border: "1px dashed rgba(255,255,255,0.15)",
};
