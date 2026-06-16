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
import { domainAccent } from "@/app/_home/client-utils";
import DayDetailPopover from "./DayDetailPopover";
import type { QuickPickRoutine } from "@/app/_home/types";

type Props = {
  data: MonthData;
  schedulableRoutines?: QuickPickRoutine[];
  scheduleActivityTypes?: import("@/app/_home/SchedulePicker").ScheduleActivityType[];
  scheduleSports?: import("@/app/_home/SchedulePicker").ScheduleSport[];
};

// Workout-dot caps. Lower than the original 6/10 because workouts are the
// minority of daily entries — most users won't have more than 1-3 actual
// workout sessions on a given day. The habit pill handles the rest.
const MAX_DOTS_MOBILE = 4;
const MAX_DOTS_DESKTOP = 6;

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

  // Workout dot caps — different on mobile vs desktop. Render both and let
  // CSS show the appropriate one. Avoids a window-size-dependent fork.
  const desktopWorkouts = workouts.slice(0, MAX_DOTS_DESKTOP);
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

      {/* Workout lane. */}
      <div style={workoutLane}>
        {workouts.length > 0 ? (
          <>
            <div className="planMonthDots planMonthDotsMobile" style={dotsRowBase}>
              {mobileWorkouts.map((entry) => (
                <Dot key={entry.key} entry={entry} />
              ))}
              {mobileWorkoutOverflow > 0 ? <Overflow count={mobileWorkoutOverflow} /> : null}
            </div>
            <div className="planMonthDots planMonthDotsDesktop" style={dotsRowBase}>
              {desktopWorkouts.map((entry) => (
                <Dot key={entry.key} entry={entry} />
              ))}
              {desktopWorkoutOverflow > 0 ? <Overflow count={desktopWorkoutOverflow} /> : null}
            </div>
          </>
        ) : null}
      </div>

      {/* IMPORTANT: `display` is set in CSS (not inline) so the media-
          query rules can actually toggle it. With `display: flex` set
          inline, the .planMonthDotsDesktop { display: none } rule loses
          on specificity and BOTH dot rows render at every viewport,
          which appeared as doubled dots on each day. */}
      <style>{`
        .planMonthDotsMobile { display: flex; }
        .planMonthDotsDesktop { display: none; }
        @media (min-width: 720px) {
          .planMonthDotsMobile { display: none; }
          .planMonthDotsDesktop { display: flex; }
        }
      `}</style>
    </button>
  );
}

function Dot({ entry }: { entry: DayEntry }) {
  return (
    <span
      style={dotStyle(entry.status, entry.domain)}
      title={`${entry.routineName} — ${entry.status}`}
      aria-hidden
    />
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
  // Tiny fixed min-height so cells with no workouts still leave room above
  // the habit pill — keeps the visual rhythm steady across the grid.
  minHeight: 10,
  display: "flex",
  alignItems: "flex-start",
};

// NOTE: `display` is intentionally NOT set here. It's controlled by the
// CSS rules + media query above so .planMonthDotsMobile and
// .planMonthDotsDesktop can be toggled per viewport. Setting display
// inline would defeat the media query (inline beats class selectors).
const dotsRowBase: CSSProperties = {
  flexWrap: "wrap",
  gap: 3,
  alignItems: "center",
};

function dotStyle(status: DayEntryStatus, domain: string): CSSProperties {
  const color = domainAccent(domain);
  const base: CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: 999,
    border: `1.5px solid ${color}`,
    flexShrink: 0,
    boxSizing: "border-box",
  };
  switch (status) {
    case "done":
    case "loggedExtra":
      return { ...base, background: color };
    case "partial":
      return { ...base, background: color, opacity: 0.7 };
    case "missed":
      return { ...base, background: "transparent", borderColor: "rgba(248,113,113,0.65)" };
    case "future":
      // Solid hollow ring at low opacity. The previous dashed border
      // rendered as a few tick marks on an 8px circle and read as visual
      // noise — solid + opacity reads cleanly at this size.
      return { ...base, background: "transparent", opacity: 0.4 };
    case "planned":
    default:
      return { ...base, background: "transparent", opacity: 0.75 };
  }
}

const overflowChip: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  color: "rgba(255,255,255,0.55)",
  letterSpacing: 0.2,
  padding: "0 2px",
  lineHeight: 1,
};
