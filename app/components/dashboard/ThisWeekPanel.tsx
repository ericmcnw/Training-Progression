// THIS WEEK panel — combined dashboard surface that keeps the original
// scrollable Week-at-a-Glance day rail (with its selectable detail card and
// 12-week history) at the top, then layers habit consistency and frequency
// target progress as subsections below.
//
// All math comes from prepared data passed in from app/page.tsx. The original
// WeekAtGlanceClient, HabitLane, and FrequencyTargetsCard components are
// reused as-is so reverting is a single boolean flip in app/page.tsx.

import type { CSSProperties } from "react";
import WeekAtGlanceClient from "@/app/WeekAtGlanceClient";
import RhythmGrid from "./RhythmGrid";
import TodayActionsBar, { type TodayActionItem } from "./TodayActionsBar";
import type { HabitLaneRow } from "./HabitLane";
import type { FrequencyTargetRow } from "./FrequencyTargetsCard";
import type { DayTodoItem } from "./DayTodoList";
import type { RoutineDomain } from "@/lib/routines";

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
  logs: Array<{ id: string; routineId: string; routineName: string; kind: string; domain: RoutineDomain }>;
  habitAggregate?: { expected: number; completed: number };
  todos?: DayTodoItem[];
};

export default function ThisWeekPanel({
  glanceDays,
  weekStart,
  habits,
  frequencyTargets,
  today,
  todayLabel,
  todayItems,
  todayTodos,
  weekRangeLabel,
  panelStyle,
  panelHeaderStyle,
}: {
  glanceDays: GlanceDay[];
  weekStart: string;
  habits: HabitLaneRow[];
  frequencyTargets: FrequencyTargetRow[];
  today: string;
  todayLabel: string;
  todayItems: TodayActionItem[];
  todayTodos: DayTodoItem[];
  weekRangeLabel: string;
  panelStyle: CSSProperties;
  panelHeaderStyle: CSSProperties;
}) {
  const atRiskCount =
    habits.filter((h) => h.state.currentWindow.status === "at_risk").length +
    frequencyTargets.filter((t) => t.state.currentWindow.status === "at_risk").length;
  const bestStreak = Math.max(
    0,
    ...habits.map((h) => Math.max(h.state.windowStreak, h.state.currentDayStreak)),
    ...frequencyTargets.map((t) => Math.max(t.state.windowStreak, t.state.currentDayStreak))
  );

  // Hide habit/frequency subsections cleanly when the user has neither set up
  // — the day rail still reads as a meaningful "this week" surface on its own.
  const hasHabits = habits.length > 0;
  const hasTargets = frequencyTargets.length > 0;
  const hasRhythm = hasHabits || hasTargets;

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
              <span style={dot("rgba(248,113,113,0.95)")} /> {atRiskCount} at risk
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
        {/* ── TODAY: one-tap log surface for today's planned + habits ── */}
        <TodayActionsBar todayYmd={today} todayLabel={todayLabel} items={todayItems} todos={todayTodos} />

        {/* ── Day rail + selectable detail card (original WaG behavior) ── */}
        <div style={dayRailWrap}>
          <WeekAtGlanceClient days={glanceDays} today={today} currentWeekStart={weekStart} />
        </div>

        {hasRhythm ? <div style={dividerStyle} /> : null}

        {hasRhythm ? (
          <RhythmGrid habits={habits} frequencyTargets={frequencyTargets} today={today} />
        ) : null}
      </div>
    </section>
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
  padding: "12px 14px 14px",
  display: "grid",
  gap: 12,
};

// Day rail gets a soft inset so it visually anchors as the panel's primary
// surface, while the rhythm subsections feel like a quieter footer.
const dayRailWrap: CSSProperties = {
  display: "grid",
  gap: 8,
};

// Stronger divider between the day rail and the rhythm sub-block so the user
// reads the panel as "what happened" then "how I'm doing".
const dividerStyle: CSSProperties = {
  height: 1,
  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)",
  marginTop: 4,
  marginBottom: 2,
};

