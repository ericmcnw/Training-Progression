import {
  type Goal,
  type MetadataGroupKind,
} from "@/generated/prisma";
import { formatAppDate, formatAppDateTime } from "@/lib/dates";
import {
  GOAL_METRIC_LABELS,
  GOAL_TARGET_TYPE_LABELS,
  GOAL_TIMEFRAME_LABELS,
  GOAL_TYPE_LABELS,
  type GoalMetricTypeValue,
  type GoalTargetTypeValue,
  type GoalTimeframeValue,
  type GoalTypeValue,
  getAllowedMetricTypes,
  metricIsLowerBetter,
} from "@/lib/goals-config";
import { formatMetadataGroupKind } from "@/lib/metadata";
import { prisma } from "@/lib/prisma";
import { fillWeeklySeries, formatWeekLabel } from "@/lib/progress-v2";
import { formatRoutineSubtype } from "@/lib/routines";
import { getWeekBoundsSunday } from "@/lib/week";

type GoalConfig = {
  benchmarkDistanceMi?: number;
  benchmarkLabel?: string;
};

type GoalWithConfig = Omit<Goal, "config"> & {
  config: GoalConfig | null;
};

type GoalLog = Awaited<ReturnType<typeof getLogsForGoal>>[number];
type GoalExerciseEntry = GoalLog["exercises"][number];

export type GoalTargetOption = {
  id: string;
  label: string;
  subtitle?: string;
};

export type GoalFormOptions = {
  routines: GoalTargetOption[];
  exercises: GoalTargetOption[];
  cardioTargets: GoalTargetOption[];
  groups: GoalTargetOption[];
};

export type GoalHistoryPoint = {
  label: string;
  value: number;
};

export type GoalRecentItem = {
  id: string;
  routineId: string;
  routineName: string;
  performedAt: Date;
  contributionLabel: string;
};

export type GoalInsight = {
  goal: GoalWithConfig;
  targetLabel: string;
  targetKindLabel: string;
  targetHref: string | null;
  goalTypeLabel: string;
  metricLabel: string;
  timeframeLabel: string;
  timeframeStatusLabel: string;
  timeframeWindowLabel: string;
  summaryLabel: string;
  actualValue: number;
  targetValue: number;
  actualDisplay: string;
  targetDisplay: string;
  fractionComplete: number;
  isAchieved: boolean;
  hasData: boolean;
  history: GoalHistoryPoint[];
  recentItems: GoalRecentItem[];
};

export type GoalChartReference = {
  goalId: string;
  goalName: string;
  targetValue: number;
  label: string;
  unit?: string;
  decimals?: number;
};

export type GoalListFilters = {
  type?: string;
  active?: string;
};

type GoalChartCandidate = {
  targetType: GoalTargetTypeValue;
  targetId: string;
};

type GoalWindow = {
  currentStart: Date;
  currentEnd: Date;
  historyStart: Date;
  historyEnd: Date;
  elapsedFraction: number;
  currentLabel: string;
};

const cardioKinds: MetadataGroupKind[] = ["CARDIO_ACTIVITY"];

function asGoalConfig(value: Goal["config"]): GoalConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const benchmarkDistanceMi =
    typeof record.benchmarkDistanceMi === "number" && Number.isFinite(record.benchmarkDistanceMi)
      ? record.benchmarkDistanceMi
      : undefined;
  const benchmarkLabel =
    typeof record.benchmarkLabel === "string" && record.benchmarkLabel.trim().length > 0
      ? record.benchmarkLabel.trim()
      : undefined;
  return {
    ...(benchmarkDistanceMi ? { benchmarkDistanceMi } : {}),
    ...(benchmarkLabel ? { benchmarkLabel } : {}),
  };
}

