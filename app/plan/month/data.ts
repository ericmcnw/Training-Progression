// Server data fetch for the Plan / Month tab. Computes a per-day view of
// what fired in a given calendar month: routines (manually scheduled,
// cycle-scheduled, or auto-scheduled by frequency goal) plus logged
// routines, plus rolled-up month stats.
//
// Returns a flat serializable bag the client components render. Loose
// inspiration from app/_home/data.ts's legacyGlanceDays builder, but
// scoped to a single calendar month rather than 12 weeks of WaG history.

import { prisma } from "@/lib/prisma";
import { addDaysYmd, getAppDayRange, toAppYmd, todayAppYmd } from "@/lib/dates";
import { effectiveRoutineDomain } from "@/lib/routines";
import type { RoutineDomain } from "@/lib/routines";
import {
  routineWithFrequencyTarget,
  shouldAutoScheduleRoutine,
  isRoutineAutoScheduledOnDay,
} from "@/lib/routine-frequency";

export type DayEntryStatus = "done" | "partial" | "planned" | "missed" | "future" | "loggedExtra";

export type DayEntry = {
  routineId: string;
  routineName: string;
  domain: RoutineDomain;
  planned: number;
  logged: number;
  status: DayEntryStatus;
  latestLogId: string | null;
  // True when this routine is a daily-firing frequency goal (DAY/1, WEEK/7,
  // or weekday-mask). The calendar aggregates these into a single "habits"
  // pill per cell so a user with 5+ daily habits doesn't see identical dot
  // patterns on every day. false = workout-style routine (strength run,
  // cardio session, etc.) which still gets an individual dot.
  isHabit: boolean;
};

export type MonthDayCell = {
  ymd: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  entries: DayEntry[];
};

export type MonthData = {
  today: string;
  monthYmd: string;            // "2026-05"
  monthLabel: string;          // "May 2026"
  monthStart: string;          // "2026-05-01"
  monthEnd: string;            // "2026-05-31"
  prevMonthYmd: string;        // "2026-04"
  nextMonthYmd: string;        // "2026-06"
  leadingEmpty: number;        // empty cells before day 1 (0–6 = Sun-anchored)
  trailingEmpty: number;       // empty cells after the last day to round the grid
  days: MonthDayCell[];        // length = daysInMonth, oldest → newest
  stats: {
    daysLogged: number;        // past+today days with at least one log
    daysWithActivity: number;  // total past+today days the user could've logged on
    totalSessions: number;     // total log count in the month
    topDomain: string | null;  // domain label with most sessions ("Strength")
    activeCycles: number;      // count of SchedulePlanActivation rows with isEnabled
  };
};

function isMonthParam(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}

function monthFromYmd(ymd: string) {
  return ymd.slice(0, 7);
}

function startOfMonth(monthYmd: string) {
  return `${monthYmd}-01`;
}

