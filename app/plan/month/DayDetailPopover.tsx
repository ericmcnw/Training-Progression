"use client";

// DayDetailPopover — opens when the user taps a day in the Plan / Month
// calendar. Mirrors the visual language of Home's WeekAtGlance day-detail
// panel (domain bars, log buttons, "+ Add" picker) but is a focused
// subset for now; full parity with Home's DetailPanel — including
// available-habits and todos — is deferred to a follow-up.

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import Popover from "@/app/_home/Popover";
import SchedulePicker from "@/app/_home/SchedulePicker";
import DrawerLogButton from "@/app/routines/DrawerLogButton";
import { domainAccent } from "@/app/_home/client-utils";
import { formatUtcDateLabel } from "@/lib/dates";
import type { MonthDayCell, DayEntry } from "./data";
import type { QuickPickRoutine } from "@/app/_home/types";

type Props = {
  day: MonthDayCell;
  today: string;
  schedulableRoutines?: QuickPickRoutine[];
  /** Enabled endurance activity types — feeds the schedule picker's
   *  typed-endurance shortcut. Empty array hides the shortcut cleanly. */
  scheduleActivityTypes?: import("@/app/_home/SchedulePicker").ScheduleActivityType[];
  /** Sports the user has added on /log — populates the SPORTS section
   *  in the schedule picker with tappable sport tiles. */
  scheduleSports?: import("@/app/_home/SchedulePicker").ScheduleSport[];
  onClose: () => void;
};

export default function DayDetailPopover({ day, today, schedulableRoutines, scheduleActivityTypes, scheduleSports, onClose }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fullDate = formatUtcDateLabel(day.ymd, { weekday: "long", month: "long", day: "numeric" });
  const sub = day.ymd === today ? "Today" : day.ymd < today ? "Past day" : "Upcoming";
  const isFuture = day.ymd > today;
  // Schedulable if EITHER saved routines, sports, or endurance types
  // are available — the picker shows whichever applies.
  const hasPickable =
    (schedulableRoutines?.length ?? 0) > 0 ||
    (scheduleSports?.length ?? 0) > 0 ||
    (scheduleActivityTypes?.length ?? 0) > 0;
  const canSchedule = hasPickable && day.ymd >= today;
  const isEmpty = day.entries.length === 0;

  // Sessions (workouts / planned routines) render first; daily habits are
  // grouped into their own labeled block below — the popover is where
  // habits live now that they're off the calendar grid.
  const sessions = day.entries.filter((e) => !e.isHabit);
  const habits = day.entries.filter((e) => e.isHabit);

  // Header pill mirrors WeekAtGlance — green + Add. Hidden for past days
  // since scheduling onto yesterday makes no sense.
  const headerActions = canSchedule ? (
    <button
      type="button"
      onClick={() => setPickerOpen(true)}
      style={addPillBtn}
      aria-label={`Add a routine to ${fullDate}`}
    >
      <span aria-hidden style={addPillPlus}>+</span>
      <span>Add</span>
    </button>
  ) : null;

  return (
    <>
      <Popover open onClose={onClose} title={fullDate} subtitle={sub} desktopWidth={420}>
        {headerActions ? <div style={actionsRow}>{headerActions}</div> : null}

        {isEmpty ? (
          <div style={emptyHint}>
            {isFuture
              ? "Nothing planned. Tap +Add to schedule something."
              : "No activity logged."}
          </div>
        ) : (
          <div style={groups}>
            {sessions.length > 0 ? (
              <div style={list}>
                {sessions.map((entry) => (
                  <DayEntryRow key={entry.key} entry={entry} day={day} isFuture={isFuture} />
                ))}
              </div>
            ) : null}

            {habits.length > 0 ? (
              <div style={list}>
                <div style={groupLabel}>Daily habits</div>
                {habits.map((entry) => (
                  <DayEntryRow key={entry.key} entry={entry} day={day} isFuture={isFuture} />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </Popover>

      {canSchedule ? (
        <SchedulePicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          ymd={day.ymd}
          dateLabel={fullDate}
          routines={schedulableRoutines ?? []}
          activityTypes={scheduleActivityTypes}
          sports={scheduleSports}
        />
      ) : null}
    </>
  );
}

function DayEntryRow({
  entry,
  day,
  isFuture,
}: {
  entry: DayEntry;
  day: MonthDayCell;
  isFuture: boolean;
}) {
  // Note: we don't have the routine's kind in the DayEntry shape (data.ts
  // doesn't surface it). Future polish — pipe `kind` through and use it
  // for COMPLETION-kind checkbox handling. For now treat everything as a
  // regular log via DrawerLogButton.
  const isLogged = entry.logged > 0;
  const fullyLogged = entry.planned > 0 && entry.logged >= entry.planned;
  const showLog = !isFuture && !fullyLogged;

  const subText = (() => {
    if (entry.logged > 0) {
      const denom = entry.planned > 0 ? entry.planned : entry.logged;
      return `${Math.min(entry.logged, denom)}/${denom} done`;
    }
    return `${entry.planned} planned`;
  })();

  return (
    <div style={rowShell(isLogged)}>
      <span style={{ ...domainBar, background: domainAccent(entry.domain) }} aria-hidden />
      <div style={rowText}>
        <span style={rowName}>{entry.routineName}</span>
        <span style={rowMeta}>{subText}</span>
      </div>
      <div style={rowActions}>
        {showLog ? (
          <DrawerLogButton
            routineId={entry.routineId}
            defaultDate={day.ymd}
            className=""
            style={logButton}
          />
        ) : isLogged && entry.latestLogId ? (
          <Link
            href={`/routines/${entry.routineId}/logs/${entry.latestLogId}`}
            style={viewLink}
          >
            view →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────── styles

const actionsRow: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const addPillBtn: CSSProperties = {
  all: "unset",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 11px 5px 8px",
  borderRadius: 999,
  border: "1px solid rgba(51,255,122,0.40)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
  fontSize: 11.5,
  fontWeight: 900,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  cursor: "pointer",
  minHeight: 30,
  whiteSpace: "nowrap",
};

const addPillPlus: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1,
  marginTop: -1,
};

const groups: CSSProperties = {
  display: "grid",
  gap: 14,
};

const list: CSSProperties = {
  display: "grid",
  gap: 6,
};

const groupLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
  marginBottom: 2,
};

const emptyHint: CSSProperties = {
  fontSize: 12,
  fontStyle: "italic",
  color: "rgba(255,255,255,0.55)",
  padding: "8px 4px",
};

function rowShell(isLogged: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "3px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: isLogged ? "rgba(51,255,122,0.05)" : "rgba(255,255,255,0.02)",
    minHeight: 44,
  };
}

const domainBar: CSSProperties = {
  width: 3,
  height: 28,
  borderRadius: 2,
};

const rowText: CSSProperties = {
  display: "grid",
  gap: 1,
  minWidth: 0,
};

const rowName: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(255,255,255,0.95)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowMeta: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.55)",
};

const rowActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const logButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 14px",
  borderRadius: 10,
  border: "1px solid rgba(51,255,122,0.42)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,1)",
  fontSize: 12,
  fontWeight: 900,
  textDecoration: "none",
  letterSpacing: 0.3,
};

const viewLink: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,0.55)",
  textDecoration: "none",
  padding: "5px 9px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};