function toGoalWithConfig(goal: Goal): GoalWithConfig {
  return {
    ...goal,
    config: asGoalConfig(goal.config),
  };
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function clampDate(date: Date, min: Date, max: Date) {
  const time = date.getTime();
  return new Date(Math.min(Math.max(time, min.getTime()), max.getTime()));
}

function currentWindowForGoal(goal: GoalWithConfig, now = new Date()): GoalWindow {
  const goalStart = goal.startDate;
  const naturalEnd = goal.endDate ?? now;
  const useAllTimePerformanceWindow = goal.goalType === "PERFORMANCE" && goal.timeframe === "ONE_TIME";
  let currentStart = startOfDay(goalStart);
  let currentEnd = addDays(currentStart, 1);
  let historyStart = currentStart;
  let currentLabel = "Today";

  if (goal.timeframe === "WEEK") {
    currentStart = getWeekBoundsSunday(now).start;
    currentEnd = addDays(currentStart, 7);
    historyStart = addDays(currentStart, -7 * 7);
    currentLabel = "This week";
  } else if (goal.timeframe === "MONTH") {
    currentStart = startOfMonth(now);
    currentEnd = addMonths(currentStart, 1);
    historyStart = addMonths(currentStart, -5);
    currentLabel = "This month";
  } else if (goal.timeframe === "ONE_TIME") {
    currentStart = useAllTimePerformanceWindow ? new Date(0) : goalStart;
    currentEnd = goal.endDate ?? now;
    historyStart = useAllTimePerformanceWindow ? new Date(0) : goalStart;
    currentLabel = useAllTimePerformanceWindow ? "All time" : goal.endDate ? "Goal window" : "Since start";
  } else {
    historyStart = addDays(currentStart, -13);
  }

  currentStart = useAllTimePerformanceWindow
    ? currentStart
    : currentStart.getTime() < goalStart.getTime()
    ? goalStart
    : currentStart;
  currentEnd = currentEnd.getTime() > naturalEnd.getTime() ? naturalEnd : currentEnd;
  historyStart = useAllTimePerformanceWindow
    ? historyStart
    : historyStart.getTime() < goalStart.getTime()
    ? goalStart
    : historyStart;
  const historyEnd = naturalEnd;

  const effectiveEnd = currentEnd.getTime() <= currentStart.getTime() ? addDays(currentStart, 1) : currentEnd;
  const elapsedNow = clampDate(now, currentStart, effectiveEnd);
  const elapsedSpan = Math.max(1, effectiveEnd.getTime() - currentStart.getTime());
  const elapsedFraction = Math.max(0, Math.min(1, (elapsedNow.getTime() - currentStart.getTime()) / elapsedSpan));

  return {
    currentStart,
    currentEnd: effectiveEnd,
    historyStart,
    historyEnd,
    elapsedFraction,
    currentLabel,
  };
}

function distinctLogs(logs: GoalLog[]) {
  const seen = new Set<string>();
  return logs.filter((log) => {
    if (seen.has(log.id)) return false;
    seen.add(log.id);
    return true;
  });
}

function relevantExerciseIdsForLog(log: GoalLog, exerciseIds: Set<string>) {
  return log.exercises.filter((entry) => exerciseIds.has(entry.exerciseId));
}

async function getDescendantGroupIds(rootId: string) {
  const relations = await prisma.metadataGroupRelation.findMany({
    select: { parentGroupId: true, childGroupId: true },
  });
  const result = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const relation of relations) {
      if (relation.parentGroupId !== current || result.has(relation.childGroupId)) continue;
      result.add(relation.childGroupId);
      queue.push(relation.childGroupId);
    }
  }
  return Array.from(result);
}

async function getTargetDescriptor(goal: GoalWithConfig) {
  if (goal.targetType === "ROUTINE") {
    const routine = await prisma.routine.findUnique({
      where: { id: goal.targetId },
      select: { id: true, name: true, kind: true, subtype: true, category: true },
    });
    return {
      label: routine?.name ?? "Unknown routine",
      kindLabel: GOAL_TARGET_TYPE_LABELS.ROUTINE,
      href: routine ? `/progress/routines/${routine.id}?tab=overview&range=4w` : null,
      filter: {
        routineIds: routine ? [routine.id] : [],
        exerciseIds: [],
      },
    };
  }

  if (goal.targetType === "EXERCISE") {
    const exercise = await prisma.exercise.findUnique({
      where: { id: goal.targetId },
      select: { id: true, name: true, unit: true, supportsWeight: true },
    });
    return {
      label: exercise?.name ?? "Unknown exercise",
      kindLabel: GOAL_TARGET_TYPE_LABELS.EXERCISE,
      href: exercise ? `/progress/exercises/${exercise.id}?tab=overview&range=4w` : null,
      filter: {
        routineIds: [],
        exerciseIds: exercise ? [exercise.id] : [],
      },
    };
  }

  const group = await prisma.metadataGroup.findUnique({
    where: { id: goal.targetId },
    select: { id: true, slug: true, label: true, kind: true },
  });
  const groupIds = group ? await getDescendantGroupIds(group.id) : [];
  const [routineAssignments, exerciseAssignments] = groupIds.length
    ? await Promise.all([
        prisma.routineMetadataGroup.findMany({
          where: { groupId: { in: groupIds } },
          select: { routineId: true },
        }),
        prisma.exerciseMetadataGroup.findMany({
          where: { groupId: { in: groupIds } },
          select: { exerciseId: true },
        }),
      ])
    : [[], []];
  const routineIds = Array.from(new Set(routineAssignments.map((item) => item.routineId)));
  const exerciseIds = Array.from(new Set(exerciseAssignments.map((item) => item.exerciseId)));

  return {
    label: group?.label ?? "Unknown group",
    kindLabel: goal.targetType === "CARDIO" ? GOAL_TARGET_TYPE_LABELS.CARDIO : GOAL_TARGET_TYPE_LABELS.GROUP,
    href: group ? `/progress/groups/${group.slug}?tab=overview&range=4w` : null,
    filter: { routineIds, exerciseIds },
  };
}

