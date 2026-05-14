// Shape contracts between HomePageV2 (server-side data prep) and the
// client subcomponents. Keep these flat and serializable — no Date objects,
// no Maps, no functions. Everything is a YMD string or a primitive so the
// server → client boundary stays clean.

import type { RoutineDomain } from "@/lib/routines";
import type { FrequencyState } from "@/lib/frequency-state";

export type DomainTone = Exclude<RoutineDomain, "skill" | "general" | "recovery" | "habit">;

// Legacy WaG shape — matches the existing WeekAtGlanceClient's GlanceDay
// contract. Used so we can reuse that scrollable rail unchanged.
export type LegacyGlanceDay = {
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
  habitAggregate?: { expected: number; completed: number };
  todos?: Array<{ id: string; ymd: string; label: string; done: boolean }>;
  // Habit-domain routines that aren't on the schedule for this day but are
  // available to log inline. Populated for today + future only — past days
  // surface what actually happened via the `planned`/`logs` arrays.
  availableHabits?: Array<{
    routineId: string;
    routineName: string;
    kind: string;
    domain: RoutineDomain;
  }>;
};

// One routine planned or logged on a given day.
export type DayRoutineEntry = {
  routineId: string;
  routineName: string;
  kind: string;
  domain: DomainTone;
  planned: number;
  logged: number;
  // The most recent log id for this routine on this day, if any — used by
  // the "view →" link to jump straight to the existing log.
  lastLogId: string | null;
  lastLoggedAt: string | null; // ISO string for tooltip / sub-label rendering
};

// One to-do for a given day.
export type DayTodo = {
  id: string;
  ymd: string;
  label: string;
  done: boolean;
};

// One row per active frequency goal. Covers three flavors that all share the
// same shape:
//   • per-routine goal (1 PRIMARY routine — the common case for habits)
//   • per-routine goal with substitutes (e.g. fingers + climbing-as-substitute)
//   • group goal (N PRIMARY routines counted together — e.g. strength 3x/week)
//
// `routineId` carries the *contextual* routine: for single-primary goals it's
// that routine; for groups it's the first primary (used as a sane default for
// quick log links). The full primary + substitute lists below let the
// expansion offer per-routine log buttons when the goal spans multiple.
export type HabitRow = {
  // Identity — `goalId` is the FrequencyGoal id (e.g. `fg_<routineId>` for
  // per-routine, or a cuid for group). `routineId` is included for back-compat
  // with the existing log button routing.
  goalId: string;
  goalName: string;
  isGroup: boolean;
  routineId: string;          // primary's id (or first primary for groups)
  routineName: string;        // primary's name (or group name for groups)
  primaryRoutines: Array<{ id: string; name: string; domain: DomainTone }>;
  substituteRoutines: Array<{ id: string; name: string; domain: DomainTone }>;

  // Display
  domain: DomainTone;
  state: FrequencyState;
  // The frequency goal's target. Drives the expansion's render mode pick
  // (daily grid vs weekly bars). Null means "no explicit target" → daily
  // streak fallback, daily-grid render.
  target: import("@/lib/frequency-state").FrequencyTarget | null;
  // 30-day per-day state strip, oldest → newest.
  trailing30: Array<{ ymd: string; state: "done" | "covered" | "missed" | "rest" | "future" }>;
  currentStreak: number;
  longestStreak: number;
  // X/Y format for this-week summary.
  weekFraction: { progress: number; target: number };
  // For ambient chip routing.
  status: "complete" | "ahead" | "on_track" | "behind" | "at_risk";
};

// 8-week per-domain bar chart entry.
export type DomainWeek = {
  weekStartYmd: string;
  weekEndYmd: string;
  count: number;
  logs: Array<{
    logId: string;
    routineId: string;
    routineName: string;
    performedYmd: string;
    performedTimeLabel: string;
  }>;
};

export type DomainSeries = {
  domain: DomainTone;
  label: string;
  totalThisWeek: number;
  weeks: DomainWeek[]; // length 8, oldest → newest
};

// Ambient chip status.
export type BodyChipStatus = {
  tone: "clear" | "recovering" | "injured";
  primaryLabel: string;
  secondaryLabel: string;
};

export type HabitChipStatus = {
  bestStreakLabel: string | null;
  bestStreakName: string | null;
  atRiskLabel: string | null;
  atRiskName: string | null;
};

export type WeekChipStatus = {
  done: number;
  planned: number;
  paceLabel: "on track" | "ahead" | "behind" | "complete" | "starting";
  fillPercent: number;
};

// Routine link for the FAB quick-add picker.
export type QuickPickRoutine = {
  routineId: string;
  routineName: string;
  domain: DomainTone;
  kind: string;
};

// Full props bag for the client-side HomeShell.
export type HomeV2Data = {
  today: string;
  currentWeekStart: string;
  legacyGlanceDays: LegacyGlanceDay[]; // ~12 weeks of days for the scrollable WaG
  habitRows: HabitRow[];
  domainSeries: DomainSeries[];
  movementPatterns: import("./movement-patterns").MovementPatternData;
  bodyChip: BodyChipStatus;
  habitChip: HabitChipStatus;
  weekChip: WeekChipStatus;
  quickPickRoutines: QuickPickRoutine[];
};
