// THIS WEEK panel — Proposal C: a single panel that unifies plan/logs (the
// week-at-a-glance day rail) with habit consistency (HabitLane data) and
// frequency target progress (FrequencyTargetsCard data) under one column-
// aligned grid.
//
// All data is already prepared by the dashboard's existing data prep — this
// component is purely presentational. The original WeekAtGlanceClient and
// RhythmPanel are not modified, so swapping back to them is a single import
// change in app/page.tsx.
//
// Visual structure:
//   ┌─────────────────────────────────────────────────────────┐
//   │ THIS WEEK · Mar 10 – 16              3 at risk · 6🔥    │
//   ├─────────────────────────────────────────────────────────┤
//   │           Mon Tue Wed Thu Fri Sat Sun                    │
//   │  Plan    [●● ··  ●●● ··  ●●  ·   · ]   3/12 done         │
//   │  ── HABITS ──                                            │
//   │  Creatine [✓  ✓  ✓  ✓  ·  ·  · ]                 🔥6d  │
//   │  Reading  [✓  ·  ✓  ✓  ·  ·  · ]                 🔥3w  │
//   │  ── FREQUENCY TARGETS ──                                 │
//   │  Cardio   3×/wk · Run, Hike       ████░░ 2/3      🔥3w  │
//   ├─────────────────────────────────────────────────────────┤
//   │ View 12-week history →                                   │
//   └─────────────────────────────────────────────────────────┘

import Link from "next/link";
import type { CSSProperties } from "react";
import { addDaysYmd, formatUtcDateLabel } from "@/lib/dates";
import { domainColor, normalizeRoutineKind, type RoutineDomain } from "@/lib/routines";
import { frequencyStatusColor, type FrequencyState, type FrequencyTarget } from "@/lib/frequency-state";
import type { HabitLaneRow } from "./HabitLane";
import type { FrequencyTargetRow } from "./FrequencyTargetsCard";

