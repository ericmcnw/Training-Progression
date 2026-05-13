// Unified frequency-state primitives — used by the habit lane in the
// week-at-a-glance, the Frequency Targets dashboard module, the goals page,
// and any other surface that needs to ask "how is this routine/goal doing
// against its frequency target?".
//
// Two layers of meaning:
//   1. Window progress: across a rolling target window (e.g., "3 of 5 in the
//      last 7 days") — this is the existing FrequencyGoal math, generalized.
//   2. Per-day expected state: for surfaces that draw a calendar strip, we
//      project each past day in a trailing window into one of four states —
//      done / missed / rest / future. This is what powers the habit lane.
//
// A null target means "treat as a daily streak" (every day is expected). This
// lets habit-domain routines without a FrequencyGoal still get sensible
// per-day state from the same primitive.

import type { RoutineFrequencyUnit } from "@/generated/prisma";
import { addDaysYmd, toAppYmd, todayAppYmd } from "@/lib/dates";

export type FrequencyTarget = {
  targetCount: number;
  targetInterval: number;
  targetUnit: RoutineFrequencyUnit;
  // Weekday bitmask: bit 0 = Sun, bit 1 = Mon, ..., bit 6 = Sat.
  // Null/zero means "any day counts" (flexible weekly target).
  // Only meaningful when targetUnit === "WEEK".
  weekdayMask?: number | null;
};

// "covered" — only substitute-routine logs landed on this day; no primary log.
// Counts toward window/streak (so the user isn't punished for swapping in a
// related activity), but renders distinctly so the heatmap reads "you climbed
// instead of hangboarded" rather than "you hangboarded."
export type DailyState = "done" | "covered" | "missed" | "rest" | "future";

export type FrequencyWindowStatus =
  | "complete"   // hit or exceeded target this window
  | "ahead"      // ahead of pace
  | "on_track"   // on linear pace
  | "behind"     // under pace, recoverable
  | "at_risk";   // under target with ≤1 day left

export type FrequencyWindow = {
  startYmd: string;     // inclusive
  endYmd: string;       // inclusive (today, for the current window)
  windowDays: number;
  progress: number;
  target: number;
  daysElapsed: number;
  daysRemaining: number;
  status: FrequencyWindowStatus;
  // Linear pace expected count at this point in the window. Useful for
  // status badges that want to say "you're 1 behind pace".
  expectedByNow: number;
};

