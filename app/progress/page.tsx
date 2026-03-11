import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getWeekBoundsSunday } from "@/lib/week";
import {
  GOAL_TYPE,
  aggregateWeeklyMileageSeries,
  aggregateRunStats,
  dateYmd,
  formatDuration,
  formatPace,
  normalizeProgressRange,
  parseExerciseRepsAtWeightGoalType,
  parseRunLongestGoalType,
  parseRunWeeklyMileageGoalType,
  toPerformedAtFilter,
  type ProgressRange,
  type ProgressView,
} from "@/lib/progress";
import { formatRoutineSubtype, normalizeRoutineKind } from "@/lib/routines";
import ExerciseSearch from "./ExerciseSearch";
import MetricLineChart from "./MetricLineChart";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type ActiveGoalCard = {
  id: string;
  category: string;
  heading: string;
  subheading: string;
  summary: string;
  chips: string[];
  chart: React.ReactNode;
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function rangeLabel(range: ProgressRange) {
  if (range === "week") return "This week";
  if (range === "4w") return "Last 4 weeks";
  if (range === "8w") return "Last 8 weeks";
  if (range === "12w") return "Last 12 weeks";
  return "All time";
}

function getPlannedWeeks(range: ProgressRange): number | null {
  if (range === "week") return 1;
  if (range === "4w") return 4;
  if (range === "8w") return 8;
  if (range === "12w") return 12;
  return null;
}

function routineKindLabel(kind: string) {
  return normalizeRoutineKind(kind);
}

function cardioTypeLabel(value: string | null | undefined) {
  return formatRoutineSubtype(value) || "Cardio";
}

function cardioScopeKey(scope: { kind: "routine"; routineId: string } | { kind: "cardioType"; cardioType: string } | { kind: "allCardio" }) {
  if (scope.kind === "routine") return `routine:${scope.routineId}`;
  if (scope.kind === "cardioType") return `cardioType:${scope.cardioType}`;
  return "allCardio";
}

function goalCategory(type: string) {
  const [prefix] = type.split(":");
  if (prefix === GOAL_TYPE.routinePlannedPerWeek) return "Routine Planning";
  if (prefix === GOAL_TYPE.routineCompletion || prefix === GOAL_TYPE.routineStreak) return "Routine";
  if (prefix === GOAL_TYPE.runWeeklyMileage || prefix === GOAL_TYPE.runLongest) return "Cardio";
  if (
    prefix === GOAL_TYPE.exerciseWeight ||
    prefix === GOAL_TYPE.exerciseAvgRepsPerSet ||
    prefix === GOAL_TYPE.exerciseRepsAtWeight
  ) {
    return "Exercise";
  }
  return "Other";
}

function goalCategoryRank(category: string) {
  if (category === "Routine Planning") return 0;
  if (category === "Routine") return 1;
  if (category === "Cardio") return 2;
  if (category === "Exercise") return 3;
  return 4;
}

function queryString(next: { category: string; range: ProgressRange; view: ProgressView; includeArchived: boolean }) {
  const q = new URLSearchParams();
  if (next.category !== "all") q.set("category", next.category);
  q.set("range", next.range);
  q.set("view", next.view);
  if (next.includeArchived) q.set("includeArchived", "1");
  return q.toString();
}

export default async function ProgressPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const category = getParam(searchParams, "category") ?? "all";
  const range = normalizeProgressRange(getParam(searchParams, "range"));
  const view: ProgressView = "progression";
  const includeArchived = getParam(searchParams, "includeArchived") === "1";
  const exerciseQuery = getParam(searchParams, "exercise") ?? "";
  const selectedExerciseId = getParam(searchParams, "exerciseId") ?? "";

  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const plannedWeeks = getPlannedWeeks(range);
  const performedAt = toPerformedAtFilter(range);

  const [allRoutines, exercises] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        category: string;
        cardioType: string | null;
        kind: string;
        timesPerWeek: number | null;
        isActive: number | boolean;
        exerciseCount: number;
      }>
    >(
      'SELECT r."id", r."name", r."category", r."subtype" as "cardioType", r."kind", r."timesPerWeek", r."isActive", COUNT(re."id") as "exerciseCount" FROM "Routine" r LEFT JOIN "RoutineExercise" re ON re."routineId" = r."id" WHERE r."isDeleted" = false GROUP BY r."id", r."name", r."category", r."subtype", r."kind", r."timesPerWeek", r."isActive" ORDER BY r."category" ASC, r."name" ASC'
    ),
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, supportsWeight: true },
    }),
  ]);

  const activeGoals = await prisma.goal.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, targetValue: true },
  });

  const categories = Array.from(new Set(allRoutines.map((r) => (r.category || "General").trim() || "General"))).sort(
    (a, b) => a.localeCompare(b)
  );

  const filteredRoutines = allRoutines.filter((r) => {
    if (category !== "all" && r.category !== category) return false;
    if (!includeArchived && !Boolean(r.isActive)) return false;
    return true;
  });

  const completionRoutines = filteredRoutines.filter((r) => normalizeRoutineKind(r.kind) === "COMPLETION");
  const progressionRoutines = filteredRoutines.filter((r) => {
    const kind = normalizeRoutineKind(r.kind);
    return kind === "CARDIO" || kind === "WORKOUT";
  });
  const routineById = new Map(allRoutines.map((routine) => [routine.id, routine]));
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  const completionRoutineIds = completionRoutines.map((r) => r.id);
  const progressionRoutineIds = progressionRoutines.map((r) => r.id);
  const runRoutineIds = progressionRoutines.filter((r) => normalizeRoutineKind(r.kind) === "CARDIO").map((r) => r.id);
  const workoutRoutineIds = progressionRoutines.filter((r) => normalizeRoutineKind(r.kind) === "WORKOUT").map((r) => r.id);
  const activeExerciseGoalIds = Array.from(
    new Set(
      activeGoals
        .map((goal) => {
          if (goal.type.startsWith(`${GOAL_TYPE.exerciseWeight}:`)) return goal.type.split(":")[1];
          if (goal.type.startsWith(`${GOAL_TYPE.exerciseAvgRepsPerSet}:`)) return goal.type.split(":")[1];
          const repsAtWeight = parseExerciseRepsAtWeightGoalType(goal.type);
          return repsAtWeight?.exerciseId;
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  const whereCompletionSelected = {
    routineId: { in: completionRoutineIds.length ? completionRoutineIds : ["__none__"] },
    ...(performedAt ? { performedAt } : {}),
  };

  const whereProgressSelected = {
    routineId: { in: progressionRoutineIds.length ? progressionRoutineIds : ["__none__"] },
    ...(performedAt ? { performedAt } : {}),
  };

  const [
    completionCounts,
    progressSelectedCounts,
    ytdCounts,
    latestCompletionDates,
    completionLogsForWeeks,
    runLogs,
    setRows,
    goalExerciseSessions,
  ] = await Promise.all([
    prisma.routineLog.groupBy({
      by: ["routineId"],
      where: whereCompletionSelected,
      _count: { _all: true },
    }),
    prisma.routineLog.groupBy({
      by: ["routineId"],
      where: whereProgressSelected,
      _count: { _all: true },
      _max: { performedAt: true },
    }),
    prisma.routineLog.groupBy({
      by: ["routineId"],
      where: {
        routineId: { in: completionRoutineIds.length ? completionRoutineIds : ["__none__"] },
        performedAt: { gte: ytdStart },
      },
      _count: { _all: true },
    }),
    prisma.routineLog.groupBy({
      by: ["routineId"],
      where: { routineId: { in: completionRoutineIds.length ? completionRoutineIds : ["__none__"] } },
      _max: { performedAt: true },
    }),
    prisma.routineLog.findMany({
      where: whereCompletionSelected,
      select: { routineId: true, performedAt: true },
    }),
    prisma.routineLog.findMany({
      where: {
        routineId: { in: runRoutineIds.length ? runRoutineIds : ["__none__"] },
        ...(performedAt ? { performedAt } : {}),
        distanceMi: { not: null },
        durationSec: { not: null },
      },
      orderBy: [{ routineId: "asc" }, { performedAt: "asc" }],
      select: { routineId: true, performedAt: true, distanceMi: true, durationSec: true },
    }),
    prisma.setEntry.findMany({
      where: {
        sessionExercise: {
          routineLog: {
            routineId: { in: workoutRoutineIds.length ? workoutRoutineIds : ["__none__"] },
            ...(performedAt ? { performedAt } : {}),
          },
        },
      },
      select: {
        reps: true,
        weightLb: true,
        sessionExercise: { select: { routineLog: { select: { routineId: true } } } },
      },
    }),
    prisma.sessionExercise.findMany({
      where: {
        exerciseId: { in: activeExerciseGoalIds.length > 0 ? activeExerciseGoalIds : ["__none__"] },
        routineLog: {
          ...(performedAt ? { performedAt } : {}),
          ...((category !== "all" || !includeArchived)
            ? {
                routine: {
                  ...(category !== "all" ? { category } : {}),
                  ...(!includeArchived ? { isActive: true } : {}),
                },
              }
            : {}),
        },
      },
      orderBy: { routineLog: { performedAt: "asc" } },
      select: {
        exerciseId: true,
        routineLog: { select: { performedAt: true, routine: { select: { id: true, name: true } } } },
        sets: { orderBy: { setNumber: "asc" }, select: { reps: true, seconds: true, weightLb: true } },
      },
    }),
  ]);

  const completionMap = new Map(completionCounts.map((x) => [x.routineId, x._count._all]));
  const selectedProgressSessionMap = new Map(
    progressSelectedCounts.map((x) => [x.routineId, { sessions: x._count._all, lastPerformedAt: x._max.performedAt }])
  );
  const ytdMap = new Map(ytdCounts.map((x) => [x.routineId, x._count._all]));
  const latestDateMap = new Map(latestCompletionDates.map((x) => [x.routineId, x._max.performedAt]));

  const weeklyCountMap = new Map<string, Map<string, number>>();
  for (const log of completionLogsForWeeks) {
    const weekKey = dateYmd(getWeekBoundsSunday(log.performedAt).start);
    if (!weeklyCountMap.has(log.routineId)) weeklyCountMap.set(log.routineId, new Map<string, number>());
    const routineWeeks = weeklyCountMap.get(log.routineId)!;
    routineWeeks.set(weekKey, (routineWeeks.get(weekKey) ?? 0) + 1);
  }

  const weeksMetMap = new Map<string, number>();
  for (const routine of completionRoutines) {
    const target = routine.timesPerWeek ?? 0;
    if (target <= 0) {
      weeksMetMap.set(routine.id, 0);
      continue;
    }

    const routineWeeks = weeklyCountMap.get(routine.id) ?? new Map<string, number>();
    const weeksMet = Array.from(routineWeeks.values()).filter((count) => count >= target).length;
    weeksMetMap.set(routine.id, weeksMet);
  }

  const runStatsMap = new Map<string, ReturnType<typeof aggregateRunStats>>();
  const runLongestMap = new Map<string, number>();
  const runPreviewSeriesMap = new Map<string, Array<{ label: string; value: number }>>();
  const runDistanceSeriesMap = new Map<string, Array<{ label: string; value: number }>>();
  const runWeeklyGoalMap = new Map<string, number>();
  const runLongestGoalMap = new Map<string, number>();
  const routinePlannedGoalMap = new Map<string, number>();
  const routineCompletionGoalMap = new Map<string, number>();
  const routineStreakGoalMap = new Map<string, number>();
  const exerciseWeightGoalMap = new Map<string, number>();
  const exerciseAvgRepsGoalMap = new Map<string, number>();
  const exerciseRepsAtWeightGoalMap = new Map<string, { weightLb: number; repsTarget: number }>();
  const exerciseWeightSeriesMap = new Map<string, Array<{ label: string; value: number; detailLines?: string[] }>>();
  const exerciseAvgRepsSeriesMap = new Map<string, Array<{ label: string; value: number; detailLines?: string[] }>>();
  const exerciseRepsAtWeightSeriesMap = new Map<string, Array<{ label: string; value: number; detailLines?: string[] }>>();

  for (const id of runRoutineIds) {
    const logs = runLogs.filter((x) => x.routineId === id);
    runStatsMap.set(id, aggregateRunStats(logs));
    runPreviewSeriesMap.set(id, aggregateWeeklyMileageSeries(logs));
    runDistanceSeriesMap.set(
      id,
      logs.map((log) => ({
        label: dateYmd(log.performedAt),
        value: log.distanceMi ?? 0,
      }))
    );
    runLongestMap.set(
      id,
      Math.max(
        0,
        ...logs.map((x) => (x.distanceMi !== null && Number.isFinite(x.distanceMi) ? x.distanceMi : 0))
      )
    );
  }

  for (const goal of activeGoals) {
    if (goal.type.startsWith(`${GOAL_TYPE.routinePlannedPerWeek}:`)) {
      const routineId = goal.type.split(":")[1];
      if (routineId && !routinePlannedGoalMap.has(routineId)) routinePlannedGoalMap.set(routineId, goal.targetValue);
    }
    if (goal.type.startsWith(`${GOAL_TYPE.routineCompletion}:`)) {
      const routineId = goal.type.split(":")[1];
      if (routineId && !routineCompletionGoalMap.has(routineId)) routineCompletionGoalMap.set(routineId, goal.targetValue);
    }
    if (goal.type.startsWith(`${GOAL_TYPE.routineStreak}:`)) {
      const routineId = goal.type.split(":")[1];
      if (routineId && !routineStreakGoalMap.has(routineId)) routineStreakGoalMap.set(routineId, goal.targetValue);
    }
    if (goal.type.startsWith(`${GOAL_TYPE.runWeeklyMileage}:`)) {
      const scope = parseRunWeeklyMileageGoalType(goal.type);
      if (scope?.kind === "routine" && !runWeeklyGoalMap.has(scope.routineId)) {
        runWeeklyGoalMap.set(scope.routineId, goal.targetValue);
      }
    }
    if (goal.type.startsWith(`${GOAL_TYPE.runLongest}:`)) {
      const scope = parseRunLongestGoalType(goal.type);
      if (scope?.kind === "routine" && !runLongestGoalMap.has(scope.routineId)) {
        runLongestGoalMap.set(scope.routineId, goal.targetValue);
      }
    }
    if (goal.type.startsWith(`${GOAL_TYPE.exerciseWeight}:`)) {
      const exerciseId = goal.type.split(":")[1];
      if (exerciseId && !exerciseWeightGoalMap.has(exerciseId)) exerciseWeightGoalMap.set(exerciseId, goal.targetValue);
    }
    if (goal.type.startsWith(`${GOAL_TYPE.exerciseAvgRepsPerSet}:`)) {
      const exerciseId = goal.type.split(":")[1];
      if (exerciseId && !exerciseAvgRepsGoalMap.has(exerciseId)) exerciseAvgRepsGoalMap.set(exerciseId, goal.targetValue);
    }
    const repsAtWeight = parseExerciseRepsAtWeightGoalType(goal.type);
    if (repsAtWeight && !exerciseRepsAtWeightGoalMap.has(repsAtWeight.exerciseId)) {
      exerciseRepsAtWeightGoalMap.set(repsAtWeight.exerciseId, {
        weightLb: repsAtWeight.weightLb,
        repsTarget: goal.targetValue,
      });
    }
  }

  for (const session of goalExerciseSessions) {
    const exerciseId = session.exerciseId;
    const weights = session.sets.map((set) => set.weightLb ?? 0);
    const reps = session.sets.map((set) => set.reps ?? 0);
    const label = dateYmd(session.routineLog.performedAt);
    const weightPoint = {
      label,
      value: Math.max(0, ...weights),
      detailLines: weights.map((weight, index) => `S${index + 1}: ${weight.toFixed(1)} lb`),
    };
    const totalReps = reps.reduce((sum, value) => sum + value, 0);
    const avgRepsPoint = {
      label,
      value: session.sets.length > 0 ? totalReps / session.sets.length : 0,
      detailLines: reps.map((rep, index) => `S${index + 1}: ${rep} reps`),
    };
    exerciseWeightSeriesMap.set(exerciseId, [...(exerciseWeightSeriesMap.get(exerciseId) ?? []), weightPoint]);
    exerciseAvgRepsSeriesMap.set(exerciseId, [...(exerciseAvgRepsSeriesMap.get(exerciseId) ?? []), avgRepsPoint]);
  }

  for (const [exerciseId, goal] of exerciseRepsAtWeightGoalMap.entries()) {
    const points = goalExerciseSessions
      .filter((session) => session.exerciseId === exerciseId)
      .map((session) => {
        const matchingSets = session.sets.filter((set) => (set.weightLb ?? 0) >= goal.weightLb);
        return {
          label: dateYmd(session.routineLog.performedAt),
          value: Math.max(0, ...matchingSets.map((set) => set.reps ?? 0)),
          detailLines: matchingSets.map(
            (set, index) => `S${index + 1}: ${(set.reps ?? 0).toFixed(0)} reps @ ${(set.weightLb ?? 0).toFixed(1)} lb`
          ),
        };
      });
    exerciseRepsAtWeightSeriesMap.set(exerciseId, points);
  }

  const selectedExercise = selectedExerciseId ? exercises.find((e) => e.id === selectedExerciseId) : undefined;
  const selectedExerciseSessions = selectedExercise
    ? await prisma.sessionExercise.findMany({
        where: {
          exerciseId: selectedExercise.id,
          routineLog: {
            ...(performedAt ? { performedAt } : {}),
            ...(category !== "all" ? { routine: { category } } : {}),
          },
        },
        orderBy: { routineLog: { performedAt: "asc" } },
        select: {
          id: true,
          routineLog: {
            select: {
              performedAt: true,
              routine: { select: { id: true, name: true, category: true } },
            },
          },
          sets: {
            orderBy: { setNumber: "asc" },
            select: { reps: true, seconds: true, weightLb: true },
          },
        },
      })
    : [];

  const selectedExerciseRows = selectedExerciseSessions.map((session) => {
    const reps = session.sets.map((set) => set.reps ?? 0);
    const weights = session.sets.map((set) => set.weightLb ?? 0);
    const seconds = session.sets.map((set) => set.seconds ?? 0);
    const setSeconds = session.sets
      .map((set) => set.seconds)
      .filter((value): value is number => Number.isFinite(value));
    const setWeights = session.sets
      .map((set) => set.weightLb)
      .filter((value): value is number => Number.isFinite(value));
    const totalReps = reps.reduce((sum, value) => sum + value, 0);
    const totalVolume = session.sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.weightLb ?? 0), 0);
    return {
      id: session.id,
      label: dateYmd(session.routineLog.performedAt),
      performedAt: session.routineLog.performedAt,
      routine: session.routineLog.routine,
      topWeight: Math.max(0, ...weights),
      maxTimeSeconds: Math.max(0, ...seconds),
      totalReps,
      totalSets: session.sets.length,
      totalVolume,
      setReps: reps,
      setSeconds,
      setWeights,
    };
  });
  const selectedIsTimeAndWeight = Boolean(
    selectedExercise && selectedExercise.unit === "TIME" && selectedExercise.supportsWeight
  );
  const selectedPrimaryPoints = selectedExerciseRows.map((row) => ({
    label: row.label,
    value:
      selectedExercise?.unit === "TIME" && !selectedExercise.supportsWeight
        ? row.maxTimeSeconds
        : row.topWeight,
    detailLines:
      selectedExercise?.unit === "TIME" && !selectedExercise.supportsWeight
        ? undefined
        : row.setWeights.map((weight, idx) => `S${idx + 1}: ${weight.toFixed(1)} lb`),
  }));
  const selectedRepsPoints = selectedExerciseRows.map((row) => ({
    label: row.label,
    value: row.totalReps,
    detailLines: row.setReps.map((rep, idx) => `S${idx + 1}: ${rep} reps`),
  }));
  const selectedAvgRepsPoints = selectedExerciseRows.map((row) => ({
    label: row.label,
    value: row.totalSets > 0 ? row.totalReps / row.totalSets : 0,
    detailLines: row.setReps.map((rep, idx) => `S${idx + 1}: ${rep} reps`),
  }));
  const selectedAvgTimePerSetPoints = selectedExerciseRows.map((row) => ({
    label: row.label,
    value: row.setSeconds.length > 0 ? row.setSeconds.reduce((sum, sec) => sum + sec, 0) / row.setSeconds.length : 0,
    detailLines: row.setSeconds.map((sec, idx) => `S${idx + 1}: ${sec.toFixed(1)} sec`),
  }));
  const selectedVolumePoints = selectedExerciseRows.map((row) => ({ label: row.label, value: row.totalVolume }));
  const selectedTopWeight = Math.max(0, ...selectedExerciseRows.map((row) => row.topWeight));
  const selectedMaxTime = Math.max(0, ...selectedExerciseRows.map((row) => row.maxTimeSeconds));
  const selectedTotalReps = selectedExerciseRows.reduce((sum, row) => sum + row.totalReps, 0);
  const selectedTotalVolume = selectedExerciseRows.reduce((sum, row) => sum + row.totalVolume, 0);
  const selectedExerciseRoutines = Array.from(
    new Map(selectedExerciseRows.map((row) => [row.routine.id, row.routine])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const workoutTotalsMap = new Map<string, { totalSets: number; totalReps: number; totalVolume: number }>();
  for (const row of setRows) {
    const routineId = row.sessionExercise.routineLog.routineId;
    const current = workoutTotalsMap.get(routineId) ?? { totalSets: 0, totalReps: 0, totalVolume: 0 };
    const reps = row.reps ?? 0;
    const weight = row.weightLb ?? 0;
    current.totalSets += 1;
    current.totalReps += reps;
    current.totalVolume += reps * weight;
    workoutTotalsMap.set(routineId, current);
  }

  const cardioRoutines = progressionRoutines
    .filter((routine) => normalizeRoutineKind(routine.kind) === "CARDIO")
    .sort((a, b) => a.name.localeCompare(b.name));
  const workoutRoutines = progressionRoutines
    .filter((routine) => normalizeRoutineKind(routine.kind) === "WORKOUT")
    .sort((a, b) => a.name.localeCompare(b.name));
  const orderedCompletionRoutines = [...completionRoutines].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
  );

  const cardioTypePreviewMap = new Map<string, Array<{ label: string; value: number }>>();
  const cardioTypeStatsMap = new Map<string, ReturnType<typeof aggregateRunStats>>();
  const scopedRunWeeklySeriesMap = new Map<string, Array<{ label: string; value: number }>>();
  const scopedRunStatsMap = new Map<string, ReturnType<typeof aggregateRunStats>>();
  const scopedRunDistanceSeriesMap = new Map<string, Array<{ label: string; value: number }>>();
  const allCardioLogs = runLogs.filter((log) => log.distanceMi !== null && log.durationSec !== null);
  scopedRunWeeklySeriesMap.set(cardioScopeKey({ kind: "allCardio" }), aggregateWeeklyMileageSeries(allCardioLogs));
  scopedRunStatsMap.set(cardioScopeKey({ kind: "allCardio" }), aggregateRunStats(allCardioLogs));
  scopedRunDistanceSeriesMap.set(
    cardioScopeKey({ kind: "allCardio" }),
    allCardioLogs.map((log) => ({ label: dateYmd(log.performedAt), value: log.distanceMi ?? 0 }))
  );

  const cardioTypes = Array.from(
    new Set(
      progressionRoutines
        .filter((routine) => normalizeRoutineKind(routine.kind) === "CARDIO")
        .map((routine) => cardioTypeLabel(routine.cardioType))
    )
  ).sort((a, b) => a.localeCompare(b));
  for (const cardioType of cardioTypes) {
    const typeRoutineIds = new Set(
      progressionRoutines
        .filter(
          (routine) =>
            normalizeRoutineKind(routine.kind) === "CARDIO" &&
            cardioTypeLabel(routine.cardioType) === cardioType
        )
        .map((routine) => routine.id)
    );
    const typeLogs = runLogs.filter((log) => typeRoutineIds.has(log.routineId));
    const key = cardioScopeKey({ kind: "cardioType", cardioType });
    scopedRunWeeklySeriesMap.set(key, aggregateWeeklyMileageSeries(typeLogs));
    scopedRunStatsMap.set(key, aggregateRunStats(typeLogs));
    scopedRunDistanceSeriesMap.set(key, typeLogs.map((log) => ({ label: dateYmd(log.performedAt), value: log.distanceMi ?? 0 })));
  }

  for (const routineId of runRoutineIds) {
    const key = cardioScopeKey({ kind: "routine", routineId });
    scopedRunWeeklySeriesMap.set(key, runPreviewSeriesMap.get(routineId) ?? []);
    scopedRunStatsMap.set(key, runStatsMap.get(routineId) ?? { runCount: 0, totalMiles: 0, totalDurationSec: 0, avgPaceSecPerMi: null });
    scopedRunDistanceSeriesMap.set(key, runDistanceSeriesMap.get(routineId) ?? []);
  }

  for (const cardioType of cardioTypes) {
    const routineIds = new Set(
      cardioRoutines
        .filter((routine) => cardioTypeLabel(routine.cardioType) === cardioType)
        .map((routine) => routine.id)
    );
    const logs = runLogs.filter((log) => routineIds.has(log.routineId));
    cardioTypePreviewMap.set(cardioType, aggregateWeeklyMileageSeries(logs));
    cardioTypeStatsMap.set(cardioType, aggregateRunStats(logs));
  }

  const currentWeekKey = dateYmd(getWeekBoundsSunday(now).start);
  function currentRoutineStreak(routineId: string) {
    const routine = routineById.get(routineId);
    const weeklyTarget = routineCompletionGoalMap.get(routineId) ?? routine?.timesPerWeek ?? 0;
    if (!weeklyTarget || weeklyTarget <= 0) return 0;

    let cursor = currentWeekKey;
    let streak = 0;
    while (true) {
      const count = weeklyCountMap.get(routineId)?.get(cursor) ?? 0;
      if (count < weeklyTarget) break;
      streak += 1;
      const cursorDate = new Date(`${cursor}T00:00:00.000Z`);
      cursorDate.setUTCDate(cursorDate.getUTCDate() - 7);
      cursor = dateYmd(cursorDate);
    }
    return streak;
  }

  const activeGoalCards = activeGoals.reduce<ActiveGoalCard[]>((cards, goal) => {
      let card: ActiveGoalCard | null = null;
      if (goal.type.startsWith(`${GOAL_TYPE.routineCompletion}:`)) {
        const routineId = goal.type.split(":")[1];
        const routine = routineById.get(routineId);
        if (!routine) return cards;
        const points = Array.from((weeklyCountMap.get(routineId) ?? new Map<string, number>()).entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([label, value]) => ({ label, value }));
        card = {
          id: goal.id,
          category: goalCategory(goal.type),
          heading: `${routine.name} completion`,
          subheading: `${routine.category} | ${routineKindLabel(routine.kind)}`,
          summary: `Completed ${completionMap.get(routineId) ?? 0} times in ${rangeLabel(range).toLowerCase()}.`,
          chips: [
            `Current: ${completionMap.get(routineId) ?? 0}`,
            `Target: ${goal.targetValue.toFixed(0)}`,
            `Weeks met: ${weeksMetMap.get(routineId) ?? 0}${plannedWeeks ? ` / ${plannedWeeks}` : ""}`,
            `YTD: ${ytdMap.get(routineId) ?? 0}`,
          ],
          chart: (
            <MetricLineChart
              title="Weekly completions"
              yLabel="Completions"
              xLabel="Week"
              points={points}
              valueLabel="Completions"
              decimals={0}
              yAxisTicks={Array.from({ length: Math.ceil(Math.max(...points.map((point) => point.value), goal.targetValue)) + 1 }, (_, index) => index)}
              targetValue={goal.targetValue}
              targetLabel="Completion goal"
              targetDecimals={0}
              compact={true}
            />
          ),
        };
      } else if (goal.type.startsWith(`${GOAL_TYPE.routinePlannedPerWeek}:`)) {
        const routineId = goal.type.split(":")[1];
        const routine = routineById.get(routineId);
        if (!routine) return cards;
        card = {
          id: goal.id,
          category: goalCategory(goal.type),
          heading: `${routine.name} planning target`,
          subheading: `${routine.category} | ${routineKindLabel(routine.kind)}`,
          summary: "Planning goals adjust the routine's weekly scheduling target.",
          chips: [
            `Routine target: ${routine.timesPerWeek ?? 0}`,
            `Goal target: ${goal.targetValue.toFixed(0)}`,
          ],
          chart: null,
        };
      } else if (goal.type.startsWith(`${GOAL_TYPE.routineStreak}:`)) {
        const routineId = goal.type.split(":")[1];
        const routine = routineById.get(routineId);
        if (!routine) return cards;
        const streak = currentRoutineStreak(routineId);
        card = {
          id: goal.id,
          category: goalCategory(goal.type),
          heading: `${routine.name} streak`,
          subheading: `${routine.category} | ${routineKindLabel(routine.kind)}`,
          summary: "Current streak is based on consecutive weeks meeting the routine's weekly completion target.",
          chips: [
            `Current streak: ${streak}`,
            `Goal streak: ${goal.targetValue.toFixed(0)}`,
            `Weekly target: ${(routineCompletionGoalMap.get(routineId) ?? routine.timesPerWeek ?? 0).toFixed(0)}`,
          ],
          chart: null,
        };
      } else if (goal.type.startsWith(`${GOAL_TYPE.runWeeklyMileage}:`)) {
        const scope = parseRunWeeklyMileageGoalType(goal.type);
        if (!scope) return cards;
        const key = cardioScopeKey(scope);
        const points = scopedRunWeeklySeriesMap.get(key) ?? [];
        const stats = scopedRunStatsMap.get(key) ?? { runCount: 0, totalMiles: 0, totalDurationSec: 0, avgPaceSecPerMi: null };
        const currentMiles = points.length > 0 ? points[points.length - 1].value : 0;
        const heading =
          scope.kind === "allCardio"
            ? "All cardio weekly mileage"
            : scope.kind === "cardioType"
              ? `${scope.cardioType} weekly mileage`
              : `${routineById.get(scope.routineId)?.name ?? "Cardio"} weekly mileage`;
        const subheading =
          scope.kind === "routine"
            ? `${routineById.get(scope.routineId)?.category ?? "General"} | CARDIO`
            : "Cardio mileage goal";
        card = {
          id: goal.id,
          category: goalCategory(goal.type),
          heading,
          subheading,
          summary: `Current weekly mileage is ${currentMiles.toFixed(2)} miles across ${stats.runCount} cardio sessions in ${rangeLabel(range).toLowerCase()}.`,
          chips: [
            `Current miles: ${currentMiles.toFixed(2)}`,
            `Goal miles: ${goal.targetValue.toFixed(2)}`,
            `Avg pace: ${formatPace(stats.avgPaceSecPerMi)}`,
          ],
          chart: (
            <MetricLineChart
              title="Weekly mileage"
              yLabel="Miles"
              xLabel="Week"
              points={points}
              valueLabel="Miles"
              unit="mi"
              decimals={2}
              targetValue={goal.targetValue}
              targetLabel="Mileage goal"
              targetUnit="mi"
              targetDecimals={2}
              compact={true}
            />
          ),
        };
      } else if (goal.type.startsWith(`${GOAL_TYPE.runLongest}:`)) {
        const scope = parseRunLongestGoalType(goal.type);
        if (!scope) return cards;
        const key = cardioScopeKey(scope);
        const stats = scopedRunStatsMap.get(key) ?? { runCount: 0, totalMiles: 0, totalDurationSec: 0, avgPaceSecPerMi: null };
        const points = scopedRunDistanceSeriesMap.get(key) ?? [];
        const currentLongest = Math.max(0, ...points.map((point) => point.value));
        const heading =
          scope.kind === "allCardio"
            ? "All cardio longest session"
            : scope.kind === "cardioType"
              ? `${scope.cardioType} longest session`
              : `${routineById.get(scope.routineId)?.name ?? "Cardio"} longest session`;
        card = {
          id: goal.id,
          category: goalCategory(goal.type),
          heading,
          subheading: "Cardio distance goal",
          summary: `Longest logged session in this filter is ${currentLongest.toFixed(2)} miles.`,
          chips: [
            `Current longest: ${currentLongest.toFixed(2)} mi`,
            `Goal longest: ${goal.targetValue.toFixed(2)} mi`,
            `Sessions: ${stats.runCount}`,
          ],
          chart: (
            <MetricLineChart
              title="Session distance"
              yLabel="Miles"
              xLabel="Session"
              points={points}
              valueLabel="Miles"
              unit="mi"
              decimals={2}
              targetValue={goal.targetValue}
              targetLabel="Longest goal"
              targetUnit="mi"
              targetDecimals={2}
              compact={true}
            />
          ),
        };
      } else if (goal.type.startsWith(`${GOAL_TYPE.exerciseWeight}:`)) {
        const exerciseId = goal.type.split(":")[1];
        const exercise = exerciseById.get(exerciseId);
        if (!exercise) return cards;
        const points = exerciseWeightSeriesMap.get(exerciseId) ?? [];
        const currentTop = Math.max(0, ...points.map((point) => point.value));
        card = {
          id: goal.id,
          category: goalCategory(goal.type),
          heading: `${exercise.name} top weight`,
          subheading: "Exercise progression goal",
          summary: `Best top weight in this filter is ${currentTop.toFixed(1)} lb.`,
          chips: [`Current: ${currentTop.toFixed(1)} lb`, `Goal: ${goal.targetValue.toFixed(1)} lb`],
          chart: (
            <MetricLineChart
              title="Top weight"
              yLabel="Weight"
              xLabel="Session"
              points={points}
              valueLabel="Weight"
              unit="lb"
              decimals={1}
              targetValue={goal.targetValue}
              targetLabel="Weight goal"
              targetUnit="lb"
              targetDecimals={1}
              compact={true}
            />
          ),
        };
      } else if (goal.type.startsWith(`${GOAL_TYPE.exerciseAvgRepsPerSet}:`)) {
        const exerciseId = goal.type.split(":")[1];
        const exercise = exerciseById.get(exerciseId);
        if (!exercise) return cards;
        const points = exerciseAvgRepsSeriesMap.get(exerciseId) ?? [];
        const latest = points.length > 0 ? points[points.length - 1].value : 0;
        card = {
          id: goal.id,
          category: goalCategory(goal.type),
          heading: `${exercise.name} avg reps per set`,
          subheading: "Exercise progression goal",
          summary: `Latest average reps per set is ${latest.toFixed(1)}.`,
          chips: [`Latest: ${latest.toFixed(1)}`, `Goal: ${goal.targetValue.toFixed(1)}`],
          chart: (
            <MetricLineChart
              title="Avg reps per set"
              yLabel="Reps/Set"
              xLabel="Session"
              points={points}
              valueLabel="Avg reps"
              decimals={1}
              targetValue={goal.targetValue}
              targetLabel="Avg reps goal"
              targetDecimals={1}
              compact={true}
            />
          ),
        };
      } else {
        const repsAtWeight = parseExerciseRepsAtWeightGoalType(goal.type);
        if (!repsAtWeight) return cards;
        const exercise = exerciseById.get(repsAtWeight.exerciseId);
        if (!exercise) return cards;
        const points = exerciseRepsAtWeightSeriesMap.get(repsAtWeight.exerciseId) ?? [];
        const currentBest = Math.max(0, ...points.map((point) => point.value));
        card = {
          id: goal.id,
          category: goalCategory(goal.type),
          heading: `${exercise.name} reps @ ${repsAtWeight.weightLb.toFixed(1)} lb`,
          subheading: "Exercise progression goal",
          summary: `Best matching set reached ${currentBest.toFixed(0)} reps at or above ${repsAtWeight.weightLb.toFixed(1)} lb.`,
          chips: [
            `Current best: ${currentBest.toFixed(0)} reps`,
            `Goal: ${goal.targetValue.toFixed(0)} reps`,
            `Weight floor: ${repsAtWeight.weightLb.toFixed(1)} lb`,
          ],
          chart: (
            <MetricLineChart
              title="Reps at target weight"
              yLabel="Reps"
              xLabel="Session"
              points={points}
              valueLabel="Reps"
              decimals={0}
              yAxisTicks={Array.from({ length: Math.ceil(Math.max(...points.map((point) => point.value), goal.targetValue)) + 1 }, (_, index) => index)}
              targetValue={goal.targetValue}
              targetLabel="Reps goal"
              targetDecimals={0}
              compact={true}
            />
          ),
        };
      }

      if (card) cards.push(card);
      return cards;
    }, []);
  const activeGoalGroups = new Map<string, ActiveGoalCard[]>();
  for (const goal of activeGoalCards) {
    if (!activeGoalGroups.has(goal.category)) activeGoalGroups.set(goal.category, []);
    activeGoalGroups.get(goal.category)!.push(goal);
  }
  const orderedActiveGoalCategories = Array.from(activeGoalGroups.keys()).sort(
    (a, b) => goalCategoryRank(a) - goalCategoryRank(b) || a.localeCompare(b)
  );
  return (
    <div className="mobileProgressPage" style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div className="mobileProgressTopRow" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Progress</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            {rangeLabel(range)}{category === "all" ? " | All categories" : ` | ${category}`}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, padding: 14 }}>
        <form method="get" style={{ display: "grid", gap: 14 }}>
          <input type="hidden" name="view" value="progression" />
          <div className="mobileProgressFilterRow" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            <ExerciseSearch
              exercises={exercises}
              initialQuery={exerciseQuery}
              selectedExerciseId={selectedExerciseId}
            />
          </div>

          <div className="mobileProgressFilterGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.65, fontWeight: 800 }}>Category</span>
              <select
                name="category"
                defaultValue={category}
                style={{ background: "#111b2e", color: "rgba(255,255,255,0.92)", opacity: 0.95 }}
              >
                <option value="all">All categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.65, fontWeight: 800 }}>Time range</span>
              <select
                name="range"
                defaultValue={range}
                style={{ background: "#111b2e", color: "rgba(255,255,255,0.92)", opacity: 0.95 }}
              >
                <option value="week">week</option>
                <option value="4w">4 weeks</option>
                <option value="8w">8 weeks</option>
                <option value="12w">12 weeks</option>
                <option value="all">all time</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.65, fontWeight: 800 }}>Archived</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input type="checkbox" name="includeArchived" value="1" defaultChecked={includeArchived} />
                Include inactive routines
              </span>
            </label>

            <div style={{ display: "flex", alignItems: "end" }}>
              <button type="submit" style={{ width: "100%" }}>
                Apply Filters
              </button>
            </div>
          </div>
        </form>
      </div>

      <section style={{ marginTop: 16, border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, overflow: "hidden" }}>
        <details open style={sectionDetails}>
          <summary data-collapsible-summary style={sectionSummary}>ACTIVE GOALS</summary>
          <div style={{ padding: 12, display: "grid", gap: 12 }}>
            {activeGoalCards.length === 0 && (
              <div style={{ opacity: 0.75, fontSize: 13 }}>No active goals in the current filter.</div>
            )}
            {orderedActiveGoalCategories.map((categoryName) => (
              <details key={categoryName} open style={goalCategoryDetailsStyle}>
                <summary data-collapsible-summary style={goalCategorySummaryStyle}>
                  {categoryName.toUpperCase()} ({(activeGoalGroups.get(categoryName) ?? []).length})
                </summary>
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {(activeGoalGroups.get(categoryName) ?? []).map((goal) => (
                    <div key={goal.id} style={goalCardStyle}>
                      <div className="mobileProgressGoalHeader" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 900 }}>{goal.heading}</div>
                          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>{goal.subheading}</div>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8, maxWidth: 320 }}>{goal.summary}</div>
                      </div>
                      <div className="mobileProgressGoalChips" style={{ marginTop: 10, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                        {goal.chips.map((chip) => (
                          <div key={`${goal.id}-${chip}`} style={metricChip}>
                            {chip}
                          </div>
                        ))}
                      </div>
                      {goal.chart && <div style={{ marginTop: 10 }}>{goal.chart}</div>}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      </section>

      {selectedExercise && (
        <section style={{ marginTop: 16, border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, overflow: "hidden" }}>
          <details open style={sectionDetails}>
            <summary data-collapsible-summary style={sectionSummary}>
              EXERCISE SNAPSHOT: {selectedExercise.name}
            </summary>
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
            <div className="mobileProgressExerciseStats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                <div style={metricChip}>Sessions: {selectedExerciseRows.length}</div>
                <div style={metricChip}>Top weight: {selectedTopWeight.toFixed(1)} lb</div>
                <div style={metricChip}>Max time: {selectedMaxTime.toFixed(0)} sec</div>
                <div style={metricChip}>Total reps: {selectedTotalReps}</div>
                <div style={metricChip}>Total volume: {selectedTotalVolume.toFixed(1)}</div>
                {exerciseWeightGoalMap.has(selectedExercise.id) && (
                  <div style={metricChip}>
                    Goal {selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "time" : "weight"}:{" "}
                    {exerciseWeightGoalMap.get(selectedExercise.id)?.toFixed(
                      selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? 0 : 1
                    )}{" "}
                    {selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "sec" : "lb"}
                  </div>
                )}
                {exerciseAvgRepsGoalMap.has(selectedExercise.id) && (
                  <div style={metricChip}>Goal avg reps/set: {exerciseAvgRepsGoalMap.get(selectedExercise.id)?.toFixed(1)}</div>
                )}
                {exerciseRepsAtWeightGoalMap.has(selectedExercise.id) && (
                  <div style={metricChip}>
                    Goal reps @ wt: {exerciseRepsAtWeightGoalMap.get(selectedExercise.id)?.repsTarget.toFixed(0)} @{" "}
                    {exerciseRepsAtWeightGoalMap.get(selectedExercise.id)?.weightLb.toFixed(1)} lb
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart
                  title={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "Time" : "Weight"}
                  yLabel={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "Time" : "Weight"}
                  xLabel="Session"
                  points={selectedPrimaryPoints}
                  valueLabel={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "Time" : "Weight"}
                  unit={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "sec" : "lb"}
                  decimals={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? 0 : 1}
                  targetValue={
                    exerciseWeightGoalMap.get(selectedExercise.id) ??
                    exerciseRepsAtWeightGoalMap.get(selectedExercise.id)?.weightLb
                  }
                  targetLabel={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "Time goal" : "Weight goal"}
                  targetUnit={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? "sec" : "lb"}
                  targetDecimals={selectedExercise.unit === "TIME" && !selectedExercise.supportsWeight ? 0 : 1}
                  compact={true}
                />
                {selectedIsTimeAndWeight ? (
                  <MetricLineChart
                    title="Avg Time per Set"
                    yLabel="Time/Set"
                    xLabel="Session"
                    points={selectedAvgTimePerSetPoints}
                    valueLabel="Avg Time/Set"
                    unit="sec"
                    decimals={1}
                    compact={true}
                  />
                ) : (
                  <>
                    <MetricLineChart
                      title="Total Reps"
                      yLabel="Reps"
                      xLabel="Session"
                      points={selectedRepsPoints}
                      valueLabel="Reps"
                      decimals={0}
                      compact={true}
                    />
                    <MetricLineChart
                      title="Avg Reps per Set"
                      yLabel="Reps/Set"
                      xLabel="Session"
                      points={selectedAvgRepsPoints}
                      valueLabel="Avg Reps/Set"
                      decimals={1}
                      targetValue={
                        exerciseRepsAtWeightGoalMap.get(selectedExercise.id)?.repsTarget ??
                        exerciseAvgRepsGoalMap.get(selectedExercise.id)
                      }
                      targetLabel={
                        exerciseRepsAtWeightGoalMap.has(selectedExercise.id) ? "Reps goal @ weight" : "Avg reps goal"
                      }
                      targetDecimals={1}
                      compact={true}
                    />
                  </>
                )}
                <MetricLineChart
                  title="Total Volume"
                  yLabel="Volume"
                  xLabel="Session"
                  points={selectedVolumePoints}
                  valueLabel="Volume"
                  decimals={1}
                  compact={true}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>ROUTINES USING THIS EXERCISE</div>
                {selectedExerciseRoutines.length === 0 && (
                  <div style={{ opacity: 0.75, fontSize: 13 }}>No matching sessions for this exercise in the selected filters.</div>
                )}
              <div className="mobileProgressExerciseRoutineGrid" style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                  {selectedExerciseRoutines.map((routine) => (
                    <Link
                      key={routine.id}
                      href={`/progress/routine/${routine.id}?${queryString({ category, range, view: "progression", includeArchived })}`}
                      style={metricChip}
                    >
                      {routine.name} | {routine.category}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </section>
      )}

      <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
        <section style={{ border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, overflow: "hidden" }}>
          <details open style={sectionDetails}>
            <summary data-collapsible-summary style={typeHeader}>
              <span>CARDIO</span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>{cardioRoutines.length} routines</span>
            </summary>
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              {cardioRoutines.length === 0 && <div style={{ opacity: 0.75 }}>No cardio routines in this filter.</div>}
              {cardioTypes.map((cardioType) => {
              const preview = cardioTypePreviewMap.get(cardioType) ?? [];
              const stats = cardioTypeStatsMap.get(cardioType) ?? {
                runCount: 0,
                totalMiles: 0,
                totalDurationSec: 0,
                avgPaceSecPerMi: null,
              };

              return (
                <div key={cardioType} style={groupCardStyle}>
                  <div className="mobileProgressGroupHeader" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900 }}>{cardioType}</div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                        Important group metrics for this cardio subtype.
                      </div>
                    </div>
                    <div className="mobileProgressStats" style={{ display: "grid", gap: 4, fontSize: 12, opacity: 0.88, textAlign: "right" }}>
                      <div>Sessions: {stats.runCount}</div>
                      <div>Miles: {stats.totalMiles.toFixed(2)}</div>
                      <div>Avg pace: {formatPace(stats.avgPaceSecPerMi)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <MetricLineChart
                      title="Weekly mileage"
                      yLabel="Miles"
                      xLabel="Week"
                      points={preview}
                      valueLabel="Miles"
                      unit="mi"
                      decimals={2}
                      compact={true}
                    />
                  </div>
                </div>
              );
              })}

              {cardioRoutines.map((routine) => {
              const selectedSessions = selectedProgressSessionMap.get(routine.id)?.sessions ?? 0;
              const lastPerformedAt = selectedProgressSessionMap.get(routine.id)?.lastPerformedAt ?? null;
              const ytdSessions = ytdMap.get(routine.id) ?? 0;
              const runStats = runStatsMap.get(routine.id) ?? {
                runCount: 0,
                totalMiles: 0,
                totalDurationSec: 0,
                avgPaceSecPerMi: null,
              };
              const longestRun = runLongestMap.get(routine.id) ?? 0;
              const runPreview = runPreviewSeriesMap.get(routine.id) ?? [];
              const detailHref = `/progress/routine/${routine.id}?${queryString({
                category,
                range,
                view,
                includeArchived,
              })}`;

              return (
                <Link key={routine.id} href={detailHref} style={{ ...cardStyle, display: "block" }}>
                  <div className="mobileProgressRoutineHeader" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900 }}>{routine.name}</div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                        {cardioTypeLabel(routine.cardioType)} | {routine.category || "General"}
                      </div>
                    </div>
                    <div className="mobileProgressStats" style={{ display: "grid", gap: 4, fontSize: 12, opacity: 0.88, textAlign: "right" }}>
                      <div>Sessions ({rangeLabel(range)}): {selectedSessions}</div>
                      <div>YTD sessions: {ytdSessions}</div>
                      <div>Last session: {lastPerformedAt ? new Date(lastPerformedAt).toLocaleDateString() : "-"}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <div className="mobileProgressRoutineGrid" style={routineMetricsGrid}>
                      <div style={metricChip}>Miles: {runStats.totalMiles.toFixed(2)}</div>
                      <div style={metricChip}>Longest: {longestRun.toFixed(2)} mi</div>
                      <div style={metricChip}>Avg pace: {formatPace(runStats.avgPaceSecPerMi)}</div>
                      <div style={metricChip}>Duration: {formatDuration(runStats.totalDurationSec)}</div>
                    </div>
                    <MetricLineChart
                      title="Weekly mileage preview"
                      yLabel="Miles"
                      xLabel="Week"
                      points={runPreview}
                      valueLabel="Miles"
                      unit="mi"
                      decimals={2}
                      targetValue={runWeeklyGoalMap.get(routine.id)}
                      targetLabel="Weekly mileage goal"
                      targetUnit="mi"
                      targetDecimals={2}
                      compact={true}
                    />
                  </div>
                </Link>
              );
              })}
            </div>
          </details>
        </section>

        <section style={{ border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, overflow: "hidden" }}>
          <details open style={sectionDetails}>
            <summary data-collapsible-summary style={typeHeader}>
              <span>WORKOUT</span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>{workoutRoutines.length} routines</span>
            </summary>
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              {workoutRoutines.length === 0 && <div style={{ opacity: 0.75 }}>No workout routines in this filter.</div>}
              {workoutRoutines.map((routine) => {
              const selectedSessions = selectedProgressSessionMap.get(routine.id)?.sessions ?? 0;
              const lastPerformedAt = selectedProgressSessionMap.get(routine.id)?.lastPerformedAt ?? null;
              const ytdSessions = ytdMap.get(routine.id) ?? 0;
              const workoutTotals = workoutTotalsMap.get(routine.id) ?? {
                totalSets: 0,
                totalReps: 0,
                totalVolume: 0,
              };
              const avgRepsPerSet =
                workoutTotals.totalSets > 0 ? workoutTotals.totalReps / workoutTotals.totalSets : 0;
              const detailHref = `/progress/routine/${routine.id}?${queryString({
                category,
                range,
                view,
                includeArchived,
              })}`;

              return (
                <Link key={routine.id} href={detailHref} style={{ ...cardStyle, display: "block" }}>
                  <div className="mobileProgressRoutineHeader" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900 }}>{routine.name}</div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                        Exercises tracked: {routine.exerciseCount} | {routine.category || "General"}
                      </div>
                    </div>
                    <div className="mobileProgressStats" style={{ display: "grid", gap: 4, fontSize: 12, opacity: 0.88, textAlign: "right" }}>
                      <div>Sessions ({rangeLabel(range)}): {selectedSessions}</div>
                      <div>YTD sessions: {ytdSessions}</div>
                      <div>Last session: {lastPerformedAt ? new Date(lastPerformedAt).toLocaleDateString() : "-"}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div className="mobileProgressRoutineGrid" style={routineMetricsGrid}>
                      <div style={metricChip}>Sets: {workoutTotals.totalSets}</div>
                      <div style={metricChip}>Reps: {workoutTotals.totalReps}</div>
                      <div style={metricChip}>Avg reps/set: {avgRepsPerSet.toFixed(1)}</div>
                      <div style={metricChip}>Volume: {workoutTotals.totalVolume.toFixed(1)}</div>
                    </div>
                  </div>
                </Link>
              );
              })}
            </div>
          </details>
        </section>

        <section style={{ border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, overflow: "hidden" }}>
          <details open style={sectionDetails}>
            <summary data-collapsible-summary style={typeHeader}>
              <span>COMPLETION</span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>{orderedCompletionRoutines.length} routines</span>
            </summary>
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              {orderedCompletionRoutines.length === 0 && <div style={{ opacity: 0.75 }}>No completion routines in this filter.</div>}
              {orderedCompletionRoutines.map((routine) => {
              const completed = completionMap.get(routine.id) ?? 0;
              const ytdSessions = ytdMap.get(routine.id) ?? 0;
              const weeklyTarget = routineCompletionGoalMap.get(routine.id) ?? routine.timesPerWeek ?? 0;
              const streak = currentRoutineStreak(routine.id);
              const lastCompleted = latestDateMap.get(routine.id);
              const detailHref = `/progress/routine/${routine.id}?${queryString({
                category,
                range,
                view,
                includeArchived,
              })}`;

              return (
                <Link key={routine.id} href={detailHref} style={{ ...cardStyle, display: "block" }}>
                  <div className="mobileProgressRoutineHeader" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900 }}>{routine.name}</div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                        {routine.category || "General"} | Completion tracking
                      </div>
                    </div>
                    <div className="mobileProgressStats" style={{ display: "grid", gap: 4, fontSize: 12, opacity: 0.88, textAlign: "right" }}>
                      <div>Completed ({rangeLabel(range)}): {completed}</div>
                      <div>YTD sessions: {ytdSessions}</div>
                      <div>Last completed: {lastCompleted ? new Date(lastCompleted).toLocaleDateString() : "-"}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div className="mobileProgressRoutineGrid" style={routineMetricsGrid}>
                      <div style={metricChip}>Weekly target: {weeklyTarget}</div>
                      <div style={metricChip}>Weeks goal met: {weeksMetMap.get(routine.id) ?? 0}</div>
                      <div style={metricChip}>Current streak: {streak}</div>
                      <div style={metricChip}>Range completions: {completed}</div>
                    </div>
                  </div>
                </Link>
              );
              })}
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.06)",
};

const groupCardStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: "rgba(76,163,255,0.35)",
  background: "linear-gradient(180deg, rgba(76,163,255,0.10), rgba(128,128,128,0.06))",
};

const typeHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
  letterSpacing: 0.4,
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

const goalCardStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: "rgba(255,199,92,0.32)",
  background: "linear-gradient(180deg, rgba(255,199,92,0.10), rgba(128,128,128,0.06))",
};

const goalCategoryDetailsStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.22)",
  borderRadius: 12,
  padding: 10,
  background: "rgba(128,128,128,0.04)",
};

const goalCategorySummaryStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  opacity: 0.9,
  cursor: "pointer",
};

const sectionDetails: React.CSSProperties = {
  display: "grid",
};

const sectionSummary: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
  letterSpacing: 0.4,
  cursor: "pointer",
  listStyle: "none",
};

const metricChip: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 10,
  padding: "7px 9px",
  fontSize: 12,
  opacity: 0.9,
  background: "rgba(128,128,128,0.08)",
};

const routineMetricsGrid: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
};
