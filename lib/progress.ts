import { toAppYmd } from "@/lib/dates";
import { getWeekBoundsSunday } from "@/lib/week";

export type ProgressRange = "week" | "4w" | "8w" | "12w" | "all";
export type ProgressView = "completion" | "progression";

type SetLike = {
  reps: number | null;
  seconds: number | null;
  weightLb: number | null;
};

export function normalizeProgressRange(value?: string | null): ProgressRange {
  if (value === "week" || value === "4w" || value === "8w" || value === "12w" || value === "all") {
    return value;
  }
  return "4w";
}

export function normalizeProgressView(value?: string | null): ProgressView {
  if (value === "completion" || value === "progression") return value;
  return "progression";
}

function startOfWeekSunday(date: Date) {
  return getWeekBoundsSunday(date).start;
}

export function getRangeStart(range: ProgressRange, now = new Date()): Date | null {
  if (range === "all") return null;
  if (range === "week") return getWeekBoundsSunday(now).start;

  const weeks = range === "4w" ? 4 : range === "8w" ? 8 : 12;
  const start = startOfWeekSunday(now);
  start.setDate(start.getDate() - (weeks - 1) * 7);
  return start;
}

export function getDateRange(range: ProgressRange, now = new Date()) {
  const start = getRangeStart(range, now);
  return { start, end: now };
}

export function toPerformedAtFilter(range: ProgressRange, now = new Date()) {
  const { start, end } = getDateRange(range, now);
  if (!start) return undefined;
  return { gte: start, lte: end };
}

export function getCompletionMetrics(completedCount: number, timesPerWeek: number | null) {
  const targetCount = timesPerWeek ?? 0;
  if (!targetCount || targetCount <= 0) {
    return { targetCount: 0, displayPercent: 0, barPercent: 0 };
  }

  const rawPercent = Math.round((completedCount / targetCount) * 100);
  return {
    targetCount,
    displayPercent: rawPercent,
    barPercent: Math.min(100, rawPercent),
  };
}

export function getWorkoutSessionMetrics(sets: SetLike[]) {
  let topWeight = 0;
  let totalReps = 0;
  let totalVolume = 0;
  let maxTimeSeconds = 0;

  for (const set of sets) {
    const reps = set.reps ?? 0;
    const seconds = set.seconds ?? 0;
    const weight = set.weightLb ?? 0;

    if (weight > topWeight) topWeight = weight;
    if (seconds > maxTimeSeconds) maxTimeSeconds = seconds;
    totalReps += reps;
    totalVolume += reps * weight;
  }

  return {
    topWeight,
    totalReps,
    totalVolume,
    maxTimeSeconds,
    totalSets: sets.length,
  };
}

export function aggregateWorkoutSessionTotals(sessions: Array<{ sets: SetLike[] }>) {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;

  for (const session of sessions) {
    const m = getWorkoutSessionMetrics(session.sets);
    totalSets += m.totalSets;
    totalReps += m.totalReps;
    totalVolume += m.totalVolume;
  }

  return { totalSets, totalReps, totalVolume };
}

export function aggregateRunStats(logs: Array<{ distanceMi: number | null; durationSec: number | null }>) {
  let runCount = 0;
  let totalMiles = 0;
  let totalDurationSec = 0;

  for (const log of logs) {
    if (log.distanceMi === null || log.durationSec === null) continue;
    runCount += 1;
    totalMiles += log.distanceMi;
    totalDurationSec += log.durationSec;
  }

  const avgPaceSecPerMi = totalMiles > 0 ? totalDurationSec / totalMiles : null;

  return { runCount, totalMiles, totalDurationSec, avgPaceSecPerMi };
}

