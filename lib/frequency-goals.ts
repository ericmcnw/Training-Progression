import type { RoutineFrequencyUnit } from "@/generated/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export type FrequencyGoalShape = {
  id: string;
  name: string;
  targetCount: number;
  targetInterval: number;
  targetUnit: RoutineFrequencyUnit;
  matchTags: string[];
  isActive: boolean;
};

export type FrequencyGoalProgress = {
  goal: FrequencyGoalShape;
  currentCount: number;
  remainingCount: number;
  excessCount: number;
  status: "behind" | "on_track" | "ahead";
  summaryLabel: string;
  detailLabel: string;
  windowDays: number;
  windowLabel: string;
  matchingRoutineIds: string[];
};

export function getFrequencyGoalWindowDays(goal: Pick<FrequencyGoalShape, "targetInterval" | "targetUnit">) {
  if (goal.targetUnit === "DAY") return goal.targetInterval;
  if (goal.targetUnit === "WEEK") return goal.targetInterval * 7;
  return goal.targetInterval * 30;
}

export function getFrequencyGoalProgress(params: {
  goal: FrequencyGoalShape;
  routineTags: Map<string, string[]>; // routineId → tag names
  logs: Array<{ routineId: string; performedAt: Date }>;
  now?: Date;
}): FrequencyGoalProgress {
  const { goal, routineTags, logs, now = new Date() } = params;
  const windowDays = getFrequencyGoalWindowDays(goal);
  const windowStart = new Date(now.getTime() - windowDays * DAY_MS);
  const matchTagSet = new Set(goal.matchTags);

  const matchingRoutineIds: string[] = [];
  for (const [routineId, tags] of routineTags) {
    if (tags.some((tag) => matchTagSet.has(tag))) {
      matchingRoutineIds.push(routineId);
    }
  }
  const matchingRoutineIdSet = new Set(matchingRoutineIds);

  const currentCount = logs.filter(
    (log) => matchingRoutineIdSet.has(log.routineId) && log.performedAt >= windowStart && log.performedAt <= now
  ).length;

  const remainingCount = Math.max(0, goal.targetCount - currentCount);
  const excessCount = Math.max(0, currentCount - goal.targetCount);
  const status: FrequencyGoalProgress["status"] =
    currentCount < goal.targetCount ? "behind" : currentCount > goal.targetCount ? "ahead" : "on_track";

  const unitLabel =
    goal.targetUnit === "DAY"
      ? `${goal.targetInterval} day${goal.targetInterval === 1 ? "" : "s"}`
      : goal.targetUnit === "WEEK"
      ? `${goal.targetInterval} week${goal.targetInterval === 1 ? "" : "s"}`
      : `${goal.targetInterval} month${goal.targetInterval === 1 ? "" : "s"}`;

  const windowLabel = `last ${windowDays} day${windowDays === 1 ? "" : "s"}`;
  const summaryLabel = `${currentCount} / ${goal.targetCount} (${unitLabel})`;
  const detailLabel =
    status === "behind"
      ? `${remainingCount} short in the ${windowLabel}`
      : status === "ahead"
      ? `${excessCount} ahead in the ${windowLabel}`
      : "On track";

  return {
    goal,
    currentCount,
    remainingCount,
    excessCount,
    status,
    summaryLabel,
    detailLabel,
    windowDays,
    windowLabel,
    matchingRoutineIds,
  };
}

export function getFrequencyGoalProgressList(params: {
  goals: FrequencyGoalShape[];
  routineTags: Map<string, string[]>;
  logs: Array<{ routineId: string; performedAt: Date }>;
  now?: Date;
}): FrequencyGoalProgress[] {
  return params.goals
    .filter((goal) => goal.isActive)
    .map((goal) =>
      getFrequencyGoalProgress({ goal, routineTags: params.routineTags, logs: params.logs, now: params.now })
    );
}
