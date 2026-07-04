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
  /** Endurance type targets: a log counts if its activityTypeId is in this
   *  list. "Trail Run 2x/wk" sets this to the trail-run type id. Exact
   *  match — Trail Run doesn't satisfy a Long Run goal. For family-wide
   *  goals use triggerActivityFamilyIds instead. */
  triggerActivityTypeIds?: string[];
  /** Endurance family targets: a log counts if its activity type's family
   *  is in this list. "Running 3x/wk" sets this to the running family id
   *  and any run-family log (Run, Trail Run, Long Run, ...) counts. */
  triggerActivityFamilyIds?: string[];
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
  /** Domain-wide targeting: a log counts when its routine's effective
   *  domain equals this ("strength" | "cardio" | "mobility" | "sport" |
   *  "lifestyle"), or "any" to count every training log. Null/absent =
   *  not a domain goal. */
  targetDomain?: string | null;
  /** Sport-tag targeting: a log counts when its routine's supportsSports
   *  overlaps this list — "training FOR climbing" without enumerating
   *  routines. Slugs, lowercase. */
  triggerSupportedSports?: string[];
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
  /** Activity type id on the log itself (set by typed endurance logs).
   *  Optional — non-endurance logs don't have one. Used to match against
   *  goal.triggerActivityTypeIds (exact) and indirectly via the type's
   *  familyId against goal.triggerActivityFamilyIds. */
  activityTypeId?: string | null;
  /** Activity family id for the log's activity type. Callers pre-resolve
   *  this (one join in the query) so the matcher doesn't need a separate
   *  lookup table. Optional — null when no activityTypeId. */
  activityFamilyId?: string | null;
  /** Per-exercise set counts. Optional same as above; required only when
   *  the goal has trigger-exercise rules. Older callers passing just ids
   *  can use `exerciseIds` instead and the matcher treats each as 1 set. */
  exerciseSets?: FrequencyGoalExerciseSet[];
  /** Back-compat shorthand: ids only, treated as 1 set each. New callers
   *  should populate `exerciseSets` so `triggerMinSets > 1` works. */
  exerciseIds?: string[];
  /** Effective domain of the log's routine (via effectiveRoutineDomain).
   *  Optional — callers that don't resolve it just skip the domain path. */
  routineDomain?: string | null;
  /** supportsSports slugs on the log's routine. Optional same as above. */
  routineSupportsSports?: string[];
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

  // Domain-wide match — "Strength 3×/wk" counts any log whose routine's
  // effective domain matches; "any" counts every training log.
  if (goal.targetDomain) {
    if (goal.targetDomain === "any") return true;
    if (log.routineDomain && log.routineDomain === goal.targetDomain) return true;
  }

  // Sport-tag match — routine declared it trains FOR one of these sports.
  const supportedSports = goal.triggerSupportedSports ?? [];
  if (supportedSports.length > 0 && log.routineSupportsSports && log.routineSupportsSports.length > 0) {
    const wanted = new Set(supportedSports.map((s) => s.toLowerCase()));
    if (log.routineSupportsSports.some((s) => wanted.has(s.toLowerCase()))) return true;
  }

  const subtypes = goal.triggerSubtypes ?? [];
  if (subtypes.length > 0 && log.routineSubtype) {
    const normalizedTriggers = new Set(subtypes.map(caseInsensitive));
    if (normalizedTriggers.has(caseInsensitive(log.routineSubtype))) return true;
  }

  // Endurance type trigger — exact match on activity type id. Set by
  // "Trail Run 2x/wk" style goals where the user wants only that
  // specific type to count.
  const activityTypeTriggers = goal.triggerActivityTypeIds ?? [];
  if (activityTypeTriggers.length > 0 && log.activityTypeId) {
    if (activityTypeTriggers.includes(log.activityTypeId)) return true;
  }

  // Endurance family trigger — matches any log whose activity type
  // belongs to the listed family. Set by "Running 3x/wk" style goals
  // where the user wants every run-family type to count (Run + Trail
  // Run + Long Run + ...).
  const activityFamilyTriggers = goal.triggerActivityFamilyIds ?? [];
  if (activityFamilyTriggers.length > 0 && log.activityFamilyId) {
    if (activityFamilyTriggers.includes(log.activityFamilyId)) return true;
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
  /** Endurance type triggers (exact match on log.activityTypeId). */
  triggerActivityTypeIds: Set<string>;
  /** Endurance family triggers (matched via log.activityFamilyId). */
  triggerActivityFamilyIds: Set<string>;
  triggerExerciseIds: Set<string>;
  /** Minimum trigger-exercise sets a log needs to claim a session.
   *  Clamped to ≥ 1 by the caller; pass 1 to mean "any set counts." */
  triggerMinSets: number;
  /** Domain-wide targeting — see FrequencyGoalShape.targetDomain. */
  targetDomain: string | null;
  /** Sport-tag targeting — lowercase slugs. */
  triggerSupportedSports: Set<string>;
};

