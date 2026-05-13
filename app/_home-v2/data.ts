// Server-only data assembly for HomePageV2. Fetches everything the v2 shell
// needs and returns a single flat HomeV2Data bag. Keeps the page component
// itself thin (just renders) and isolates the (necessarily long) Prisma
// queries here.

import { prisma } from "@/lib/prisma";
import { addDaysYmd, diffYmdDays, toAppYmd, todayAppYmd } from "@/lib/dates";
import {
  effectiveRoutineDomain,
  type RoutineDomain,
} from "@/lib/routines";
import {
  computeFrequencyState,
  isExpectedDay,
  type FrequencyTarget,
} from "@/lib/frequency-state";
import {
  routineWithFrequencyTarget,
  shouldAutoScheduleRoutine,
  isRoutineAutoScheduledOnDay,
} from "@/lib/routine-frequency";
import { getAllZonesWithState } from "@/lib/body-zones";
import { getWeekBoundsSunday } from "@/lib/week";
import { getMovementPatternData } from "./movement-patterns";
import type {
  BodyChipStatus,
  DayTodo,
  DomainSeries,
  DomainTone,
  DomainWeek,
  HabitChipStatus,
  HabitRow,
  HomeV2Data,
  LegacyGlanceDay,
  QuickPickRoutine,
  WeekChipStatus,
} from "./types";
import { DOMAIN_LABEL } from "./tokens";

const HABIT_GRID_DAYS = 30;
const DOMAIN_WEEKS = 8;
const WAG_WEEKS = 12;       // weeks of history shown in the scrollable WaG rail
const WAG_FORWARD_DAYS = 3; // extra days past today shown at the right edge

