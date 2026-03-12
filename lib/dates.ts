export const APP_TIME_ZONE = "America/New_York";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parseOffsetToMinutes(offsetText: string) {
  if (offsetText === "GMT" || offsetText === "UTC") return 0;

  const match = offsetText.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    throw new Error(`Unsupported timezone offset: ${offsetText}`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function getOffsetMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const offset = parts.find((part) => part.type === "timeZoneName")?.value;
  if (!offset) throw new Error("Unable to resolve timezone offset.");
  return parseOffsetToMinutes(offset);
}

function zonedTimeToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  const baseUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  let utcMs = baseUtc;

  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getOffsetMinutes(new Date(utcMs)) * 60_000;
    const nextUtcMs = baseUtc - offsetMs;
    if (nextUtcMs === utcMs) break;
    utcMs = nextUtcMs;
  }

  return new Date(utcMs);
}

export function toAppYmd(value: Date | string) {
  return ymdFormatter.format(value instanceof Date ? value : new Date(value));
}

export function todayAppYmd(now = new Date()) {
  return toAppYmd(now);
}

export function addDaysYmd(ymd: string, plus: number) {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + plus);
  return date.toISOString().slice(0, 10);
}

export function diffYmdDays(a: string, b: string) {
  const at = new Date(`${a}T00:00:00.000Z`).getTime();
  const bt = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.floor((at - bt) / 86_400_000);
}

export function getAppDayRange(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  const start = zonedTimeToUtc(year, month, day, 0, 0, 0);
  const nextDay = addDaysYmd(ymd, 1);
  const [nextYear, nextMonth, nextDate] = nextDay.split("-").map(Number);
  const end = zonedTimeToUtc(nextYear, nextMonth, nextDate, 0, 0, 0);
  return { start, end };
}

export function formatUtcDateLabel(
  ymd: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
) {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
}

export function formatAppDate(value: Date | string, options: Intl.DateTimeFormatOptions = {}) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, { ...options, timeZone: APP_TIME_ZONE });
}

export function formatAppDateTime(value: Date | string, options: Intl.DateTimeFormatOptions = {}) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(undefined, { ...options, timeZone: APP_TIME_ZONE });
}
