import type { RoutineFrequencyUnit } from "@/generated/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export type FrequencyGoalShape = {
  id: string;
  name: string;
  targetCount: number;
  targetInterval: number;
  targetUnit: RoutineFrequencyUnit;
  isActive: boolean;
  /** Routines whose logs count toward this goal (PRIMARY + SUBSTITUTE
   *  combined — the matcher doesn't care about role for counting purposes). */
  routineIds: string[];
  /** Optional broaden-the-net rule: a log also counts if the routine it
   *  belongs to has a subtype in this list. Useful for "any climbing
   *  session", "any strength workout", etc. without listing every routine. */
  triggerSubtypes?: string[];
  /** Optional broaden-the-net rule: a log also counts if it contains enough
   *  sets of an exercise in this list (see `triggerMinSets`). Headline use
   *  case: ad-hoc gym pull-ups satisfy a Pull Strength goal even though
   *  the quick-log placeholder isn't in `routineIds`. */
  triggerExerciseIds?: string[];
  /** Minimum count of trigger-exercise sets required in a single log for
   *  it to claim a session via the exercise-trigger path. Defaults to 1
   *  if omitted. Routine-id and subtype matches ignore this — they're
   *  already routine-level claims. */
  triggerMinSets?: number;
};

export type FrequencyGoalExerciseSet = {
  exerciseId: string;
  /** How many SetEntry rows this exercise had in this log. Used to gate
   *  exercise-trigger matches against `triggerMinSets`. Callers that don't
   *  care about thresholds can pass `1` for each exercise — that's
   *  equivalent to the prior "any set counts" behavior. */
  setCount: number;
};

export type FrequencyGoalLogShape = {
  /** Required so the matcher can dedupe — a log that matches via routineId
   *  AND via a trigger exercise should only count once. */
  id: string;
  routineId: string;
  performedAt: Date;
  /** Subtype on the log's routine. Optional so callers that don't include
   *  routine metadata (legacy) just skip the subtype-trigger path. */
  routineSubtype?: string | null;
  /** Per-exercise set counts. Optional same as above; required only when
   *  the goal has trigger-exercise rules. Older callers passing just ids
   *  can use `exerciseIds` instead and the matcher treats each as 1 set. */
  exerciseSets?: FrequencyGoalExerciseSet[];
  /** Back-compat shorthand: ids only, treated as 1 set each. New callers
   *  should populate `exerciseSets` so `triggerMinSets > 1` works. */
  exerciseIds?: string[];
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
};

export function getFrequencyGoalWindowDays(goal: Pick<FrequencyGoalShape, "targetInterval" | "targetUnit">) {
  if (goal.targetUnit === "DAY") return goal.targetInterval;
  if (goal.targetUnit === "WEEK") return goal.targetInterval * 7;
  return goal.targetInterval * 30;
}

