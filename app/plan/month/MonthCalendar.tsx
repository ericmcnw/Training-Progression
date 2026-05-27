"use client";

// MonthCalendar — the calendar grid for Plan / Month. Tap a day to open
// the day-detail popover (DayDetailPopover). One dot per routine that
// fired/expected that day, color-coded by domain, filled when logged.
// Overflows compress into a "+N" chip.

import { useState, type CSSProperties } from "react";
import type { MonthData, MonthDayCell, DayEntry, DayEntryStatus } from "./data";
import { domainAccent } from "@/app/_home/client-utils";
import DayDetailPopover from "./DayDetailPopover";
import type { QuickPickRoutine } from "@/app/_home/types";

type Props = {
  data: MonthData;
  schedulableRoutines?: QuickPickRoutine[];
};

const MAX_DOTS_MOBILE = 6;
const MAX_DOTS_DESKTOP = 10;

export default function MonthCalendar({ data, schedulableRoutines }: Props) {
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
  // Compute display dots. The cap differs by viewport; the JS just builds
  // both and CSS hides whichever doesn't apply (we approximate by always
  // using the desktop cap then hiding overflow on mobile via a CSS class).
  const hasEntries = cell.entries.length > 0;
  const desktopDots = cell.entries.slice(0, MAX_DOTS_DESKTOP);
  const desktopOverflow = cell.entries.length - desktopDots.length;
  const mobileDots = cell.entries.slice(0, MAX_DOTS_MOBILE);
  const mobileOverflow = cell.entries.length - mobileDots.length;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${cell.dayNumber}${cell.isToday ? " (today)" : ""} — ${cell.entries.length} routine${cell.entries.length === 1 ? "" : "s"}`}
      aria-pressed={isSelected}
      style={cellShell(cell, isSelected)}
      className="planMonthCell"
    >
      <span style={dayNumber(cell.isToday)}>{cell.dayNumber}</span>

      {hasEntries ? (
        <>
          {/* Mobile dot strip (≤6 dots + optional "+N"). */}
          <div className="planMonthDots planMonthDotsMobile" style={dotsRow}>
            {mobileDots.map((entry) => (
              <Dot key={entry.routineId} entry={entry} />
            ))}
            {mobileOverflow > 0 ? <Overflow count={mobileOverflow} /> : null}
          </div>
          {/* Desktop dot strip (≤10 dots + optional "+N"). */}
          <div className="planMonthDots planMonthDotsDesktop" style={dotsRow}>
            {desktopDots.map((entry) => (
              <Dot key={entry.routineId} entry={entry} />
            ))}
            {desktopOverflow > 0 ? <Overflow count={desktopOverflow} /> : null}
          </div>
        </>
      ) : null}

      <style>{`
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
    gap: 4,
    alignContent: "start",
    minHeight: "var(--plan-cell-min-h, 64px)",
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

const dotsRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 3,
  alignItems: "center",
};

function dotStyle(status: DayEntryStatus, domain: string): CSSProperties {
  const color = domainAccent(domain);
  const base: CSSProperties = {
    width: 7,
    height: 7,
    borderRadius: 999,
    border: `1.5px solid ${color}`,
    flexShrink: 0,
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
      return { ...base, background: "transparent", borderStyle: "dashed" };
    case "planned":
    default:
      return { ...base, background: "transparent", opacity: 0.85 };
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
