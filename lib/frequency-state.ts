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
  const lookback = Math.max(8, params.maxLookbackWindows ?? 26);

  // For WEEK and MONTH targets, build calendar-aligned windows so the streak
  // agrees with the bars chart (which buckets by Sun–Sat weeks / calendar
  // months). The old rolling-N-days approach computed a streak users couldn't
  // reconcile with what they saw — last 4 calendar weeks all green but
  // streak said 2.
  // For DAY/N targets the rolling N-day approach is correct (no calendar
  // alignment to speak of) and we fall through to it.
  if (target.targetUnit === "WEEK" || target.targetUnit === "MONTH") {
    return computeCalendarWindowStreak({ target, logYmds, today, lookback });
  }

  const windowDays = getWindowDays(target);
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

// Calendar-aligned window streak for WEEK and MONTH targets. Windows are
// anchored to the current Sun–Sat week (or current calendar month) and walk
// backward. The current (in-progress) window counts toward the streak if it
// already met target; otherwise it's treated as a grace window — the streak
// continues from the most recently completed window so users don't see their
// streak vanish on the first day of a new week before they've logged.
function computeCalendarWindowStreak(params: {
  target: FrequencyTarget;
  logYmds: Set<string>;
  today: string;
  lookback: number;
}): { current: number; longest: number } {
  const { target, logYmds, today, lookback } = params;
  const interval = Math.max(1, target.targetInterval);

  type Window = { startYmd: string; endYmd: string };
  const windows: Window[] = [];

  if (target.targetUnit === "WEEK") {
    const todayDate = new Date(`${today}T00:00:00.000Z`);
    const todayDow = todayDate.getUTCDay();
    const currentWeekStart = addDaysYmd(today, -todayDow);
    const spanDays = 7 * interval;
    for (let i = 0; i < lookback; i++) {
      const startYmd = addDaysYmd(currentWeekStart, -i * spanDays);
      const endYmd = addDaysYmd(startYmd, spanDays - 1);
      windows.push({ startYmd, endYmd });
    }
  } else {
    // MONTH — windows are `interval` calendar months wide, anchored to the
    // first day of the month containing today.
    const todayDate = new Date(`${today}T00:00:00.000Z`);
    const year = todayDate.getUTCFullYear();
    const month = todayDate.getUTCMonth();
    for (let i = 0; i < lookback; i++) {
      const startDate = new Date(Date.UTC(year, month - i * interval, 1));
      const endDate = new Date(Date.UTC(year, month - i * interval + interval, 0));
      const startYmd = startDate.toISOString().slice(0, 10);
      const endYmd = endDate.toISOString().slice(0, 10);
      windows.push({ startYmd, endYmd });
    }
  }

  // Score each window. Future days inside the current window don't count —
  // we cap the day cursor at today.
  const hits: boolean[] = windows.map((w) => {
    let count = 0;
    let cursor = w.startYmd;
    while (cursor <= w.endYmd) {
      if (cursor > today) break;
      if (logYmds.has(cursor)) count++;
      cursor = addDaysYmd(cursor, 1);
    }
    return count >= target.targetCount;
  });

  // Current streak — walk backward from the most recent window.
  // The current (in-progress) window: include if hit, otherwise skip past it
  // as a grace window so an unfinished week doesn't break the streak.
  let current = 0;
  let startIdx = 0;
  if (!hits[0]) startIdx = 1;
  for (let i = startIdx; i < hits.length; i++) {
    if (hits[i]) current++;
    else break;
  }

  // Longest run across the lookback. Exclude the in-progress current window
  // from "longest" when it hasn't hit yet — it could still bump up.
  let longest = current;
  let run = 0;
  for (let i = hits.length - 1; i >= 0; i--) {
    if (i === 0 && !hits[0]) continue;
    if (hits[i]) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
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

// Render-mode picker. Frequency goals visually fall into two camps:
//   • daily-grid — every day is an "expected" day, so a calendar grid reads
//     well. Streak math is meaningful per-day. Daily habits like supplements
//     or hangboarding fall here, as do mask-based goals (Mon/Wed/Fri).
//   • weekly-bars — flexible windows where most days are unscheduled. A
//     calendar grid for "3× per week" is mostly empty cells; a row of weekly
//     bars showing "did I hit 3 this week?" reads much better.
//
// Callers (heatmap, dashboard cards) pick which component to render based
// on this. The math layer (computeFrequencyState) is shared either way.
export type FrequencyRenderMode = "daily-grid" | "weekly-bars";

export function getFrequencyRenderMode(target: FrequencyTarget | null): FrequencyRenderMode {
  if (!target) return "daily-grid"; // null target = daily streak fallback
  if (isDailyEveryDay(target)) return "daily-grid";
  if (hasMask(target)) return "daily-grid";
  return "weekly-bars";
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
