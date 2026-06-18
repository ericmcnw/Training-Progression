"use client";

// WeekAtGlance — scrollable day rail + inline detail panel for each day
// (domain dots + status word). Includes habit-domain routines in the dot
// row so users who train mostly via habits see their data instead of
// empty cells.

import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { LegacyGlanceDay, QuickPickRoutine } from "./types";
import DrawerLogButton from "@/app/routines/DrawerLogButton";
import ViewButton from "@/app/components/ViewButton";
import { COLOR, cardSurface } from "./tokens";
import { domainAccent } from "./client-utils";
import {
  formatRoutineTypeLabel,
  normalizeRoutineKind,
} from "@/lib/routines";
import { formatUtcDateLabel } from "@/lib/dates";
import { describeWeatherCode } from "@/lib/weather";
import CompletionCheckbox from "@/app/components/dashboard/CompletionCheckbox";
import CompletionMinutesPill from "@/app/components/dashboard/CompletionMinutesPill";
import DayTodoList from "@/app/components/dashboard/DayTodoList";
import SchedulePicker from "./SchedulePicker";

type Props = {
  days: LegacyGlanceDay[];
  today: string;
  currentWeekStart: string;
  // Full active-routine list piped through for the inline schedule picker.
  // Optional so existing callers (legacy) don't have to provide it — when
  // absent the "+ Add to plan" button stays hidden.
  schedulableRoutines?: QuickPickRoutine[];
  /** Enabled endurance activity types — feeds the SchedulePicker's
   *  typed-endurance shortcut block. Empty hides the section cleanly. */
  scheduleActivityTypes?: import("./SchedulePicker").ScheduleActivityType[];
  /** Sports the user has added — populates the SPORTS section in the
   *  schedule picker with tappable sport tiles. */
  scheduleSports?: import("./SchedulePicker").ScheduleSport[];
};

// Default fallbacks — actual day width is computed from viewport width so
// exactly `visibleCount` cards fit without horizontal overflow. This matters
// in the 2x2 desktop layout where each cell is ~half the page width.
const DAY_WIDTH_DESKTOP = 76;
const DAY_WIDTH_MOBILE = 66;
const VISIBLE_ON_DESKTOP = 7;
const VISIBLE_ON_MOBILE = 5;
const DAY_WIDTH_DESKTOP_MIN = 60;
const DAY_WIDTH_DESKTOP_MAX = 88;
const DAY_WIDTH_MOBILE_MIN = 56;
const DAY_WIDTH_MOBILE_MAX = 76;
const DAY_GAP = 6;