function caseInsensitive(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

// Returns whether a log matches the goal via routine-id, subtype-trigger, or
// exercise-trigger. Lives as a standalone helper so callers (UI badges,
// "what counts toward this goal?" tooltips) can ask the same question
// without recomputing window counts.
export function logMatchesFrequencyGoal(goal: FrequencyGoalShape, log: FrequencyGoalLogShape): boolean {
  if (goal.routineIds.includes(log.routineId)) return true;

  const subtypes = goal.triggerSubtypes ?? [];
  if (subtypes.length > 0 && log.routineSubtype) {
    const normalizedTriggers = new Set(subtypes.map(caseInsensitive));
    if (normalizedTriggers.has(caseInsensitive(log.routineSubtype))) return true;
  }

  const triggerExercises = goal.triggerExerciseIds ?? [];
  if (triggerExercises.length > 0) {
    const triggerSet = new Set(triggerExercises);
    const minSets = Math.max(1, goal.triggerMinSets ?? 1);
    let matchingSets = 0;
    // Prefer richer exerciseSets when present so triggerMinSets > 1 works
    // correctly; fall back to exerciseIds (1 set each) for older callers.
    if (log.exerciseSets && log.exerciseSets.length > 0) {
      for (const row of log.exerciseSets) {
        if (triggerSet.has(row.exerciseId)) matchingSets += Math.max(0, row.setCount);
        if (matchingSets >= minSets) return true;
      }
    } else if (log.exerciseIds && log.exerciseIds.length > 0) {
      for (const id of log.exerciseIds) {
        if (triggerSet.has(id)) matchingSets += 1;
        if (matchingSets >= minSets) return true;
      }
    }
  }

  return false;
}

export function getFrequencyGoalProgress(params: {
  goal: FrequencyGoalShape;
  logs: FrequencyGoalLogShape[];
  now?: Date;
}): FrequencyGoalProgress {
  const { goal, logs, now = new Date() } = params;
  const windowDays = getFrequencyGoalWindowDays(goal);
  const windowStart = new Date(now.getTime() - windowDays * DAY_MS);

  // Dedupe by log id — a single session can satisfy multiple match rules
  // (e.g. routineId AND a trigger exercise) but should only count once
  // toward the window's total.
  const matchingLogIds = new Set<string>();
  for (const log of logs) {
    if (log.performedAt < windowStart || log.performedAt >= now) continue;
    if (matchingLogIds.has(log.id)) continue;
    if (logMatchesFrequencyGoal(goal, log)) matchingLogIds.add(log.id);
  }
  const currentCount = matchingLogIds.size;

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

  return { goal, currentCount, remainingCount, excessCount, status, summaryLabel, detailLabel, windowDays, windowLabel };
}

export function getFrequencyGoalProgressList(params: {
  goals: FrequencyGoalShape[];
  logs: FrequencyGoalLogShape[];
  now?: Date;
}): FrequencyGoalProgress[] {
  return params.goals
    .filter((goal) => goal.isActive)
    .map((goal) => getFrequencyGoalProgress({ goal, logs: params.logs, now: params.now }));
}

// Richer matcher used by the home dashboard's habit grid and the log
// page's "Contributes to" strip. Knows about PRIMARY vs SUBSTITUTE
// membership so the caller can classify a matched log as a real
// completion ("done") vs a covered slot ("covered by another routine").
// Trigger-path matches always claim a primary slot — the user did the
// work, just not via a saved-routine link.
export type FrequencyGoalMembership = {
  primaryRoutineIds: Set<string>;
  substituteRoutineIds: Set<string>;
  /** Uppercased for case-insensitive comparison. */
  triggerSubtypes: Set<string>;
  triggerExerciseIds: Set<string>;
  /** Minimum trigger-exercise sets a log needs to claim a session.
   *  Clamped to ≥ 1 by the caller; pass 1 to mean "any set counts." */
  triggerMinSets: number;
};

export function classifyLogAgainstFrequencyGoal(
  log: FrequencyGoalLogShape,
  goal: FrequencyGoalMembership
): { isPrimary: boolean } | null {
  if (goal.primaryRoutineIds.has(log.routineId)) return { isPrimary: true };
  if (goal.substituteRoutineIds.has(log.routineId)) return { isPrimary: false };

  const hasTriggers = goal.triggerSubtypes.size > 0 || goal.triggerExerciseIds.size > 0;
  if (!hasTriggers) return null;

  if (goal.triggerSubtypes.size > 0 && log.routineSubtype) {
    const subtype = log.routineSubtype.toUpperCase();
    if (goal.triggerSubtypes.has(subtype)) return { isPrimary: true };
  }

  if (goal.triggerExerciseIds.size > 0) {
    let matchingSets = 0;
    if (log.exerciseSets && log.exerciseSets.length > 0) {
      for (const row of log.exerciseSets) {
        if (goal.triggerExerciseIds.has(row.exerciseId)) matchingSets += Math.max(0, row.setCount);
        if (matchingSets >= goal.triggerMinSets) return { isPrimary: true };
      }
    } else if (log.exerciseIds && log.exerciseIds.length > 0) {
      for (const id of log.exerciseIds) {
        if (goal.triggerExerciseIds.has(id)) matchingSets += 1;
        if (matchingSets >= goal.triggerMinSets) return { isPrimary: true };
      }
    }
  }

  return null;
}