// Centralized membership builder. Three surfaces — home data, routine-frequency
// context, and goal-detail frequency-consistency — used to inline this shape
// independently. Folding them through here keeps them in sync, and crucially
// it's where the post-T2 endurance fix lives: PRIMARY routines that carry an
// `activityTypeId` (the legacy per-type endurance routines like "Easy Run"
// with activityType=easy-run) propagate that id into `triggerActivityTypeIds`
// so the matcher claims logs against the synthetic Endurance routine that
// carry the same activityType.
//
// Why only PRIMARY: substitute matches resolve to a "covered" state in the
// matcher, but a trigger-path match returns `isPrimary: true`. Folding
// substitute routine activityTypeIds in here would silently upgrade their
// matches to primary completions — semantically wrong.
//
// Why only activityTypeId (not family): exact-type propagation is unambiguous —
// the user explicitly added "Walk" as a routine member, so Walk logs count.
// Family propagation would broaden "Walk" into "anything walking-family" which
// the user can already express with explicit `triggerActivityFamilyIds` once
// the goal-form exposes that UI (Phase 3).
export function buildFrequencyGoalMembership(input: {
  primaryRoutines: ReadonlyArray<{ id: string; activityTypeId?: string | null }>;
  substituteRoutineIds: ReadonlyArray<string>;
  explicit: {
    triggerSubtypes?: ReadonlyArray<string> | null;
    triggerActivityTypeIds?: ReadonlyArray<string> | null;
    triggerActivityFamilyIds?: ReadonlyArray<string> | null;
    triggerExerciseIds?: ReadonlyArray<string> | null;
    triggerMinSets?: number | null;
    targetDomain?: string | null;
    triggerSupportedSports?: ReadonlyArray<string> | null;
  };
}): FrequencyGoalMembership {
  const triggerActivityTypeIds = new Set<string>(input.explicit.triggerActivityTypeIds ?? []);
  for (const r of input.primaryRoutines) {
    if (r.activityTypeId) triggerActivityTypeIds.add(r.activityTypeId);
  }
  return {
    primaryRoutineIds: new Set(input.primaryRoutines.map((r) => r.id)),
    substituteRoutineIds: new Set(input.substituteRoutineIds),
    triggerSubtypes: new Set((input.explicit.triggerSubtypes ?? []).map((s) => s.toUpperCase())),
    triggerActivityTypeIds,
    triggerActivityFamilyIds: new Set(input.explicit.triggerActivityFamilyIds ?? []),
    triggerExerciseIds: new Set(input.explicit.triggerExerciseIds ?? []),
    triggerMinSets: Math.max(1, input.explicit.triggerMinSets ?? 1),
    targetDomain: input.explicit.targetDomain ?? null,
    triggerSupportedSports: new Set(
      (input.explicit.triggerSupportedSports ?? []).map((s) => s.toLowerCase())
    ),
  };
}

export function classifyLogAgainstFrequencyGoal(
  log: FrequencyGoalLogShape,
  goal: FrequencyGoalMembership
): { isPrimary: boolean } | null {
  if (goal.primaryRoutineIds.has(log.routineId)) return { isPrimary: true };
  if (goal.substituteRoutineIds.has(log.routineId)) return { isPrimary: false };

  // Domain-wide match claims PRIMARY — the user did training in the domain,
  // which is exactly what the goal asks for.
  if (goal.targetDomain) {
    if (goal.targetDomain === "any") return { isPrimary: true };
    if (log.routineDomain && log.routineDomain === goal.targetDomain) return { isPrimary: true };
  }

  // Sport-tag match — routine trains FOR one of the goal's sports.
  if (goal.triggerSupportedSports.size > 0 && log.routineSupportsSports) {
    if (log.routineSupportsSports.some((s) => goal.triggerSupportedSports.has(s.toLowerCase()))) {
      return { isPrimary: true };
    }
  }

  const hasTriggers =
    goal.triggerSubtypes.size > 0 ||
    goal.triggerActivityTypeIds.size > 0 ||
    goal.triggerActivityFamilyIds.size > 0 ||
    goal.triggerExerciseIds.size > 0;
  if (!hasTriggers) return null;

  if (goal.triggerSubtypes.size > 0 && log.routineSubtype) {
    const subtype = log.routineSubtype.toUpperCase();
    if (goal.triggerSubtypes.has(subtype)) return { isPrimary: true };
  }

  // Activity-type and family triggers — endurance logs land here. Trigger
  // matches claim PRIMARY (the user did the work, they just used a
  // type-based goal instead of a routine-based one).
  if (goal.triggerActivityTypeIds.size > 0 && log.activityTypeId) {
    if (goal.triggerActivityTypeIds.has(log.activityTypeId)) return { isPrimary: true };
  }
  if (goal.triggerActivityFamilyIds.size > 0 && log.activityFamilyId) {
    if (goal.triggerActivityFamilyIds.has(log.activityFamilyId)) return { isPrimary: true };
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