async function getLogsForGoal(goal: GoalWithConfig, descriptor: Awaited<ReturnType<typeof getTargetDescriptor>>, start: Date, end: Date) {
  const routineIds = descriptor.filter.routineIds;
  const exerciseIds = descriptor.filter.exerciseIds;

  const logs = await prisma.routineLog.findMany({
    where: {
      performedAt: { gte: start, lte: end },
      ...(
        routineIds.length > 0 && exerciseIds.length > 0
          ? {
              OR: [
                { routineId: { in: routineIds } },
                { exercises: { some: { exerciseId: { in: exerciseIds } } } },
              ],
            }
          : routineIds.length > 0
          ? { routineId: { in: routineIds } }
          : exerciseIds.length > 0
          ? { exercises: { some: { exerciseId: { in: exerciseIds } } } }
          : { id: "__none__" }
      ),
    },
    include: {
      routine: {
        select: {
          id: true,
          name: true,
          kind: true,
        },
      },
      exercises: {
        include: {
          exercise: {
            select: {
              id: true,
              name: true,
            },
          },
          sets: {
            select: {
              reps: true,
              seconds: true,
              weightLb: true,
            },
          },
        },
      },
      metrics: {
        select: {
          id: true,
          name: true,
          value: true,
          unit: true,
        },
      },
    },
    orderBy: { performedAt: "desc" },
  });

  return logs;
}

function metricForExerciseEntry(goal: GoalWithConfig, entry: GoalExerciseEntry) {
  if (goal.metricType === "REPS") {
    return entry.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
  }
  if (goal.metricType === "SETS") {
    return entry.sets.length;
  }
  if (goal.metricType === "VOLUME") {
    return entry.sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.weightLb ?? 0), 0);
  }
  if (goal.metricType === "MAX_WEIGHT") {
    return Math.max(0, ...entry.sets.map((set) => set.weightLb ?? 0));
  }
  if (goal.metricType === "MAX_DURATION") {
    return Math.max(0, ...entry.sets.map((set) => set.seconds ?? 0));
  }
  if (goal.metricType === "DURATION") {
    return entry.sets.reduce((sum, set) => sum + (set.seconds ?? 0), 0);
  }
  return 0;
}

function metricForLog(goal: GoalWithConfig, log: GoalLog, exerciseIds: Set<string>) {
  if (goal.metricType === "SESSIONS") {
    return 1;
  }
  if (goal.metricType === "COMPLETED") {
    return log.completionCount ?? 1;
  }
  if (goal.metricType === "DISTANCE") {
    if (goal.goalType === "PERFORMANCE") return log.distanceMi ?? 0;
    return log.distanceMi ?? 0;
  }
  if (goal.metricType === "DURATION") {
    if (exerciseIds.size > 0) {
      const relevantExercises = relevantExerciseIdsForLog(log, exerciseIds);
      return relevantExercises.reduce((sum, entry) => sum + metricForExerciseEntry(goal, entry), 0);
    }
    return log.durationSec ?? 0;
  }
  if (goal.metricType === "PACE") {
    if (!log.distanceMi || !log.durationSec || log.distanceMi <= 0) return 0;
    const benchmarkDistance = goal.config?.benchmarkDistanceMi ?? 1;
    return (log.durationSec / log.distanceMi) * benchmarkDistance;
  }

  const relevantExercises = exerciseIds.size > 0 ? relevantExerciseIdsForLog(log, exerciseIds) : log.exercises;
  if (relevantExercises.length === 0) return 0;

  if (goal.metricType === "REPS" || goal.metricType === "SETS" || goal.metricType === "VOLUME") {
    return relevantExercises.reduce((sum, entry) => sum + metricForExerciseEntry(goal, entry), 0);
  }
  if (goal.metricType === "MAX_WEIGHT" || goal.metricType === "MAX_DURATION") {
    return Math.max(0, ...relevantExercises.map((entry) => metricForExerciseEntry(goal, entry)));
  }

  return 0;
}

