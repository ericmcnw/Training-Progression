"use client";

// MonthCalendar — the calendar grid for Plan / Month. Tap a day to open
// the day-detail popover (DayDetailPopover).
//
// Cell layout: a single lane of domain-colored dots for "workout" entries
// (anything that isn't a daily-firing frequency goal). Filled = logged,
// hollow ring = expected/future. Capped at 4 mobile / 6 desktop with "+N".
//
// Daily habits are intentionally NOT shown on the grid — they repeat on
// every cell so they carry no day-to-day signal here, and they cluttered
// the calendar. They live in the day-detail popover (tap a day) and on the
// Home heatmap, which are built for "did I keep my dailies."

import { useState, type CSSProperties } from "react";
import type { MonthData, MonthDayCell, DayEntry, DayEntryStatus } from "./data";
import { domainRgb } from "@/lib/routines";
import DayDetailPopover from "./DayDetailPopover";
import type { QuickPickRoutine } from "@/app/_home/types";

type Props = {
  data: MonthData;
  schedulableRoutines?: QuickPickRoutine[];
  scheduleActivityTypes?: import("@/app/_home/SchedulePicker").ScheduleActivityType[];
  scheduleSports?: import("@/app/_home/SchedulePicker").ScheduleSport[];
};

// Per-cell entry caps. Mobile shows glyph dots (bigger now — a letter or
// sport emoji each), desktop shows full word chips. Most days have 1-3
// sessions; beyond the cap we render "+N".
const MAX_DOTS_MOBILE = 3;
const MAX_CHIPS_DESKTOP = 3;

export default function MonthCalendar({ data, schedulableRoutines, scheduleActivityTypes, scheduleSports }: Props) {
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const selectedDay = selectedYmd ? data.days.find((d) => d.ymd === selectedYmd) ?? null : null;

  // Pad leading + trailing cells so the calendar always starts on Sun and
  // fills out a 7-column grid cleanly.
  const cells: Array<MonthDayCell | null> = [
    ...Array.from({ length: data.leadingEmpty }, () => null),
    ...data.days,
    ...Array.from({ length: data.trailingEmpty }, () => null),
  ];

  return (
    <div className="planMonthCalendarWrap">
      <div style={weekdayRow}>
        {WEEKDAYS.map((wd) => (
          <div key={wd} style={weekdayHeader}>
            {wd}
          </div>
        ))}
      </div>

      <div style={grid}>
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} style={emptyCell} aria-hidden />;
          return (
            <DayCell
              key={cell.ymd}
              cell={cell}
              onSelect={() => setSelectedYmd(cell.ymd)}
              isSelected={cell.ymd === selectedYmd}
            />
          );
        })}
      </div>

      {selectedDay ? (
        <DayDetailPopover
          day={selectedDay}
          today={data.today}
          schedulableRoutines={schedulableRoutines}
          scheduleActivityTypes={scheduleActivityTypes}
          scheduleSports={scheduleSports}
          onClose={() => setSelectedYmd(null)}
        />
      ) : null}

      <style>{`
        .planMonthCalendarWrap {
          --plan-cell-min-h: 64px;
        }
        @media (min-width: 720px) {
          .planMonthCalendarWrap {
            --plan-cell-min-h: 96px;
          }
        }
      `}</style>
    </div>
  );
}