export type FrequencyState = {
  // Per-day state for the trailing window. Map keys are YMDs in app TZ.
  dailyState: Record<string, DailyState>;
  // The window the goal is currently inside.
  currentWindow: FrequencyWindow;
  // Consecutive past windows where target was hit (excludes the current one).
  windowStreak: number;
  longestWindowStreak: number;
  // Daily streak: only meaningful for DAY/1 or null targets. For weekly/monthly
  // targets, callers should prefer windowStreak. For mask-based weekly targets
  // (Mon/Wed/Fri), this counts consecutive expected days that were hit.
  currentDayStreak: number;
  longestDayStreak: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function getWindowDays(target: FrequencyTarget): number {
  if (target.targetUnit === "DAY") return Math.max(1, target.targetInterval);
  if (target.targetUnit === "WEEK") return Math.max(1, target.targetInterval) * 7;
  return Math.max(1, target.targetInterval) * 30;
}

function dayOfWeekFromYmd(ymd: string): number {
  // Treat YMD as midnight UTC for stable weekday math; weekday computed in UTC.
  return new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
}

function isMaskedDay(ymd: string, mask: number): boolean {
  return (mask & (1 << dayOfWeekFromYmd(ymd))) !== 0;
}

function hasMask(target: FrequencyTarget): target is FrequencyTarget & { weekdayMask: number } {
  return target.targetUnit === "WEEK" && typeof target.weekdayMask === "number" && target.weekdayMask > 0;
}

function isDailyEveryDay(target: FrequencyTarget | null): boolean {
  if (!target) return true;
  if (target.targetUnit === "DAY" && target.targetInterval === 1) return true;
  // WEEK/1 with count = 7 ≡ daily every day
  if (target.targetUnit === "WEEK" && target.targetInterval === 1 && target.targetCount === 7) return true;
  return false;
}

export function isExpectedDay(target: FrequencyTarget | null, ymd: string): boolean {
  if (isDailyEveryDay(target)) return true;
  if (!target) return false;
  if (hasMask(target)) return isMaskedDay(ymd, target.weekdayMask);
  return false;
}

function buildLogYmdSet(logs: Array<{ performedAt: Date }>): Set<string> {
  const set = new Set<string>();
  for (const log of logs) set.add(toAppYmd(log.performedAt));
  return set;
}

// Build a set of YMDs where at least one PRIMARY-routine log landed. Logs that
// omit `isPrimary` are treated as primary (back-compat for callers that don't
// know about substitutes yet).
function buildPrimaryYmdSet(logs: Array<{ performedAt: Date; isPrimary?: boolean }>): Set<string> {
  const set = new Set<string>();
  for (const log of logs) {
    if (log.isPrimary === false) continue;
    set.add(toAppYmd(log.performedAt));
  }
  return set;
}

function computeWindowStatus(params: {
  progress: number;
  target: number;
  daysElapsed: number;
  daysRemaining: number;
  expectedByNow: number;
}): FrequencyWindowStatus {
  const { progress, target, daysRemaining, expectedByNow } = params;
  if (progress >= target) return "complete";
  if (daysRemaining <= 1 && progress < target) return "at_risk";
  if (progress >= expectedByNow + 0.5) return "ahead";
  if (progress >= expectedByNow - 0.5) return "on_track";
  return "behind";
}

function computeCurrentWindow(params: {
  target: FrequencyTarget;
  logYmds: Set<string>;
  today: string;
}): FrequencyWindow {
  const { target, logYmds, today } = params;
  const windowDays = getWindowDays(target);
  const startYmd = addDaysYmd(today, -(windowDays - 1));

  let progress = 0;
  for (let i = 0; i < windowDays; i++) {
    const ymd = addDaysYmd(startYmd, i);
    if (logYmds.has(ymd)) progress++;
  }

  // For an open window we treat "today" as fully elapsed for pace purposes —
  // the user has had a chance to log today already.
  const daysElapsed = windowDays;
  const daysRemaining = 0;
  const expectedByNow = target.targetCount;

  return {
    startYmd,
    endYmd: today,
    windowDays,
    progress,
    target: target.targetCount,
    daysElapsed,
    daysRemaining,
    expectedByNow,
    status: computeWindowStatus({
      progress,
      target: target.targetCount,
      daysElapsed,
      daysRemaining,
      expectedByNow,
    }),
  };
}

function computeWindowStreak(params: {
  target: FrequencyTarget;
  logYmds: Set<string>;
  today: string;
  maxLookbackWindows?: number;
}): { current: number; longest: number } {
  const { target, logYmds, today } = params;
  const windowDays = getWindowDays(target);
  const lookback = Math.max(8, params.maxLookbackWindows ?? 26);

  let current = 0;
  let longest = 0;
  let run = 0;
  // Walk back through completed past windows (i = 1 starts the window before
  // the current one). A "complete" window means it hit target.
  for (let i = 1; i <= lookback; i++) {
    const windowEnd = addDaysYmd(today, -((i - 1) * windowDays + 1));
    const windowStart = addDaysYmd(windowEnd, -(windowDays - 1));
    let count = 0;
    for (let j = 0; j < windowDays; j++) {
      const ymd = addDaysYmd(windowStart, j);
      if (logYmds.has(ymd)) count++;
    }
    const hit = count >= target.targetCount;
    if (hit) {
      run++;
      if (i === current + 1) current = run; // contiguous from most recent
    } else {
      run = 0;
    }
    if (run > longest) longest = run;
  }

  return { current, longest };
}

function computeDailyStreak(params: {
  target: FrequencyTarget | null;
  logYmds: Set<string>;
  today: string;
}): { current: number; longest: number } {
  const { target, logYmds, today } = params;

  // Walk back day-by-day, only counting days the target expected. Stop the
  // current streak as soon as we hit an expected day with no log.
  // Start from today if logged, else yesterday — gives users a grace day.
  let current = 0;
  let cursor = logYmds.has(today) ? today : addDaysYmd(today, -1);
  for (let i = 0; i < 1000; i++) {
    const expected = isExpectedDay(target, cursor);
    if (!expected) {
      cursor = addDaysYmd(cursor, -1);
      continue;
    }
    if (logYmds.has(cursor)) {
      current++;
      cursor = addDaysYmd(cursor, -1);
    } else {
      break;
    }
  }

  // Longest streak: scan all logged dates, count consecutive expected-day hits.
  const sorted = Array.from(logYmds).sort();
  let longest = current;
  let run = 0;
  let prev: string | null = null;
  for (const ymd of sorted) {
    if (!isExpectedDay(target, ymd)) continue;
    if (prev !== null) {
      // Walk forward from prev+1 to ymd-1 looking for any expected day that
      // wasn't logged — if we find one, the streak broke.
      let broken = false;
      let cursor = addDaysYmd(prev, 1);
      while (cursor < ymd) {
        if (isExpectedDay(target, cursor)) { broken = true; break; }
        cursor = addDaysYmd(cursor, 1);
      }
      if (broken) run = 1;
      else run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = ymd;
  }

  return { current, longest };
}

function computeDailyStateMap(params: {
  target: FrequencyTarget | null;
  logYmds: Set<string>;
  primaryYmds: Set<string>;
  today: string;
  trailingDays: number;
  currentWindow: FrequencyWindow | null;
}): Record<string, DailyState> {
  const { target, logYmds, primaryYmds, today, trailingDays, currentWindow } = params;
  const startYmd = addDaysYmd(today, -(trailingDays - 1));
  const result: Record<string, DailyState> = {};

  for (let i = 0; i < trailingDays; i++) {
    const ymd = addDaysYmd(startYmd, i);
    if (ymd > today) { result[ymd] = "future"; continue; }
    if (logYmds.has(ymd)) {
      result[ymd] = primaryYmds.has(ymd) ? "done" : "covered";
      continue;
    }

    if (isDailyEveryDay(target) || (target && hasMask(target))) {
      // Per-day expectation: missed if the day was expected, rest otherwise.
      result[ymd] = isExpectedDay(target, ymd) ? "missed" : "rest";
    } else if (target && currentWindow) {
      // Flexible weekly/monthly target: only mark the days inside the current
      // window as "missed" if the window has fallen behind pace or is at risk.
      // Past closed windows are summarized via windowStreak — we leave their
      // individual days as "rest" so the strip stays calm.
      const inCurrentWindow = ymd >= currentWindow.startYmd && ymd <= currentWindow.endYmd;
      if (inCurrentWindow && (currentWindow.status === "behind" || currentWindow.status === "at_risk")) {
        result[ymd] = "missed";
      } else {
        result[ymd] = "rest";
      }
    } else {
      result[ymd] = "rest";
    }
  }

  return result;
}

export function computeFrequencyState(params: {
  target: FrequencyTarget | null;
  // Logs may carry an `isPrimary` flag — when false, the log came from a
  // SUBSTITUTE routine. Substitutes still satisfy the day for window/streak
  // math (so swapping climbing in for hangboard doesn't break a streak), but
  // the day renders as "covered" instead of "done."
  logs: Array<{ performedAt: Date; isPrimary?: boolean }>;
  today?: string;
  trailingDays?: number;
}): FrequencyState {
  const today = params.today ?? todayAppYmd();
  const trailingDays = Math.max(7, params.trailingDays ?? 30);
  const logYmds = buildLogYmdSet(params.logs);
  const primaryYmds = buildPrimaryYmdSet(params.logs);

  // Build a synthetic target for daily-streak fallback so window math still
  // gives us a meaningful "current window" to render.
  const effectiveTarget: FrequencyTarget = params.target ?? {
    targetCount: 1,
    targetInterval: 1,
    targetUnit: "DAY",
  };

  const currentWindow = computeCurrentWindow({ target: effectiveTarget, logYmds, today });
  const dailyState = computeDailyStateMap({
    target: params.target,
    logYmds,
    primaryYmds,
    today,
    trailingDays,
    currentWindow,
  });

  const windowStreak = params.target
    ? computeWindowStreak({ target: effectiveTarget, logYmds, today })
    : { current: 0, longest: 0 };

  const dayStreak = computeDailyStreak({
    target: params.target,
    logYmds,
    today,
  });

  return {
    dailyState,
    currentWindow,
    windowStreak: windowStreak.current,
    longestWindowStreak: windowStreak.longest,
    currentDayStreak: dayStreak.current,
    longestDayStreak: dayStreak.longest,
  };
}

// Bitmask helpers for goal-form weekday pickers.
export const WEEKDAY_BITS: Array<{ bit: number; short: string; full: string }> = [
  { bit: 1 << 0, short: "S", full: "Sun" },
  { bit: 1 << 1, short: "M", full: "Mon" },
  { bit: 1 << 2, short: "T", full: "Tue" },
  { bit: 1 << 3, short: "W", full: "Wed" },
  { bit: 1 << 4, short: "T", full: "Thu" },
  { bit: 1 << 5, short: "F", full: "Fri" },
  { bit: 1 << 6, short: "S", full: "Sat" },
];

export function countMaskedDays(mask: number): number {
  let n = 0;
  for (let i = 0; i < 7; i++) if (mask & (1 << i)) n++;
  return n;
}

export function formatMaskLabel(mask: number | null | undefined): string | null {
  if (!mask) return null;
  const days = WEEKDAY_BITS.filter((w) => (mask & w.bit) !== 0).map((w) => w.full);
  if (days.length === 7) return "Every day";
  if (days.length === 5 && !(mask & WEEKDAY_BITS[0].bit) && !(mask & WEEKDAY_BITS[6].bit)) return "Weekdays";
  if (days.length === 2 && (mask & WEEKDAY_BITS[0].bit) && (mask & WEEKDAY_BITS[6].bit)) return "Weekends";
  return days.join(" · ");
}

// Re-exported for callers that want to walk a window without recomputing state.
export function getFrequencyWindowDays(target: FrequencyTarget): number {
  return getWindowDays(target);
}

// Status → accent color helper. Centralized so every habit / frequency surface
// renders the same palette and a designer change touches one place.
export function frequencyStatusColor(status: FrequencyWindowStatus): string {
  switch (status) {
    case "complete": return "rgba(84,203,130,0.95)";   // green
    case "ahead":    return "rgba(132,204,255,0.95)";  // sky
    case "on_track": return "rgba(100,180,255,0.95)";  // blue
    case "behind":   return "rgba(251,191,36,0.95)";   // amber
    case "at_risk":  return "rgba(248,113,113,0.95)";  // red
  }
}

export function frequencyStatusLabel(status: FrequencyWindowStatus): string {
  switch (status) {
    case "complete": return "Complete";
    case "ahead":    return "Ahead";
    case "on_track": return "On track";
    case "behind":   return "Behind";
    case "at_risk":  return "At risk";
  }
}

// Streak chip helpers — single source of truth so every dashboard surface
// renders the same compact label and tooltip. Day streaks read as "Nd",
// window streaks as "Nw" (week) or "Nm" (month). Both get a clear hover
// description so the abbreviation isn't ambiguous.
export type StreakLabel = {
  value: number;
  unit: "d" | "w" | "m";
  short: string;       // "6d" / "3w"
  long: string;        // "6-day streak" / "3-week streak (3× / week)"
  tooltip: string;     // full description with target context
};

export function getStreakLabel(
  state: FrequencyState,
  target: FrequencyTarget | null
): StreakLabel | null {
  // Window streak takes precedence — a multi-day count where target was met
  // each window is more meaningful than per-day for non-daily targets.
  if (state.windowStreak > 0 && target) {
    const unit: "d" | "w" | "m" =
      target.targetUnit === "DAY" ? "d" : target.targetUnit === "WEEK" ? "w" : "m";
    const unitWord = unit === "d" ? "day" : unit === "w" ? "week" : "month";
    const cadence = `${target.targetCount}× / ${unitWord}`;
    const value = state.windowStreak;
    return {
      value,
      unit,
      short: `${value}${unit}`,
      long: `${value}-${unitWord} streak`,
      tooltip: `${value} ${unitWord}${value === 1 ? "" : "s"} in a row hitting ${cadence}`,
    };
  }
  // Daily streak — every consecutive expected day was logged.
  if (state.currentDayStreak > 0) {
    const value = state.currentDayStreak;
    return {
      value,
      unit: "d",
      short: `${value}d`,
      long: `${value}-day streak`,
      tooltip: `${value} consecutive day${value === 1 ? "" : "s"} logged`,
    };
  }
  return null;
}