function addMonths(monthYmd: string, delta: number) {
  const d = new Date(`${monthYmd}-01T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

function formatMonthLabel(monthYmd: string) {
  return new Date(`${monthYmd}-01T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function weekdayIndex(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
}

// Domain → display label used by the "Top domain" stat. Centralized so the
// label matches what Home shows in DomainSparklines (Endurance, etc.).
const DOMAIN_LABEL: Record<string, string> = {
  strength: "Strength",
  cardio: "Endurance",
  mobility: "Mobility",
  sport: "Sport",
  lifestyle: "Lifestyle",
};

export async function getMonthData(rawMonth: string | undefined): Promise<MonthData> {
  const today = todayAppYmd();
  const monthYmd = isMonthParam(rawMonth) ? rawMonth : monthFromYmd(today);
  const monthStart = startOfMonth(monthYmd);
  const monthEndExclusive = startOfMonth(addMonths(monthYmd, 1));
  // monthEnd is inclusive — the last day of the month.
  const monthEnd = addDaysYmd(monthEndExclusive, -1);

  // ── Queries ─────────────────────────────────────────────────────────────
  const [rawRoutines, manualRaw, logsRaw, planEntriesRaw, activeCyclesRaw] = await Promise.all([
    prisma.routine.findMany({
      where: { isDeleted: false, isPlaceholder: false, isActive: true },
      include: {
        frequencyGoalRoutines: {
          include: {
            goal: {
              select: {
                id: true,
                isActive: true,
                targetCount: true,
                targetInterval: true,
                targetUnit: true,
                weekdayMask: true,
              },
            },
          },
        },
      },
    }),
    prisma.scheduleManualEntry.findMany({
      where: {
        scheduledDate: {
          gte: getAppDayRange(monthStart).start,
          lt: getAppDayRange(monthEndExclusive).start,
        },
      },
      orderBy: [{ scheduledDate: "asc" }, { sortOrder: "asc" }],
      select: { id: true, routineId: true, scheduledDate: true, sortOrder: true },
    }),
    prisma.routineLog.findMany({
      where: {
        performedAt: {
          gte: getAppDayRange(monthStart).start,
          lt: getAppDayRange(monthEndExclusive).start,
        },
      },
      orderBy: { performedAt: "asc" },
      select: {
        id: true,
        routineId: true,
        performedAt: true,
        routine: { select: { name: true, domain: true, kind: true, subtype: true } },
      },
    }),
    prisma.$queryRawUnsafe<Array<{ routineId: string; dayOffset: number; startDate: Date; cycleLengthDays: number }>>(
      'SELECT e."routineId", e."dayOffset", a."startDate", p."cycleLengthDays" FROM "ScheduleEntry" e INNER JOIN "SchedulePlanActivation" a ON a."schedulePlanId" = e."schedulePlanId" INNER JOIN "SchedulePlan" p ON p."id" = e."schedulePlanId" WHERE a."isEnabled" = true'
    ),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*) as count FROM "SchedulePlanActivation" WHERE "isEnabled" = true'
    ),
  ]);

  // ── Build maps ──────────────────────────────────────────────────────────
  const routines = rawRoutines.map(routineWithFrequencyTarget);
  const routineMap = new Map(routines.map((r) => [r.id, r]));
  const autoScheduledRoutines = routines.filter((r) => shouldAutoScheduleRoutine(r));

  const manualByDay = new Map<string, string[]>();
  for (const entry of manualRaw) {
    const ymd = toAppYmd(entry.scheduledDate);
    if (!manualByDay.has(ymd)) manualByDay.set(ymd, []);
    manualByDay.get(ymd)!.push(entry.routineId);
  }

  const cycleEntries = planEntriesRaw.map((entry) => ({
    routineId: entry.routineId,
    dayOffset: Number(entry.dayOffset),
    startDate: toAppYmd(new Date(entry.startDate)),
    cycleLengthDays: Number(entry.cycleLengthDays),
  }));

  // logs grouped: per-day map of routineId → { count, latestLogId }
  type LogBucket = { count: number; latestLogId: string };
  const logsByDayByRoutine = new Map<string, Map<string, LogBucket>>();
  const totalsByDomain = new Map<string, number>();
  const daysLoggedSet = new Set<string>();
  let totalSessions = 0;

  for (const log of logsRaw) {
    const ymd = toAppYmd(log.performedAt);
    daysLoggedSet.add(ymd);
    totalSessions++;
    const domain = effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype);
    totalsByDomain.set(domain, (totalsByDomain.get(domain) ?? 0) + 1);

    if (!logsByDayByRoutine.has(ymd)) logsByDayByRoutine.set(ymd, new Map());
    const dayBuckets = logsByDayByRoutine.get(ymd)!;
    const existing = dayBuckets.get(log.routineId);
    if (existing) {
      existing.count += 1;
      existing.latestLogId = log.id;
    } else {
      dayBuckets.set(log.routineId, { count: 1, latestLogId: log.id });
    }
  }

  // ── Build day cells ─────────────────────────────────────────────────────
  const daysInMonth = Number(monthEnd.slice(-2));
  const days: MonthDayCell[] = [];

  for (let i = 0; i < daysInMonth; i++) {
    const ymd = addDaysYmd(monthStart, i);
    const isToday = ymd === today;
    const isPast = ymd < today;
    const isFuture = ymd > today;
    const dayLogs = logsByDayByRoutine.get(ymd) ?? new Map<string, LogBucket>();

    // Build plannedCounts: union of manual, cycle, auto-scheduled.
    const plannedCounts = new Map<string, number>();
    for (const rid of manualByDay.get(ymd) ?? []) {
      plannedCounts.set(rid, (plannedCounts.get(rid) ?? 0) + 1);
    }
    for (const cycle of cycleEntries) {
      if (cycle.cycleLengthDays <= 0) continue;
      const diff = Math.floor(
        (new Date(`${ymd}T00:00:00.000Z`).getTime() - new Date(`${cycle.startDate}T00:00:00.000Z`).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      if (diff < 0) continue;
      if (diff % cycle.cycleLengthDays === cycle.dayOffset) {
        plannedCounts.set(cycle.routineId, Math.max(1, plannedCounts.get(cycle.routineId) ?? 0));
      }
    }
    for (const r of autoScheduledRoutines) {
      if (isRoutineAutoScheduledOnDay(r, ymd, null)) {
        plannedCounts.set(r.id, Math.max(1, plannedCounts.get(r.id) ?? 0));
      }
    }
    // Surface logged-but-unplanned routines on past/today days.
    if (!isFuture) {
      for (const rid of dayLogs.keys()) {
        if (!plannedCounts.has(rid)) plannedCounts.set(rid, 0);
      }
    }

    const entries: DayEntry[] = [];
    for (const [routineId, plannedCount] of plannedCounts.entries()) {
      const r = routineMap.get(routineId);
      if (!r) continue;
      const bucket = dayLogs.get(routineId);
      const loggedCount = bucket?.count ?? 0;
      const latestLogId = bucket?.latestLogId ?? null;
      const status: DayEntryStatus = computeStatus(plannedCount, loggedCount, isPast, isFuture);
      entries.push({
        routineId,
        routineName: r.name,
        domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
        planned: plannedCount,
        logged: loggedCount,
        status,
        latestLogId,
        // shouldAutoScheduleRoutine returns true exactly when this routine
        // has a DAY/1, WEEK/7, or weekday-mask frequency goal — i.e. it
        // fires (or is expected to fire) every day. That's the lens that
        // matches the user's "daily habit" intuition for the calendar
        // pill, regardless of domain.
        isHabit: shouldAutoScheduleRoutine(r),
      });
    }

    // Order: logged-then-pending, then by name. Keeps "done" things at the
    // front of the dot strip in each cell.
    entries.sort((a, b) => {
      const aDone = a.logged > 0 ? 0 : 1;
      const bDone = b.logged > 0 ? 0 : 1;
      if (aDone !== bDone) return aDone - bDone;
      return a.routineName.localeCompare(b.routineName);
    });

    days.push({
      ymd,
      dayNumber: i + 1,
      isToday,
      isPast,
      isFuture,
      entries,
    });
  }

  // ── Layout padding (Sun-anchored) ───────────────────────────────────────
  const leadingEmpty = weekdayIndex(monthStart);
  const trailingEmpty = (7 - ((leadingEmpty + daysInMonth) % 7)) % 7;

  // ── Stats ───────────────────────────────────────────────────────────────
  const daysInPastOrToday = days.filter((d) => !d.isFuture).length;
  let topDomain: string | null = null;
  let topCount = 0;
  for (const [domain, count] of totalsByDomain.entries()) {
    if (count > topCount) {
      topCount = count;
      topDomain = DOMAIN_LABEL[domain] ?? domain;
    }
  }
  const activeCyclesCount = Number(activeCyclesRaw[0]?.count ?? 0);

  return {
    today,
    monthYmd,
    monthLabel: formatMonthLabel(monthYmd),
    monthStart,
    monthEnd,
    prevMonthYmd: addMonths(monthYmd, -1),
    nextMonthYmd: addMonths(monthYmd, 1),
    leadingEmpty,
    trailingEmpty,
    days,
    stats: {
      daysLogged: daysLoggedSet.size,
      daysWithActivity: daysInPastOrToday,
      totalSessions,
      topDomain,
      activeCycles: activeCyclesCount,
    },
  };
}

function computeStatus(
  planned: number,
  logged: number,
  isPast: boolean,
  isFuture: boolean
): DayEntryStatus {
  if (planned === 0 && logged > 0) return "loggedExtra";
  if (logged >= planned && logged > 0) return "done";
  if (logged > 0) return "partial";
  if (isFuture) return "future";
  if (isPast) return "missed";
  return "planned"; // today, nothing logged yet
}
