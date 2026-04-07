"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { formatUtcDateLabel } from "@/lib/dates";
import { formatRoutineTypeLabel, normalizeRoutineKind, type RoutineDomain } from "@/lib/routines";

type WeekAtGlanceWeek = {
  start: string;
  end: string;
  days: Array<{
    ymd: string;
    label: string;
    dayNumber: string;
    logs: Array<{
      id: string;
      routineName: string;
      kind: string;
      domain: RoutineDomain;
    }>;
  }>;
};

export default function WeekAtGlanceClient({
  weeks,
  today,
}: {
  weeks: WeekAtGlanceWeek[];
  today: string;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const currentWeekIndex = Math.max(0, weeks.length - 1);
  const [activeIndex, setActiveIndex] = useState(currentWeekIndex);
  const [selectedDayByWeek, setSelectedDayByWeek] = useState<Record<string, string | null>>(() =>
    weeks[currentWeekIndex] ? { [weeks[currentWeekIndex].start]: today } : {}
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = viewport.clientWidth * currentWeekIndex;
  }, [currentWeekIndex]);

  const activeWeek = weeks[activeIndex] ?? weeks[currentWeekIndex] ?? null;
  const selectedDayYmd = activeWeek
    ? selectedDayByWeek[activeWeek.start] ?? (activeWeek.days.some((day) => day.ymd === today) ? today : null)
    : null;
  const selectedDay = activeWeek?.days.find((day) => day.ymd === selectedDayYmd) ?? null;
  const weekKindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const day of activeWeek?.days ?? []) {
      for (const log of day.logs) {
        const kind = normalizeRoutineKind(log.kind);
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
    }
    return counts;
  }, [activeWeek]);
  const weekLogTotal = Array.from(weekKindCounts.values()).reduce((sum, count) => sum + count, 0);

  function scrollToWeek(index: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextIndex = Math.max(0, Math.min(index, weeks.length - 1));
    viewport.scrollTo({ left: viewport.clientWidth * nextIndex, behavior: "smooth" });
    setActiveIndex(nextIndex);
  }

  function handleScroll() {
    const viewport = viewportRef.current;
    if (!viewport || viewport.clientWidth === 0) return;
    const nextIndex = Math.round(viewport.scrollLeft / viewport.clientWidth);
    if (nextIndex !== activeIndex) setActiveIndex(nextIndex);
  }

  if (!activeWeek) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={headerRow}>
        <button
          type="button"
          onClick={() => scrollToWeek(activeIndex - 1)}
          disabled={activeIndex === 0}
          style={{
            ...navButton,
            opacity: activeIndex === 0 ? 0.35 : 1,
            cursor: activeIndex === 0 ? "default" : "pointer",
          }}
          aria-label="View previous week"
        >
          {"<"}
        </button>
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div style={rangeLabel}>{formatWeekRange(activeWeek.start, activeWeek.end)}</div>
          <div style={rangeSub}>{activeIndex === currentWeekIndex ? "Current week" : `${currentWeekIndex - activeIndex} week${currentWeekIndex - activeIndex === 1 ? "" : "s"} back`}</div>
        </div>
        <button
          type="button"
          onClick={() => scrollToWeek(activeIndex + 1)}
          disabled={activeIndex === currentWeekIndex}
          style={{
            ...navButton,
            opacity: activeIndex === currentWeekIndex ? 0.35 : 1,
            cursor: activeIndex === currentWeekIndex ? "default" : "pointer",
          }}
          aria-label="View next week"
        >
          {">"}
        </button>
      </div>

      <div
        ref={viewportRef}
        onScroll={handleScroll}
        style={viewport}
        aria-label="Week at a glance week scroller"
      >
        {weeks.map((week) => (
          <div key={week.start} style={page}>
            <div style={grid}>
              {week.days.map((day) => {
                const isToday = day.ymd === today;
                const isSelected = day.ymd === selectedDayYmd;
                return (
                  <button
                    key={day.ymd}
                    type="button"
                    onClick={() =>
                      setSelectedDayByWeek((current) => ({
                        ...current,
                        [week.start]: current[week.start] === day.ymd ? null : day.ymd,
                      }))
                    }
                    style={{
                      ...dayButton,
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
                      {day.logs.length === 0 ? (
                        <div style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.09)" }} />
                      ) : (
                        day.logs.slice(0, 6).map((log) => (
                          <div key={log.id} style={{ width: 7, height: 7, borderRadius: 999, background: kindDotColor(log.kind), flexShrink: 0 }} />
                        ))
                      )}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, opacity: day.logs.length > 0 ? 0.78 : 0.38 }}>
                      {day.logs.length > 0 ? `${day.logs.length} logged` : "Open"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {(["WORKOUT", "CARDIO", "GUIDED", "SESSION", "COMPLETION"] as const).map((kind) => {
          const count = weekKindCounts.get(kind) ?? 0;
          if (count === 0) return null;
          return (
            <div key={kind} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: kindDotColor(kind), flexShrink: 0 }} />
              <span style={{ fontSize: 11, opacity: 0.75 }}>{formatRoutineTypeLabel(kind)} - {count}</span>
            </div>
          );
        })}
        {weekLogTotal === 0 && <div style={{ fontSize: 11, opacity: 0.5 }}>No sessions logged in this week.</div>}
      </div>

      <div style={detailCard}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>
            {selectedDay ? formatDayDetailLabel(selectedDay.ymd) : "Tap a day to inspect sessions"}
          </div>
          {selectedDay ? <div style={{ fontSize: 11, opacity: 0.6 }}>{selectedDay.logs.length} session{selectedDay.logs.length === 1 ? "" : "s"}</div> : null}
        </div>
        {!selectedDay ? (
          <div style={{ fontSize: 12, opacity: 0.62 }}>Select any day cell to see the routines logged there.</div>
        ) : selectedDay.logs.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.62 }}>No sessions logged on this day.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {selectedDay.logs.map((log) => (
              <div key={log.id} style={detailRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 999, background: domainColor(log.domain), flexShrink: 0 }} />
                  <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{log.routineName}</div>
                </div>
                <div style={{ fontSize: 11, opacity: 0.62 }}>{formatRoutineTypeLabel(normalizeRoutineKind(log.kind))}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatWeekRange(startYmd: string, endYmd: string) {
  const start = formatUtcDateLabel(startYmd, { month: "short", day: "numeric" });
  const sameMonth = startYmd.slice(5, 7) === endYmd.slice(5, 7);
  const end = formatUtcDateLabel(endYmd, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${start} - ${end}`;
}

function formatDayDetailLabel(ymd: string) {
  return formatUtcDateLabel(ymd, { weekday: "long", month: "short", day: "numeric" });
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
  display: "flex",
  overflowX: "auto",
  scrollSnapType: "x mandatory",
  scrollbarWidth: "none",
  WebkitOverflowScrolling: "touch",
};

const page: CSSProperties = {
  flex: "0 0 100%",
  minWidth: "100%",
  scrollSnapAlign: "start",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 6,
};

const dayButton: CSSProperties = {
  width: "100%",
  minWidth: 0,
  minHeight: 108,
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


