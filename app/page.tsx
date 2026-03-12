import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  parseExerciseRepsAtWeightGoalType,
  parseRunLongestGoalType,
  parseRunWeeklyMileageGoalType,
  sparklinePoints,
} from "@/lib/progress";
import { addDaysYmd, diffYmdDays, formatAppDate, formatAppDateTime, formatUtcDateLabel, getAppDayRange, toAppYmd, todayAppYmd } from "@/lib/dates";
import { formatRoutineSubtype, formatRoutineTypeLabel, normalizeRoutineKind, routineKindColor } from "@/lib/routines";
import { getWeekBoundsSunday } from "@/lib/week";

export const dynamic = "force-dynamic";

function utcDateOnlyYmd(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function addDays(ymd: string, plus: number) {
  return addDaysYmd(ymd, plus);
}

function dayDiff(a: string, b: string) {
  return diffYmdDays(a, b);
}

function formatDayLabel(ymd: string) {
  return formatUtcDateLabel(ymd, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatLogTime(date: Date) {
  return formatAppDateTime(date, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function localDayRange(ymd: string) {
  return getAppDayRange(ymd);
}

function formatGoalType(type: string, routineMap: Map<string, { name: string }>, exerciseMap: Map<string, { name: string }>) {
  if (type.startsWith("routine_planned_per_week:")) {
    const routineId = type.split(":")[1];
    return `Plan ${routineMap.get(routineId)?.name ?? "routine"} per week`;
  }
  if (type.startsWith("routine_completion:")) {
    const routineId = type.split(":")[1];
    return `Complete ${routineMap.get(routineId)?.name ?? "routine"} this week`;
  }
  if (type.startsWith("routine_streak:")) {
    const routineId = type.split(":")[1];
    return `Keep ${routineMap.get(routineId)?.name ?? "routine"} streak`;
  }
  if (type.startsWith("run_weekly_mileage:")) {
    const scope = parseRunWeeklyMileageGoalType(type);
    if (scope?.kind === "allCardio") return "All cardio weekly mileage";
    if (scope?.kind === "cardioType") return `${scope.cardioType} cardio weekly mileage`;
    const routineId = scope?.routineId ?? type.split(":")[1];
    return `${routineMap.get(routineId)?.name ?? "Cardio"} weekly mileage`;
  }
  if (type.startsWith("run_longest:")) {
    const scope = parseRunLongestGoalType(type);
    if (scope?.kind === "allCardio") return "All cardio longest session";
    if (scope?.kind === "cardioType") return `${scope.cardioType} cardio longest session`;
    const routineId = scope?.routineId ?? type.split(":")[1];
    return `${routineMap.get(routineId)?.name ?? "Cardio"} longest session`;
  }
  if (type.startsWith("exercise_weight:")) {
    const exerciseId = type.split(":")[1];
    return `${exerciseMap.get(exerciseId)?.name ?? "Exercise"} top weight`;
  }
  if (type.startsWith("exercise_avg_reps_per_set:")) {
    const exerciseId = type.split(":")[1];
    return `${exerciseMap.get(exerciseId)?.name ?? "Exercise"} avg reps/set`;
  }
  const repsAtWeight = parseExerciseRepsAtWeightGoalType(type);
  if (repsAtWeight) {
    return `${exerciseMap.get(repsAtWeight.exerciseId)?.name ?? "Exercise"} reps @ ${repsAtWeight.weightLb} lb`;
  }
  return type;
}

function kindAccent(kind: string) {
  return routineKindColor(kind);
}

function loggingHref(routine: { routineId: string; kind: string }) {
  const kind = normalizeRoutineKind(routine.kind);
  if (kind === "WORKOUT") return `/routines/${routine.routineId}/log`;
  if (kind === "CARDIO") return `/routines/${routine.routineId}/log-cardio`;
  if (kind === "GUIDED") return `/routines/${routine.routineId}/log-guided`;
  if (kind === "SESSION") return `/routines/${routine.routineId}/log-session`;
  return `/routines/${routine.routineId}/log-completion`;
}

function SessionFractionRing({ current, target }: { current: number; target: number }) {
  const size = 86;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = target > 0 ? current / target : 0;
  const clamped = Math.max(0, Math.min(1, fraction));
  const dashOffset = circumference * (1 - clamped);

  return (
    <div style={{ width: size, height: size, position: "relative", display: "grid", placeItems: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(128,128,128,0.25)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(84,203,130,0.95)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center", lineHeight: 1.1 }}>
        <div style={{ fontWeight: 900, fontSize: 17 }}>
          {current}/{target}
        </div>
        <div style={{ fontSize: 10, opacity: 0.72 }}>sessions</div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const today = todayAppYmd();
  const tomorrow = addDays(today, 1);
  const weekBounds = getWeekBoundsSunday(new Date());
  const weekStart = toAppYmd(weekBounds.start);
  const sparkStart = addDays(weekStart, -35);

  const [
    routines,
    recentLogs,
    weeklyLogs,
    activeGoals,
    exercises,
    planEntriesRaw,
    manualEntriesRaw,
    sparkLogs,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        category: string;
        subtype: string | null;
        kind: string;
        timesPerWeek: number | null;
      }>
    >(
      'SELECT "id","name","category","subtype","kind","timesPerWeek" FROM "Routine" WHERE "isDeleted" = false AND "isActive" = true ORDER BY "kind" ASC, "category" ASC, "name" ASC'
    ),
    prisma.routineLog.findMany({
      orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        performedAt: true,
        distanceMi: true,
        durationSec: true,
        exercises: { select: { id: true, sets: { select: { id: true } } } },
        routine: { select: { id: true, name: true, category: true, kind: true } },
      },
    }),
    prisma.routineLog.groupBy({
      by: ["routineId"],
      where: {
        performedAt: {
          gte: weekBounds.start,
          lt: weekBounds.end,
        },
      },
      _count: { _all: true },
      _sum: { distanceMi: true },
      _max: { performedAt: true },
    }),
    prisma.goal.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, type: true, targetValue: true, createdAt: true },
    }),
    prisma.exercise.findMany({
      select: { id: true, name: true },
    }),
    prisma.$queryRawUnsafe<Array<{ routineId: string; dayOffset: number; sortOrder: number; startDate: string; cycleLengthDays: number }>>(
      'SELECT e."routineId", e."dayOffset", e."sortOrder", a."startDate", p."cycleLengthDays" FROM "ScheduleEntry" e INNER JOIN "SchedulePlanActivation" a ON a."schedulePlanId" = e."schedulePlanId" INNER JOIN "SchedulePlan" p ON p."id" = e."schedulePlanId" WHERE a."isEnabled" = true'
    ),
    prisma.$queryRawUnsafe<Array<{ routineId: string; scheduledDate: string; sortOrder: number }>>(
      'SELECT "routineId","scheduledDate","sortOrder" FROM "ScheduleManualEntry"'
    ),
    prisma.routineLog.findMany({
      where: {
        performedAt: {
          gte: new Date(`${sparkStart}T00:00:00.000Z`),
          lt: weekBounds.end,
        },
      },
      orderBy: { performedAt: "asc" },
      select: { performedAt: true, distanceMi: true },
    }),
  ]);

  const routineMap = new Map(routines.map((routine) => [routine.id, routine]));
  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  const weeklyMap = new Map(
    weeklyLogs.map((row) => [
      row.routineId,
      {
        count: row._count._all,
        miles: row._sum.distanceMi ?? 0,
        lastAt: row._max.performedAt,
      },
    ])
  );

  const manualToday = manualEntriesRaw
    .map((entry) => ({
      routineId: entry.routineId,
      scheduledDate: utcDateOnlyYmd(entry.scheduledDate),
      sortOrder: Number(entry.sortOrder),
    }))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.sortOrder - b.sortOrder);

  const cycleEntries = planEntriesRaw
    .map((entry) => ({
      routineId: entry.routineId,
      dayOffset: Number(entry.dayOffset),
      sortOrder: Number(entry.sortOrder),
      startDate: utcDateOnlyYmd(entry.startDate),
      cycleLengthDays: Number(entry.cycleLengthDays),
    }));

  function buildPlanForDay(day: string) {
    const dayPlanMap = new Map<
      string,
      { routineId: string; routineName: string; category: string; kind: string; planned: number; logged: number }
    >();

    const manualForDay = manualToday.filter((entry) => entry.scheduledDate === day);
    const cyclesForDay = cycleEntries.filter((entry) => {
      if (entry.cycleLengthDays <= 0) return false;
      const diff = dayDiff(day, entry.startDate);
      return diff >= 0 && diff % entry.cycleLengthDays === entry.dayOffset;
    });

    for (const item of [...manualForDay, ...cyclesForDay]) {
      const routine = routineMap.get(item.routineId);
      if (!routine) continue;
      const existing = dayPlanMap.get(item.routineId);
      if (existing) {
        existing.planned += 1;
        continue;
      }
      dayPlanMap.set(item.routineId, {
        routineId: item.routineId,
        routineName: routine.name,
        category: routine.category,
        kind: routine.kind,
        planned: 1,
        logged: 0,
      });
    }

    return dayPlanMap;
  }

  const todayPlanMap = buildPlanForDay(today);
  const tomorrowPlanMap = buildPlanForDay(tomorrow);

  const todayRange = localDayRange(today);
  const todayLogs = await prisma.routineLog.findMany({
    where: {
      performedAt: {
        gte: todayRange.start,
        lt: todayRange.end,
      },
    },
    select: { routineId: true },
  });

  const todayLogCountMap = new Map<string, number>();
  for (const log of todayLogs) {
    todayLogCountMap.set(log.routineId, (todayLogCountMap.get(log.routineId) ?? 0) + 1);
  }

  for (const [routineId, count] of todayLogCountMap.entries()) {
    const routine = routineMap.get(routineId);
    if (!routine) continue;
    const existing = todayPlanMap.get(routineId);
    if (existing) {
      existing.logged = count;
    } else {
      todayPlanMap.set(routineId, {
        routineId,
        routineName: routine.name,
        category: routine.category,
        kind: routine.kind,
        planned: 0,
        logged: count,
      });
    }
  }

  const todayFocus = Array.from(todayPlanMap.values()).sort(
    (a, b) => b.logged - a.logged || b.planned - a.planned || a.routineName.localeCompare(b.routineName)
  );
  const tomorrowPlan = Array.from(tomorrowPlanMap.values()).sort(
    (a, b) => b.planned - a.planned || a.routineName.localeCompare(b.routineName)
  );

  const weeklyCards = routines
    .map((routine) => {
      const week = weeklyMap.get(routine.id) ?? { count: 0, miles: 0, lastAt: null };
      const target = routine.timesPerWeek ?? 0;
      const percent = target > 0 ? Math.min(100, Math.round((week.count / target) * 100)) : 0;
      return {
        id: routine.id,
        name: routine.name,
        category: routine.category,
        kind: routine.kind,
        target,
        count: week.count,
        miles: week.miles,
        percent,
        delta: target > 0 ? target - week.count : 0,
      };
    })
    .sort((a, b) => {
      const aNeeds = a.target > 0 ? a.delta : 999;
      const bNeeds = b.target > 0 ? b.delta : 999;
      return aNeeds - bNeeds || b.percent - a.percent || a.name.localeCompare(b.name);
    });

  const weeklyCardioBreakdown = routines
    .filter((routine) => normalizeRoutineKind(routine.kind) === "CARDIO")
    .map((routine) => ({
      id: routine.id,
      name: routine.name,
      cardioType: formatRoutineSubtype(routine.subtype) || "Cardio",
      miles: weeklyMap.get(routine.id)?.miles ?? 0,
      logs: weeklyMap.get(routine.id)?.count ?? 0,
    }))
    .sort((a, b) => b.miles - a.miles || b.logs - a.logs || a.name.localeCompare(b.name));

  const totalWeeklyCardioMiles = weeklyCardioBreakdown.reduce((sum, item) => sum + item.miles, 0);
  const cardioByType = new Map<string, typeof weeklyCardioBreakdown>();
  for (const item of weeklyCardioBreakdown) {
    if (!cardioByType.has(item.cardioType)) cardioByType.set(item.cardioType, []);
    cardioByType.get(item.cardioType)!.push(item);
  }
  const cardioTypeGroups = Array.from(cardioByType.entries())
    .map(([type, items]) => ({
      type,
      items,
      miles: items.reduce((sum, item) => sum + item.miles, 0),
    }))
    .sort((a, b) => b.miles - a.miles || a.type.localeCompare(b.type));

  const onTrack = weeklyCards.filter((item) => item.target > 0 && item.count >= item.target).slice(0, 4);
  const needsAttention = weeklyCards.filter((item) => item.target > 0 && item.count < item.target).slice(0, 4);

  const weeklySeries = Array.from({ length: 6 }, (_, index) => {
    const start = addDays(weekStart, -(5 - index) * 7);
    const end = addDays(start, 7);
    const logsInWeek = sparkLogs.filter((log) => {
      const ymd = toAppYmd(log.performedAt);
      return ymd >= start && ymd < end;
    });
    return {
      label: start,
      sessions: logsInWeek.length,
      miles: logsInWeek.reduce((sum, log) => sum + (log.distanceMi ?? 0), 0),
    };
  });

  const todayPlannedTotal = todayFocus.reduce((sum, item) => sum + item.planned, 0);
  const todayLoggedTotal = todayFocus.reduce((sum, item) => sum + item.logged, 0);
  const todayDoneRoutines = todayFocus.filter((item) => item.logged > 0).length;
  const todayRemainingTotal = todayFocus.reduce((sum, item) => sum + Math.max(0, item.planned - item.logged), 0);
  const tomorrowPlannedTotal = tomorrowPlan.reduce((sum, item) => sum + item.planned, 0);
  const weekLoggedByRoutine = new Map(weeklyCards.map((item) => [item.id, item.count]));
  const weekLoggedTotal = weeklyCards.reduce((sum, item) => sum + item.count, 0);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekPlannedByRoutine = new Map<string, number>();
  for (const day of weekDays) {
    const dayPlan = buildPlanForDay(day);
    for (const item of dayPlan.values()) {
      weekPlannedByRoutine.set(item.routineId, (weekPlannedByRoutine.get(item.routineId) ?? 0) + item.planned);
    }
  }
  const weekPlannedTotal = Array.from(weekPlannedByRoutine.values()).reduce((sum, count) => sum + count, 0);
  const weekUnplannedLoggedTotal = Array.from(weekLoggedByRoutine.entries()).reduce((sum, [routineId, logged]) => {
    const planned = weekPlannedByRoutine.get(routineId) ?? 0;
    return sum + Math.max(0, logged - planned);
  }, 0);
  const weekSessionTargetTotal = weekPlannedTotal + weekUnplannedLoggedTotal;
  const weekEnd = addDays(weekStart, 6);
  const weekDateRangeLabel = `${formatDayLabel(weekStart)} - ${formatDayLabel(weekEnd)}`;

  const recentItems = recentLogs.map((log) => {
    const setCount = log.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    const isRun = log.distanceMi !== null && log.durationSec !== null;
    const isWorkout = !isRun && log.exercises.length > 0;
    return {
      id: log.id,
      name: log.routine.name,
      category: log.routine.category,
      kind: log.routine.kind,
      stamp: formatLogTime(log.performedAt),
      detail: isRun
        ? `${(log.distanceMi ?? 0).toFixed(2)} mi`
        : isWorkout
        ? `${setCount} sets logged`
        : "Completed check-in",
    };
  });

  const goalCards = activeGoals.map((goal) => ({
    id: goal.id,
    title: formatGoalType(goal.type, routineMap, exerciseMap),
    target: goal.targetValue,
    createdAt: formatAppDate(goal.createdAt),
  }));

  return (
    <div className="mobileHomePage" style={page}>
      <section className="mobileHomeMainGrid" style={mainGrid}>
        <div className="mobileHomePrimaryColumn" style={{ display: "grid", gap: 14 }}>
          <section style={panel}>
            <div style={panelHeader}>TODAY&apos;S FOCUS</div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div style={sectionSub}>{formatDayLabel(today)}</div>
              <div className="mobileHomeSummaryGrid" style={summaryGrid}>
                <div style={summaryCard}>
                  <div style={summaryLabel}>Today Planned/Done</div>
                  <div style={summaryValue}>{todayPlannedTotal}/{todayDoneRoutines}</div>
                  <div style={summarySub}>planned routines / completed routines</div>
                </div>
                <div style={summaryCard}>
                  <div style={summaryLabel}>Today Logs</div>
                  <div style={summaryValue}>{todayLoggedTotal}</div>
                  <div style={summarySub}>logs completed today</div>
                </div>
                <div style={summaryCard}>
                  <div style={summaryLabel}>Today Remaining</div>
                  <div style={summaryValue}>{todayRemainingTotal}</div>
                  <div style={summarySub}>planned entries remaining</div>
                </div>
                <div style={summaryCard}>
                  <div style={summaryLabel}>Tomorrow Planned</div>
                  <div style={summaryValue}>{tomorrowPlannedTotal}</div>
                  <div style={summarySub}>planned entries tomorrow</div>
                </div>
              </div>
              {todayFocus.length === 0 && <div style={emptyState}>Nothing planned or logged yet today.</div>}
              {todayFocus.map((item) => (
                <div key={item.routineId} style={item.logged > 0 ? focusDoneCard : focusCard}>
                  <div className="mobileHomeFocusHeader" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>{item.routineName}</div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.78 }}>
                        {item.category} | {formatRoutineTypeLabel(item.kind)}
                      </div>
                    </div>
                    <div className="mobileHomeKindPill" style={{ ...kindPill, borderColor: kindAccent(item.kind), color: kindAccent(item.kind) }}>
                      {item.logged > 0 ? "DONE" : "PLANNED"}
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, opacity: 0.88 }}>
                    Planned: {item.planned} | Logged: {item.logged} | Remaining: {Math.max(0, item.planned - item.logged)}
                  </div>
                  {item.planned > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <Link href={loggingHref(item)} style={focusActionLink}>
                        Log
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>TOMORROW PREVIEW</div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div style={sectionSub}>{formatDayLabel(tomorrow)}</div>
              <div style={summaryCard}>
                <div style={summaryLabel}>Tomorrow Planned</div>
                <div style={summaryValue}>{tomorrowPlannedTotal}</div>
                <div style={summarySub}>planned entries tomorrow</div>
              </div>
              {tomorrowPlan.length === 0 && <div style={emptyState}>Nothing planned yet for tomorrow.</div>}
              <div className="mobileHomeTomorrowGrid" style={tomorrowPreviewGrid}>
                {tomorrowPlan.slice(0, 8).map((item) => (
                  <div key={`tomorrow-${item.routineId}`} style={metricChip}>
                    {item.routineName} ({item.kind}) | planned {item.planned}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>RECENT ACTIVITY</div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              {recentItems.length === 0 && <div style={emptyState}>No logs yet.</div>}
              {recentItems.map((item) => (
                <div key={item.id} className="mobileHomeActivityRow" style={activityRow}>
                  <div style={activityDot(item.kind)} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{item.name}</div>
                    <div style={{ marginTop: 3, fontSize: 12, opacity: 0.76 }}>
                      {item.category} | {item.detail}
                    </div>
                  </div>
                  <div className="mobileHomeActivityStamp" style={{ fontSize: 12, opacity: 0.7, textAlign: "right" }}>{item.stamp}</div>
                </div>
              ))}
              <Link href="/manual-log" style={secondaryLinkBlock}>Open Manual Log</Link>
            </div>
          </section>
        </div>

        <div className="mobileHomeSecondaryColumn" style={{ display: "grid", gap: 14 }}>
          <section style={panel}>
            <div style={panelHeader}>WEEKLY MOMENTUM</div>
            <div style={{ padding: 14, display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div className="mobileHomeWeeklyHeader" style={weeklySubheaderRow}>
                  <div style={weeklySubheader}>This Week</div>
                  <SessionFractionRing current={weekLoggedTotal} target={weekSessionTargetTotal} />
                </div>
                <div style={sectionSub}>{weekDateRangeLabel}</div>
              </div>

              <div style={mileageBand}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Weekly Cardio Mileage</div>
                  <div style={sectionSub}>Combined miles from all cardio routines this week.</div>
                </div>
                <div style={mileageValue}>{totalWeeklyCardioMiles.toFixed(1)} mi</div>
                <details style={cardioDetails}>
                  <summary data-collapsible-summary style={cardioSummary}>
                    Show cardio routine breakdown
                  </summary>
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {cardioTypeGroups.length === 0 && <div style={emptyState}>No cardio logged this week.</div>}
                    {cardioTypeGroups.map((group) => (
                      <div key={group.type} style={cardioGroupCard}>
                        <div className="mobileHomeCardioRow" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ fontWeight: 900 }}>{group.type}</div>
                          <div style={cardioMilesPill}>{group.miles.toFixed(1)} mi</div>
                        </div>
                        <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                          {group.items.map((item) => (
                            <div key={item.id} style={cardioRoutineRow}>
                              <span>{item.name}</span>
                              <span>{item.miles.toFixed(1)} mi ({item.logs} logs)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

              <div style={sparkCard}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Last 6 Weeks</div>
                  <div style={sectionSub}>Session count trend with total weekly mileage underneath.</div>
                </div>
                <svg width="100%" height="84" viewBox="0 0 220 84" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="rgba(84,203,130,0.95)"
                    strokeWidth="3"
                    points={sparklinePoints(weeklySeries.map((item) => item.sessions), 220, 84, 8)}
                  />
                </svg>
                <div className="mobileHomeSparkMeta" style={sparkMetaRow}>
                  {weeklySeries.map((item) => (
                    <div key={item.label} style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, opacity: 0.66 }}>{formatDayLabel(item.label)}</div>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{item.sessions} logs</div>
                      <div style={{ fontSize: 11, opacity: 0.74 }}>{item.miles.toFixed(1)} mi</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mobileHomeTwoCol" style={twoColGrid}>
                <div style={subPanel}>
                  <div style={subPanelTitle}>On Track</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {onTrack.length === 0 && <div style={emptyState}>No routines have hit their weekly target yet.</div>}
                    {onTrack.map((item) => (
                      <div key={item.id} style={miniCardSuccess}>
                        <div style={{ fontWeight: 800 }}>{item.name}</div>
                        <div style={miniCardMeta}>
                          {item.count}/{item.target} this week
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={subPanel}>
                  <div style={subPanelTitle}>Needs Attention</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {needsAttention.length === 0 && <div style={emptyState}>Everything with a weekly target is on pace.</div>}
                    {needsAttention.map((item) => (
                      <div key={item.id} style={miniCardWarn}>
                        <div style={{ fontWeight: 800 }}>{item.name}</div>
                        <div style={miniCardMeta}>
                          {item.count}/{item.target} this week
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>ACTIVE GOALS</div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              {goalCards.length === 0 && <div style={emptyState}>No active goals yet.</div>}
              {goalCards.map((goal) => (
                <div key={goal.id} style={goalRow}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{goal.title}</div>
                    <div style={{ marginTop: 3, fontSize: 12, opacity: 0.76 }}>
                      Target: {goal.target} | Created: {goal.createdAt}
                    </div>
                  </div>
                </div>
              ))}
              <Link href="/goals" style={secondaryLinkBlock}>Manage Goals</Link>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>QUICK PATHS</div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div className="mobileHomeQuickGrid" style={quickGrid}>
                <Link href="/routines/new" style={quickCard}>
                  <div style={quickTitle}>New Routine</div>
                  <div style={quickSub}>Add a workout, cardio, or check routine.</div>
                </Link>
                <Link href="/schedule" style={quickCard}>
                  <div style={quickTitle}>Plan Week</div>
                  <div style={quickSub}>Adjust today and this month on the schedule board.</div>
                </Link>
                <Link href="/progress" style={quickCard}>
                  <div style={quickTitle}>Review Trends</div>
                  <div style={quickSub}>Open progression charts and completion history.</div>
                </Link>
                <Link href="/goals?mode=create" style={quickCard}>
                  <div style={quickTitle}>Set Goal</div>
                  <div style={quickSub}>Create a target tied to routine, cardio, or exercise progress.</div>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 16,
};

const mainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.25fr 0.95fr",
  gap: 16,
  alignItems: "start",
};

const panel: React.CSSProperties = {
  borderRadius: 20,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(20,29,46,0.9), rgba(13,19,31,0.92))",
  boxShadow: "0 12px 34px rgba(0,0,0,0.16)",
};

const panelHeader: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const sectionSub: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.68,
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

const summaryCard: React.CSSProperties = {
  borderRadius: 12,
  padding: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 3,
};

const summaryLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.35,
  opacity: 0.72,
};

const summaryValue: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.1,
};

const summarySub: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.7,
};

const focusCard: React.CSSProperties = {
  borderRadius: 14,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const focusDoneCard: React.CSSProperties = {
  ...focusCard,
  border: "1px solid rgba(84,203,130,0.72)",
  background: "rgba(84,203,130,0.10)",
  boxShadow: "0 0 0 1px rgba(84,203,130,0.14), 0 0 18px rgba(84,203,130,0.18)",
};

const focusActionLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800,
};

const kindPill: React.CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.4,
};

const sparkCard: React.CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(180deg, rgba(84,203,130,0.10), rgba(76,163,255,0.06) 45%, rgba(255,255,255,0.02))",
  display: "grid",
  gap: 10,
};

const mileageBand: React.CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: "1px solid rgba(76,163,255,0.24)",
  background: "linear-gradient(135deg, rgba(76,163,255,0.12), rgba(84,203,130,0.07))",
  display: "grid",
  gap: 10,
};

const mileageValue: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
  lineHeight: 1,
};

const cardioDetails: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 10,
};

const cardioSummary: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 800,
};

const cardioGroupCard: React.CSSProperties = {
  borderRadius: 12,
  padding: 10,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.03)",
};

const cardioMilesPill: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(76,163,255,0.14)",
  border: "1px solid rgba(76,163,255,0.35)",
  fontSize: 11,
  fontWeight: 900,
};

const cardioRoutineRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 12,
  opacity: 0.88,
};

const sparkMetaRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: 8,
};

const twoColGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const weeklySubheader: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: 0.3,
};

const weeklySubheaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
};

const tomorrowPreviewGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 8,
};