export type ThisWeekDay = {
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
  logs: Array<{ id: string; routineId: string; routineName: string; kind: string; domain: RoutineDomain }>;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ThisWeekPanel({
  weekDays,
  habits,
  frequencyTargets,
  today,
  weekRangeLabel,
  panelStyle,
  panelHeaderStyle,
}: {
  weekDays: ThisWeekDay[]; // exactly 7, ordered Sun→Sat
  habits: HabitLaneRow[];
  frequencyTargets: FrequencyTargetRow[];
  today: string;
  weekRangeLabel: string;
  panelStyle: CSSProperties;
  panelHeaderStyle: CSSProperties;
}) {
  const todayIndex = weekDays.findIndex((day) => day.ymd === today);
  const totalPlanned = weekDays.reduce((sum, day) => sum + day.planned.reduce((s, item) => s + item.planned, 0), 0);
  const totalLogged = weekDays.reduce((sum, day) => sum + day.planned.reduce((s, item) => s + Math.min(item.logged, item.planned), 0), 0);

  const atRiskCount =
    habits.filter((h) => h.state.currentWindow.status === "at_risk").length +
    frequencyTargets.filter((t) => t.state.currentWindow.status === "at_risk").length;
  const bestStreak = Math.max(
    0,
    ...habits.map((h) => Math.max(h.state.windowStreak, h.state.currentDayStreak)),
    ...frequencyTargets.map((t) => Math.max(t.state.windowStreak, t.state.currentDayStreak))
  );

  const hasHabits = habits.length > 0;
  const hasTargets = frequencyTargets.length > 0;

  return (
    <section style={panelStyle}>
      <div style={{ ...panelHeaderStyle, ...headerRow }}>
        <div style={headerLeft}>
          <span>THIS WEEK</span>
          <span style={headerRangeLabel}>· {weekRangeLabel}</span>
        </div>
        <div style={headerSignals}>
          {atRiskCount > 0 ? (
            <span style={atRiskPill} title="At-risk habits or targets">
              <span style={dot(atRiskPill.color as string)} /> {atRiskCount} at risk
            </span>
          ) : null}
          {bestStreak > 0 ? (
            <span style={streakPill} title="Best running streak">
              <FlameIcon /> {bestStreak}
            </span>
          ) : null}
        </div>
      </div>

      <div style={body}>
        {/* ── DAY HEADER + PLAN RAIL ─────────────────────────── */}
        <div style={subhead}>
          <span style={subheadLabel}>PLAN &amp; LOGS</span>
          <span style={subheadCount}>{totalLogged}/{totalPlanned} done</span>
          <span style={subheadSublabel}>this week</span>
        </div>

        <div style={dayRailGrid}>
          <div style={leftCol} />
          {weekDays.map((day, idx) => (
            <div key={day.ymd} style={dayHeaderCell(idx === todayIndex)}>
              <div style={dayLabelText(idx === todayIndex)}>{day.label}</div>
              <div style={dayNumberText(idx === todayIndex)}>{day.dayNumber}</div>
            </div>
          ))}
          <div style={rightCol} />
        </div>

        <div style={dayRailGrid}>
          <div style={leftRailLabel}>Plan</div>
          {weekDays.map((day, idx) => (
            <DayPlanCell key={day.ymd} day={day} isToday={idx === todayIndex} />
          ))}
          <div style={rightCol} />
        </div>

        {/* ── HABITS ─────────────────────────────────────────── */}
        {hasHabits ? (
          <>
            <div style={dividerStyle} />
            <div style={subhead}>
              <span style={subheadLabel}>HABITS</span>
              <span style={subheadCount}>{habits.length}</span>
              <span style={subheadSublabel}>per-day completion</span>
            </div>

            <div style={{ display: "grid", gap: 4 }}>
              {habits.map((habit) => (
                <HabitRow key={habit.routineId} habit={habit} weekDays={weekDays} todayIndex={todayIndex} />
              ))}
            </div>
          </>
        ) : null}

        {/* ── FREQUENCY TARGETS ──────────────────────────────── */}
        {hasTargets ? (
          <>
            <div style={dividerStyle} />
            <div style={subhead}>
              <span style={subheadLabel}>FREQUENCY TARGETS</span>
              <span style={subheadCount}>{frequencyTargets.length}</span>
              <span style={subheadSublabel}>window progress</span>
            </div>

            <div style={{ display: "grid", gap: 4 }}>
              {frequencyTargets.map((target) => (
                <FrequencyRow key={target.goalId} target={target} />
              ))}
            </div>
          </>
        ) : null}

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <div style={footer}>
          <Link href="#full-week-history" style={footerLink}>View 12-week history ↓</Link>
        </div>
      </div>
    </section>
  );
}

function DayPlanCell({ day, isToday }: { day: ThisWeekDay; isToday: boolean }) {
  const totalPlanned = day.planned.reduce((s, item) => s + item.planned, 0);
  const totalLogged = day.planned.reduce((s, item) => s + Math.min(item.logged, item.planned), 0);
  const dots: Array<{ color: string; filled: boolean; key: string }> = [];

  for (const item of day.planned) {
    for (let i = 0; i < Math.min(item.planned, 3); i++) {
      dots.push({
        color: domainColor(item.domain),
        filled: item.logged > i,
        key: `${item.routineId}-${i}`,
      });
    }
  }

  // Append unplanned-but-logged dots so users see "extra" sessions too.
  const plannedRoutineIds = new Set(day.planned.map((p) => p.routineId));
  for (const log of day.logs) {
    if (plannedRoutineIds.has(log.routineId)) continue;
    dots.push({
      color: domainColor(log.domain),
      filled: true,
      key: `extra-${log.id}`,
    });
  }

  const isFuture = day.ymd > "today" ? false : false; // calculated by parent ymd cmp
  const empty = dots.length === 0;

  return (
    <div style={planCellWrap(isToday)}>
      <div style={planDotsRow}>
        {empty ? (
          <div style={emptyDot} />
        ) : (
          dots.slice(0, 6).map((d) => (
            <div
              key={d.key}
              title={`${day.label} ${day.dayNumber} — ${totalLogged}/${totalPlanned} done`}
              style={{
                ...planDot,
                background: d.filled ? d.color : "transparent",
                border: d.filled ? "none" : `1px solid ${d.color}`,
                opacity: d.filled ? 1 : 0.55,
              }}
            />
          ))
        )}
      </div>
      {totalPlanned > 0 ? (
        <div style={planCountText(isToday)}>
          {totalLogged}/{totalPlanned}
        </div>
      ) : null}
    </div>
  );
}

function HabitRow({
  habit,
  weekDays,
  todayIndex,
}: {
  habit: HabitLaneRow;
  weekDays: ThisWeekDay[];
  todayIndex: number;
}) {
  const accent = frequencyStatusColor(habit.state.currentWindow.status);
  const detailHref = `/routines/${habit.routineId}`;
  const sub = habit.weekdayMask
    ? cadenceSub(habit.goalLabel, habit.weekdayMask)
    : (habit.goalLabel ?? "Daily");
  const streakValue = habit.state.windowStreak > 0 ? habit.state.windowStreak : habit.state.currentDayStreak;
  const streakUnit = habit.state.windowStreak > 0 ? "wk" : "d";

  return (
    <Link href={detailHref} style={habitFreqRow}>
      <div style={{ ...rowAccent, background: accent }} />
      <div style={leftCol2}>
        <div style={nameLine}>
          <span style={nameText}>{habit.routineName}</span>
          <span style={subText}>· {sub}</span>
        </div>
      </div>

      {weekDays.map((day, idx) => {
        const cellState = habit.state.dailyState[day.ymd] ?? "rest";
        const isToday = idx === todayIndex;
        return (
          <div key={day.ymd} style={cellOuter(isToday)}>
            <div
              title={`${formatUtcDateLabel(day.ymd, { weekday: "short", month: "short", day: "numeric" })} — ${cellState}`}
              style={habitCellStyle(cellState)}
            />
          </div>
        );
      })}

      <div style={trailing}>
        {streakValue > 0 ? (
          <span style={streakChip}>
            {streakValue}
            <span style={streakUnitText}>{streakUnit}</span>
          </span>
        ) : (
          <span style={{ ...streakChip, opacity: 0.35 }}>—</span>
        )}
      </div>
    </Link>
  );
}

function FrequencyRow({ target }: { target: FrequencyTargetRow }) {
  const accent = domainColor(target.primaryDomain);
  const statusColor = frequencyStatusColor(target.state.currentWindow.status);
  const detailHref = target.isGroup
    ? `/goals/group-frequency:${target.goalId}?mode=edit`
    : `/routines/${target.goalId.replace(/^fg_/, "")}`;
  const fraction = Math.min(1, target.state.currentWindow.progress / Math.max(1, target.state.currentWindow.target));
  const cadence = formatCadence(target.target);
  const routineSummary = summarizeRoutines(target.routineNames);
  const streakValue = target.state.windowStreak > 0 ? target.state.windowStreak : target.state.currentDayStreak;
  const streakUnit = target.state.windowStreak > 0 ? "wk" : "d";

  return (
    <Link href={detailHref} style={freqRow}>
      <div style={{ ...rowAccent, background: accent }} />
      <div style={leftCol2}>
        <div style={nameLine}>
          <span style={nameText}>{target.goalName}</span>
          <span style={subText}>· {cadence}</span>
        </div>
        <div style={routineSubline}>{routineSummary}</div>
      </div>

      {/* Progress bar spans where the per-day cells would go in a habit row. */}
      <div style={freqBarSpan}>
        <div style={progressTrack}>
          <div style={{ ...progressFill, width: `${Math.max(2, fraction * 100)}%`, background: statusColor }} />
        </div>
      </div>

      <div style={freqCount}>
        <span style={{ ...freqCountValue, color: statusColor }}>{target.state.currentWindow.progress}</span>
        <span style={freqCountDenom}>/{target.state.currentWindow.target}</span>
      </div>

      <div style={trailing}>
        {streakValue > 0 ? (
          <span style={streakChip}>
            {streakValue}
            <span style={streakUnitText}>{streakUnit}</span>
          </span>
        ) : (
          <span style={{ ...streakChip, opacity: 0.35 }}>—</span>
        )}
      </div>
    </Link>
  );
}

function FlameIcon() {
  return (
    <svg width="9" height="11" viewBox="0 0 10 12" fill="none" aria-hidden="true">
      <path
        d="M5 0.5C5 2.5 7 3 7 5C7 6 6.5 6.5 6 6.5C6 5 5 4.5 5 4.5C5 5.5 4 6 4 7.5C4 8.5 4.5 9 5 9C5.5 9 6 8.5 6 8C6.8 8.5 7.5 9.5 7.5 10.5C7.5 11.3 6.5 11.5 5 11.5C3.5 11.5 2.5 10.3 2.5 9C2.5 6.5 5 5.5 5 0.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function dot(color: string): CSSProperties {
  return { width: 5, height: 5, borderRadius: 999, background: color };
}

function cadenceSub(label: string | null, mask: number): string {
  if (label && mask) return `${label} · mask`;
  return label ?? "";
}

function formatCadence(t: FrequencyTarget): string {
  const unit = t.targetUnit === "DAY" ? "day" : t.targetUnit === "WEEK" ? "week" : "month";
  if (t.targetInterval === 1) return `${t.targetCount}× / ${unit}`;
  return `${t.targetCount}× / ${t.targetInterval} ${unit}s`;
}

function summarizeRoutines(names: string[]): string {
  if (names.length === 0) return "—";
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function habitCellStyle(state: "done" | "missed" | "rest" | "future"): CSSProperties {
  switch (state) {
    case "done":
      return { ...cellBase, background: "rgba(251,191,36,0.85)", border: "1px solid rgba(251,191,36,0.65)" };
    case "missed":
      return { ...cellBase, background: "transparent", border: "1px solid rgba(248,113,113,0.55)" };
    case "rest":
      return { ...cellBase, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" };
    case "future":
      return { ...cellBase, background: "transparent", border: "1px dashed rgba(255,255,255,0.13)" };
  }
}

// ───── styles ──────────────────────────────────────────────────────────────

const NAME_COL_WIDTH = "minmax(110px, 1.4fr)";
const STREAK_COL_WIDTH = "48px";
const FREQ_COUNT_COL_WIDTH = "44px";

// 9-column grid: name | day1..day7 | streak
const dayRailGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `${NAME_COL_WIDTH} repeat(7, minmax(0, 1fr)) ${STREAK_COL_WIDTH}`,
  gap: 6,
  alignItems: "center",
};

// 9-column grid for habit rows: same layout as dayRailGrid for column alignment
const habitFreqRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `3px ${NAME_COL_WIDTH} repeat(7, minmax(0, 1fr)) ${STREAK_COL_WIDTH}`,
  gap: 6,
  alignItems: "center",
  padding: "5px 6px 5px 0",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.015)",
  color: "inherit",
  textDecoration: "none",
  minHeight: 32,
};

// Frequency row uses the SAME column grid but the 7 day columns merge into
// one progress-bar span, plus a count column before the streak.
const freqRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `3px ${NAME_COL_WIDTH} 1fr ${FREQ_COUNT_COL_WIDTH} ${STREAK_COL_WIDTH}`,
  gap: 8,
  alignItems: "center",
  padding: "5px 6px 5px 0",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.015)",
  color: "inherit",
  textDecoration: "none",
  minHeight: 38,
};

