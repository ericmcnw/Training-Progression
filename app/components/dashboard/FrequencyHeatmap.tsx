"use client";

// Frequency heatmap — 8-week consistency calendar for the goal detail page.
// Renders a Sun→Sat × N-weeks grid where each cell is colored by daily state
// (done / missed / rest / future). Today is highlighted with a subtle ring.
//
// All math comes from lib/frequency-state.ts — this component is purely
// presentational. The header shows current/longest streak chips and the
// running window progress.
//
// Marked "use client" so the missed-cell back-date affordance can launch
// the floating log drawer (instead of full-page navigating away from the
// goal detail). Has no server-only deps so the boundary is cheap.

import type { CSSProperties } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import { addDaysYmd, formatUtcDateLabel } from "@/lib/dates";
import {
  formatMaskLabel,
  frequencyStatusColor,
  frequencyStatusLabel,
  type FrequencyState,
  type FrequencyTarget,
} from "@/lib/frequency-state";

type WeekRow = { weekStartYmd: string; cells: Array<{ ymd: string }> };

const WEEKS = 8;
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]; // Sun-first

export default function FrequencyHeatmap({
  target,
  state,
  today,
  weekdayMask,
  // When provided, "missed" cells become clickable links to back-date a log
  // for that exact date+routine. Only single-routine goals supply this —
  // group goals span multiple routines and can't pick one to log against.
  retroactiveLogRoutineId,
}: {
  target: FrequencyTarget;
  state: FrequencyState;
  today: string;
  weekdayMask?: number | null;
  retroactiveLogRoutineId?: string;
}) {
  const { openDrawer } = useLogDrawer();
  // Anchor the grid on the most recent Sunday (≤ today). Walk back WEEKS rows.
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const todayDow = todayDate.getUTCDay();
  const lastWeekStart = addDaysYmd(today, -todayDow);
  const firstWeekStart = addDaysYmd(lastWeekStart, -(WEEKS - 1) * 7);

  const weeks: WeekRow[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const weekStartYmd = addDaysYmd(firstWeekStart, w * 7);
    const cells = Array.from({ length: 7 }, (_, d) => ({ ymd: addDaysYmd(weekStartYmd, d) }));
    weeks.push({ weekStartYmd, cells });
  }

  const accent = frequencyStatusColor(state.currentWindow.status);
  const statusLabel = frequencyStatusLabel(state.currentWindow.status);
  const progressLabel = `${state.currentWindow.progress} / ${state.currentWindow.target}`;
  const targetUnitLabel = target.targetUnit === "DAY" ? "day" : target.targetUnit === "WEEK" ? "week" : "month";
  const cadenceLabel =
    target.targetInterval === 1
      ? `${target.targetCount}× / ${targetUnitLabel}`
      : `${target.targetCount}× / ${target.targetInterval} ${targetUnitLabel}s`;
  const maskLabel = weekdayMask ? formatMaskLabel(weekdayMask) : null;

  return (
    <div style={shell}>
      <div style={headerRow}>
        <div style={titleBlock}>
          <div style={titleLine}>Consistency · last 8 weeks</div>
          <div style={subLine}>
            <span>{cadenceLabel}</span>
            {maskLabel ? <span style={subLineDot}>· {maskLabel}</span> : null}
          </div>
        </div>
        <div style={statsRow}>
          <Stat label="This window" value={progressLabel} accent={accent} />
          <Stat label="Status" value={statusLabel} accent={accent} />
          <Stat label="Streak" value={String(Math.max(state.windowStreak, state.currentDayStreak))} accent="rgba(251,146,60,0.95)" />
          <Stat label="Best" value={String(Math.max(state.longestWindowStreak, state.longestDayStreak))} accent="rgba(132,204,255,0.95)" />
        </div>
      </div>

      <div style={gridWrap}>
        <div style={dayLabelCol}>
          {DAY_LABELS.map((d, i) => (
            <div key={i} style={dayLabelText}>{d}</div>
          ))}
        </div>

        <div style={cellsGrid}>
          {weeks.map((week) => (
            <div key={week.weekStartYmd} style={weekColumn}>
              {week.cells.map(({ ymd }) => {
                const cellState = state.dailyState[ymd] ?? "rest";
                const isToday = ymd === today;
                const isFuture = ymd > today;
                const dateLabel = formatUtcDateLabel(ymd, { weekday: "short", month: "short", day: "numeric" });
                const cellSx: CSSProperties = { ...cellStyle(cellState, isFuture), ...(isToday ? todayRing : null) };
                // Missed cells become quick-confirm log links when the goal
                // is single-routine (group goals can't disambiguate which
                // routine to back-date for).
                if (cellState === "missed" && retroactiveLogRoutineId) {
                  return (
                    <button
                      key={ymd}
                      type="button"
                      onClick={() => openDrawer(retroactiveLogRoutineId, { defaultDate: ymd })}
                      title={`${dateLabel} — missed · tap to log`}
                      style={{ ...cellSx, cursor: "pointer", display: "block", padding: 0, border: "none" }}
                      aria-label={`Back-date a log for ${dateLabel}`}
                    />
                  );
                }
                return (
                  <div
                    key={ymd}
                    title={`${dateLabel} — ${cellState}`}
                    style={cellSx}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div style={weekTickRow}>
          {weeks.map((week, idx) => {
            const isLast = idx === weeks.length - 1;
            const showLabel = idx === 0 || isLast || idx % 2 === 0;
            return (
              <div key={week.weekStartYmd} style={weekTickCell}>
                {showLabel ? formatUtcDateLabel(week.weekStartYmd, { month: "short", day: "numeric" }) : ""}
              </div>
            );
          })}
        </div>
      </div>

      <div style={legendRow}>
        <Legend swatch={swatchDone} label="Done" />
        <Legend swatch={swatchMissed} label="Missed expected day" />
        <Legend swatch={swatchRest} label="No expectation" />
        <Legend swatch={swatchFuture} label="Upcoming" />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={statBlock}>
      <div style={statLabelStyle}>{label}</div>
      <div style={{ ...statValueStyle, color: accent }}>{value}</div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: CSSProperties; label: string }) {
  return (
    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <div style={swatch} />
      <span style={{ fontSize: 11, opacity: 0.65 }}>{label}</span>
    </div>
  );
}

function cellStyle(state: "done" | "missed" | "rest" | "future", isFuture: boolean): CSSProperties {
  if (isFuture) return { ...cellBase, background: "transparent", border: "1px dashed rgba(255,255,255,0.13)" };
  switch (state) {
    case "done":
      return {
        ...cellBase,
        background: "linear-gradient(180deg, rgba(251,191,36,0.95), rgba(245,158,11,0.85))",
        border: "1px solid rgba(251,191,36,0.55)",
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
        border: "1px dashed rgba(255,255,255,0.13)",
      };
  }
}

const CELL_SIZE = 16;
const CELL_GAP = 3;

const cellBase: CSSProperties = {
  width: CELL_SIZE,
  height: CELL_SIZE,
  borderRadius: 3,
};

const todayRing: CSSProperties = {
  outline: "1.5px solid rgba(255,255,255,0.55)",
  outlineOffset: 1,
};

const shell: CSSProperties = {
  display: "grid",
  gap: 12,
};

const headerRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-end",
};

const titleBlock: CSSProperties = {
  display: "grid",
  gap: 2,
};

const titleLine: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.7,
};

const subLine: CSSProperties = {
  fontSize: 12,
  opacity: 0.65,
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
};

const subLineDot: CSSProperties = {
  opacity: 0.8,
};

const statsRow: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
};

const statBlock: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 60,
};

const statLabelStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};

const statValueStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1.1,
};

const gridWrap: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gridTemplateRows: "auto auto",
  gap: 8,
  alignItems: "start",
};

