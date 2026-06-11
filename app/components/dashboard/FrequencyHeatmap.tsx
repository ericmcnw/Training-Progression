"use client";

// Frequency heatmap — N-week consistency calendar for the goal detail page.
// Calendar layout: day-of-week labels go HORIZONTALLY across the top,
// each week is a VERTICAL row stacked top-to-bottom (oldest first).
// Week-start date labels run down the left side at month boundaries +
// every Nth week for context.
//
// This is the standard "calendar grid" layout the user requested instead
// of the GitHub-contributions horizontal-time orientation. Reads more
// naturally on mobile because it grows vertically (scroll-friendly)
// instead of horizontally (overflow-scroll).
//
// Cell coloring rules (gentle lens): "done" uses the goal's type accent,
// "covered" stays cool-blue (another routine handled it), "missed" is a
// dim hollow outline (no red anywhere), "rest" is a quiet placeholder,
// "future" is a dashed empty cell.
//
// Marked "use client" because:
//   1. missed-cell back-date affordance launches the floating LogDrawer
//   2. matchMedia hook bumps cell size on desktop viewports

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import { addDaysYmd, formatUtcDateLabel } from "@/lib/dates";
import {
  formatMaskLabel,
  type FrequencyState,
  type FrequencyTarget,
} from "@/lib/frequency-state";

type WeekRow = { weekStartYmd: string; cells: Array<{ ymd: string }> };

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]; // Sun-first

// Cell size scales with range AND viewport. Desktop gets ~70% larger
// cells so the heatmap actually fills the width of the detail card.
function cellSizeForWeeks(weeks: number, isDesktop: boolean): number {
  if (isDesktop) {
    if (weeks <= 12) return 28;
    if (weeks <= 26) return 22;
    return 16;
  }
  if (weeks <= 12) return 22;
  if (weeks <= 26) return 16;
  return 11;
}

