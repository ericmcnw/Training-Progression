import type { RoutineFrequencyUnit } from "@/generated/prisma";

// Frequency target shape — the canonical structure callers consume.
//
// As of Phase 1 of the activity-world restructure, this shape is no longer
// stored as columns on Routine. The source of truth is the FrequencyGoal model
// (with FrequencyGoalRoutine join). The shape is preserved for backward
// compatibility with the dozens of callers downstream — use the helpers below
// to construct it from a FrequencyGoal.
export type RoutineFrequencyTargetShape = {
  targetFrequencyCount: number | null;
  targetFrequencyUnit: RoutineFrequencyUnit | null;
  targetFrequencyInterval: number | null;
  frequencyGoalEnabled?: boolean | null;
  // Weekday bitmask (Sun=1, Mon=2, ..., Sat=64). Only meaningful when the
  // unit is WEEK; null/zero = "any day counts".
  weekdayMask?: number | null;
};

// Subset of FrequencyGoal needed to construct a target shape.
export type FrequencyGoalSource = {
  id?: string;
  targetCount: number;
  targetUnit: RoutineFrequencyUnit;
  targetInterval: number;
  isActive: boolean;
  weekdayMask?: number | null;
};

// A "no target" shape — what callers see for a routine without a FrequencyGoal.
export const NULL_FREQUENCY_TARGET: RoutineFrequencyTargetShape = {
  targetFrequencyCount: null,
  targetFrequencyUnit: null,
  targetFrequencyInterval: null,
  frequencyGoalEnabled: false,
  weekdayMask: null,
};

// Convert a single FrequencyGoal into the legacy shape callers consume.
export function frequencyTargetFromGoal(goal: FrequencyGoalSource | null | undefined): RoutineFrequencyTargetShape {
  if (!goal) return NULL_FREQUENCY_TARGET;
  return {
    targetFrequencyCount: goal.targetCount,
    targetFrequencyUnit: goal.targetUnit,
    targetFrequencyInterval: goal.targetInterval,
    frequencyGoalEnabled: goal.isActive,
    weekdayMask: goal.weekdayMask ?? null,
  };
}

// A routine can be linked to multiple FrequencyGoals; the routine's "primary"
// target is the first ACTIVE goal linked to it. Inactive goals are ignored.
// Callers should include `frequencyGoalRoutines: { include: { goal: true } }`
// in their Prisma selects when they need the target.
export function routineFrequencyTarget(
  routine: { frequencyGoalRoutines?: Array<{ goal: FrequencyGoalSource | null }> } | null | undefined
): RoutineFrequencyTargetShape {
  if (!routine?.frequencyGoalRoutines) return NULL_FREQUENCY_TARGET;
  const activeGoals = routine.frequencyGoalRoutines
    .map((rel) => rel.goal)
    .filter((g): g is FrequencyGoalSource => Boolean(g?.isActive));
  // Prefer the per-routine (`fg_*`) goal as primary — it represents the user's
  // intent for this specific routine. Falls back to the first active goal
  // (typically a group goal) if no per-routine companion exists.
  const primary = activeGoals.find((g) => g.id?.startsWith("fg_")) ?? activeGoals[0] ?? null;
  return frequencyTargetFromGoal(primary);
}

// Extends a routine with the legacy frequency target shape, derived from any
// FrequencyGoal links present. Use this when downstream callers expect the
// flat shape (e.g., inline form previews, frequency status calculators).
export function routineWithFrequencyTarget<T extends { frequencyGoalRoutines?: Array<{ goal: FrequencyGoalSource | null }> }>(routine: T): T & RoutineFrequencyTargetShape {
  return {
    ...routine,
    ...routineFrequencyTarget(routine),
  };
}

export type RoutineFrequencyWindow = {
  start: Date;
  end: Date;
  label: string;
  days: number;
};

export type RoutineFrequencyStatus = "no_target" | "behind" | "on_track" | "ahead";

