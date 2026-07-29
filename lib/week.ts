import { addDaysYmd, getAppDayRange, toAppYmd } from "@/lib/dates";

export function getWeekBoundsSunday(date: Date) {
  const todayYmd = toAppYmd(date);
  const day = new Date(`${todayYmd}T00:00:00.000Z`).getUTCDay();
  const startYmd = addDaysYmd(todayYmd, -day);
  const start = getAppDayRange(startYmd).start;
  const end = getAppDayRange(addDaysYmd(startYmd, 7)).start;
  return { start, end, startYmd };
}

/** Monday (app-timezone) of the week containing `date`, as YYYY-MM-DD. */
export function mondayYmdOf(date: Date): string {
  const ymd = toAppYmd(date);
  const day = new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
  return addDaysYmd(ymd, day === 0 ? -6 : 1 - day);
}

/** Returns the instant the given date's Monday-aligned week starts, in the
 *  app timezone. Used by activity-world pulse + heatmap aggregates.
 *  App-tz midnight sits at 04:00/05:00 UTC, so `.toISOString().slice(0,10)`
 *  on the result still yields the Monday's calendar date — callers that
 *  build week keys that way stay correct. */
export function startOfWeekMonday(date: Date): Date {
  return getAppDayRange(mondayYmdOf(date)).start;
}

/** Returns the app-timezone start of the day `days` days before `now`. */
export function daysAgoMidnight(now: Date, days: number): Date {
  return getAppDayRange(addDaysYmd(toAppYmd(now), -days)).start;
}