// Week-label tick density — every Nth week gets a date label on the left.
// Always show the first week + every month boundary so the user has
// anchors.
function tickEveryForWeeks(weeks: number): number {
  if (weeks <= 6) return 1;
  if (weeks <= 14) return 2;
  if (weeks <= 28) return 4;
  return 8;
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

  // Desktop detection — bumps cell size up. SSR safe: we render with
  // mobile sizes by default and re-render on mount if we're on desktop.
  // No layout shift on the same device, only a brief mobile-shaped paint
  // on a fresh desktop load.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 720px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const CELL_SIZE = cellSizeForWeeks(WEEKS, isDesktop);
  const CELL_GAP = WEEKS > 26 ? 2 : 3;
  const LABEL_COL_PX = isDesktop ? 56 : 44;

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

  // Decide which weeks get a left-side date label.
  //  - Always label week 0 + last week
  //  - Always label first week of each new month
  //  - Beyond that, fall back to every-Nth-week density
  const tickEvery = tickEveryForWeeks(WEEKS);
  const weekShouldLabel = (idx: number) => {
    if (idx === 0 || idx === weeksGrid.length - 1) return true;
    const prev = weeksGrid[idx - 1];
    const curr = weeksGrid[idx];
    if (!prev) return true;
    const prevMonth = new Date(`${prev.weekStartYmd}T00:00:00.000Z`).getUTCMonth();
    const currMonth = new Date(`${curr.weekStartYmd}T00:00:00.000Z`).getUTCMonth();
    if (prevMonth !== currMonth) return true;
    return idx % tickEvery === 0;
  };

  const targetUnitLabel = target.targetUnit === "DAY" ? "day" : target.targetUnit === "WEEK" ? "week" : "month";
  const cadenceLabel =
    target.targetInterval === 1
      ? `${target.targetCount}× / ${targetUnitLabel}`
      : `${target.targetCount}× / ${target.targetInterval} ${targetUnitLabel}s`;
  const maskLabel = weekdayMask ? formatMaskLabel(weekdayMask) : null;

  // Grid template: 1 label column + 7 day columns
  const gridTemplateColumns = `${LABEL_COL_PX}px repeat(7, ${CELL_SIZE}px)`;

  return (
    <div style={shellStyle}>
      <div style={subLineStyle}>
        <span>{cadenceLabel}</span>
        {maskLabel ? <span style={subLineDotStyle}>· {maskLabel}</span> : null}
      </div>

      <div
        style={{
          ...gridStyle,
          gridTemplateColumns,
          gap: CELL_GAP,
        }}
      >
        {/* Header row: empty corner + 7 day-of-week labels */}
        <div aria-hidden />
        {DAY_LABELS.map((d, i) => (
          <div
            key={`hdr-${i}`}
            style={{
              ...dayHeaderStyle,
              height: CELL_SIZE,
              fontSize: CELL_SIZE >= 22 ? 11 : 9,
            }}
          >
            {d}
          </div>
        ))}

        {/* One row per week */}
        {weeksGrid.map((week, weekIdx) => {
          const showLabel = weekShouldLabel(weekIdx);
          const dateLabel = showLabel
            ? formatUtcDateLabel(week.weekStartYmd, { month: "short", day: "numeric" })
            : "";
          return (
            <Fragment key={week.weekStartYmd}>
              <div
                style={{
                  ...weekLabelStyle,
                  height: CELL_SIZE,
                  fontSize: CELL_SIZE >= 22 ? 11 : 9.5,
                  visibility: showLabel ? "visible" : "hidden",
                }}
              >
                {dateLabel}
              </div>
              {week.cells.map(({ ymd }) => {
                const cellState = state.dailyState[ymd] ?? "rest";
                const isToday = ymd === today;
                const isFuture = ymd > today;
                const dateTitle = formatUtcDateLabel(ymd, { weekday: "short", month: "short", day: "numeric" });
                const cellSx: CSSProperties = {
                  ...cellStyle(cellState, isFuture, CELL_SIZE, accentColor, accentBorderColor),
                  ...(isToday ? todayRing : null),
                };

                if (cellState === "missed" && retroactiveLogRoutineId) {
                  return (
                    <button
                      key={ymd}
                      type="button"
                      className="freqHeatmapCell"
                      onClick={() => openDrawer(retroactiveLogRoutineId, { defaultDate: ymd })}
                      title={`${dateTitle} — missed · tap to log`}
                      style={{
                        ...cellSx,
                        cursor: "pointer",
                        display: "block",
                        padding: 0,
                        minHeight: 0,
                        border: cellSx.border ?? "none",
                      }}
                      aria-label={`Back-date a log for ${dateTitle}`}
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
                      className="freqHeatmapCell"
                      onClick={() => onDayClick(ymd)}
                      title={`${dateTitle} — ${cellState} (${dayLogs.length} log${dayLogs.length > 1 ? "s" : ""}) · tap to view`}
                      style={{
                        ...cellSx,
                        cursor: "pointer",
                        display: "block",
                        padding: 0,
                        minHeight: 0,
                        border: cellSx.border ?? "none",
                        ...(isOpen ? openCellRing : null),
                      }}
                      aria-pressed={isOpen}
                      aria-label={`View logs for ${dateTitle}`}
                    />
                  );
                }
                return (
                  <div
                    key={ymd}
                    title={`${dateTitle} — ${cellState}`}
                    style={cellSx}
                  />
                );
              })}
            </Fragment>
          );
        })}
      </div>

      <div style={legendRowStyle}>
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
  const base: CSSProperties = { width: size, height: size, borderRadius: size <= 12 ? 3 : 4 };
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

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const subLineStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.65,
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
};

const subLineDotStyle: CSSProperties = {
  opacity: 0.8,
};

const gridStyle: CSSProperties = {
  display: "grid",
  alignItems: "center",
  justifyContent: "start",
};

const dayHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  opacity: 0.5,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const weekLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  paddingRight: 6,
  fontWeight: 700,
  opacity: 0.55,
  whiteSpace: "nowrap",
};

const legendRowStyle: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
};

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
