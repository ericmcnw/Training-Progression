"use client";

// WeekAtGlanceV3 — combines the old WAAG's scrollable rail + inline detail
// panel with the new visual style (domain dots + status word per day).
// Includes habit-domain routines in the dot row so users who train mostly
// via habits actually see their data instead of empty cells.

import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { LegacyGlanceDay } from "./types";
import { COLOR, RADIUS, cardSurface, cardHeader, cardTitle, cardHint } from "./tokens";
import { domainAccent } from "./client-utils";
import {
  formatRoutineTypeLabel,
  normalizeRoutineKind,
} from "@/lib/routines";
import { formatUtcDateLabel } from "@/lib/dates";
import CompletionCheckbox from "@/app/components/dashboard/CompletionCheckbox";
import DayTodoList from "@/app/components/dashboard/DayTodoList";

type Props = {
  days: LegacyGlanceDay[];
  today: string;
  currentWeekStart: string;
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

export default function WeekAtGlanceV3({ days, today, currentWeekStart: _currentWeekStart }: Props) {
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
      <header style={cardHeader}>
        <span style={cardTitle}>Week at a glance</span>
        <span style={cardHint}>scroll · tap a day →</span>
      </header>

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

      {selectedDay ? <DetailPanel day={selectedDay} today={today} /> : null}

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
  const dots = buildDots(day);
  const plannedCount = day.planned.reduce((s, p) => s + p.planned, 0);
  const loggedCount =
    day.planned.reduce((s, p) => s + Math.min(p.logged, p.planned), 0) +
    day.logs.filter((l) => !day.planned.some((p) => p.routineId === l.routineId)).length;

  let status: "done" | "partial" | "plan" | "missed" | "empty";
  if (day.planned.length === 0 && day.logs.length === 0) status = "empty";
  else if (isFuture) status = "plan";
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
      <div style={dayLabelCol(isToday)}>
        <span style={dayInitial}>{day.label.charAt(0)}</span>
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
      <div style={statusLine(status)}>{statusText(status, loggedCount, plannedCount)}</div>
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
  const seen = new Set<string>();
  // Planned routines (filled if logged, hollow if not).
  for (const p of day.planned) {
    if (seen.has(p.routineId)) continue;
    seen.add(p.routineId);
    result.push({ domain: p.domain, logged: p.logged > 0, routineName: p.routineName });
  }
  // Logged-but-not-planned routines (always filled).
  for (const l of day.logs) {
    if (seen.has(l.routineId)) continue;
    seen.add(l.routineId);
    result.push({ domain: l.domain, logged: true, routineName: l.routineName });
  }
  return result;
}

function statusText(
  status: "done" | "partial" | "plan" | "missed" | "empty",
  logged: number,
  planned: number,
): string {
  if (status === "done") return "done";
  if (status === "partial") return `${logged}/${planned || logged}`;
  if (status === "missed") return "missed";
  if (status === "plan") return "plan";
  return "—";
}

// ───────────────────────────────────────────────────── Detail panel

function DetailPanel({ day, today }: { day: LegacyGlanceDay; today: string }) {
  const fullDate = formatUtcDateLabel(day.ymd, { weekday: "long", month: "long", day: "numeric" });
  const sub = day.ymd === today ? "today" : day.ymd < today ? "past day" : "upcoming";
  const planned = day.planned;
  const unplannedLogs = day.logs.filter((l) => !planned.some((p) => p.routineId === l.routineId));
  const isFutureDay = day.ymd > today;
  const availableHabits = day.availableHabits ?? [];
  const isEmpty = planned.length === 0 && unplannedLogs.length === 0 && availableHabits.length === 0;

  return (
    <div style={detailShell}>
      <div style={detailHeader}>
        <div style={detailTitleCol}>
          <span style={detailTitle}>{fullDate}</span>
          <span style={detailSub}>{sub}</span>
        </div>
      </div>

      {isEmpty ? (
        <div style={emptyHint}>No routines planned. Add a to-do or log something ad-hoc.</div>
      ) : (
        <div style={detailList}>
          {planned.map((item) => {
            const normalizedKind = normalizeRoutineKind(item.kind);
            const isCompletion = normalizedKind === "COMPLETION";
            const fullyLogged = item.planned > 0 && item.logged >= item.planned;
            const showLogButton = !isCompletion && !isFutureDay && !fullyLogged;
            const isLogged = item.logged > 0;
            return (
              <div key={item.routineId} style={detailRow(isLogged)}>
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
                    <CompletionCheckbox routineId={item.routineId} ymd={day.ymd} done={isLogged} />
                  ) : showLogButton ? (
                    <Link
                      href={`/routines/${item.routineId}/log?date=${encodeURIComponent(day.ymd)}`}
                      style={logButton}
                    >
                      Log
                    </Link>
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
              <Link href={`/routines/${log.routineId}/logs/${log.id}`} style={viewLink}>view →</Link>
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
                      <Link
                        href={`/routines/${h.routineId}/log?date=${encodeURIComponent(day.ymd)}`}
                        style={logButton}
                      >
                        Log
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <DayTodoList ymd={day.ymd} todos={day.todos ?? []} mode="panel" />
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
  const bg = isToday
    ? "linear-gradient(180deg, rgba(51,255,122,0.12), rgba(51,255,122,0.025))"
    : isSelected
    ? "rgba(255,255,255,0.06)"
    : status === "missed"
    ? "rgba(248,113,113,0.04)"
    : "rgba(255,255,255,0.02)";
  return {
    all: "unset",
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
    textAlign: "center",
    boxSizing: "border-box",
    boxShadow: isToday ? "0 4px 14px rgba(51,255,122,0.10)" : "none",
    opacity: status === "empty" && !isToday && !isSelected ? 0.55 : 1,
    transition: "transform 120ms ease, border-color 120ms ease",
  };
}

function dayLabelCol(isToday: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: isToday ? COLOR.success : COLOR.textDim,
  };
}

const dayInitial: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.6,
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

function statusLine(status: "done" | "partial" | "plan" | "missed" | "empty"): CSSProperties {
  const tone =
    status === "done" ? COLOR.success
      : status === "partial" ? COLOR.amber
      : status === "missed" ? COLOR.red
      : status === "plan" ? COLOR.textDim
      : COLOR.textFaint;
  return {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.3,
    color: tone,
    textTransform: "uppercase",
  };
}

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