function bucketKeyForGoal(goal: GoalWithConfig, date: Date) {
  if (goal.timeframe === "DAY") {
    return date.toISOString().slice(0, 10);
  }
  if (goal.timeframe === "MONTH") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return getWeekBoundsSunday(date).start.toISOString().slice(0, 10);
}

function bucketLabelForGoal(goal: GoalWithConfig, key: string) {
  if (goal.timeframe === "DAY") {
    return formatAppDate(new Date(`${key}T00:00:00.000Z`), { month: "short", day: "numeric" });
  }
  if (goal.timeframe === "MONTH") {
    const [year, month] = key.split("-");
    return new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(
      new Date(Date.UTC(Number(year), Number(month) - 1, 1))
    );
  }
  return formatWeekLabel(key);
}

function aggregateHistory(goal: GoalWithConfig, logs: GoalLog[], exerciseIds: Set<string>) {
  const byBucket = new Map<string, number>();
  const lowerIsBetter = metricIsLowerBetter(goal.metricType as GoalMetricTypeValue);

  for (const log of logs) {
    const key = bucketKeyForGoal(goal, log.performedAt);
    const value = metricForLog(goal, log, exerciseIds);
    if (goal.goalType === "PERFORMANCE" || lowerIsBetter) {
      const current = byBucket.get(key);
      if (current === undefined) {
        byBucket.set(key, value);
      } else {
        byBucket.set(key, lowerIsBetter ? Math.min(current, value > 0 ? value : current) : Math.max(current, value));
      }
      continue;
    }
    byBucket.set(key, (byBucket.get(key) ?? 0) + value);
  }

  if (goal.timeframe === "WEEK") {
    return fillWeeklySeries(byBucket, "8w").map((point) => ({ label: point.label, value: point.value }));
  }

  return Array.from(byBucket.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ label: bucketLabelForGoal(goal, key), value }));
}

function currentValueForGoal(goal: GoalWithConfig, logs: GoalLog[], exerciseIds: Set<string>) {
  const lowerIsBetter = metricIsLowerBetter(goal.metricType as GoalMetricTypeValue);
  if (goal.goalType === "PERFORMANCE" || lowerIsBetter) {
    const values = logs.map((log) => metricForLog(goal, log, exerciseIds)).filter((value) => value > 0);
    if (values.length === 0) return 0;
    return lowerIsBetter ? Math.min(...values) : Math.max(...values);
  }

  return logs.reduce((sum, log) => sum + metricForLog(goal, log, exerciseIds), 0);
}

