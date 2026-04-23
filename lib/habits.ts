import { addDaysYmd, toAppYmd } from "@/lib/dates";

/**
 * Given an array of Date objects for a single routine, computes:
 * - currentStreak: consecutive days logged up to today (or yesterday)
 * - longestStreak: all-time best streak in the supplied log window
 * - missedLast30: count of calendar days in the past 30 where no log exists
 */
export function computeHabitStats(logDates: Date[], today: string): {
  currentStreak: number;
  longestStreak: number;
  missedLast30: number;
} {
  if (logDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, missedLast30: 30 };
  }

  const logYmds = new Set(logDates.map((d) => toAppYmd(d)));

  // Current streak: walk backward from today (or yesterday if today has no log)
  let streakStart = logYmds.has(today) ? today : addDaysYmd(today, -1);
  let currentStreak = 0;
  let cursor = streakStart;
  while (logYmds.has(cursor)) {
    currentStreak++;
    cursor = addDaysYmd(cursor, -1);
  }

  // Longest streak over all available log data
  const sorted = Array.from(logYmds).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const ymd of sorted) {
    if (prev !== null && ymd === addDaysYmd(prev, 1)) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = ymd;
  }

  // Missed days in the last 30
  let missedLast30 = 0;
  for (let i = 1; i <= 30; i++) {
    if (!logYmds.has(addDaysYmd(today, -i))) missedLast30++;
  }

  return { currentStreak, longestStreak: Math.max(longest, currentStreak), missedLast30 };
}