export type RoutineFrequencySummary = {
  hasTarget: boolean;
  status: RoutineFrequencyStatus;
  targetCount: number | null;
  interval: number | null;
  unit: RoutineFrequencyUnit | null;
  currentCount: number;
  remainingCount: number;
  excessCount: number;
  targetLabel: string;
  windowLabel: string;
  summaryLabel: string;
  detailLabel: string;
  shortStatusLabel: string;
  window: RoutineFrequencyWindow | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function doesRoutineHaveTarget(target: RoutineFrequencyTargetShape) {
  return (
    target.frequencyGoalEnabled !== false &&
    Number.isFinite(target.targetFrequencyCount) &&
    (target.targetFrequencyCount ?? 0) > 0 &&
    !!target.targetFrequencyUnit &&
    Number.isFinite(target.targetFrequencyInterval) &&
    (target.targetFrequencyInterval ?? 0) > 0
  );
}

export function normalizeRoutineFrequencyTarget(target: RoutineFrequencyTargetShape) {
  if (!doesRoutineHaveTarget(target)) {
    return {
      hasTarget: false,
      count: null,
      unit: null,
      interval: null,
    } as const;
  }

  return {
    hasTarget: true,
    count: Math.max(1, Math.floor(target.targetFrequencyCount ?? 1)),
    unit: target.targetFrequencyUnit!,
    interval: Math.max(1, Math.floor(target.targetFrequencyInterval ?? 1)),
  } as const;
}

export function routineFrequencyUnitLabel(unit: RoutineFrequencyUnit, interval = 1) {
  const plural = interval === 1 ? "" : "s";
  if (unit === "DAY") return `day${plural}`;
  if (unit === "WEEK") return `week${plural}`;
  return `month${plural}`;
}

export function formatRoutineTargetLabel(target: RoutineFrequencyTargetShape) {
  const normalized = normalizeRoutineFrequencyTarget(target);
  if (!normalized.hasTarget) return "No target";
  const countLabel = `${normalized.count} ${normalized.count === 1 ? "time" : "times"}`;
  return `${countLabel} per ${normalized.interval} ${routineFrequencyUnitLabel(normalized.unit, normalized.interval)}`;
}

export function getRoutineTargetWindow(target: RoutineFrequencyTargetShape, now = new Date()): RoutineFrequencyWindow | null {
  const normalized = normalizeRoutineFrequencyTarget(target);
  if (!normalized.hasTarget) return null;

  const days =
    normalized.unit === "DAY"
      ? normalized.interval
      : normalized.unit === "WEEK"
      ? normalized.interval * 7
      : normalized.interval * 30;
  const end = now;
  const start = new Date(end.getTime() - days * DAY_MS);

  return {
    start,
    end,
    days,
    label: `last ${days} day${days === 1 ? "" : "s"}`,
  };
}

export function getRoutineCompletionCountInTargetWindow(
  target: RoutineFrequencyTargetShape,
  logs: Array<{ performedAt: Date }>,
  now = new Date()
) {
  const window = getRoutineTargetWindow(target, now);
  if (!window) return 0;
  return logs.filter((log) => log.performedAt.getTime() >= window.start.getTime() && log.performedAt.getTime() < window.end.getTime()).length;
}

export function getRoutineFrequencyStatus(params: {
  target: RoutineFrequencyTargetShape;
  logs: Array<{ performedAt: Date }>;
  now?: Date;
}): RoutineFrequencySummary {
  const normalized = normalizeRoutineFrequencyTarget(params.target);
  if (!normalized.hasTarget) {
    return {
      hasTarget: false,
      status: "no_target",
      targetCount: null,
      interval: null,
      unit: null,
      currentCount: 0,
      remainingCount: 0,
      excessCount: 0,
      targetLabel: "No target",
      windowLabel: "No target",
      summaryLabel: "No target",
      detailLabel: "No frequency target set.",
      shortStatusLabel: "No target",
      window: null,
    };
  }

  const window = getRoutineTargetWindow(params.target, params.now);
  const currentCount = getRoutineCompletionCountInTargetWindow(params.target, params.logs, params.now);
  const remainingCount = Math.max(0, normalized.count - currentCount);
  const excessCount = Math.max(0, currentCount - normalized.count);
  const status: RoutineFrequencyStatus =
    currentCount < normalized.count ? "behind" : currentCount > normalized.count ? "ahead" : "on_track";
  const targetLabel = formatRoutineTargetLabel(params.target);
  const windowLabel = window?.label ?? "current window";

  const summaryLabel = `${currentCount} of ${normalized.count} ${windowLabel}`;

  const detailLabel =
    status === "behind"
      ? `${remainingCount} short in the ${windowLabel}`
      : status === "ahead"
      ? `${excessCount} ahead in the ${windowLabel}`
      : status === "on_track"
      ? "On track"
      : "No frequency target set.";

  const shortStatusLabel =
    status === "behind"
      ? `${remainingCount} short`
      : status === "ahead"
      ? "Ahead of target"
      : status === "on_track"
      ? "On track"
      : "No target";

  return {
    hasTarget: true,
    status,
    targetCount: normalized.count,
    interval: normalized.interval,
    unit: normalized.unit,
    currentCount,
    remainingCount,
    excessCount,
    targetLabel,
    windowLabel,
    summaryLabel,
    detailLabel,
    shortStatusLabel,
    window,
  };
}

export function getRoutineFrequencySummary(params: {
  routine: RoutineFrequencyTargetShape;
  logs: Array<{ performedAt: Date }>;
  now?: Date;
}) {
  return getRoutineFrequencyStatus({ target: params.routine, logs: params.logs, now: params.now });
}

export function getMaxRoutineFrequencyWindowDays(routines: RoutineFrequencyTargetShape[]) {
  return routines.reduce((maxDays, routine) => {
    const window = getRoutineTargetWindow(routine);
    return Math.max(maxDays, window?.days ?? 0);
  }, 0);
}

export function getRoutineFrequencyStatuses<T extends RoutineFrequencyTargetShape & { id: string }>(params: {
  routines: T[];
  logs: Array<{ routineId: string; performedAt: Date }>;
  now?: Date;
}) {
  const logsByRoutineId = new Map<string, Array<{ performedAt: Date }>>();
  for (const log of params.logs) {
    const current = logsByRoutineId.get(log.routineId) ?? [];
    current.push({ performedAt: log.performedAt });
    logsByRoutineId.set(log.routineId, current);
  }

  return new Map(
    params.routines.map((routine) => [
      routine.id,
      getRoutineFrequencyStatus({
        target: routine,
        logs: logsByRoutineId.get(routine.id) ?? [],
        now: params.now,
      }),
    ])
  );
}

export function suggestedTimesPerWeekForRoutineTarget(target: RoutineFrequencyTargetShape) {
  const normalized = normalizeRoutineFrequencyTarget(target);
  if (!normalized.hasTarget) return null;
  if (normalized.unit === "WEEK" && normalized.interval === 1) return normalized.count;
  return null;
}

// Auto-scheduling triggers when:
//   • DAY/1 (literal daily)
//   • WEEK/1 with count 7 (also literal daily, just expressed weekly)
//   • WEEK with a weekdayMask set (specific days each week)
// Other patterns (3× per week with no mask, monthly, etc.) are flexible —
// the user picks when to do them and the schedule stays uncluttered.
export function shouldAutoScheduleRoutine(target: RoutineFrequencyTargetShape) {
  const normalized = normalizeRoutineFrequencyTarget(target);
  if (!normalized.hasTarget) return false;
  if (normalized.unit === "DAY" && normalized.interval === 1) return true;
  if (normalized.unit === "WEEK" && normalized.interval === 1 && normalized.count === 7) return true;
  if (normalized.unit === "WEEK" && (target.weekdayMask ?? 0) > 0) return true;
  return false;
}

export function isRoutineAutoScheduledOnDay(
  target: RoutineFrequencyTargetShape,
  dayYmd: string,
  autoScheduleStartYmd?: string | null
) {
  if (!shouldAutoScheduleRoutine(target)) return false;
  if (autoScheduleStartYmd && dayYmd < autoScheduleStartYmd) return false;
  // If a weekday mask is set, only fire on masked days; otherwise the routine
  // is daily and every day qualifies.
  const mask = target.weekdayMask ?? 0;
  if (mask > 0 && target.targetFrequencyUnit === "WEEK") {
    const dow = new Date(`${dayYmd}T00:00:00.000Z`).getUTCDay();
    return (mask & (1 << dow)) !== 0;
  }
  return true;
}

// Backward-compat aliases: legacy callers expect the old "Daily" naming.
// Both functions now respect weekday masks transparently.
export const shouldAutoScheduleRoutineDaily = shouldAutoScheduleRoutine;
export const isRoutineAutoScheduledDailyOnDay = isRoutineAutoScheduledOnDay;
