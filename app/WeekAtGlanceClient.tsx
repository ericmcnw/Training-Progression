"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatUtcDateLabel } from "@/lib/dates";
import { formatRoutineTypeLabel, normalizeRoutineKind, type RoutineDomain } from "@/lib/routines";

type GlanceDay = {
  ymd: string;
  label: string;
  dayNumber: string;
  planned: Array<{
    routineId: string;
    routineName: string;
    kind: string;
    domain: RoutineDomain;
    planned: number;
    logged: number;
  }>;
  logs: Array<{
    id: string;
    routineId: string;
    routineName: string;
    kind: string;
    domain: RoutineDomain;
  }>;
};

const WINDOW_SIZE = 7;
const CELL_GAP = 6;

export default function WeekAtGlanceClient({
  days,
  today,
  currentWeekStart,
}: {
  days: GlanceDay[];
  today: string;
  currentWeekStart: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const todayIndex = Math.max(0, days.findIndex((day) => day.ymd === today));
  const currentWeekStartIndex = Math.max(0, days.findIndex((day) => day.ymd === currentWeekStart));
  const [visibleCount, setVisibleCount] = useState(WINDOW_SIZE);
  const [dayWidth, setDayWidth] = useState(72);
  const maxStartIndex = Math.max(0, days.length - visibleCount);
  const initialStartIndex = Math.min(currentWeekStartIndex, maxStartIndex);
  const [startIndex, setStartIndex] = useState(currentWeekStartIndex);
  const [selectedDayYmd, setSelectedDayYmd] = useState<string | null>(today);
  const effectiveStartIndex = Math.min(startIndex, maxStartIndex);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateViewportMetrics = () => {
      const nextVisibleCount = getVisibleCount(viewport.clientWidth);
      setVisibleCount(nextVisibleCount);
      setDayWidth(getDayWidth(viewport.clientWidth, nextVisibleCount));
    };
    updateViewportMetrics();
    window.addEventListener("resize", updateViewportMetrics);
    return () => window.removeEventListener("resize", updateViewportMetrics);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = initialStartIndex * getStepWidth(viewport);
  }, [initialStartIndex, visibleCount]);

  const visibleDays = days.slice(effectiveStartIndex, effectiveStartIndex + visibleCount);
  const selectedDay =
    days.find((day) => day.ymd === selectedDayYmd) ??
    visibleDays.find((day) => day.ymd === today) ??
    visibleDays[0] ??
    null;

  const visibleKindCounts = new Map<string, number>();
  for (const day of visibleDays) {
    for (const item of day.planned) {
      const kind = normalizeRoutineKind(item.kind);
      visibleKindCounts.set(kind, (visibleKindCounts.get(kind) ?? 0) + item.planned);
    }
  }

  const visiblePlannedTotal = Array.from(visibleKindCounts.values()).reduce((sum, count) => sum + count, 0);
  const rangeStart = visibleDays[0]?.ymd ?? null;
  const rangeEnd = visibleDays[visibleDays.length - 1]?.ymd ?? null;

  function scrollToIndex(index: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextIndex = Math.max(0, Math.min(index, maxStartIndex));
    viewport.scrollTo({ left: nextIndex * getStepWidth(viewport), behavior: "smooth" });
    setStartIndex(nextIndex);
  }

  function handleScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const stepWidth = getStepWidth(viewport);
    const nextIndex = Math.max(0, Math.min(Math.round(viewport.scrollLeft / stepWidth), maxStartIndex));
    if (nextIndex !== effectiveStartIndex) setStartIndex(nextIndex);
  }

  if (visibleDays.length === 0 || !rangeStart || !rangeEnd) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={headerRow}>
        <button
          type="button"
          onClick={() => scrollToIndex(effectiveStartIndex - 1)}
          disabled={effectiveStartIndex === 0}
          style={{
            ...navButton,
            opacity: effectiveStartIndex === 0 ? 0.35 : 1,
            cursor: effectiveStartIndex === 0 ? "default" : "pointer",
          }}
          aria-label="View earlier days"
        >
          {"<"}
        </button>
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div style={rangeLabel}>{formatRange(rangeStart, rangeEnd)}</div>
          <div style={rangeSub}>
            {rangeEnd === today ? "Ends today" : `${Math.max(0, todayIndex - effectiveStartIndex)} days before today`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => scrollToIndex(effectiveStartIndex + 1)}
          disabled={effectiveStartIndex === maxStartIndex}
          style={{
            ...navButton,
            opacity: effectiveStartIndex === maxStartIndex ? 0.35 : 1,
            cursor: effectiveStartIndex === maxStartIndex ? "default" : "pointer",
          }}
          aria-label="View later days"
        >
          {">"}
        </button>
      </div>

      <div
        ref={viewportRef}
        onScroll={handleScroll}
        style={viewport}
        aria-label="Week at a glance day scroller"
      >
        <div style={rail}>
          {days.map((day) => {
            const isToday = day.ymd === today;
            const isSelected = day.ymd === selectedDay?.ymd;
            return (
              <button
                key={day.ymd}
                type="button"
                onClick={() => setSelectedDayYmd((current) => (current === day.ymd ? null : day.ymd))}
                style={{
                  ...dayButton,
                  width: dayWidth,
                  minWidth: dayWidth,
                  border: isToday
                    ? "1px solid rgba(84,203,130,0.5)"
                    : isSelected
                    ? "1px solid rgba(255,255,255,0.2)"
                    : "1px solid rgba(255,255,255,0.07)",
                  background: isToday
                    ? "linear-gradient(180deg, rgba(84,203,130,0.2), rgba(84,203,130,0.08))"
                    : isSelected
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.02)",
                  boxShadow: isToday ? "0 0 0 1px rgba(84,203,130,0.22) inset" : "none",
                }}
                aria-pressed={isSelected}
              >
                <div style={{ display: "grid", gap: 2, justifyItems: "center" }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: isToday ? 900 : 700,
                      color: isToday ? "rgba(84,203,130,0.98)" : "rgba(255,255,255,0.56)",
                    }}
                  >
                    {day.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: isToday ? 900 : 800, lineHeight: 1 }}>{day.dayNumber}</div>
                </div>
                <div style={dotWrap}>
                  {day.planned.length === 0 && day.logs.length === 0 ? (
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.09)" }} />
                  ) : day.planned.length === 0 ? (
                    day.logs.slice(0, 6).map((log) => (
                      <div
                        key={log.id}
                        title={log.routineName}
                        style={{ width: 7, height: 7, borderRadius: 999, background: kindDotColor(log.kind), opacity: 0.72, flexShrink: 0 }}
                      />
                    ))
                  ) : (
                    day.planned.flatMap((item) =>
                      Array.from({ length: Math.min(item.planned, 3) }, (_, index) => (
                        <div
                          key={`${item.routineId}-${index}`}
                          title={item.routineName}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 999,
                            background: kindDotColor(item.kind),
                            opacity: item.logged > index ? 1 : 0.42,
                            border: item.logged > index ? "0" : "1px solid rgba(255,255,255,0.18)",
                            flexShrink: 0,
                          }}
                        />
                      ))
                    ).slice(0, 8)
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {(["WORKOUT", "CARDIO", "GUIDED", "SESSION", "COMPLETION"] as const).map((kind) => {
          const count = visibleKindCounts.get(kind) ?? 0;
          if (count === 0) return null;
          return (
            <div key={kind} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: kindDotColor(kind), flexShrink: 0 }} />
              <span style={{ fontSize: 11, opacity: 0.75 }}>{formatRoutineTypeLabel(kind)} - {count}</span>
            </div>
          );
        })}
        {visiblePlannedTotal === 0 && <div style={{ fontSize: 11, opacity: 0.5 }}>No routines planned in this range.</div>}
      </div>

      <div style={detailCard}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>
            {selectedDay ? formatDayDetailLabel(selectedDay.ymd) : "Tap a day to inspect routines"}
          </div>
          {selectedDay ? <div style={{ fontSize: 11, opacity: 0.6 }}>{plannedCount(selectedDay)} planned</div> : null}
        </div>
        {!selectedDay ? (
          <div style={{ fontSize: 12, opacity: 0.62 }}>Select any day cell to see the routines planned there.</div>
        ) : selectedDay.planned.length === 0 && selectedDay.logs.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.62 }}>No routines planned on this day.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {selectedDay.planned.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.62 }}>No routines planned. Logged sessions are listed below.</div>
            ) : null}
            {selectedDay.planned.map((item) => (
              <div key={item.routineId} style={item.logged > 0 ? completedDetailRow : detailRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 999, background: domainColor(item.domain), flexShrink: 0 }} />
                  <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.routineName}</div>
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {item.logged > 0 ? `${Math.min(item.logged, item.planned)}/${item.planned} done` : `${item.planned} planned`} | {formatRoutineTypeLabel(normalizeRoutineKind(item.kind))}
                </div>
              </div>
            ))}
            {selectedDay.logs.filter((log) => !selectedDay.planned.some((item) => item.routineId === log.routineId)).map((log) => (
              <div key={log.id} style={unplannedDetailRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 999, background: domainColor(log.domain), flexShrink: 0 }} />
                  <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.routineName}</div>
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Logged extra | {formatRoutineTypeLabel(normalizeRoutineKind(log.kind))}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRange(startYmd: string, endYmd: string) {
  const start = formatUtcDateLabel(startYmd, { month: "short", day: "numeric" });
  const sameMonth = startYmd.slice(5, 7) === endYmd.slice(5, 7);
  const end = formatUtcDateLabel(endYmd, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${start} - ${end}`;
}

function formatDayDetailLabel(ymd: string) {
  return formatUtcDateLabel(ymd, { weekday: "long", month: "short", day: "numeric" });
}

function plannedCount(day: GlanceDay) {
  return day.planned.reduce((sum, item) => sum + item.planned, 0);
}

function kindDotColor(kind: string): string {
  switch (normalizeRoutineKind(kind)) {
    case "WORKOUT":
      return "rgba(84,203,130,0.95)";
    case "CARDIO":
      return "rgba(78,148,255,0.95)";
    case "GUIDED":
      return "rgba(192,132,252,0.95)";
    case "SESSION":
      return "rgba(251,146,60,0.95)";
    default:
      return "rgba(251,199,92,0.88)";
  }
}

function domainColor(domain: RoutineDomain): string {
  switch (domain) {
    case "strength":
      return "rgba(84,203,130,0.9)";
    case "cardio":
      return "rgba(78,148,255,0.9)";
    case "mobility":
      return "rgba(192,132,252,0.9)";
    case "sport":
      return "rgba(251,146,60,0.9)";
    case "recovery":
      return "rgba(251,113,133,0.9)";
    case "skill":
      return "rgba(251,199,92,0.9)";
    case "habit":
      return "rgba(156,163,175,0.9)";
    default:
      return "rgba(156,163,175,0.7)";
  }
}

const headerRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "40px minmax(0, 1fr) 40px",
  alignItems: "center",
  gap: 10,
};

const navButton: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 18,
  fontWeight: 900,
};

const rangeLabel: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const rangeSub: CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  opacity: 0.62,
};

const viewport: CSSProperties = {
  overflowX: "auto",
  scrollbarWidth: "none",
  WebkitOverflowScrolling: "touch",
};

const rail: CSSProperties = {
  display: "flex",
  gap: CELL_GAP,
  width: "max-content",
  paddingBottom: 2,
};

const dayButton: CSSProperties = {
  minHeight: 98,
  borderRadius: 14,
  padding: "10px 6px 8px",
  display: "grid",
  gap: 8,
  alignContent: "start",
  justifyItems: "center",
  color: "inherit",
  textAlign: "center",
};

const dotWrap: CSSProperties = {
  minHeight: 30,
  width: "100%",
  display: "flex",
  flexWrap: "wrap",
  alignContent: "center",
  justifyContent: "center",
  gap: 3,
  paddingInline: 2,
};

const detailCard: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 12,
  display: "grid",
  gap: 10,
};

const detailRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  borderRadius: 12,
  padding: "9px 10px",
  background: "rgba(255,255,255,0.04)",
};

const completedDetailRow: CSSProperties = {
  ...detailRow,
  border: "1px solid rgba(84,203,130,0.38)",
  background: "rgba(84,203,130,0.08)",
};

const unplannedDetailRow: CSSProperties = {
  ...detailRow,
  border: "1px solid rgba(251,199,92,0.32)",
  background: "rgba(251,199,92,0.07)",
};

function getStepWidth(viewport: HTMLDivElement) {
  return (viewport.clientWidth + CELL_GAP) / getVisibleCount(viewport.clientWidth);
}

function getDayWidth(viewportWidth: number, visibleCount: number) {
  return Math.floor((viewportWidth - CELL_GAP * (visibleCount - 1)) / visibleCount);
}

function getVisibleCount(viewportWidth: number) {
  if (viewportWidth >= 1280) return 11;
  if (viewportWidth >= 1024) return 10;
  if (viewportWidth >= 768) return 8;
  return WINDOW_SIZE;
}
