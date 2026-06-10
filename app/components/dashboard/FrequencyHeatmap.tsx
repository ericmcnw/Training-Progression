"use client";

// Frequency heatmap — N-week consistency calendar for the goal detail page.
// Renders a Sun→Sat × N-weeks grid where each cell is colored by daily state
// (done / covered / missed / rest / future).
//
// All math comes from lib/frequency-state.ts — this component is purely
// presentational. The parent SectionCard provides title + subtitle now;
// the streak/window stats moved up to TypeHighlights so this surface stays
// focused on the calendar itself.
//
// Gentle-lens colors (per feedback_habit_lens): "done" uses the goal's
// type accent (default soft amber for back-compat callers), "missed" is a
// dim neutral outline — no red anywhere. "Covered" stays cool-blue so the
// "another routine took care of this day" cue reads as helpful, not as
// the same as "done".
//
// Marked "use client" so the missed-cell back-date affordance can launch
// the floating log drawer.

import type { CSSProperties } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import { addDaysYmd, formatUtcDateLabel } from "@/lib/dates";
import {
  formatMaskLabel,
  type FrequencyState,
  type FrequencyTarget,
} from "@/lib/frequency-state";

type WeekRow = { weekStartYmd: string; cells: Array<{ ymd: string }> };

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]; // Sun-first

// Scale cell size to the requested range so longer ranges still fit
// reasonably — 52 weeks at 16px = ~990px wide, which overflows mobile.
// The wrapper still allows horizontal scroll for the densest case.
function cellSizeForWeeks(weeks: number): number {
  if (weeks <= 12) return 16;
  if (weeks <= 26) return 12;
  return 9;
}

