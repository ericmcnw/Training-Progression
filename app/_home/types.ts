// Shape contracts between the server-side data prep (data.ts) and the
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
    /** Unique React key for this row. Equals `${routineId}::${activityTypeId}`
     *  for typed endurance entries (Trail Run, Walk on the synthetic
     *  Endurance routine — same routineId, different activity types
     *  collide otherwise) and plain `routineId` for everything else. */
    key: string;
    routineId: string;
    routineName: string;
    kind: string;
    domain: RoutineDomain;
    planned: number;
    logged: number;
    // Log ids for this routine on this day, most-recent first. Feeds the
    // view-log modal so all same-day logs (e.g. two walks) are openable
    // from a single "view →" button.
    logIds: string[];
    // COMPLETION-only flag mirroring Routine.capturesDuration. When true,
    // the WaG detail panel renders a minutes pill next to the checkbox.
    capturesDuration?: boolean;
    // When the day is logged AND the routine captures duration, the most
    // recent log's durationSec (seconds) so the pill can display existing
    // minutes. Null/undefined = day done but no duration recorded yet.
    durationSec?: number | null;
  }>;
  logs: Array<{
    id: string;
    routineId: string;
    routineName: string;
    kind: string;
    domain: RoutineDomain;
  }>;
  habitAggregate?: { expected: number; completed: number };
  // Ambient home-base weather for this day (high temp + WMO code) shown as a
  // chip in the WaG block. Absent when no home base is set or the fetch failed.
  weather?: { code: number; highF: number };
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
  // 8 weeks of contributing logs, oldest → newest. Aligned to the same week
  // starts the WeeklyFrequencyBars view uses (Sunday-anchored). Each entry
  // is one log that satisfied this goal — primary or substitute. Used to
  // expand a bar inline and show "what routines counted toward 3× / week,
  // and when did I do them?" without an extra roundtrip.
  weeklyContributions: HabitWeekContribution[];
};

export type HabitWeekContribution = {
  weekStartYmd: string;
  weekEndYmd: string;
  logs: Array<{
    logId: string;
    routineId: string;
    routineName: string;
    performedYmd: string;
    performedTimeLabel: string;
    // false = log came from a SUBSTITUTE routine (counts but renders distinctly).
    isPrimary: boolean;
  }>;
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

// Routine link for the FAB quick-add picker.
export type QuickPickRoutine = {
  routineId: string;
  routineName: string;
  domain: DomainTone;
  kind: string;
};

// Full props bag for the client-side HomeShell.
/** Rolling 7-day snapshot used by the home page's "Last 7 days" strip.
 *  Pure totals — no comparison vs prior period or breakdowns. */
export type Last7DaysStats = {
  sessions: number;
  totalDurationSec: number;
  totalCardioMi: number;
};

export type HomeData = {
  today: string;
  currentWeekStart: string;
  legacyGlanceDays: LegacyGlanceDay[]; // ~12 weeks of days for the scrollable WaG
  habitRows: HabitRow[];
  domainSeries: DomainSeries[];
  movementPatterns: import("./movement-patterns").MovementPatternData;
  quickPickRoutines: QuickPickRoutine[];
  /** Last-7-days totals shown in a compact strip at the top of the dashboard. */
  last7Days: Last7DaysStats;
  /** Enabled endurance activity types for the typed-endurance schedule
   *  shortcut in the schedule picker. */
  scheduleActivityTypes: Array<{
    id: string;
    slug: string;
    name: string;
    familyId: string;
    familyName: string;
  }>;
  /** Sports the user has added — populates the SPORTS section in the
   *  schedule picker with tappable sport tiles. */
  scheduleSports: Array<{
    slug: string;
    label: string;
    eyebrow: string;
    color: string;
  }>;
};
