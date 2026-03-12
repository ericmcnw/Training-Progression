import { addDaysYmd, getAppDayRange, toAppYmd } from "@/lib/dates";

export function getWeekBoundsSunday(date: Date) {
  const todayYmd = toAppYmd(date);
  const day = new Date(`${todayYmd}T00:00:00.000Z`).getUTCDay();
  const startYmd = addDaysYmd(todayYmd, -day);
  const start = getAppDayRange(startYmd).start;
  const end = getAppDayRange(addDaysYmd(startYmd, 7)).start;
  return { start, end, startYmd };
}