const freqBarSpan: CSSProperties = {
  display: "flex",
  alignItems: "center",
  minWidth: 0,
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const headerLeft: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 6,
};

const headerRangeLabel: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: 0,
  textTransform: "none",
  opacity: 0.55,
};

const headerSignals: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
  fontWeight: 600,
  letterSpacing: 0,
  textTransform: "none",
};

const atRiskPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 10.5,
  fontWeight: 800,
  color: "rgba(248,113,113,0.95)",
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.35)",
  padding: "2px 7px",
  borderRadius: 999,
};

const streakPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 10.5,
  fontWeight: 800,
  color: "rgba(251,191,36,0.95)",
  background: "rgba(251,191,36,0.08)",
  border: "1px solid rgba(251,191,36,0.32)",
  padding: "2px 7px",
  borderRadius: 999,
};

const body: CSSProperties = {
  padding: "10px 14px 12px",
  display: "grid",
  gap: 8,
};

const subhead: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  paddingLeft: 4,
  marginTop: 2,
};

const subheadLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  opacity: 0.65,
};

const subheadCount: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  opacity: 0.6,
  padding: "1px 5px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.05)",
};

const subheadSublabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  opacity: 0.4,
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.05)",
  margin: "4px 0",
};

const leftCol: CSSProperties = {
  // Reserved space for label alignment in day-header row
};