function formatSeconds(value: number) {
  const rounded = Math.max(0, Math.round(value));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatMetricValue(goal: GoalWithConfig, value: number) {
  if (goal.metricType === "DISTANCE") return `${value.toFixed(1)} mi`;
  if (goal.metricType === "DURATION" || goal.metricType === "MAX_DURATION") return formatSeconds(value);
  if (goal.metricType === "PACE") {
    const label = goal.config?.benchmarkLabel ?? (goal.config?.benchmarkDistanceMi ? `${goal.config.benchmarkDistanceMi.toFixed(2)} mi` : null);
    return label ? `${formatSeconds(value)} (${label})` : formatSeconds(value);
  }
  if (goal.metricType === "MAX_WEIGHT") return `${value.toFixed(1)} lb`;
  if (goal.metricType === "VOLUME") return `${value.toFixed(0)} lb`;
  if (goal.metricType === "REPS" || goal.metricType === "SETS" || goal.metricType === "SESSIONS" || goal.metricType === "COMPLETED") {
    return value.toFixed(0);
  }
  return value.toFixed(1);
}

function summaryLabel(goal: GoalWithConfig, targetLabel: string) {
  const timeframe = GOAL_TIMEFRAME_LABELS[goal.timeframe as GoalTimeframeValue].toLowerCase();
  const metric = GOAL_METRIC_LABELS[goal.metricType as GoalMetricTypeValue].toLowerCase();
  return `${targetLabel} | ${metric} | ${timeframe}`;
}

function statusForGoal(goal: GoalWithConfig, actualValue: number, elapsedFraction: number) {
  const lowerIsBetter = metricIsLowerBetter(goal.metricType as GoalMetricTypeValue);
  const progressRatio = lowerIsBetter
    ? actualValue > 0
      ? goal.targetValue / actualValue
      : 0
    : goal.targetValue > 0
    ? actualValue / goal.targetValue
    : 0;

  const isAchieved = lowerIsBetter
    ? actualValue > 0 && actualValue <= goal.targetValue
    : actualValue >= goal.targetValue;

  if (!actualValue) return { label: "No data yet", isAchieved: false, fraction: 0, hasData: false };
  if (isAchieved) return { label: "Achieved", isAchieved: true, fraction: Math.min(1, progressRatio), hasData: true };
  if (goal.timeframe === "ONE_TIME" && !goal.endDate) {
    return { label: "On track", isAchieved: false, fraction: Math.min(1, progressRatio), hasData: true };
  }
  return {
    label: progressRatio >= Math.max(0.15, elapsedFraction) ? "On track" : "Behind",
    isAchieved: false,
    fraction: Math.min(1, progressRatio),
    hasData: true,
  };
}

function recentContributionLabel(goal: GoalWithConfig, log: GoalLog, exerciseIds: Set<string>) {
  return formatMetricValue(goal, metricForLog(goal, log, exerciseIds));
}

async function buildGoalInsight(goal: Goal) {
  const parsedGoal = toGoalWithConfig(goal);
  const descriptor = await getTargetDescriptor(parsedGoal);
  const window = currentWindowForGoal(parsedGoal);
  const allLogs = await getLogsForGoal(parsedGoal, descriptor, window.historyStart, window.historyEnd);
  const currentLogs = allLogs.filter(
    (log) =>
      log.performedAt.getTime() >= window.currentStart.getTime() &&
      log.performedAt.getTime() <= window.currentEnd.getTime()
  );
  const distinctCurrentLogs = distinctLogs(currentLogs);
  const exerciseIds = new Set(descriptor.filter.exerciseIds);
  const actualValue = currentValueForGoal(parsedGoal, distinctCurrentLogs, exerciseIds);
  const status = statusForGoal(parsedGoal, actualValue, window.elapsedFraction);

  const recentItems = distinctCurrentLogs.slice(0, 8).map((log) => ({
    id: log.id,
    routineId: log.routineId,
    routineName: log.routine.name,
    performedAt: log.performedAt,
    contributionLabel: recentContributionLabel(parsedGoal, log, exerciseIds),
  }));

  return {
    goal: parsedGoal,
    targetLabel: descriptor.label,
    targetKindLabel: descriptor.kindLabel,
    targetHref: descriptor.href,
    goalTypeLabel: GOAL_TYPE_LABELS[parsedGoal.goalType as GoalTypeValue],
    metricLabel: GOAL_METRIC_LABELS[parsedGoal.metricType as GoalMetricTypeValue],
    timeframeLabel: GOAL_TIMEFRAME_LABELS[parsedGoal.timeframe as GoalTimeframeValue],
    timeframeStatusLabel: status.label,
    timeframeWindowLabel: window.currentLabel,
    summaryLabel: summaryLabel(parsedGoal, descriptor.label),
    actualValue,
    targetValue: parsedGoal.targetValue,
    actualDisplay: formatMetricValue(parsedGoal, actualValue),
    targetDisplay: formatMetricValue(parsedGoal, parsedGoal.targetValue),
    fractionComplete: status.fraction,
    isAchieved: status.isAchieved,
    hasData: status.hasData,
    history: aggregateHistory(parsedGoal, allLogs, exerciseIds),
    recentItems,
  } satisfies GoalInsight;
}

export async function getGoalFormOptions(): Promise<GoalFormOptions> {
  const [routines, exercises, groups] = await Promise.all([
    prisma.routine.findMany({
      where: { isDeleted: false },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, kind: true, subtype: true },
    }),
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, supportsWeight: true },
    }),
    prisma.metadataGroup.findMany({
      orderBy: [{ kind: "asc" }, { label: "asc" }],
      select: { id: true, label: true, kind: true },
    }),
  ]);

  const cardioTargets = groups.filter((group) => cardioKinds.includes(group.kind));
  const standardGroups = groups.filter((group) => !cardioKinds.includes(group.kind));

  return {
    routines: routines.map((routine) => ({
      id: routine.id,
      label: routine.name,
      subtitle: `${routine.category} | ${routine.kind}${routine.subtype ? ` | ${formatRoutineSubtype(routine.subtype)}` : ""}`,
    })),
    exercises: exercises.map((exercise) => ({
      id: exercise.id,
      label: exercise.name,
      subtitle: `${exercise.unit}${exercise.supportsWeight ? " | Weighted" : ""}`,
    })),
    cardioTargets: cardioTargets.map((group) => ({
      id: group.id,
      label: group.label,
      subtitle: formatMetadataGroupKind(group.kind),
    })),
    groups: standardGroups.map((group) => ({
      id: group.id,
      label: group.label,
      subtitle: formatMetadataGroupKind(group.kind),
    })),
  };
}

