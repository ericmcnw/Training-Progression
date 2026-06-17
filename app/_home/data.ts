// Server-only data assembly for the home dashboard. Fetches everything
// HomeShell needs and returns a single flat HomeData bag. Keeps the page
// component itself thin (just renders) and isolates the (necessarily long)
// Prisma queries here.

import { prisma } from "@/lib/prisma";
import { addDaysYmd, diffYmdDays, toAppYmd, todayAppYmd } from "@/lib/dates";
import {
  effectiveRoutineDomain,
  type RoutineDomain,
} from "@/lib/routines";
import {
  computeFrequencyState,
  getFrequencyRenderMode,
  isExpectedDay,
  type FrequencyTarget,
} from "@/lib/frequency-state";
import { buildFrequencyGoalMembership, classifyLogAgainstFrequencyGoal } from "@/lib/frequency-goals";
import { getLogDisplayName } from "@/lib/routine-display";
import {
  routineWithFrequencyTarget,
  shouldAutoScheduleRoutine,
  isRoutineAutoScheduledOnDay,
} from "@/lib/routine-frequency";
import { getWeekBoundsSunday } from "@/lib/week";
import { getMovementPatternData } from "./movement-patterns";
import type {
  DayTodo,
  DomainSeries,
  DomainTone,
  DomainWeek,
  HabitRow,
  HomeData,
  LegacyGlanceDay,
  QuickPickRoutine,
} from "./types";
import { DOMAIN_LABEL } from "./tokens";

const HABIT_GRID_DAYS = 30;
// State window for the unified Frequency Goals card. Wide enough to cover
// the WeeklyFrequencyBars view (8 weeks = 56 days) so older weeks render
// real hit counts instead of all-zeros. The daily-grid view still slices
// out just the last HABIT_GRID_DAYS for its 30-day strip.
const FREQUENCY_STATE_DAYS = 56;
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

