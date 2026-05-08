import { addDaysYmd, getAppDayRange, toAppYmd } from "@/lib/dates";

export function getWeekBoundsSunday(date: Date) {
  const todayYmd = toAppYmd(date);
  const day = new Date(`${todayYmd}T00:00:00.000Z`).getUTCDay();
  const startYmd = addDaysYmd(todayYmd, -day);
  const start = getAppDayRange(startYmd).start;
  const end = getAppDayRange(addDaysYmd(startYmd, 7)).start;
  return { start, end, startYmd };
}

/** Returns the Monday-aligned start of the given date's week, in local time
 *  (midnight). Used by activity-world pulse + heatmap aggregates. */
export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns midnight `days` days before `now`, in local time. */
export function daysAgoMidnight(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}