const rightCol: CSSProperties = {
  // Reserved space for streak alignment
};

const leftRailLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.55,
  paddingLeft: 9,
};

function dayHeaderCell(isToday: boolean): CSSProperties {
  return {
    display: "grid",
    gap: 1,
    justifyItems: "center",
    padding: "4px 0 2px",
    borderRadius: 6,
    background: isToday ? "rgba(251,191,36,0.07)" : "transparent",
  };
}

function dayLabelText(isToday: boolean): CSSProperties {
  return {
    fontSize: 9.5,
    fontWeight: isToday ? 900 : 700,
    color: isToday ? "rgba(251,191,36,0.98)" : "rgba(255,255,255,0.55)",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  };
}

function dayNumberText(isToday: boolean): CSSProperties {
  return {
    fontSize: 13,
    fontWeight: isToday ? 900 : 800,
    color: isToday ? "rgba(251,191,36,0.98)" : "inherit",
    lineHeight: 1.1,
  };
}

function planCellWrap(isToday: boolean): CSSProperties {
  return {
    display: "grid",
    gap: 2,
    justifyItems: "center",
    alignItems: "center",
    padding: "3px 0",
    borderRadius: 6,
    background: isToday ? "rgba(251,191,36,0.05)" : "transparent",
    minHeight: 28,
  };
}

const planDotsRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 2,
  maxWidth: "100%",
};

const planDot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  flexShrink: 0,
};

const emptyDot: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: 999,
  background: "rgba(255,255,255,0.10)",
};

function planCountText(isToday: boolean): CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 700,
    opacity: isToday ? 0.8 : 0.45,
  };
}

const rowAccent: CSSProperties = {
  height: 18,
  width: 3,
  borderRadius: "0 2px 2px 0",
};

const leftCol2: CSSProperties = {
  minWidth: 0,
  paddingLeft: 4,
};

const nameLine: CSSProperties = {
  display: "flex",
  gap: 4,
  alignItems: "baseline",
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const nameText: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  lineHeight: 1.1,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const subText: CSSProperties = {
  fontSize: 10.5,
  opacity: 0.55,
  fontWeight: 600,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const routineSubline: CSSProperties = {
  fontSize: 10,
  opacity: 0.5,
  fontWeight: 500,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  marginTop: 1,
};

function cellOuter(isToday: boolean): CSSProperties {
  return {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "0 1px",
    minHeight: 18,
    background: isToday ? "rgba(251,191,36,0.05)" : "transparent",
    borderRadius: 4,
  };
}

const cellBase: CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 14,
  borderRadius: 3,
};

const trailing: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "center",
};

const streakChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 1,
  fontSize: 13,
  fontWeight: 900,
  color: "rgba(251,191,36,0.95)",
  lineHeight: 1,
};

const streakUnitText: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  opacity: 0.65,
  marginLeft: 1,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const progressTrack: CSSProperties = {
  height: 6,
  width: "100%",
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.04)",
  overflow: "hidden",
};

const progressFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 200ms ease",
};

const freqCount: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "flex-end",
  gap: 1,
};

const freqCountValue: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1,
};

const freqCountDenom: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  opacity: 0.55,
};

const footer: CSSProperties = {
  marginTop: 4,
  paddingTop: 6,
  borderTop: "1px solid rgba(255,255,255,0.04)",
  textAlign: "right",
};

const footerLink: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.6,
  color: "inherit",
  textDecoration: "none",
};