export async function getHomeData(): Promise<HomeData> {
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

  // TODO(perf): these queries re-run on every dashboard visit because the
  // page is `force-dynamic` and nothing here is wrapped in unstable_cache.
  // The biggest single repeat-visit win in the app. Plan + risks + initial
  // candidates in docs/perf-followups.md §1.
  const [
    routines,
    allLogs,
    dayTodosRaw,
    planEntriesRaw,
    manualEntriesRaw,
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
                // Substitute links live on the goal — pull them inline so
                // the habit grid can credit "covered" days without an
                // extra `frequencyGoalRoutine.findMany` roundtrip later.
                routines: {
                  where: { role: "SUBSTITUTE" },
                  select: { routineId: true },
                },
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
        // Exercises + routine.subtype are pulled here so the frequency-goal
        // builder below can evaluate trigger-exercise / trigger-subtype
        // matches without a second roundtrip. `_count.sets` gives us the
        // per-exercise set count for `triggerMinSets` gating without
        // hydrating every SetEntry row. activityTypeId + family carry
        // through for endurance type/family goal triggers + the
        // display-name helper (so synthetic-routine logs render as their
        // activity type name instead of literally "Endurance").
        activityTypeId: true,
        activityType: { select: { name: true, familyId: true } },
        // distanceMi + durationSec power the "Last 7 days" snapshot strip
        // — cheap to include here vs. a second roundtrip.
        distanceMi: true,
        durationSec: true,
        routine: {
          select: {
            id: true, name: true, kind: true, domain: true, subtype: true,
            // Activity type on the routine itself — used by the display-
            // name helper to resolve a name for legacy endurance routine
            // logs that don't have activityType set on the log yet.
            activityType: { select: { name: true } },
          },
        },
        exercises: {
          select: {
            exerciseId: true,
            _count: { select: { sets: true } },
          },
        },
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
    prisma.$queryRawUnsafe<Array<{ routineId: string; activityTypeId: string | null; scheduledDate: string; sortOrder: number }>>(
      'SELECT "routineId","activityTypeId","scheduledDate","sortOrder" FROM "ScheduleManualEntry"'
    ),
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
  // Manual schedule entries grouped by day. Typed endurance slots
  // (activityTypeId set) live alongside legacy routine slots — they're
  // pulled into the WaG plan list as a separate path below so a single
  // synthetic-routine schedule with two different types (Run + Hike on
  // the same day) doesn't collapse into one entry.
  const manualByDay = new Map<string, string[]>();
  const typedManualByDay = new Map<string, Array<{ routineId: string; activityTypeId: string }>>();
  for (const entry of manualEntriesRaw) {
    const ymd = toAppYmd(new Date(entry.scheduledDate));
    if (entry.activityTypeId) {
      if (!typedManualByDay.has(ymd)) typedManualByDay.set(ymd, []);
      typedManualByDay.get(ymd)!.push({ routineId: entry.routineId, activityTypeId: entry.activityTypeId });
    } else {
      if (!manualByDay.has(ymd)) manualByDay.set(ymd, []);
      manualByDay.get(ymd)!.push(entry.routineId);
    }
  }

  // Resolve activity type id → display name once so the planned-slot
  // builder below can label typed slots correctly. Loading here (not at
  // the bottom) so the lookup is available before the day-by-day plan
  // builder runs. Falls back to null if a slot references a missing
  // type (shouldn't happen — onDelete SetNull on the schedule column).
  const activityTypeNameRows = await prisma.activityType.findMany({
    select: { id: true, name: true, familyId: true },
  });
  const activityTypeNameById = new Map(
    activityTypeNameRows.map((t) => [t.id, { name: t.name, familyId: t.familyId }])
  );
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

  // Substitute routines per habit: derived from the routine query's
  // `goal.routines (where role=SUBSTITUTE)` include. Walks each habit's
  // own frequencyGoalRoutines, finds its PRIMARY goal (the `fg_<id>`
  // companion), and collects that goal's substitute routine ids.
  const substituteRoutineIdsByHabitId = new Map<string, string[]>();
  for (const h of habitRoutines) {
    const primaryRel = h.frequencyGoalRoutines.find(
      (rel) => rel.role !== "SUBSTITUTE" && rel.goal?.isActive
    );
    const subRoutineIds = (primaryRel?.goal?.routines ?? []).map((r) => r.routineId);
    if (subRoutineIds.length > 0) {
      substituteRoutineIdsByHabitId.set(h.id, subRoutineIds);
    }
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
    // The map key doubles as the React key downstream — `${routineId}::${activityTypeId}`
    // for typed endurance entries (two typed slots on the same synthetic
    // routine would otherwise collide on routineId) and plain routineId
    // everywhere else.
    const plannedMap = new Map<string, {
      key: string;
      routineId: string;
      routineName: string;
      kind: string;
      domain: RoutineDomain;
      planned: number;
      logged: number;
      logIds: string[];
      // COMPLETION-only — mirrors Routine.capturesDuration so the WaG
      // detail panel can decide whether to render the minutes pill.
      capturesDuration?: boolean;
      // Most recent log's duration in seconds. Populated after the logs
      // loop below from whichever log lands in logIds[0].
      durationSec?: number | null;
    }>();
    for (const rid of plannedIds) {
      const r = routineMap.get(rid);
      if (!r) continue;
      plannedMap.set(rid, {
        key: rid,
        routineId: rid,
        routineName: r.name,
        kind: r.kind,
        domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
        planned: 1,
        logged: 0,
        logIds: [],
        capturesDuration: r.kind === "COMPLETION" ? r.capturesDuration : undefined,
      });
    }
    // Typed endurance slots (Run on Tuesday, Hike on Saturday, …) live
    // on the synthetic Endurance routine + an activityTypeId. Key by
    // `${routineId}::${activityTypeId}` so two typed slots on the same
    // day stay distinct, and label them by their activity type name.
    for (const slot of typedManualByDay.get(ymd) ?? []) {
      const r = routineMap.get(slot.routineId);
      if (!r) continue;
      const typeInfo = activityTypeNameById.get(slot.activityTypeId);
      if (!typeInfo) continue; // type no longer exists — skip the slot
      const composite = `${slot.routineId}::${slot.activityTypeId}`;
      plannedMap.set(composite, {
        key: composite,
        routineId: slot.routineId,
        routineName: typeInfo.name,
        kind: r.kind,
        domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
        planned: 1,
        logged: 0,
        logIds: [],
      });
    }
    // allLogs is sorted performedAt asc, so dayLogs inherits that order.
    // We want most-recent first in logIds — unshift each into position so
    // the modal opens with the latest log up top.
    //
    // For typed endurance logs (log.activityTypeId set), prefer the
    // composite key first so a scheduled "Run on Tuesday" pairs with a
    // logged Run rather than a logged Hike on the same day. Fall back
    // to plain routineId when no typed plan exists OR the log has no
    // activityTypeId (legacy / non-endurance).
    for (const log of dayLogs) {
      const compositeKey = log.activityTypeId
        ? `${log.routineId}::${log.activityTypeId}`
        : null;
      const existing =
        (compositeKey ? plannedMap.get(compositeKey) : undefined) ??
        plannedMap.get(log.routineId);
      if (existing) {
        existing.logged += 1;
        existing.logIds.unshift(log.id);
        // logIds[0] is the most-recent log → its durationSec is what the
        // minutes pill renders. Skip non-COMPLETION logs (capturesDuration
        // is COMPLETION-only) so we don't leak duration onto unrelated
        // routine kinds.
        if (existing.capturesDuration) existing.durationSec = log.durationSec ?? null;
      } else if (ymd <= today) {
        const r = routineMap.get(log.routineId);
        if (r) {
          // Unplanned typed log — key by composite so two typed logs on
          // the same day stay distinct. Label by activity type name.
          const typeInfo = log.activityTypeId
            ? activityTypeNameById.get(log.activityTypeId)
            : null;
          const key = compositeKey ?? log.routineId;
          plannedMap.set(key, {
            key,
            routineId: log.routineId,
            routineName: typeInfo?.name ?? r.name,
            kind: r.kind,
            domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
            planned: 0,
            logged: 1,
            logIds: [log.id],
            capturesDuration: r.kind === "COMPLETION" ? r.capturesDuration : undefined,
            durationSec:
              r.kind === "COMPLETION" && r.capturesDuration ? log.durationSec ?? null : undefined,
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
      // Display name resolves synthetic Endurance routine + typed
      // endurance logs to their activity type ("Run", "Hike", …) so the
      // user sees the activity, not the placeholder routine name.
      routineName: getLogDisplayName(log),
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

  // ── Frequency goal rows ──────────────────────────────────────────────────
  // One row per active FrequencyGoal — covers per-routine goals (the old
  // "habits" view) AND group goals (e.g. "strength 3x/week" spanning Push/
  // Pull/Legs). The card renders both, switching between daily-grid and
  // weekly-bars based on each goal's target shape.
  const allFrequencyGoals = await prisma.frequencyGoal.findMany({
    where: { isActive: true },
    include: {
      routines: {
        include: {
          routine: { select: { id: true, name: true, kind: true, domain: true, subtype: true, isActive: true, isDeleted: true, activityTypeId: true } },
        },
      },
      // Trigger-exercise links — used below to broaden which logs count
      // toward a goal (e.g. quick-log pull-ups satisfy a Pull Strength goal
      // even though the placeholder routine isn't in the goal's roster).
      triggerExercises: { select: { exerciseId: true } },
    },
  });

  const habitRows: HabitRow[] = allFrequencyGoals
    .map((goal): HabitRow | null => {
      // Filter out deleted/inactive routine references.
      const liveLinks = goal.routines.filter(
        (rel) => rel.routine && rel.routine.isActive && !rel.routine.isDeleted
      );
      const primaryLinks = liveLinks.filter((rel) => rel.role !== "SUBSTITUTE");
      const subLinks = liveLinks.filter((rel) => rel.role === "SUBSTITUTE");
      if (primaryLinks.length === 0) return null; // Goal exists but has no primary routine; skip

      const primaryRoutines = primaryLinks.map((rel) => ({
        id: rel.routine!.id,
        name: rel.routine!.name,
        domain: effectiveRoutineDomain(rel.routine!.domain, rel.routine!.kind, rel.routine!.subtype) as DomainTone,
        activityTypeId: rel.routine!.activityTypeId ?? null,
      }));
      const substituteRoutines = subLinks.map((rel) => ({
        id: rel.routine!.id,
        name: rel.routine!.name,
        domain: effectiveRoutineDomain(rel.routine!.domain, rel.routine!.kind, rel.routine!.subtype) as DomainTone,
      }));
      const isGroup = primaryRoutines.length > 1;
      // For per-routine goals (`fg_*`), the goal's name is generic
      // ("X frequency goal") — prefer the routine name. For group goals,
      // the goal's name is what the user picked.
      const isPerRoutine = goal.id.startsWith("fg_");
      const displayName = isPerRoutine ? primaryRoutines[0].name : goal.name;

      const target: FrequencyTarget = {
        targetCount: goal.targetCount,
        targetInterval: goal.targetInterval,
        targetUnit: goal.targetUnit,
        weekdayMask: goal.weekdayMask ?? null,
      };

      // Logs: every primary routine's log = isPrimary:true; every substitute's
      // log = isPrimary:false. The state classifier marks substitute-only days
      // as "covered" rather than "done." Trigger-matched logs (e.g. a quick
      // workout containing the goal's triggerExercises beyond triggerMinSets)
      // count as primary completions. Dedupe by log id so a routine that's
      // both a primary member AND contains a trigger exercise isn't double-
      // counted.
      const membership = buildFrequencyGoalMembership({
        primaryRoutines,
        substituteRoutineIds: substituteRoutines.map((r) => r.id),
        explicit: {
          triggerSubtypes: goal.triggerSubtypes,
          triggerActivityTypeIds: goal.triggerActivityTypeIds,
          triggerActivityFamilyIds: goal.triggerActivityFamilyIds,
          triggerExerciseIds: goal.triggerExercises.map((e) => e.exerciseId),
          triggerMinSets: goal.triggerMinSets,
        },
      });

      type MatchedLog = {
        logId: string;
        performedAt: Date;
        isPrimary: boolean;
        routineId: string;
        routineName: string;
      };
      const matched = new Map<string, MatchedLog>();
      for (const log of allLogs) {
        if (matched.has(log.id)) continue;
        const result = classifyLogAgainstFrequencyGoal(
          {
            id: log.id,
            routineId: log.routineId,
            performedAt: log.performedAt,
            routineSubtype: log.routine?.subtype ?? null,
            activityTypeId: log.activityTypeId ?? null,
            activityFamilyId: log.activityType?.familyId ?? null,
            exerciseSets: log.exercises.map((ex) => ({ exerciseId: ex.exerciseId, setCount: ex._count.sets })),
          },
          membership
        );
        if (!result) continue;
        matched.set(log.id, {
          logId: log.id,
          performedAt: log.performedAt,
          isPrimary: result.isPrimary,
          routineId: log.routineId,
          routineName: getLogDisplayName(log),
        });
      }
      const matchedList = Array.from(matched.values());
      const logs = matchedList.map((m) => ({ performedAt: m.performedAt, isPrimary: m.isPrimary }));
      const state = computeFrequencyState({ target, logs, today, trailingDays: FREQUENCY_STATE_DAYS });

      // 8-week contribution rollup, Sunday-anchored, oldest → newest. Mirrors
      // the WeeklyFrequencyBars layout so each bar lines up with its entry.
      const weeklyContributions: HabitRow["weeklyContributions"] = [];
      for (let w = 0; w < DOMAIN_WEEKS; w++) {
        const weekStartYmd = addDaysYmd(currentWeekStart, -(DOMAIN_WEEKS - 1 - w) * 7);
        const weekEndYmd = addDaysYmd(weekStartYmd, 6);
        const weekLogs = matchedList
          .filter((m) => {
            const ymd = toAppYmd(m.performedAt);
            return ymd >= weekStartYmd && ymd <= weekEndYmd;
          })
          .sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime())
          .map((m) => ({
            logId: m.logId,
            routineId: m.routineId,
            routineName: m.routineName,
            performedYmd: toAppYmd(m.performedAt),
            performedTimeLabel: timeLabel(m.performedAt),
            isPrimary: m.isPrimary,
          }));
        weeklyContributions.push({ weekStartYmd, weekEndYmd, logs: weekLogs });
      }

      const trailing30: HabitRow["trailing30"] = [];
      for (let i = 0; i < HABIT_GRID_DAYS; i++) {
        const ymd = addDaysYmd(habitWindowStart, i);
        trailing30.push({ ymd, state: state.dailyState[ymd] ?? (ymd > today ? "future" : "rest") });
      }
      // This-week summary (used by the row's compact "X/Y" pill).
      let weekTarget = 0;
      let weekProgress = 0;
      for (let i = 0; i < 7; i++) {
        const ymd = addDaysYmd(currentWeekStart, i);
        if (ymd > today) continue;
        const expected = isExpectedDay(target, ymd);
        if (expected) weekTarget++;
        if (expected && (state.dailyState[ymd] === "done" || state.dailyState[ymd] === "covered")) {
          weekProgress++;
        }
      }
      // For weekly-target goals without expected-every-day shape, fall back
      // to the window progress so the X/Y pill always reads sensibly.
      if (weekTarget === 0) {
        weekTarget = target.targetCount;
        weekProgress = state.currentWindow.progress;
      }

      return {
        goalId: goal.id,
        goalName: displayName,
        isGroup,
        routineId: primaryRoutines[0].id,
        routineName: displayName,
        primaryRoutines,
        substituteRoutines,
        domain: primaryRoutines[0].domain,
        state,
        target,
        trailing30,
        currentStreak: state.currentDayStreak || state.windowStreak,
        longestStreak: Math.max(state.longestDayStreak, state.longestWindowStreak),
        weekFraction: { progress: weekProgress, target: Math.max(weekTarget, 0) },
        status: state.currentWindow.status,
        weeklyContributions,
      };
    })
    .filter((r): r is HabitRow => r !== null);

  // Sort: daily-style first (calendar grid feels like the "habit" surface),
  // then weekly-style. Within each group: at-risk first, then highest streak,
  // then alphabetical.
  const statusRank: Record<HabitRow["status"], number> = {
    at_risk: 0, behind: 1, on_track: 2, ahead: 3, complete: 4,
  };
  habitRows.sort((a, b) => {
    const aMode = getFrequencyRenderMode(a.target);
    const bMode = getFrequencyRenderMode(b.target);
    if (aMode !== bMode) return aMode === "daily-grid" ? -1 : 1;
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    return a.goalName.localeCompare(b.goalName);
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
          routineName: getLogDisplayName(log),
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

  // ── Quick-pick routines for the FAB ──────────────────────────────────────
  const quickPickRoutines: QuickPickRoutine[] = routinesWithTargets
    .map((r) => ({
      routineId: r.id,
      routineName: r.name,
      domain: effectiveRoutineDomain(r.domain, r.kind, r.subtype),
      kind: r.kind,
    }))
    .sort((a, b) => a.routineName.localeCompare(b.routineName));

  // ── Enabled endurance activity types for the schedule picker ─────────────
  // Filters out user-disabled types via the same preference table the
  // log drawer respects. Empty-array fallback if the seed hasn't run.
  const activityTypeRows = await prisma.activityType.findMany({
    include: {
      family: { select: { name: true, sortOrder: true } },
      userPreferences: { select: { enabled: true } },
    },
    orderBy: [{ family: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  const scheduleActivityTypes = activityTypeRows
    .filter((t) => t.userPreferences[0]?.enabled !== false)
    .map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      familyId: t.familyId,
      familyName: t.family.name,
    }));

  // ── User's selected sports for the schedule picker's SPORTS tiles ────────
  const { listSelectedSports } = await import("@/lib/synthetic-sport-routines");
  const { getActivityEntry } = await import("@/lib/activity-families");
  const { sportAccent } = await import("@/lib/sport-accent");
  const selectedSports = await listSelectedSports();
  const scheduleSports = selectedSports.map((s) => ({
    slug: s.slug,
    label: s.label,
    eyebrow: getActivityEntry(s.slug)?.eyebrow ?? "Sport",
    color: sportAccent(s.slug),
  }));

  // ── Last-7-days snapshot ────────────────────────────────────────────────
  // Pure aggregation over allLogs; no extra Prisma roundtrip. Rolling
  // 7-day window ending today (inclusive of today).
  const sevenDaysAgoMs = new Date(`${today}T00:00:00.000Z`).getTime() - 6 * 24 * 60 * 60 * 1000;
  let last7Sessions = 0;
  let last7DurationSec = 0;
  let last7CardioMi = 0;
  for (const log of allLogs) {
    if (log.performedAt.getTime() < sevenDaysAgoMs) continue;
    last7Sessions += 1;
    if (log.durationSec) last7DurationSec += log.durationSec;
    if (log.distanceMi) last7CardioMi += log.distanceMi;
  }

  return {
    today,
    currentWeekStart,
    legacyGlanceDays,
    habitRows,
    domainSeries,
    movementPatterns,
    quickPickRoutines,
    scheduleActivityTypes,
    scheduleSports,
    last7Days: {
      sessions: last7Sessions,
      totalDurationSec: last7DurationSec,
      totalCardioMi: last7CardioMi,
    },
  };
}

// Narrow loader for callers that only need habit-row data (the GoalsTab on
// /plan, for instance). Avoids the routine/schedule/zone/movement-pattern
// fan-out of getHomeData(). Returns the same HabitRow[] shape so consumers
// don't need to change their downstream code.
export async function getHabitRowsOnly(): Promise<{ today: string; currentWeekStart: string; habitRows: HabitRow[] }> {
  const today = todayAppYmd();
  const habitWindowStart = addDaysYmd(today, -(HABIT_GRID_DAYS - 1));
  const weekBounds = getWeekBoundsSunday(new Date());
  const currentWeekStart = weekBounds.startYmd;
  // 8 weeks ending in the current week — same window WeeklyFrequencyBars renders.
  const sparkStart = addDaysYmd(currentWeekStart, -(DOMAIN_WEEKS - 1) * 7);
  const widestStart = [sparkStart, habitWindowStart].sort()[0];
  const windowEnd = addDaysYmd(currentWeekStart, 6);

  const [allFrequencyGoals, allLogs] = await Promise.all([
    prisma.frequencyGoal.findMany({
      where: { isActive: true },
      include: {
        routines: {
          include: {
            routine: { select: { id: true, name: true, kind: true, domain: true, subtype: true, isActive: true, isDeleted: true, activityTypeId: true } },
          },
        },
        triggerExercises: { select: { exerciseId: true } },
      },
    }),
    prisma.routineLog.findMany({
      where: {
        performedAt: {
          gte: new Date(`${widestStart}T00:00:00.000Z`),
          lt: new Date(`${addDaysYmd(windowEnd, 1)}T00:00:00.000Z`),
        },
      },
      orderBy: { performedAt: "asc" },
      select: {
        id: true,
        routineId: true,
        performedAt: true,
        activityTypeId: true,
        activityType: { select: { name: true, familyId: true } },
        routine: {
          select: {
            id: true, name: true, kind: true, domain: true, subtype: true,
            activityType: { select: { name: true } },
          },
        },
        exercises: {
          select: {
            exerciseId: true,
            _count: { select: { sets: true } },
          },
        },
      },
    }),
  ]);

  const habitRows: HabitRow[] = allFrequencyGoals
    .map((goal): HabitRow | null => {
      const liveLinks = goal.routines.filter(
        (rel) => rel.routine && rel.routine.isActive && !rel.routine.isDeleted
      );
      const primaryLinks = liveLinks.filter((rel) => rel.role !== "SUBSTITUTE");
      const subLinks = liveLinks.filter((rel) => rel.role === "SUBSTITUTE");
      if (primaryLinks.length === 0) return null;

      const primaryRoutines = primaryLinks.map((rel) => ({
        id: rel.routine!.id,
        name: rel.routine!.name,
        domain: effectiveRoutineDomain(rel.routine!.domain, rel.routine!.kind, rel.routine!.subtype) as DomainTone,
        activityTypeId: rel.routine!.activityTypeId ?? null,
      }));
      const substituteRoutines = subLinks.map((rel) => ({
        id: rel.routine!.id,
        name: rel.routine!.name,
        domain: effectiveRoutineDomain(rel.routine!.domain, rel.routine!.kind, rel.routine!.subtype) as DomainTone,
      }));
      const isGroup = primaryRoutines.length > 1;
      const isPerRoutine = goal.id.startsWith("fg_");
      const displayName = isPerRoutine ? primaryRoutines[0].name : goal.name;

      const target: FrequencyTarget = {
        targetCount: goal.targetCount,
        targetInterval: goal.targetInterval,
        targetUnit: goal.targetUnit,
        weekdayMask: goal.weekdayMask ?? null,
      };

      const membership = buildFrequencyGoalMembership({
        primaryRoutines,
        substituteRoutineIds: substituteRoutines.map((r) => r.id),
        explicit: {
          triggerSubtypes: goal.triggerSubtypes,
          triggerActivityTypeIds: goal.triggerActivityTypeIds,
          triggerActivityFamilyIds: goal.triggerActivityFamilyIds,
          triggerExerciseIds: goal.triggerExercises.map((e) => e.exerciseId),
          triggerMinSets: goal.triggerMinSets,
        },
      });

      type MatchedLog = {
        logId: string;
        performedAt: Date;
        isPrimary: boolean;
        routineId: string;
        routineName: string;
      };
      const matched = new Map<string, MatchedLog>();
      for (const log of allLogs) {
        if (matched.has(log.id)) continue;
        const result = classifyLogAgainstFrequencyGoal(
          {
            id: log.id,
            routineId: log.routineId,
            performedAt: log.performedAt,
            routineSubtype: log.routine?.subtype ?? null,
            activityTypeId: log.activityTypeId ?? null,
            activityFamilyId: log.activityType?.familyId ?? null,
            exerciseSets: log.exercises.map((ex) => ({ exerciseId: ex.exerciseId, setCount: ex._count.sets })),
          },
          membership
        );
        if (!result) continue;
        matched.set(log.id, {
          logId: log.id,
          performedAt: log.performedAt,
          isPrimary: result.isPrimary,
          routineId: log.routineId,
          routineName: getLogDisplayName(log),
        });
      }
      const matchedList = Array.from(matched.values());
      const logs = matchedList.map((m) => ({ performedAt: m.performedAt, isPrimary: m.isPrimary }));
      const state = computeFrequencyState({ target, logs, today, trailingDays: FREQUENCY_STATE_DAYS });

      const weeklyContributions: HabitRow["weeklyContributions"] = [];
      for (let w = 0; w < DOMAIN_WEEKS; w++) {
        const weekStartYmd = addDaysYmd(currentWeekStart, -(DOMAIN_WEEKS - 1 - w) * 7);
        const weekEndYmd = addDaysYmd(weekStartYmd, 6);
        const weekLogs = matchedList
          .filter((m) => {
            const ymd = toAppYmd(m.performedAt);
            return ymd >= weekStartYmd && ymd <= weekEndYmd;
          })
          .sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime())
          .map((m) => ({
            logId: m.logId,
            routineId: m.routineId,
            routineName: m.routineName,
            performedYmd: toAppYmd(m.performedAt),
            performedTimeLabel: timeLabel(m.performedAt),
            isPrimary: m.isPrimary,
          }));
        weeklyContributions.push({ weekStartYmd, weekEndYmd, logs: weekLogs });
      }

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
        if (expected && (state.dailyState[ymd] === "done" || state.dailyState[ymd] === "covered")) {
          weekProgress++;
        }
      }
      if (weekTarget === 0) {
        weekTarget = target.targetCount;
        weekProgress = state.currentWindow.progress;
      }

      return {
        goalId: goal.id,
        goalName: displayName,
        isGroup,
        routineId: primaryRoutines[0].id,
        routineName: displayName,
        primaryRoutines,
        substituteRoutines,
        domain: primaryRoutines[0].domain,
        state,
        target,
        trailing30,
        currentStreak: state.currentDayStreak || state.windowStreak,
        longestStreak: Math.max(state.longestDayStreak, state.longestWindowStreak),
        weekFraction: { progress: weekProgress, target: Math.max(weekTarget, 0) },
        status: state.currentWindow.status,
        weeklyContributions,
      };
    })
    .filter((r): r is HabitRow => r !== null);

  const statusRank: Record<HabitRow["status"], number> = {
    at_risk: 0, behind: 1, on_track: 2, ahead: 3, complete: 4,
  };
  habitRows.sort((a, b) => {
    const aMode = getFrequencyRenderMode(a.target);
    const bMode = getFrequencyRenderMode(b.target);
    if (aMode !== bMode) return aMode === "daily-grid" ? -1 : 1;
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    return a.goalName.localeCompare(b.goalName);
  });

  return { today, currentWeekStart, habitRows };
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