const dayLabelCol: CSSProperties = {
  display: "grid",
  gap: CELL_GAP,
  paddingTop: 0,
  gridRow: 1,
};

const dayLabelText: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  textAlign: "right",
  width: 12,
  opacity: 0.55,
  height: CELL_SIZE,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
};

const cellsGrid: CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: `${CELL_SIZE}px`,
  gap: CELL_GAP,
  gridRow: 1,
};

const weekColumn: CSSProperties = {
  display: "grid",
  gap: CELL_GAP,
};

const weekTickRow: CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: `${CELL_SIZE}px`,
  gap: CELL_GAP,
  gridColumn: 2,
  gridRow: 2,
  paddingTop: 4,
};

const weekTickCell: CSSProperties = {
  fontSize: 8.5,
  fontWeight: 700,
  opacity: 0.45,
  textAlign: "center",
  whiteSpace: "nowrap",
};

const legendRow: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
};

const swatchBase: CSSProperties = {
  width: 14,
  height: 10,
  borderRadius: 3,
};

const swatchDone: CSSProperties = {
  ...swatchBase,
  background: "linear-gradient(180deg, rgba(251,191,36,0.95), rgba(245,158,11,0.85))",
  border: "1px solid rgba(251,191,36,0.55)",
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
  border: "1px dashed rgba(255,255,255,0.13)",
};