const DOMAIN_ORDER: DomainTone[] = ["strength", "cardio", "mobility", "sport", "lifestyle"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabelOf(ymd: string): string {
  return DAY_LABELS[new Date(`${ymd}T00:00:00.000Z`).getUTCDay()];
}

function dayNumberOf(ymd: string): string {
  return String(Number(ymd.slice(-2)));
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export async function getHomeV2Data(): Promise<HomeV2Data> {
  const today = todayAppYmd();
  const habitWindowStart = addDaysYmd(today, -(HABIT_GRID_DAYS - 1));
  const weekBounds = getWeekBoundsSunday(new Date());
  const currentWeekStart = weekBounds.startYmd;
  const wagStart = addDaysYmd(currentWeekStart, -(WAG_WEEKS - 1) * 7);
  const wagEnd = addDaysYmd(currentWeekStart, 6 + WAG_FORWARD_DAYS); // current week end + forward days
  // 8 calendar weeks ending in the current week (current week = index 7, oldest = index 0).
  const sparkStart = addDaysYmd(currentWeekStart, -(DOMAIN_WEEKS - 1) * 7);

  // Widest log window we need to cover: spark, WaG, and habit grid.
  const widestStart = [sparkStart, wagStart, habitWindowStart].sort()[0];

  const [
    routines,
    allLogs,
    dayTodosRaw,
    planEntriesRaw,
    manualEntriesRaw,
    zoneStates,
    movementPatterns,
  ] = await Promise.all([
    prisma.routine.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
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
    prisma.routineLog.findMany({
      where: {
        performedAt: {
          gte: new Date(`${widestStart}T00:00:00.000Z`),
          lt: new Date(`${addDaysYmd(wagEnd, 1)}T00:00:00.000Z`),
        },
      },
      orderBy: { performedAt: "asc" },
      select: {
        id: true,
        routineId: true,
        performedAt: true,
        routine: { select: { id: true, name: true, kind: true, domain: true, subtype: true } },
      },
    }),
    prisma.dayTodo.findMany({
      where: { ymd: { gte: wagStart, lte: wagEnd } },
      orderBy: [{ done: "asc" }, { createdAt: "asc" }],
      select: { id: true, ymd: true, label: true, done: true },
    }),
    prisma.$queryRawUnsafe<Array<{ routineId: string; dayOffset: number; sortOrder: number; startDate: string; cycleLengthDays: number }>>(
      'SELECT e."routineId", e."dayOffset", e."sortOrder", a."startDate", p."cycleLengthDays" FROM "ScheduleEntry" e INNER JOIN "SchedulePlanActivation" a ON a."schedulePlanId" = e."schedulePlanId" INNER JOIN "SchedulePlan" p ON p."id" = e."schedulePlanId" WHERE a."isEnabled" = true'
    ),
    prisma.$queryRawUnsafe<Array<{ routineId: string; scheduledDate: string; sortOrder: number }>>(
      'SELECT "routineId","scheduledDate","sortOrder" FROM "ScheduleManualEntry"'
    ),
    getAllZonesWithState().catch(() => []),
    getMovementPatternData().catch(() => ({
      weekStarts: [] as string[],
      patterns: [] as Awaited<ReturnType<typeof getMovementPatternData>>["patterns"],
      summary: { strong: 0, ok: 0, lacking: 0, absent: 0 },
      headline: "no pattern data yet",
    })),
  ]);

  const routinesWithTargets = routines.map(routineWithFrequencyTarget);
  const routineMap = new Map(routinesWithTargets.map((r) => [r.id, r]));

  // ── Plan-for-day builder (manual + cycle entries, plus daily-habit auto-schedule) ──
  const cycleEntries = planEntriesRaw.map((entry) => ({
    routineId: entry.routineId,
    dayOffset: Number(entry.dayOffset),
    startDate: toAppYmd(new Date(entry.startDate)),
    cycleLengthDays: Number(entry.cycleLengthDays),
  }));
  const manualByDay = new Map<string, string[]>();
  for (const entry of manualEntriesRaw) {
    const ymd = toAppYmd(new Date(entry.scheduledDate));
    if (!manualByDay.has(ymd)) manualByDay.set(ymd, []);
    manualByDay.get(ymd)!.push(entry.routineId);
  }
  // Routines that auto-schedule (daily, week-with-mask, week/1 count=7).
  // Use the shared helper so weekday masks and edge-cases are handled the
  // same way they are everywhere else in the app.
  const autoScheduledRoutines = routinesWithTargets.filter((r) => shouldAutoScheduleRoutine(r));

  // All active habit-domain routines — used to surface non-auto-scheduled
  // habits (e.g. "2× per week" goals) as loggable in today's/future's detail
  // panel so the user doesn't have to navigate elsewhere to mark them done.
  const habitDomainRoutineIds = new Set<string>();
  for (const r of routinesWithTargets) {
    if (effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "lifestyle") {
      habitDomainRoutineIds.add(r.id);
    }
  }

  function plannedRoutineIdsForDay(ymd: string): Set<string> {
    const set = new Set<string>(manualByDay.get(ymd) ?? []);
    for (const cycle of cycleEntries) {
      if (cycle.cycleLengthDays <= 0) continue;
      const diff = diffYmdDays(ymd, cycle.startDate);
      if (diff < 0) continue;
      if (diff % cycle.cycleLengthDays === cycle.dayOffset) set.add(cycle.routineId);
    }
    for (const r of autoScheduledRoutines) {
      if (isRoutineAutoScheduledOnDay(r, ymd, null)) set.add(r.id);
    }
    return set;
  }

  // ── Logs grouped by ymd + routineId ──────────────────────────────────────
  const logsByYmd = new Map<string, typeof allLogs>();
  const logsByRoutine = new Map<string, Array<{ performedAt: Date }>>();
  for (const log of allLogs) {
    const ymd = toAppYmd(log.performedAt);
    if (!logsByYmd.has(ymd)) logsByYmd.set(ymd, []);
    logsByYmd.get(ymd)!.push(log);
    if (!logsByRoutine.has(log.routineId)) logsByRoutine.set(log.routineId, []);
    logsByRoutine.get(log.routineId)!.push({ performedAt: log.performedAt });
  }

  // ── Todos grouped by ymd ─────────────────────────────────────────────────
  const todosByYmd = new Map<string, DayTodo[]>();
  for (const todo of dayTodosRaw) {
    if (!todosByYmd.has(todo.ymd)) todosByYmd.set(todo.ymd, []);
    todosByYmd.get(todo.ymd)!.push(todo);
  }

  // ── Legacy-shape WaG days (the scrollable rail consumes this) ────────────
  // 12 weeks of history + the current week + WAG_FORWARD_DAYS upcoming days.
  // Each day exposes planned[], logs[], habitAggregate, todos[].
  const wagDayCount = WAG_WEEKS * 7 + WAG_FORWARD_DAYS;
  const habitRoutines = routinesWithTargets.filter(
    (r) => effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "lifestyle"
  );
  const habitTargetById = new Map<string, FrequencyTarget | null>();
  for (const h of habitRoutines) {
    // Skip SUBSTITUTE links — those belong to another routine's goal and
    // would otherwise hijack this routine's "primary" cadence.
    const goal = h.frequencyGoalRoutines.find((rel) => rel.role !== "SUBSTITUTE" && rel.goal?.isActive)?.goal ?? null;
    habitTargetById.set(h.id, goal
      ? { targetCount: goal.targetCount, targetInterval: goal.targetInterval, targetUnit: goal.targetUnit, weekdayMask: goal.weekdayMask ?? null }
      : null);
  }
  const habitCreatedYmdById = new Map<string, string>(habitRoutines.map((h) => [h.id, toAppYmd(h.createdAt)]));

  // Substitute routines per habit: which other routines, when logged, count
  // as covering this habit's day. Stored on the habit's `fg_<id>` goal as
  // SUBSTITUTE join rows. Pulled in one query so the habit grid can render
  // covered days and the daily aggregate can credit covered completions.
  const habitGoalIds = habitRoutines.map((h) => `fg_${h.id}`);
  const substituteLinks = habitGoalIds.length > 0
    ? await prisma.frequencyGoalRoutine.findMany({
        where: { goalId: { in: habitGoalIds }, role: "SUBSTITUTE" },
        select: { goalId: true, routineId: true },
      })
    : [];
  const substituteRoutineIdsByHabitId = new Map<string, string[]>();
  for (const link of substituteLinks) {
    const habitId = link.goalId.startsWith("fg_") ? link.goalId.slice(3) : link.goalId;
    const list = substituteRoutineIdsByHabitId.get(habitId) ?? [];
    list.push(link.routineId);
    substituteRoutineIdsByHabitId.set(habitId, list);
  }

  // Day sets per habit:
  //  - habitLogYmdsById: union of own logs + substitute logs (used by daily
  //    aggregate to credit a habit as completed when a substitute fired).
  //  - habitCoveredYmdsById: ONLY substitute logs on days the habit itself
  //    wasn't logged (used by the legacy aggregate to optionally surface
  //    covered counts later — currently informational).
  const habitLogYmdsById = new Map<string, Set<string>>();
  for (const h of habitRoutines) {
    const set = new Set<string>();
    for (const log of logsByRoutine.get(h.id) ?? []) set.add(toAppYmd(log.performedAt));
    for (const subId of substituteRoutineIdsByHabitId.get(h.id) ?? []) {
      for (const log of logsByRoutine.get(subId) ?? []) set.add(toAppYmd(log.performedAt));
    }
    habitLogYmdsById.set(h.id, set);
  }

  const legacyGlanceDays: LegacyGlanceDay[] = [];
  for (let i = 0; i < wagDayCount; i++) {
    const ymd = addDaysYmd(wagStart, i);
    const plannedIds = plannedRoutineIdsForDay(ymd);
    const dayLogs = logsByYmd.get(ymd) ?? [];

    // Build planned list. For past/today days, also surface any logged-but-unplanned routine.
    const plannedMap = new Map<string, {
      routineId: string;
      routineName: string;
      kind: string;
      domain: RoutineDomain;
      planned: number;
      logged: number;
    }>();
    for (const rid of plannedIds) {
      const r = routineMap.get(rid);
      if (!r) continue;
      plannedMap.set(rid, {
        routineId: rid,
        routineName: r.name,
        kind: r.kind,
        domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
        planned: 1,
        logged: 0,
      });
    }
    for (const log of dayLogs) {
      const existing = plannedMap.get(log.routineId);
      if (existing) {
        existing.logged += 1;
      } else if (ymd <= today) {
        const r = routineMap.get(log.routineId);
        if (r) {
          plannedMap.set(log.routineId, {
            routineId: log.routineId,
            routineName: r.name,
            kind: r.kind,
            domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
            planned: 0,
            logged: 1,
          });
        }
      }
    }
    const planned = Array.from(plannedMap.values()).sort(
      (a, b) => (b.logged + b.planned) - (a.logged + a.planned) || a.routineName.localeCompare(b.routineName)
    );
    const logs = dayLogs.map((log) => ({
      id: log.id,
      routineId: log.routineId,
      routineName: log.routine.name,
      kind: log.routine.kind,
      domain: effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype),
    }));

    // Habit aggregate (past/today only).
    let habitExpected = 0;
    let habitCompleted = 0;
    if (ymd <= today) {
      for (const h of habitRoutines) {
        if ((habitCreatedYmdById.get(h.id) ?? ymd) > ymd) continue;
        const target = habitTargetById.get(h.id) ?? null;
        if (!isExpectedDay(target, ymd)) continue;
        habitExpected++;
        if (habitLogYmdsById.get(h.id)?.has(ymd)) habitCompleted++;
      }
    }

    // Available habits — every active habit-domain routine that isn't
    // already on this day's plan and hasn't been logged today. Only computed
    // for today + future, since past days only need to show what actually
    // happened. The detail panel surfaces these with a Log button so users
    // can mark a non-scheduled habit done inline.
    const availableHabits: LegacyGlanceDay["availableHabits"] = ymd >= today
      ? Array.from(habitDomainRoutineIds)
          .filter((rid) => !plannedMap.has(rid))
          .map((rid) => routineMap.get(rid))
          .filter((r): r is NonNullable<typeof r> => Boolean(r))
          .map((r) => ({
            routineId: r.id,
            routineName: r.name,
            kind: r.kind,
            domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
          }))
          .sort((a, b) => a.routineName.localeCompare(b.routineName))
      : [];

    legacyGlanceDays.push({
      ymd,
      label: dayLabelOf(ymd),
      dayNumber: dayNumberOf(ymd),
      planned,
      logs,
      habitAggregate: { expected: habitExpected, completed: habitCompleted },
      todos: todosByYmd.get(ymd) ?? [],
      availableHabits,
    });
  }

  // ── Habit rows ───────────────────────────────────────────────────────────
  const habitRows: HabitRow[] = habitRoutines.map((routine) => {
    const target = habitTargetById.get(routine.id) ?? null;
    // Combine own logs (PRIMARY) with substitute logs so days only covered
    // by a substitute render sky-blue rather than red.
    const ownLogs = (logsByRoutine.get(routine.id) ?? []).map((log) => ({
      performedAt: log.performedAt,
      isPrimary: true,
    }));
    const subLogs = (substituteRoutineIdsByHabitId.get(routine.id) ?? []).flatMap((subId) =>
      (logsByRoutine.get(subId) ?? []).map((log) => ({
        performedAt: log.performedAt,
        isPrimary: false,
      }))
    );
    const logs = [...ownLogs, ...subLogs];
    const state = computeFrequencyState({ target, logs, today, trailingDays: HABIT_GRID_DAYS });
    const trailing30: HabitRow["trailing30"] = [];
    for (let i = 0; i < HABIT_GRID_DAYS; i++) {
      const ymd = addDaysYmd(habitWindowStart, i);
      trailing30.push({ ymd, state: state.dailyState[ymd] ?? (ymd > today ? "future" : "rest") });
    }
    let weekTarget = 0;
    let weekProgress = 0;
    for (let i = 0; i < 7; i++) {
      const ymd = addDaysYmd(currentWeekStart, i);
      if (ymd > today) continue;
      const expected = isExpectedDay(target, ymd);
      if (expected) weekTarget++;
      if (expected && state.dailyState[ymd] === "done") weekProgress++;
    }
    return {
      routineId: routine.id,
      routineName: routine.name,
      domain: "lifestyle",
      state,
      target,
      trailing30,
      currentStreak: state.currentDayStreak || state.windowStreak,
      longestStreak: Math.max(state.longestDayStreak, state.longestWindowStreak),
      weekFraction: { progress: weekProgress, target: Math.max(weekTarget, 0) },
      status: state.currentWindow.status,
    };
  });
  // Sort: at-risk first, then by streak desc
  const statusRank: Record<HabitRow["status"], number> = {
    at_risk: 0, behind: 1, on_track: 2, ahead: 3, complete: 4,
  };
  habitRows.sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    return a.routineName.localeCompare(b.routineName);
  });

  // ── Domain series (8 weeks per domain) ───────────────────────────────────
  const weekStarts: string[] = [];
  for (let i = 0; i < DOMAIN_WEEKS; i++) {
    weekStarts.push(addDaysYmd(sparkStart, i * 7));
  }
  const domainSeries: DomainSeries[] = DOMAIN_ORDER.map((domain) => {
    const weeks: DomainWeek[] = weekStarts.map((weekStartYmd) => {
      const weekEndYmd = addDaysYmd(weekStartYmd, 6);
      const logsInWeek = allLogs.filter((log) => {
        if (effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype) !== domain) return false;
        const ymd = toAppYmd(log.performedAt);
        return ymd >= weekStartYmd && ymd <= weekEndYmd;
      });
      return {
        weekStartYmd,
        weekEndYmd,
        count: logsInWeek.length,
        logs: logsInWeek.map((log) => ({
          logId: log.id,
          routineId: log.routineId,
          routineName: log.routine.name,
          performedYmd: toAppYmd(log.performedAt),
          performedTimeLabel: timeLabel(log.performedAt),
        })),
      };
    });
    return {
      domain,
      label: DOMAIN_LABEL[domain] ?? domain,
      totalThisWeek: weeks[weeks.length - 1]?.count ?? 0,
      weeks,
    };
  }).filter((series) => series.weeks.some((w) => w.count > 0));

  // ── Ambient chip statuses ────────────────────────────────────────────────
  let injuredCount = 0;
  let recoveringCount = 0;
  for (const zone of zoneStates) {
    if (zone.freshness === "INJURED") injuredCount++;
    else if (zone.freshness === "RECOVERING") recoveringCount++;
  }
  const bodyChip: BodyChipStatus = injuredCount > 0
    ? {
        tone: "injured",
        primaryLabel: `${injuredCount} active`,
        secondaryLabel: recoveringCount > 0 ? `${recoveringCount} recovering` : "see details",
      }
    : recoveringCount > 0
    ? {
        tone: "recovering",
        primaryLabel: `${recoveringCount} recovering`,
        secondaryLabel: "no injuries",
      }
    : { tone: "clear", primaryLabel: "all clear", secondaryLabel: "no flags" };

  const bestStreak = habitRows.find((h) => h.currentStreak > 0);
  // Find an at-risk habit that's NOT the same as bestStreak — otherwise the
  // chip's "warn" line silently vanished when the only at-risk habit was also
  // the one with the longest active streak.
  const atRisk = habitRows.find(
    (h) =>
      (h.status === "at_risk" || h.status === "behind") &&
      h.routineId !== bestStreak?.routineId
  );
  const habitChip: HabitChipStatus = {
    bestStreakName: bestStreak?.routineName ?? null,
    bestStreakLabel: bestStreak ? `${bestStreak.currentStreak}d` : null,
    atRiskName: atRisk?.routineName ?? null,
    atRiskLabel: atRisk
      ? `${atRisk.weekFraction.progress}/${Math.max(atRisk.weekFraction.target, atRisk.weekFraction.progress + 1)}`
      : null,
  };

  // ── Week chip (planned vs done for current calendar week) ────────────────
  let weekPlannedDone = 0;
  let weekPlannedTotal = 0;
  for (let i = 0; i < 7; i++) {
    const ymd = addDaysYmd(currentWeekStart, i);
    const planned = plannedRoutineIdsForDay(ymd);
    weekPlannedTotal += planned.size;
    if (ymd > today) continue;
    const dayLogs = logsByYmd.get(ymd) ?? [];
    const loggedRoutineSet = new Set(dayLogs.map((l) => l.routineId));
    for (const rid of planned) if (loggedRoutineSet.has(rid)) weekPlannedDone++;
  }
  const pace: WeekChipStatus["paceLabel"] =
    weekPlannedTotal === 0
      ? "starting"
      : weekPlannedDone >= weekPlannedTotal
      ? "complete"
      : (() => {
          // Linear pace expectation: how many days into the week elapsed,
          // proportional to the planned total.
          const daysElapsed = Math.min(
            7,
            Math.max(1, diffYmdDays(today, currentWeekStart) + 1)
          );
          const expectedByNow = (daysElapsed / 7) * weekPlannedTotal;
          if (weekPlannedDone >= expectedByNow + 0.5) return "ahead";
          if (weekPlannedDone >= expectedByNow - 0.5) return "on track";
          return "behind";
        })();
  const weekChip: WeekChipStatus = {
    done: weekPlannedDone,
    planned: weekPlannedTotal,
    paceLabel: pace,
    fillPercent: weekPlannedTotal > 0 ? Math.min(100, Math.round((weekPlannedDone / weekPlannedTotal) * 100)) : 0,
  };

  // ── Quick-pick routines for the FAB ──────────────────────────────────────
  const quickPickRoutines: QuickPickRoutine[] = routinesWithTargets
    .map((r) => ({
      routineId: r.id,
      routineName: r.name,
      domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
      kind: r.kind,
    }))
    .sort((a, b) => a.routineName.localeCompare(b.routineName));

  return {
    today,
    currentWeekStart,
    legacyGlanceDays,
    habitRows,
    domainSeries,
    movementPatterns,
    bodyChip,
    habitChip,
    weekChip,
    quickPickRoutines,
  };
}

// Re-export for callers that want to filter by domain.
export function isDomainTone(value: string): value is DomainTone {
  return value === "strength" || value === "cardio" || value === "mobility" || value === "sport" || value === "lifestyle";
}

// Note: client components should import `domainColor` directly from
// "@/lib/routines" via client-utils.ts — this server-side data module pulls
// in prisma and is not safe to re-export from.

// Re-export the RoutineDomain enum type for callers.
export type { RoutineDomain };
