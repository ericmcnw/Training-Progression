// Period model for the Reports hub (/reports/week · /month · /year).
//
// One job: turn a URL anchor (?week=YYYY-MM-DD / ?month=YYYY-MM / ?year=YYYY)
// into a resolved calendar period with UTC query bounds, a human label, and
// prev/next navigation anchors. Pure date math, composed over the proven
// app-timezone primitives in lib/dates + lib/week — nothing here reimplements
// timezone handling.
//
// Data-agnostic by design: `nextKey` is null when the next period would be in
// the future (a pure calendar fact), but the lower bound (don't page before
// the first-ever log) is the page's concern, not this module's — it has no DB
// access and shouldn't.

import { addDaysYmd, formatUtcDateLabel, getAppDayRange, toAppYmd } from "@/lib/dates";
import { getWeekBoundsSunday } from "@/lib/week";

export const PERIOD_KINDS = ["week", "month", "year"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export type Period = {
  kind: PeriodKind;
  /** Canonical anchor for this period's URL query param. */
  key: string;
  /** Inclusive UTC instant — usable directly as a Prisma `gte`. */
  start: Date;
  /** Exclusive UTC instant — usable directly as a Prisma `lt`. */
  end: Date;
  /** Human label, e.g. "Jun 22 – 28, 2026" / "June 2026" / "2026". */
  label: string;
  /** Anchor for the previous period (always present — clamping the past is the page's job). */
  prevKey: string;
  /** Anchor for the next period, or null when next would be in the future. */
  nextKey: string | null;
  /** True when this period contains today (app timezone). */
  isCurrent: boolean;
};

export function isPeriodKind(value: string): value is PeriodKind {
  return (PERIOD_KINDS as readonly string[]).includes(value);
}

export function resolvePeriod(
  kind: PeriodKind,
  anchor: string | undefined,
  now: Date = new Date()
): Period {
  switch (kind) {
    case "week":
      return resolveWeek(anchor, now);
    case "month":
      return resolveMonth(anchor, now);
    case "year":
      return resolveYear(anchor, now);
  }
}

// ── Week (Sun–Sat) ──────────────────────────────────────────────────────────

function resolveWeek(anchor: string | undefined, now: Date): Period {
  const curStart = getWeekBoundsSunday(now).startYmd;

  let startYmd: string;
  const parsed = parseYmd(anchor);
  if (parsed) {
    // Normalize any in-week day to its Sunday, then clamp a future week back.
    startYmd = getWeekBoundsSunday(getAppDayRange(parsed).start).startYmd;
    if (startYmd > curStart) startYmd = curStart;
  } else {
    startYmd = curStart;
  }

  const { start, end } = getWeekBoundsSunday(getAppDayRange(startYmd).start);
  const endYmd = addDaysYmd(startYmd, 6); // Saturday
  const isCurrent = startYmd === curStart;

  return {
    kind: "week",
    key: startYmd,
    start,
    end,
    label: weekLabel(startYmd, endYmd),
    prevKey: addDaysYmd(startYmd, -7),
    nextKey: isCurrent ? null : addDaysYmd(startYmd, 7),
    isCurrent,
  };
}

function weekLabel(startYmd: string, endYmd: string): string {
  const sMonth = formatUtcDateLabel(startYmd, { month: "short" });
  const sDay = formatUtcDateLabel(startYmd, { day: "numeric" });
  const eMonth = formatUtcDateLabel(endYmd, { month: "short" });
  const eDay = formatUtcDateLabel(endYmd, { day: "numeric" });
  const sYear = startYmd.slice(0, 4);
  const eYear = endYmd.slice(0, 4);

  if (sYear !== eYear) return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${eYear}`;
  if (sMonth !== eMonth) return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${eYear}`;
  return `${sMonth} ${sDay} – ${eDay}, ${eYear}`;
}

// ── Month ───────────────────────────────────────────────────────────────────

function resolveMonth(anchor: string | undefined, now: Date): Period {
  const curKey = toAppYmd(now).slice(0, 7);
  let key = parseMonth(anchor) ?? curKey;
  if (key > curKey) key = curKey;

  const start = getAppDayRange(`${key}-01`).start;
  const end = getAppDayRange(`${shiftMonth(key, 1)}-01`).start;
  const isCurrent = key === curKey;

  return {
    kind: "month",
    key,
    start,
    end,
    label: formatUtcDateLabel(`${key}-01`, { month: "long", year: "numeric" }),
    prevKey: shiftMonth(key, -1),
    nextKey: isCurrent ? null : shiftMonth(key, 1),
    isCurrent,
  };
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

// ── Year ────────────────────────────────────────────────────────────────────

function resolveYear(anchor: string | undefined, now: Date): Period {
  const curYear = Number(toAppYmd(now).slice(0, 4));
  let y = parseYear(anchor) ?? curYear;
  if (y > curYear) y = curYear;

  const start = getAppDayRange(`${y}-01-01`).start;
  const end = getAppDayRange(`${y + 1}-01-01`).start;
  const isCurrent = y === curYear;

  return {
    kind: "year",
    key: String(y),
    start,
    end,
    label: String(y),
    prevKey: String(y - 1),
    nextKey: isCurrent ? null : String(y + 1),
    isCurrent,
  };
}

// ── Anchor parsing (boundary validation — reject junk query params) ──────────

function parseYmd(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return toAppYmd(getAppDayRange(value).start) === value ? value : null;
}

function parseMonth(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const m = Number(value.slice(5, 7));
  return m >= 1 && m <= 12 ? value : null;
}

function parseYear(value: string | undefined): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const y = Number(value);
  return y >= 2000 && y <= 2100 ? y : null;
}
