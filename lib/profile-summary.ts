import { addDaysYmd, diffYmdDays } from "./dates";

// Shared display + date primitives for the Profile page summary modules
// (Weekly / Monthly / Yearly) and lib/profile-stats. Centralizes the domain
// label map (cardio → "Endurance") that used to be copy-pasted into six files
// and the day-streak math that had three subtly different implementations.
//
// All date logic here operates on app-timezone YMD strings (see lib/dates.ts).
// Never derive day boundaries from a server-local `Date` — on a UTC host that
// drifts a day relative to APP_TIME_ZONE.

export type ProfileDomain = "strength" | "cardio" | "mobility" | "sport" | "lifestyle";

export const PROFILE_DOMAIN_ORDER: ProfileDomain[] = [
  "strength",
  "cardio",
  "mobility",
  "sport",
  "lifestyle",
];

export const PROFILE_DOMAIN_LABELS: Record<ProfileDomain, string> = {
  strength: "Strength",
  cardio: "Endurance",
  mobility: "Mobility",
  sport: "Sport",
  lifestyle: "Lifestyle",
};

// Weekday index (0=Sun … 6=Sat) for a calendar-date YMD string. Reads at noon
// UTC so the result is independent of both the server timezone and DST edges.
export function ymdWeekday(ymd: string): number {
  return new Date(`${ymd}T12:00:00.000Z`).getUTCDay();
}

// Trailing `n` days ending at (and including) `endYmd`, oldest → newest.
export function trailingYmds(endYmd: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(addDaysYmd(endYmd, -i));
  return out;
}

// Current consecutive-day streak ending today. Today is a grace day: an
// un-logged today doesn't break a streak that ran through yesterday, but a
// logged today extends it.
export function currentDailyStreak(daySet: Set<string>, todayYmd: string): number {
  if (daySet.size === 0) return 0;
  let cursor = todayYmd;
  if (!daySet.has(cursor)) cursor = addDaysYmd(cursor, -1);
  let count = 0;
  while (daySet.has(cursor)) {
    count += 1;
    cursor = addDaysYmd(cursor, -1);
  }
  return count;
}

// Longest consecutive-day run anywhere in the set.
export function longestDailyStreak(daySet: Set<string>): number {
  if (daySet.size === 0) return 0;
  const sorted = Array.from(daySet).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (diffYmdDays(sorted[i], sorted[i - 1]) === 1) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return longest;
}