export default function WeekAtGlance({ days, today, currentWeekStart: _currentWeekStart, schedulableRoutines, scheduleActivityTypes, scheduleSports }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [selectedYmd, setSelectedYmd] = useState<string>(today);
  const [dayWidth, setDayWidth] = useState(DAY_WIDTH_DESKTOP);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_ON_DESKTOP);
  const [scrollIndex, setScrollIndex] = useState(0);

  // Drag-to-scroll bookkeeping. didDragRef gates the day-card click handler
  // so a swipe doesn't accidentally select the day under your cursor.
  const dragStateRef = useRef<{ startX: number; scrollStart: number; active: boolean } | null>(null);
  const didDragRef = useRef(false);

  const todayIndex = Math.max(0, days.findIndex((d) => d.ymd === today));

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => {
      const w = node.clientWidth;
      const isMobile = w < 480;
      // Compute day width so exactly `visible` cards fit the viewport width.
      // This keeps the user from needing to scroll on desktop while the rail
      // still gracefully shrinks inside the 2x2 grid cell on wide screens.
      const visible = isMobile ? VISIBLE_ON_MOBILE : VISIBLE_ON_DESKTOP;
      const target = Math.floor((w - DAY_GAP * (visible - 1)) / visible);
      const dw = isMobile
        ? Math.max(DAY_WIDTH_MOBILE_MIN, Math.min(DAY_WIDTH_MOBILE_MAX, target))
        : Math.max(DAY_WIDTH_DESKTOP_MIN, Math.min(DAY_WIDTH_DESKTOP_MAX, target));
      setDayWidth(dw);
      setVisibleCount(visible);
    };
    update();
    window.addEventListener("resize", update);
    // ResizeObserver also fires when the parent (e.g. 2x2 grid cell) reflows
    // without a viewport resize — important when toggling dev tools etc.
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  // Initial scroll → land with TODAY in the middle of the viewport (3 before,
  // today, 3 after when 7 are visible).
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const step = dayWidth + 6;
    const centerOffset = Math.floor(visibleCount / 2);
    const targetIndex = Math.max(0, Math.min(days.length - visibleCount, todayIndex - centerOffset));
    node.scrollLeft = targetIndex * step;
    setScrollIndex(targetIndex);
  }, [todayIndex, dayWidth, visibleCount, days.length]);

  function handleScroll() {
    const node = viewportRef.current;
    if (!node) return;
    const step = dayWidth + 6;
    setScrollIndex(Math.round(node.scrollLeft / step));
  }

  function scrollBy(delta: number) {
    const node = viewportRef.current;
    if (!node) return;
    const step = dayWidth + 6;
    const maxStart = Math.max(0, days.length - visibleCount);
    const nextIndex = Math.max(0, Math.min(maxStart, scrollIndex + delta));
    node.scrollTo({ left: nextIndex * step, behavior: "smooth" });
    setScrollIndex(nextIndex);
  }

  // ── click-and-drag horizontal scrolling ─────────────────────────────────
  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const node = viewportRef.current;
    if (!node) return;
    // Only left button
    if (e.button !== 0) return;
    dragStateRef.current = { startX: e.pageX, scrollStart: node.scrollLeft, active: true };
    didDragRef.current = false;
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const node = viewportRef.current;
    const state = dragStateRef.current;
    if (!node || !state || !state.active) return;
    const dx = e.pageX - state.startX;
    if (!didDragRef.current && Math.abs(dx) > 4) {
      didDragRef.current = true;
      node.style.cursor = "grabbing";
    }
    if (didDragRef.current) {
      node.scrollLeft = state.scrollStart - dx;
      e.preventDefault();
    }
  }

  function endDrag() {
    const node = viewportRef.current;
    if (node) node.style.cursor = "grab";
    if (dragStateRef.current) dragStateRef.current.active = false;
    // didDragRef is consumed inside the day-card onClick — leave it set so
    // the click handler can suppress its action, then reset on next tick.
    setTimeout(() => { didDragRef.current = false; }, 0);
  }

  const selectedDay = days.find((d) => d.ymd === selectedYmd) ?? days.find((d) => d.ymd === today) ?? days[days.length - 1] ?? null;
  const visibleStart = scrollIndex;
  const visibleEnd = Math.min(days.length - 1, scrollIndex + visibleCount - 1);
  const rangeLabel =
    days[visibleStart] && days[visibleEnd]
      ? `${formatUtcDateLabel(days[visibleStart].ymd, { month: "short", day: "numeric" })} – ${formatUtcDateLabel(days[visibleEnd].ymd, { month: "short", day: "numeric" })}`
      : "";

  return (
    <section style={cardSurface} aria-label="Week at a glance">
      <div style={navRow}>
        <button
          type="button"
          onClick={() => scrollBy(-7)}
          disabled={scrollIndex === 0}
          style={{ ...navButton, opacity: scrollIndex === 0 ? 0.35 : 1 }}
          aria-label="Earlier"
        >
          ‹
        </button>
        <div style={navCenter}>
          <div style={rangeText}>{rangeLabel}</div>
        </div>
        <button
          type="button"
          onClick={() => scrollBy(7)}
          disabled={scrollIndex >= Math.max(0, days.length - visibleCount)}
          style={{ ...navButton, opacity: scrollIndex >= Math.max(0, days.length - visibleCount) ? 0.35 : 1 }}
          aria-label="Later"
        >
          ›
        </button>
      </div>

      <div
        ref={viewportRef}
        onScroll={handleScroll}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={viewport}
        className="homeV2WagViewport"
      >
        <div style={rail}>
          {days.map((day) => {
            const isToday = day.ymd === today;
            const isSelected = day.ymd === selectedDay?.ymd;
            const isPast = day.ymd < today;
            const isFuture = day.ymd > today;
            return (
              <DayCard
                key={day.ymd}
                day={day}
                width={dayWidth}
                isToday={isToday}
                isSelected={isSelected}
                isPast={isPast}
                isFuture={isFuture}
                onClick={() => {
                  if (didDragRef.current) return;
                  setSelectedYmd(day.ymd);
                }}
              />
            );
          })}
        </div>
      </div>

      {selectedDay ? (
        <DetailPanel day={selectedDay} today={today} schedulableRoutines={schedulableRoutines} scheduleActivityTypes={scheduleActivityTypes} scheduleSports={scheduleSports} />
      ) : null}

      <style>{`
        .homeV2WagViewport {
          /* hide scrollbar on webkit, keep on firefox */
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.18) transparent;
        }
        .homeV2WagViewport::-webkit-scrollbar { height: 6px; }
        .homeV2WagViewport::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.16);
          border-radius: 999px;
        }
        .homeV2WagViewport::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </section>
  );
}

// ───────────────────────────────────────────────────────── Day card

function DayCard({
  day,
  width,
  isToday,
  isSelected,
  isPast,
  isFuture,
  onClick,
}: {
  day: LegacyGlanceDay;
  width: number;
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
  isFuture: boolean;
  onClick: () => void;
}) {
  // Compute the visual summary from the legacy planned/logs arrays. We include
  // habits in the dot row — the user wants to SEE everything they tracked,
  // not have habits hidden behind a separate bar.
  //
  // COMPLETION-kind routines (creatine, supplements, finger checks, etc.)
  // are excluded from the X/Y tally on purpose: they're micro-habit
  // checkboxes, not training. A day where you did your workout + cardio
  // should read "done" even if a supplement checkbox is unticked.
  const dots = buildDots(day);
  const isTrainingPlanned = (p: { kind: string }) => normalizeRoutineKind(p.kind) !== "COMPLETION";
  const plannedCount = day.planned.reduce((s, p) => (isTrainingPlanned(p) ? s + p.planned : s), 0);
  const loggedCount =
    day.planned.reduce(
      (s, p) => (isTrainingPlanned(p) ? s + Math.min(p.logged, p.planned) : s),
      0
    ) +
    day.logs.filter(
      (l) =>
        !day.planned.some((p) => p.routineId === l.routineId) &&
        normalizeRoutineKind(l.kind) !== "COMPLETION"
    ).length;

  let status: "done" | "partial" | "plan" | "missed" | "empty";
  if (day.planned.length === 0 && day.logs.length === 0) status = "empty";
  else if (isFuture) status = "plan";
  // No trainings planned and none logged ad-hoc → habits-only day, leave it
  // visually neutral instead of forcing "missed" / "0/0".
  else if (plannedCount === 0 && loggedCount === 0) status = "empty";
  else if (plannedCount > 0 && loggedCount === 0) status = "missed";
  else if (loggedCount >= plannedCount && loggedCount > 0) status = "done";
  else status = "partial";

  return (
    <button
      type="button"
      onClick={onClick}
      style={cardShell(width, isToday, isSelected, status)}
      aria-pressed={isSelected}
      aria-label={`${day.label} ${day.dayNumber}`}
    >
      {day.weather ? (
        <span style={weatherChip} title={describeWeatherCode(day.weather.code).label}>
          <span aria-hidden style={weatherEmoji}>{describeWeatherCode(day.weather.code).emoji}</span>
          <span style={weatherTemp}>{day.weather.highF}°</span>
        </span>
      ) : null}
      <div style={dayLabelCol(isToday)}>
        <span style={dayInitial}>{day.label}</span>
        <span style={dayNumber(isToday)}>{day.dayNumber}</span>
      </div>
      <div style={dotsRow}>
        {dots.length === 0 ? (
          <span style={emptyDot} />
        ) : (
          dots.slice(0, 6).map((d, i) => (
            <span key={i} style={dotStyle(d)} title={d.routineName} />
          ))
        )}
      </div>
    </button>
  );
}

type DotSpec = {
  domain: string;
  logged: boolean;
  routineName: string;
};

function buildDots(day: LegacyGlanceDay): DotSpec[] {
  const result: DotSpec[] = [];
  // Dedupe by the planned entry's unique key — so two typed endurance
  // entries on the synthetic routine (Trail Run + Walk, both routineId
  // = endurance-synthetic) each get their own dot.
  const seen = new Set<string>();
  for (const p of day.planned) {
    if (seen.has(p.key)) continue;
    seen.add(p.key);
    result.push({ domain: p.domain, logged: p.logged > 0, routineName: p.routineName });
  }
  // Logged-but-not-planned routines (always filled). day.logs has no
  // composite key so fall back to routineId dedupe here.
  const seenRoutines = new Set(day.planned.map((p) => p.routineId));
  for (const l of day.logs) {
    if (seenRoutines.has(l.routineId)) continue;
    seenRoutines.add(l.routineId);
    result.push({ domain: l.domain, logged: true, routineName: l.routineName });
  }
  return result;
}

// ───────────────────────────────────────────────────── Detail panel

function DetailPanel({
  day,
  today,
  schedulableRoutines,
  scheduleActivityTypes,
  scheduleSports,
}: {
  day: LegacyGlanceDay;
  today: string;
  schedulableRoutines?: QuickPickRoutine[];
  scheduleActivityTypes?: import("./SchedulePicker").ScheduleActivityType[];
  scheduleSports?: import("./SchedulePicker").ScheduleSport[];
}) {
  const fullDate = formatUtcDateLabel(day.ymd, { weekday: "long", month: "long", day: "numeric" });
  const sub = day.ymd === today ? "today" : day.ymd < today ? "past day" : "upcoming";
  const planned = day.planned;
  const unplannedLogs = day.logs.filter((l) => !planned.some((p) => p.routineId === l.routineId));
  const isFutureDay = day.ymd > today;
  const availableHabits = day.availableHabits ?? [];
  const isEmpty = planned.length === 0 && unplannedLogs.length === 0 && availableHabits.length === 0;
  const [pickerOpen, setPickerOpen] = useState(false);
  // Scheduling onto past days is meaningless — only show the button on today
  // and future days. Hides itself entirely if the parent didn't pass a
  // routine list.
  // Schedulable when there's anything pickable — saved routines, sports
  // tiles, or endurance types. Without sports/types, an empty-routine
  // user would never see the +Add affordance.
  const hasPickable =
    (schedulableRoutines?.length ?? 0) > 0 ||
    (scheduleSports?.length ?? 0) > 0 ||
    (scheduleActivityTypes?.length ?? 0) > 0;
  const canSchedule = hasPickable && day.ymd >= today;

  return (
    <div style={detailShell}>
      <div style={detailHeader}>
        <div style={detailTitleCol}>
          <span style={detailTitle}>{fullDate}</span>
          <span style={detailSub}>{sub}</span>
        </div>
        {canSchedule ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={schedulePillBtn}
            aria-label={`Add a routine to ${fullDate}`}
          >
            <span aria-hidden style={schedulePillPlus}>+</span>
            <span>Add</span>
          </button>
        ) : null}
      </div>

      {isEmpty ? (
        <div style={emptyHint}>No routines planned. Add a to-do or log something ad-hoc.</div>
      ) : (
        <div style={detailList}>
          {planned.map((item) => {
            const normalizedKind = normalizeRoutineKind(item.kind);
            const isCompletion = normalizedKind === "COMPLETION";
            // "Fully logged" means there's nothing left to log on this row.
            // For unplanned-but-logged routines (planned = 0, logged > 0) the
            // user has nothing to add — treat that as done so the view
            // button wins over the log button.
            const fullyLogged = item.logged > 0 && (item.planned === 0 || item.logged >= item.planned);
            const showLogButton = !isCompletion && !isFutureDay && !fullyLogged;
            const isLogged = item.logged > 0;
            return (
              <div key={item.key} style={detailRow(isLogged)}>
                <span style={{ ...domainBar, background: domainAccent(item.domain) }} aria-hidden />
                <div style={detailRowText}>
                  <span style={detailRowName}>{item.routineName}</span>
                  <span style={detailRowMeta}>
                    {item.logged > 0
                      ? `${Math.min(item.logged, item.planned || item.logged)}/${item.planned || item.logged} done`
                      : `${item.planned} planned`}
                    {" · "}
                    {formatRoutineTypeLabel(normalizedKind).toLowerCase()}
                  </span>
                </div>
                <div style={detailRowActions}>
                  {isCompletion && !isFutureDay ? (
                    <>
                      {/* Minutes pill renders BEFORE the checkbox so it
                          reads as "12m · ✓" — duration is the optional
                          adornment, the checkbox is still the primary
                          action. Pill self-hides when isLogged=false so
                          unchecked rows don't show an orphaned pill. */}
                      {item.capturesDuration && (
                        <CompletionMinutesPill
                          routineId={item.routineId}
                          ymd={day.ymd}
                          currentDurationSec={item.durationSec}
                          isDone={isLogged}
                        />
                      )}
                      <CompletionCheckbox routineId={item.routineId} ymd={day.ymd} done={isLogged} />
                    </>
                  ) : showLogButton ? (
                    <DrawerLogButton
                      routineId={item.routineId}
                      defaultDate={day.ymd}
                      className=""
                      style={logButton}
                    />
                  ) : isLogged && item.logIds.length > 0 ? (
                    <ViewButton logIds={item.logIds} title={item.routineName} style={viewLink} />
                  ) : isLogged ? (
                    <Link href={`/routines/${item.routineId}`} style={viewLink}>view →</Link>
                  ) : null}
                </div>
              </div>
            );
          })}
          {unplannedLogs.map((log) => (
            <div key={log.id} style={detailRow(true)}>
              <span style={{ ...domainBar, background: domainAccent(log.domain) }} aria-hidden />
              <div style={detailRowText}>
                <span style={detailRowName}>{log.routineName}</span>
                <span style={detailRowMeta}>logged extra · {formatRoutineTypeLabel(normalizeRoutineKind(log.kind)).toLowerCase()}</span>
              </div>
              <ViewButton logIds={[log.id]} title={log.routineName} style={viewLink} />
            </div>
          ))}
        </div>
      )}

      {/* Habits not on this day's schedule — surfaced here for today + future
          so the user can log a 2×/week or non-auto-scheduled habit inline
          without leaving the dashboard. Past days omit this list. */}
      {availableHabits.length > 0 ? (
        <div style={availableSection}>
          <span style={availableSectionLabel}>Habits available</span>
          <div style={detailList}>
            {availableHabits.map((h) => {
              const normalizedKind = normalizeRoutineKind(h.kind);
              const isCompletion = normalizedKind === "COMPLETION";
              return (
                <div key={h.routineId} style={detailRow(false)}>
                  <span style={{ ...domainBar, background: domainAccent(h.domain) }} aria-hidden />
                  <div style={detailRowText}>
                    <span style={detailRowName}>{h.routineName}</span>
                    <span style={detailRowMeta}>habit · {formatRoutineTypeLabel(normalizedKind).toLowerCase()}</span>
                  </div>
                  <div style={detailRowActions}>
                    {isCompletion && !isFutureDay ? (
                      <CompletionCheckbox routineId={h.routineId} ymd={day.ymd} done={false} />
                    ) : (
                      <DrawerLogButton
                        routineId={h.routineId}
                        defaultDate={day.ymd}
                        className=""
                        style={logButton}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <DayTodoList ymd={day.ymd} todos={day.todos ?? []} mode="panel" />

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
    </div>
  );
}

// ───────────────────────────────────────────────────── styles

const navRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  paddingInline: 4,
};

const navButton: CSSProperties = {
  width: 30,
  height: 30,
  minHeight: 30,
  padding: 0,
  borderRadius: 999,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: COLOR.textDim,
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const navCenter: CSSProperties = {
  flex: 1,
  textAlign: "center",
  minWidth: 0,
};

const rangeText: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: COLOR.text,
  letterSpacing: 0.2,
};

const viewport: CSSProperties = {
  overflowX: "auto",
  overflowY: "hidden",
  paddingBottom: 6,
  cursor: "grab",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const rail: CSSProperties = {
  display: "flex",
  gap: 6,
  paddingInline: 2,
};

function cardShell(
  width: number,
  isToday: boolean,
  isSelected: boolean,
  status: "done" | "partial" | "plan" | "missed" | "empty",
): CSSProperties {
  const borderColor = isToday
    ? "rgba(51,255,122,0.45)"
    : isSelected
    ? "rgba(255,255,255,0.32)"
    : "rgba(255,255,255,0.08)";
  // Precedence: today's gradient and the selection highlight win over the
  // status tint (both are transient/navigational); below them, status shades
  // the block — red missed, green done, amber partial — so the day's outcome
  // reads from color alone now that the status word is gone.
  const bg = isToday
    ? "linear-gradient(180deg, rgba(51,255,122,0.12), rgba(51,255,122,0.025))"
    : isSelected
    ? "rgba(255,255,255,0.06)"
    : status === "missed"
    ? "rgba(248,113,113,0.05)"
    : status === "done"
    ? "rgba(51,255,122,0.06)"
    : status === "partial"
    ? "rgba(251,191,36,0.06)"
    : "rgba(255,255,255,0.02)";
  return {
    all: "unset",
    position: "relative",
    cursor: "pointer",
    flexShrink: 0,
    width,
    minHeight: 92,
    padding: "10px 6px 9px",
    border: `1px solid ${borderColor}`,
    borderRadius: 13,
    background: bg,
    display: "grid",
    gap: 5,
    // Content bottom-aligned so the freed top of the block is reserved for
    // the per-day weather chip (Phase 4).
    alignContent: "end",
    textAlign: "center",
    boxSizing: "border-box",
    boxShadow: isToday ? "0 4px 14px rgba(51,255,122,0.10)" : "none",
    opacity: status === "empty" && !isToday && !isSelected ? 0.55 : 1,
    transition: "transform 120ms ease, border-color 120ms ease",
  };
}

// Weather chip — absolutely anchored to the top of the block (the space freed
// by removing the status word + bottom-aligning content). Ambient home-base
// daily high; absent when no home base is set.
const weatherChip: CSSProperties = {
  position: "absolute",
  top: 6,
  left: 0,
  right: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  lineHeight: 1,
  pointerEvents: "none",
};

const weatherEmoji: CSSProperties = { fontSize: 11 };

const weatherTemp: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  color: COLOR.textDim,
  letterSpacing: -0.2,
};

function dayLabelCol(isToday: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: isToday ? COLOR.success : COLOR.textDim,
  };
}

const dayInitial: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.78,
};

function dayNumber(isToday: boolean): CSSProperties {
  return {
    fontSize: isToday ? 18 : 16,
    fontWeight: isToday ? 900 : 800,
    lineHeight: 1.1,
    color: isToday ? COLOR.success : COLOR.text,
  };
}

const dotsRow: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 3,
  minHeight: 12,
};

function dotStyle(d: DotSpec): CSSProperties {
  const color = domainAccent(d.domain);
  return {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: d.logged ? color : "transparent",
    border: `1.5px solid ${color}`,
    opacity: d.logged ? 1 : 0.6,
    flexShrink: 0,
  };
}

const emptyDot: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: 999,
  background: "rgba(255,255,255,0.10)",
  flexShrink: 0,
};

// detail panel
const detailShell: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "12px",
  borderRadius: 14,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.025)",
};

const detailHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
};

const detailTitleCol: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const detailTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: COLOR.text,
};

const detailSub: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

// Compact pill button — sits next to the date in the panel header. The "+"
// glyph + "Add" pair reads as a clear affordance at a glance without
// crowding the panel title.
const schedulePillBtn: CSSProperties = {
  all: "unset",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 11px 5px 8px",
  borderRadius: 999,
  border: `1px solid rgba(51,255,122,0.40)`,
  background: COLOR.successSoft,
  color: COLOR.success,
  fontSize: 11.5,
  fontWeight: 900,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  cursor: "pointer",
  flexShrink: 0,
  whiteSpace: "nowrap",
  minHeight: 28,
};

const schedulePillPlus: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1,
  marginTop: -1,
};

const emptyHint: CSSProperties = {
  fontSize: 12,
  color: COLOR.textFaint,
  fontStyle: "italic",
  padding: "4px 2px",
};

const detailList: CSSProperties = {
  display: "grid",
  gap: 6,
};

function detailRow(isLogged: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "3px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 10,
    border: `1px solid ${COLOR.border}`,
    background: isLogged ? "rgba(51,255,122,0.05)" : "rgba(255,255,255,0.02)",
    minHeight: 44,
  };
}

const domainBar: CSSProperties = {
  width: 3,
  height: 28,
  borderRadius: 2,
};

const detailRowText: CSSProperties = {
  display: "grid",
  gap: 1,
  minWidth: 0,
};

const detailRowName: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: COLOR.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const detailRowMeta: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.textDim,
};

const detailRowActions: CSSProperties = {
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
  border: `1px solid rgba(51,255,122,0.42)`,
  background: COLOR.successSoft,
  color: COLOR.success,
  fontSize: 12,
  fontWeight: 900,
  textDecoration: "none",
  letterSpacing: 0.3,
};

const viewLink: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: COLOR.textDim,
  textDecoration: "none",
  padding: "5px 9px",
  borderRadius: 8,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
};

const availableSection: CSSProperties = {
  display: "grid",
  gap: 6,
  paddingTop: 8,
  marginTop: 2,
  borderTop: `1px dashed ${COLOR.border}`,
};

const availableSectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: COLOR.textFaint,
};