export function aggregateExerciseProgression(
  sessions: Array<{
    id: string;
    routineLog: { performedAt: Date; routine: { id: string; name: string; category: string } };
    sets: SetLike[];
  }>
) {
  const routineMap = new Map<string, { id: string; name: string; category: string }>();
  const rows = sessions
    .map((session) => {
      routineMap.set(session.routineLog.routine.id, session.routineLog.routine);
      return {
        sessionId: session.id,
        performedAt: session.routineLog.performedAt,
        routine: session.routineLog.routine,
        ...getWorkoutSessionMetrics(session.sets),
      };
    })
    .sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());

  return {
    sessions: rows,
    routines: Array.from(routineMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function formatDuration(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatPace(secPerMi: number | null) {
  if (!secPerMi || !Number.isFinite(secPerMi) || secPerMi <= 0) return "-";
  const m = Math.floor(secPerMi / 60);
  const s = Math.round(secPerMi % 60);
  return `${m}:${String(s).padStart(2, "0")} /mi`;
}

export function dateYmd(date: Date) {
  return toAppYmd(date);
}

export function sparklinePoints(values: number[], width = 220, height = 64, padding = 6) {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const y = height / 2;
    return `${padding},${y} ${width - padding},${y}`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-9, max - min);
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);

  return values
    .map((value, i) => {
      const x = padding + (i / (values.length - 1)) * innerW;
      const y = padding + (1 - (value - min) / span) * innerH;
      return `${x},${y}`;
    })
    .join(" ");
}

export function aggregateWeeklyMileageSeries(
  logs: Array<{ performedAt: Date; distanceMi: number | null }>
): Array<{ label: string; value: number }> {
  const weeklyMap = new Map<string, number>();
  for (const log of logs) {
    const weekStart = getWeekBoundsSunday(log.performedAt).start;
    const key = dateYmd(weekStart);
    weeklyMap.set(key, (weeklyMap.get(key) ?? 0) + (log.distanceMi ?? 0));
  }

  return Array.from(weeklyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

export const GOAL_TYPE = {
  routinePlannedPerWeek: "routine_planned_per_week",
  routineCompletion: "routine_completion",
  routineStreak: "routine_streak",
  exerciseWeight: "exercise_weight",
  exerciseAvgRepsPerSet: "exercise_avg_reps_per_set",
  exerciseRepsAtWeight: "exercise_reps_at_weight",
  runWeeklyMileage: "run_weekly_mileage",
  runLongest: "run_longest",
} as const;

export const CARDIO_GOAL_SCOPE = {
  routine: "routine",
  cardioType: "cardio_type",
  allCardio: "all_cardio",
} as const;

export type CardioGoalScope =
  | { kind: "routine"; routineId: string }
  | { kind: "cardioType"; cardioType: string }
  | { kind: "allCardio" };

export function cardioGoalScopeRoutine(routineId: string) {
  return `${CARDIO_GOAL_SCOPE.routine}:${routineId}`;
}

export function cardioGoalScopeCardioType(cardioType: string) {
  return `${CARDIO_GOAL_SCOPE.cardioType}:${encodeURIComponent(cardioType)}`;
}

export function cardioGoalScopeAllCardio() {
  return CARDIO_GOAL_SCOPE.allCardio;
}

export function parseCardioGoalScope(value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (raw === CARDIO_GOAL_SCOPE.allCardio) {
    return { kind: "allCardio" } as const;
  }

  if (raw.startsWith(`${CARDIO_GOAL_SCOPE.routine}:`)) {
    const routineId = raw.slice(`${CARDIO_GOAL_SCOPE.routine}:`.length).trim();
    if (!routineId) return null;
    return { kind: "routine", routineId } as const;
  }

  if (raw.startsWith(`${CARDIO_GOAL_SCOPE.cardioType}:`)) {
    const encoded = raw.slice(`${CARDIO_GOAL_SCOPE.cardioType}:`.length);
    if (!encoded) return null;
    let decoded = "";
    try {
      decoded = decodeURIComponent(encoded);
    } catch {
      return null;
    }
    const cardioType = decoded.trim();
    if (!cardioType) return null;
    return { kind: "cardioType", cardioType } as const;
  }

  // Legacy format: "<routineId>"
  return { kind: "routine", routineId: raw } as const;
}

function parseCardioGoalType(type: string, goalTypePrefix: string) {
  if (!type.startsWith(`${goalTypePrefix}:`)) return null;
  const scopeRaw = type.slice(goalTypePrefix.length + 1);
  return parseCardioGoalScope(scopeRaw);
}

export function goalTypeRoutinePlannedPerWeek(routineId: string) {
  return `${GOAL_TYPE.routinePlannedPerWeek}:${routineId}`;
}

export function goalTypeRoutineCompletion(routineId: string) {
  return `${GOAL_TYPE.routineCompletion}:${routineId}`;
}

export function goalTypeRoutineStreak(routineId: string) {
  return `${GOAL_TYPE.routineStreak}:${routineId}`;
}

export function goalTypeExerciseWeight(exerciseId: string) {
  return `${GOAL_TYPE.exerciseWeight}:${exerciseId}`;
}

export function goalTypeExerciseAvgRepsPerSet(exerciseId: string) {
  return `${GOAL_TYPE.exerciseAvgRepsPerSet}:${exerciseId}`;
}

export function goalTypeExerciseRepsAtWeight(exerciseId: string, weightLb: number) {
  return `${GOAL_TYPE.exerciseRepsAtWeight}:${exerciseId}:${weightLb}`;
}

export function goalTypeRunWeeklyMileage(scope: string) {
  return `${GOAL_TYPE.runWeeklyMileage}:${scope}`;
}

export function goalTypeRunLongest(scope: string) {
  return `${GOAL_TYPE.runLongest}:${scope}`;
}

export function parseRunWeeklyMileageGoalType(type: string) {
  return parseCardioGoalType(type, GOAL_TYPE.runWeeklyMileage);
}

export function parseRunLongestGoalType(type: string) {
  return parseCardioGoalType(type, GOAL_TYPE.runLongest);
}

export function parseExerciseRepsAtWeightGoalType(type: string) {
  if (!type.startsWith(`${GOAL_TYPE.exerciseRepsAtWeight}:`)) return null;
  const parts = type.split(":");
  if (parts.length !== 3) return null;
  const exerciseId = parts[1];
  const weightLb = Number(parts[2]);
  if (!exerciseId || !Number.isFinite(weightLb)) return null;
  return { exerciseId, weightLb };
}