export async function getGoalsOverview(filters: GoalListFilters = {}) {
  const where = {
    ...(filters.type && filters.type !== "all" ? { goalType: filters.type as GoalTypeValue } : {}),
    ...(filters.active === "active" ? { isActive: true } : filters.active === "inactive" ? { isActive: false } : {}),
  };
  const goals = await prisma.goal.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  const insights = await Promise.all(goals.map((goal) => buildGoalInsight(goal)));
  return insights;
}

export async function getGoalById(goalId: string) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  return goal ? toGoalWithConfig(goal) : null;
}

export async function getGoalInsight(goalId: string) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) return null;
  return buildGoalInsight(goal);
}

export function getMetricOptionsFor(goalType: GoalTypeValue, targetType: GoalTargetTypeValue) {
  return getAllowedMetricTypes(goalType, targetType).map((value) => ({
    value,
    label: GOAL_METRIC_LABELS[value],
  }));
}

export function goalTargetTypeOptions() {
  return (["ROUTINE", "EXERCISE", "CARDIO", "GROUP"] as const).map((value) => ({
    value,
    label: GOAL_TARGET_TYPE_LABELS[value],
  }));
}

export function goalTypeOptions() {
  return (["FREQUENCY", "VOLUME", "PERFORMANCE", "COMPLETION"] as const).map((value) => ({
    value,
    label: GOAL_TYPE_LABELS[value],
  }));
}

export function goalTimeframeOptions() {
  return (["DAY", "WEEK", "MONTH", "ONE_TIME"] as const).map((value) => ({
    value,
    label: GOAL_TIMEFRAME_LABELS[value],
  }));
}

export function formatGoalDate(date: Date) {
  return formatAppDate(date);
}

export function formatGoalDateTime(date: Date) {
  return formatAppDateTime(date);
}

export async function getChartGoalReference(params: {
  candidates: GoalChartCandidate[];
  metricType: GoalMetricTypeValue;
  timeframe: GoalTimeframeValue;
}) {
  const filteredCandidates = params.candidates.filter((candidate) => candidate.targetId);
  if (filteredCandidates.length === 0) return null;

  const goals = await prisma.goal.findMany({
    where: {
      isActive: true,
      metricType: params.metricType,
      timeframe: params.timeframe,
      OR: filteredCandidates.map((candidate) => ({
        targetType: candidate.targetType,
        targetId: candidate.targetId,
      })),
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (goals.length === 0) return null;

  const ranked = filteredCandidates
    .map((candidate, index) => ({
      index,
      goal: goals.find(
        (goal) => goal.targetType === candidate.targetType && goal.targetId === candidate.targetId
      ),
    }))
    .find((entry) => entry.goal);

  const goal = ranked?.goal ?? goals[0];
  const parsedGoal = toGoalWithConfig(goal);
  const valueText = formatMetricValue(parsedGoal, parsedGoal.targetValue);

  return {
    goalId: goal.id,
    goalName: goal.name,
    targetValue: goal.targetValue,
    label: `${goal.name} (${valueText})`,
    unit: goal.unit ?? undefined,
    decimals:
      goal.metricType === "DISTANCE" ? 1 : goal.metricType === "MAX_WEIGHT" ? 1 : 0,
  } satisfies GoalChartReference;
}