export default function FrequencyHeatmap({
  target,
  state,
  today,
  weekdayMask,
  weeks: weeksProp = 8,
  accentColor = "rgb(251,191,36)",
  accentBorderColor = "rgba(251,191,36,0.55)",
  retroactiveLogRoutineId,
  // When provided, done/covered cells with logs become clickable. Parent
  // owns the popover / day-expansion state — heatmap just emits the ymd
  // when a logged day is tapped.
  logsByDay,
  onDayClick,
  openDayYmd,
}: {
  target: FrequencyTarget;
  state: FrequencyState;
  today: string;
  weekdayMask?: number | null;
  weeks?: number;
  accentColor?: string;
  accentBorderColor?: string;
  retroactiveLogRoutineId?: string;
  logsByDay?: Map<string, unknown[]>;
  onDayClick?: (ymd: string) => void;
  openDayYmd?: string | null;
}) {
  const { openDrawer } = useLogDrawer();
  const WEEKS = Math.max(4, Math.min(52, Math.floor(weeksProp)));
  const CELL_SIZE = cellSizeForWeeks(WEEKS);
  const CELL_GAP = WEEKS > 26 ? 2 : 3;

  // Anchor the grid on the most recent Sunday (≤ today). Walk back WEEKS rows.
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const todayDow = todayDate.getUTCDay();
  const lastWeekStart = addDaysYmd(today, -todayDow);
  const firstWeekStart = addDaysYmd(lastWeekStart, -(WEEKS - 1) * 7);

  const weeksGrid: WeekRow[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const weekStartYmd = addDaysYmd(firstWeekStart, w * 7);
    const cells = Array.from({ length: 7 }, (_, d) => ({ ymd: addDaysYmd(weekStartYmd, d) }));
    weeksGrid.push({ weekStartYmd, cells });
  }

  const targetUnitLabel = target.targetUnit === "DAY" ? "day" : target.targetUnit === "WEEK" ? "week" : "month";
  const cadenceLabel =
    target.targetInterval === 1
      ? `${target.targetCount}× / ${targetUnitLabel}`
      : `${target.targetCount}× / ${target.targetInterval} ${targetUnitLabel}s`;
  const maskLabel = weekdayMask ? formatMaskLabel(weekdayMask) : null;

  // Month-boundary ticks: each week starts on Sunday; we label only the
  // weeks that begin a new month (compared to the previous week's month).
  // Sparse + naturally spaced ~4 weeks apart, so labels can't overlap each
  // other regardless of cell size. Always show the first week too so the
  // user has a starting anchor.
  const monthTicks: Array<{ idx: number; label: string }> = [];
  let prevMonth = -1;
  for (let i = 0; i < weeksGrid.length; i++) {
    const week = weeksGrid[i];
    const monthIdx = new Date(`${week.weekStartYmd}T00:00:00.000Z`).getUTCMonth();
    if (i === 0 || monthIdx !== prevMonth) {
      monthTicks.push({
        idx: i,
        label: formatUtcDateLabel(week.weekStartYmd, { month: "short" }),
      });
      prevMonth = monthIdx;
    }
  }
  const COLUMN_PX = CELL_SIZE + CELL_GAP;
  const tickRowWidth = weeksGrid.length * COLUMN_PX - CELL_GAP;

  return (
    <div style={shell}>
      <div style={subLine}>
        <span>{cadenceLabel}</span>
        {maskLabel ? <span style={subLineDot}>· {maskLabel}</span> : null}
      </div>

      <div style={scrollWrap}>
        <div style={gridWrap}>
          <div style={{ ...dayLabelCol, gap: CELL_GAP }}>
            {DAY_LABELS.map((d, i) => (
              <div key={i} style={{ ...dayLabelText, height: CELL_SIZE }}>{d}</div>
            ))}
          </div>

          <div style={{ ...cellsGrid, gridAutoColumns: `${CELL_SIZE}px`, gap: CELL_GAP }}>
            {weeksGrid.map((week) => (
              <div key={week.weekStartYmd} style={{ ...weekColumn, gap: CELL_GAP }}>
                {week.cells.map(({ ymd }) => {
                  const cellState = state.dailyState[ymd] ?? "rest";
                  const isToday = ymd === today;
                  const isFuture = ymd > today;
                  const dateLabel = formatUtcDateLabel(ymd, { weekday: "short", month: "short", day: "numeric" });
                  const cellSx: CSSProperties = {
                    ...cellStyle(cellState, isFuture, CELL_SIZE, accentColor, accentBorderColor),
                    ...(isToday ? todayRing : null),
                  };
                  if (cellState === "missed" && retroactiveLogRoutineId) {
                    return (
                      <button
                        key={ymd}
                        type="button"
                        onClick={() => openDrawer(retroactiveLogRoutineId, { defaultDate: ymd })}
                        title={`${dateLabel} — missed · tap to log`}
                        style={{ ...cellSx, cursor: "pointer", display: "block", padding: 0, border: cellSx.border ?? "none" }}
                        aria-label={`Back-date a log for ${dateLabel}`}
                      />
                    );
                  }
                  const dayLogs = logsByDay?.get(ymd);
                  const hasDayLogs = dayLogs && dayLogs.length > 0;
                  if (hasDayLogs && onDayClick) {
                    const isOpen = openDayYmd === ymd;
                    return (
                      <button
                        key={ymd}
                        type="button"
                        onClick={() => onDayClick(ymd)}
                        title={`${dateLabel} — ${cellState} (${dayLogs.length} log${dayLogs.length > 1 ? "s" : ""}) · tap to view`}
                        style={{
                          ...cellSx,
                          cursor: "pointer",
                          display: "block",
                          padding: 0,
                          border: cellSx.border ?? "none",
                          ...(isOpen ? openCellRing : null),
                        }}
                        aria-pressed={isOpen}
                        aria-label={`View logs for ${dateLabel}`}
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

          <div style={{ ...weekTickRow, width: tickRowWidth }}>
            {monthTicks.map((tick) => (
              <span
                key={tick.idx}
                style={{
                  ...monthTickLabel,
                  left: tick.idx * COLUMN_PX,
                }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={legendRow}>
        <Legend swatch={swatchStyle({ background: accentColor, border: accentBorderColor })} label="Done" />
        <Legend swatch={swatchCovered} label="Covered by another routine" />
        <Legend swatch={swatchMissed} label="Missed" />
        <Legend swatch={swatchRest} label="No expectation" />
        <Legend swatch={swatchFuture} label="Upcoming" />
      </div>
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

function cellStyle(
  state: "done" | "covered" | "missed" | "rest" | "future",
  isFuture: boolean,
  size: number,
  accentColor: string,
  accentBorderColor: string,
): CSSProperties {
  const base: CSSProperties = { width: size, height: size, borderRadius: size <= 10 ? 2 : 3 };
  if (isFuture) return { ...base, background: "transparent", border: "1px dashed rgba(255,255,255,0.12)" };
  switch (state) {
    case "done":
      return {
        ...base,
        background: accentColor,
        border: `1px solid ${accentBorderColor}`,
      };
    case "covered":
      return {
        ...base,
        background: "rgba(132,204,255,0.55)",
        border: "1px solid rgba(132,204,255,0.45)",
      };
    case "missed":
      // Gentle-lens: no red. A dim hollow outline reads as "you intended to
      // train this day and didn't" without alarm.
      return {
        ...base,
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.18)",
      };
    case "rest":
      return {
        ...base,
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.06)",
      };
    case "future":
      return { ...base, background: "transparent", border: "1px dashed rgba(255,255,255,0.13)" };
  }
}

const todayRing: CSSProperties = {
  outline: "1.5px solid rgba(255,255,255,0.55)",
  outlineOffset: 1,
};

const openCellRing: CSSProperties = {
  outline: "2px solid rgba(255,255,255,0.85)",
  outlineOffset: 1,
};

const shell: CSSProperties = {
  display: "grid",
  gap: 10,
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

const scrollWrap: CSSProperties = {
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  paddingBottom: 2,
};

const gridWrap: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gridTemplateRows: "auto auto",
  gap: 6,
  alignItems: "start",
};

const dayLabelCol: CSSProperties = {
  display: "grid",
  paddingTop: 0,
  gridRow: 1,
};

const dayLabelText: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  textAlign: "right",
  width: 12,
  opacity: 0.55,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
};

const cellsGrid: CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridRow: 1,
};

const weekColumn: CSSProperties = {
  display: "grid",
};

const weekTickRow: CSSProperties = {
  position: "relative",
  gridColumn: 2,
  gridRow: 2,
  height: 14,
  marginTop: 4,
};

// Month-boundary ticks are absolutely positioned at left = weekIdx *
// (CELL_SIZE + CELL_GAP). They never overlap each other because there's
// always at least ~4 weeks between two month boundaries — so they have
// natural horizontal breathing room regardless of cell size.
const monthTickLabel: CSSProperties = {
  position: "absolute",
  top: 0,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.3,
  opacity: 0.55,
  whiteSpace: "nowrap",
};

const legendRow: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
};

// Legend swatches match cell shape — same width:height ratio (square),
// same border-radius, so the legend reads as a literal key for the grid
// above. Sized to match the 12px cell-mode for visual consistency at any
// range without being too small to see.
const SWATCH_SIZE = 12;
function swatchStyle({ background, border }: { background: string; border: string }): CSSProperties {
  return {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: 3,
    background,
    border: `1px solid ${border}`,
  };
}

const swatchCovered: CSSProperties = swatchStyle({
  background: "rgba(132,204,255,0.55)",
  border: "rgba(132,204,255,0.45)",
});

const swatchMissed: CSSProperties = swatchStyle({
  background: "transparent",
  border: "rgba(255,255,255,0.18)",
});

const swatchRest: CSSProperties = swatchStyle({
  background: "rgba(255,255,255,0.035)",
  border: "rgba(255,255,255,0.06)",
});

const swatchFuture: CSSProperties = {
  width: SWATCH_SIZE,
  height: SWATCH_SIZE,
  borderRadius: 3,
  background: "transparent",
  border: "1px dashed rgba(255,255,255,0.13)",
};