function DayCell({
  cell,
  onSelect,
  isSelected,
}: {
  cell: MonthDayCell;
  onSelect: () => void;
  isSelected: boolean;
}) {
  // Only workouts get dots on the grid; habits are surfaced in the popover.
  const workouts = cell.entries.filter((e) => !e.isHabit);
  const habitsTotal = cell.entries.filter((e) => e.isHabit).length;

  // Render both mobile + desktop variants and let CSS show the right one.
  // Avoids a window-size-dependent fork.
  const desktopWorkouts = workouts.slice(0, MAX_CHIPS_DESKTOP);
  const desktopWorkoutOverflow = workouts.length - desktopWorkouts.length;
  const mobileWorkouts = workouts.slice(0, MAX_DOTS_MOBILE);
  const mobileWorkoutOverflow = workouts.length - mobileWorkouts.length;

  const ariaSummary = [
    workouts.length > 0 ? `${workouts.length} workout${workouts.length === 1 ? "" : "s"}` : null,
    habitsTotal > 0 ? `${habitsTotal} habit${habitsTotal === 1 ? "" : "s"} tracked` : null,
  ].filter(Boolean).join(", ") || "no activity";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${cell.dayNumber}${cell.isToday ? " (today)" : ""} — ${ariaSummary}`}
      aria-pressed={isSelected}
      style={cellShell(cell, isSelected)}
      className="planMonthCell"
    >
      <span style={dayNumber(cell.isToday)}>{cell.dayNumber}</span>

      {/* Entry lane. Mobile = glyph dots; desktop = full word chips. Only
          one renders per viewport (CSS toggle below). */}
      <div style={workoutLane}>
        {workouts.length > 0 ? (
          <>
            <div className="planMonthLane planMonthLaneMobile" style={dotsRowBase}>
              {mobileWorkouts.map((entry) => (
                <GlyphDot key={entry.key} entry={entry} />
              ))}
              {mobileWorkoutOverflow > 0 ? <Overflow count={mobileWorkoutOverflow} /> : null}
            </div>
            <div className="planMonthLane planMonthLaneDesktop" style={chipsColBase}>
              {desktopWorkouts.map((entry) => (
                <WordChip key={entry.key} entry={entry} />
              ))}
              {desktopWorkoutOverflow > 0 ? <Overflow count={desktopWorkoutOverflow} /> : null}
            </div>
          </>
        ) : null}
      </div>

      {/* IMPORTANT: `display` is set in CSS (not inline) so the media-query
          rules can toggle it. Inline `display:flex` would beat the
          `display:none` class rule on specificity and render both lanes. */}
      <style>{`
        .planMonthLaneMobile { display: flex; }
        .planMonthLaneDesktop { display: none; }
        @media (min-width: 720px) {
          .planMonthLaneMobile { display: none; }
          .planMonthLaneDesktop { display: flex; }
        }
      `}</style>
    </button>
  );
}

// Mobile: a bigger rounded glyph dot — sport emoji or a domain-tinted letter
// monogram. Filled when logged, outlined when planned/future.
function GlyphDot({ entry }: { entry: DayEntry }) {
  const tone = entryTone(entry.status, entry.domain);
  return (
    <span
      style={{
        ...glyphDotBase,
        background: tone.bg,
        borderColor: tone.border,
        color: entry.isIcon ? "inherit" : tone.glyph,
      }}
      title={`${entry.routineName} — ${entry.status}`}
    >
      {entry.glyph}
    </span>
  );
}

// Desktop: a full word chip — small glyph + truncated routine name.
function WordChip({ entry }: { entry: DayEntry }) {
  const tone = entryTone(entry.status, entry.domain);
  return (
    <span
      style={{ ...wordChipBase, background: tone.bg, borderColor: tone.border }}
      title={`${entry.routineName} — ${entry.status}`}
    >
      {entry.isIcon ? (
        <span style={chipGlyphIcon} aria-hidden>{entry.glyph}</span>
      ) : (
        <span style={{ ...chipGlyphDot, background: tone.glyph }} aria-hidden />
      )}
      <span style={chipName}>{entry.routineName}</span>
    </span>
  );
}

function Overflow({ count }: { count: number }) {
  return (
    <span style={overflowChip} aria-hidden>
      +{count}
    </span>
  );
}

// ─────────────────────── styles

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const weekdayRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 4,
  marginBottom: 4,
};

const weekdayHeader: CSSProperties = {
  textAlign: "center",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
  paddingBottom: 2,
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 4,
};

const emptyCell: CSSProperties = {
  minHeight: "var(--plan-cell-min-h, 64px)",
};

function cellShell(cell: MonthDayCell, isSelected: boolean): CSSProperties {
  const borderColor = cell.isToday
    ? "rgba(51,255,122,0.55)"
    : isSelected
    ? "rgba(255,255,255,0.35)"
    : "rgba(255,255,255,0.08)";
  const bg = cell.isToday
    ? "linear-gradient(180deg, rgba(51,255,122,0.10), rgba(51,255,122,0.02))"
    : isSelected
    ? "rgba(255,255,255,0.06)"
    : "rgba(255,255,255,0.02)";
  return {
    all: "unset",
    cursor: "pointer",
    boxSizing: "border-box",
    display: "grid",
    // grid-template-rows: day number (auto) | workout lane (1fr). The lane
    // takes the remaining height so cells stay a uniform size across the
    // grid regardless of how many dots a day has.
    gridTemplateRows: "auto 1fr",
    gap: 4,
    minHeight: "var(--plan-cell-min-h, 70px)",
    padding: "5px 6px 6px",
    borderRadius: 8,
    border: `1px solid ${borderColor}`,
    background: bg,
    opacity: cell.isFuture && cell.entries.length === 0 ? 0.6 : 1,
    transition: "background 120ms ease, border-color 120ms ease",
  };
}

function dayNumber(isToday: boolean): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: isToday ? 900 : 800,
    color: isToday ? "rgba(51,255,122,1)" : "rgba(255,255,255,0.95)",
    lineHeight: 1,
  };
}

const workoutLane: CSSProperties = {
  // Fixed min-height so empty days keep the same rhythm as full ones.
  minHeight: 10,
  display: "flex",
  alignItems: "flex-start",
};

// NOTE: `display` is intentionally NOT set on the lane base styles. It's
// controlled by the CSS rules + media query above so .planMonthLaneMobile
// and .planMonthLaneDesktop can be toggled per viewport. Setting display
// inline would defeat the media query (inline beats class selectors).
const dotsRowBase: CSSProperties = {
  flexWrap: "wrap",
  gap: 4,
  alignItems: "center",
};

const chipsColBase: CSSProperties = {
  flexDirection: "column",
  alignItems: "stretch",
  gap: 3,
  width: "100%",
  minWidth: 0,
};

// Shared tone for a glyph dot / word chip based on log status. `bg` fills
// the chip, `border` outlines it, `glyph` colors a letter monogram or the
// desktop chip's leading dot. Missed days go red; future/planned stay faint.
const MISSED_RGB = "248,113,113";
function entryTone(status: DayEntryStatus, domain: string): { bg: string; border: string; glyph: string } {
  const rgb = domainRgb(domain);
  switch (status) {
    case "done":
    case "loggedExtra":
      return { bg: `rgba(${rgb},0.92)`, border: `rgba(${rgb},0.92)`, glyph: "rgba(6,12,22,0.92)" };
    case "partial":
      return { bg: `rgba(${rgb},0.55)`, border: `rgba(${rgb},0.85)`, glyph: "rgba(6,12,22,0.9)" };
    case "missed":
      return { bg: "transparent", border: `rgba(${MISSED_RGB},0.55)`, glyph: `rgba(${MISSED_RGB},0.9)` };
    case "future":
      return { bg: "transparent", border: `rgba(${rgb},0.4)`, glyph: `rgba(${rgb},0.7)` };
    case "planned":
    default:
      return { bg: `rgba(${rgb},0.12)`, border: `rgba(${rgb},0.65)`, glyph: `rgba(${rgb},0.95)` };
  }
}

const glyphDotBase: CSSProperties = {
  width: 19,
  height: 19,
  borderRadius: 6,
  borderWidth: 1.5,
  borderStyle: "solid",
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1,
  flexShrink: 0,
};

const wordChipBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "2px 7px",
  borderRadius: 7,
  borderWidth: 1,
  borderStyle: "solid",
  boxSizing: "border-box",
  minHeight: 19,
  width: "100%",
  minWidth: 0,
  overflow: "hidden",
};

const chipGlyphIcon: CSSProperties = {
  fontSize: 11,
  lineHeight: 1,
  flexShrink: 0,
};

const chipGlyphDot: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  flexShrink: 0,
};

const chipName: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  color: "rgba(255,255,255,0.92)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};

const overflowChip: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  color: "rgba(255,255,255,0.55)",
  letterSpacing: 0.2,
  padding: "0 2px",
  lineHeight: 1,
};