const subPanel: React.CSSProperties = {
  borderRadius: 16,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 10,
};

const subPanelTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
};

const metricChip: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 10,
  padding: "7px 9px",
  fontSize: 12,
  opacity: 0.9,
  background: "rgba(128,128,128,0.08)",
};

const miniCardSuccess: React.CSSProperties = {
  borderRadius: 12,
  padding: 10,
  border: "1px solid rgba(84,203,130,0.42)",
  background: "rgba(84,203,130,0.08)",
};

const miniCardWarn: React.CSSProperties = {
  borderRadius: 12,
  padding: 10,
  border: "1px solid rgba(255,199,92,0.42)",
  background: "rgba(255,199,92,0.08)",
};

const miniCardMeta: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  opacity: 0.78,
};

const activityRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "14px minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

function activityDot(kind: string): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: kindAccent(kind),
    boxShadow: `0 0 14px ${kindAccent(kind)}`,
  };
}

const goalRow: React.CSSProperties = {
  borderRadius: 14,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const quickGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const quickCard: React.CSSProperties = {
  display: "block",
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  textDecoration: "none",
  color: "inherit",
};

const quickTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
};

const quickSub: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  opacity: 0.76,
  lineHeight: 1.45,
};

const secondaryLink: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  textDecoration: "none",
  color: "inherit",
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.04)",
  fontWeight: 800,
};

const secondaryLinkBlock: React.CSSProperties = {
  ...secondaryLink,
  display: "inline-flex",
  justifyContent: "center",
};

const emptyState: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.64,
};
