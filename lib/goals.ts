import {
  type Goal,
  type MetadataGroupKind,
} from "@/generated/prisma";
import { formatAppDate, formatAppDateTime, toAppYmd } from "@/lib/dates";
import { getFrequencyGoalProgressList, getFrequencyGoalWindowDays } from "@/lib/frequency-goals";
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
import { formatMetadataGroupKind, inferExerciseMetadataSlugs, inferGuidedStepMetadataSlugs, inferRoutineMetadataSlugs } from "@/lib/metadata";
import { prisma } from "@/lib/prisma";
import { fillWeeklySeries, formatWeekLabel } from "@/lib/progress-v2";
import { formatRoutineSubtype } from "@/lib/routines";
import { getActivityEntry } from "@/lib/activity-families";
import { formatRoutineTargetLabel, getRoutineFrequencyStatus, getRoutineTargetWindow, normalizeRoutineFrequencyTarget } from "@/lib/routine-frequency";
import {
  sessionMetricGoalValueLabel,
  sessionMetricNumericValue,
  withSessionMetricConfig,
} from "@/lib/session-templates";
import { getWeekBoundsSunday } from "@/lib/week";

type GoalConfig = {
  benchmarkDistanceMi?: number;
  benchmarkLabel?: string;
  sessionMetricDefinitionId?: string;
  sessionMetricDefinitionLabel?: string;
  sessionMetricTargetText?: string;
  /** Minimum reps a set must have to count toward a MAX_WEIGHT goal.
   *  Lets users set rep-PR goals like "Bench press 200 lb for 5 reps" —
   *  only sets with reps >= minReps are considered when finding the peak
   *  weight. Undefined / 0 / 1 mean "any single rep counts", matching the
   *  previous behavior. */
  minReps?: number;
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
  routineKind?: string;
  sessionTemplateId?: string | null;
  sessionTemplateKey?: string | null;
  metricKey?: string;
  gradeSystem?: "BOULDER_V" | "YOSEMITE";
};

// Sport-flavored target option — synthetic per-sport routines have
// the same id semantics as regular routines (they go into the same
// `routineIds` form field), but they carry an accent color + eyebrow
// for the goal-form's Sports group rendering so they read visually
// like the sport tiles on /log.
export type GoalSportTargetOption = GoalTargetOption & {
  slug: string;
  eyebrow: string;
  color: string;
};

export type GoalFormOptions = {
  routines: GoalTargetOption[];
  /** Synthetic per-sport routines — surface as their own group in the
   *  goal form so users can build "Basketball 2x/wk" goals without
   *  the sport tiles getting lost in the strength/cardio routine
   *  list. Submitted via the same `routineIds` form field. */
  sportTargets: GoalSportTargetOption[];
  exercises: GoalTargetOption[];
  cardioTargets: GoalTargetOption[];
  groups: GoalTargetOption[];
  sessionTemplates: GoalTargetOption[];
  sessionMetricsByRoutineId: Record<string, GoalTargetOption[]>;
  sessionMetricsByTemplateId: Record<string, GoalTargetOption[]>;
  /** Endurance activity types — for the goal-builder picker. */
  activityTypes: Array<{
    id: string;
    slug: string;
    name: string;
    familyId: string;
    familyName: string;
    familySortOrder: number;
    sortOrder: number;
  }>;
  /** Endurance families — broader rollup targets ("Running 3x/wk"). */
  activityFamilies: Array<{
    id: string;
    slug: string;
    name: string;
    sortOrder: number;
  }>;
};

export type GoalHistoryPoint = {
  label: string;
  value: number;
  detailLines?: string[];
  tooltipLabel?: string;
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
  detailHref?: string | null;
  editHref?: string | null;
  toggleFrequencyGoalHref?: string | null;
  isToggleEnabled?: boolean;
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
  /** Count of trigger-exercise rows on the goal (group frequency goals
   *  only). Used by the row to render a "+N triggers" chip. */
  triggerExerciseCount?: number;
  /** Count of trigger-subtype values on the goal (group frequency only). */
  triggerSubtypeCount?: number;
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

// Synthetic "routine-frequency" goal row — represents a routine's primary
// FrequencyGoal (1:1 routine→goal, identified by `fg_<routineId>` ids).
// Phase 1: sourced from FrequencyGoal joined with the linked routine, not from
// the dropped per-routine columns. The legacy field names (targetFrequency*,
// frequencyGoalEnabled) are preserved so downstream helpers like
// normalizeRoutineFrequencyTarget keep working unchanged.
type RoutineFrequencyGoalRow = {
  id: string;
  name: string;
  kind: string;
  subtype: string | null;
  isActive: boolean;
  frequencyGoalEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  targetFrequencyCount: number | null;
  targetFrequencyUnit: "DAY" | "WEEK" | "MONTH" | null;
  targetFrequencyInterval: number | null;
};

type GroupFrequencyGoalRow = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  targetCount: number;
  targetInterval: number;
  targetUnit: "DAY" | "WEEK" | "MONTH";
  weekdayMask?: number | null;
  routines: Array<{
    routineId: string;
    routine: {
      id: string;
      name: string;
    };
  }>;
  /** Subtypes that broaden the match — see FrequencyGoal model docs. */
  triggerSubtypes?: string[];
  /** Endurance activity type ids — exact-match triggers for typed
   *  endurance logs (Run 3x/wk style goals). */
  triggerActivityTypeIds?: string[];
  /** Endurance family ids — broader rollup triggers (any Run-family log
   *  counts). */
  triggerActivityFamilyIds?: string[];
  /** Exercise ids that broaden the match — captures quick logs that don't
   *  belong to any enrolled routine. */
  triggerExerciseIds?: string[];
  /** Minimum sets of a trigger exercise required in a single log for it
   *  to claim a session via the exercise-trigger path. Defaults to 1. */
  triggerMinSets?: number;
};

function isRoutineFrequencyGoalLike(goal: Pick<Goal, "goalType" | "targetType" | "metricType" | "targetId">) {
  return goal.goalType === "FREQUENCY" && goal.targetType === "ROUTINE" && goal.metricType === "SESSIONS" && goal.targetId.trim().length > 0;
}

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
  const sessionMetricDefinitionId =
    typeof record.sessionMetricDefinitionId === "string" && record.sessionMetricDefinitionId.trim().length > 0
      ? record.sessionMetricDefinitionId.trim()
      : undefined;
  const sessionMetricDefinitionLabel =
    typeof record.sessionMetricDefinitionLabel === "string" && record.sessionMetricDefinitionLabel.trim().length > 0
      ? record.sessionMetricDefinitionLabel.trim()
      : undefined;
  const sessionMetricTargetText =
    typeof record.sessionMetricTargetText === "string" && record.sessionMetricTargetText.trim().length > 0
      ? record.sessionMetricTargetText.trim()
      : undefined;
  const minRepsRaw = typeof record.minReps === "number" ? record.minReps : Number(record.minReps);
  const minReps = Number.isFinite(minRepsRaw) && minRepsRaw >= 1 ? Math.floor(minRepsRaw) : undefined;
  return {
    ...(benchmarkDistanceMi ? { benchmarkDistanceMi } : {}),
    ...(benchmarkLabel ? { benchmarkLabel } : {}),
    ...(sessionMetricDefinitionId ? { sessionMetricDefinitionId } : {}),
    ...(sessionMetricDefinitionLabel ? { sessionMetricDefinitionLabel } : {}),
    ...(sessionMetricTargetText ? { sessionMetricTargetText } : {}),
    ...(minReps ? { minReps } : {}),
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
  const shouldClampToGoalStart = goal.timeframe === "ONE_TIME";
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
    : shouldClampToGoalStart && currentStart.getTime() < goalStart.getTime()
    ? goalStart
    : currentStart;
  currentEnd = currentEnd.getTime() > naturalEnd.getTime() ? naturalEnd : currentEnd;
  historyStart = useAllTimePerformanceWindow
    ? historyStart
    : shouldClampToGoalStart && historyStart.getTime() < goalStart.getTime()
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
      select: { id: true, name: true, kind: true, subtype: true },
    });
    return {
      label: routine?.name ?? "Unknown routine",
      kindLabel: GOAL_TARGET_TYPE_LABELS.ROUTINE,
      href: routine ? `/progress/routines/${routine.id}?tab=overview&range=4w` : null,
      filter: {
        routineIds: routine ? [routine.id] : [],
        exerciseIds: [],
        sessionTemplateIds: [],
        activityTypeIds: [],
        activityFamilyIds: [],
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
        sessionTemplateIds: [],
        activityTypeIds: [],
        activityFamilyIds: [],
      },
    };
  }

  if (goal.targetType === "SESSION_TEMPLATE") {
    const template = await prisma.sessionTemplate.findUnique({
      where: { id: goal.targetId },
      select: { id: true, name: true },
    });
    return {
      label: template?.name ?? "Unknown session template",
      kindLabel: GOAL_TARGET_TYPE_LABELS.SESSION_TEMPLATE,
      href: null,
      filter: {
        routineIds: [],
        exerciseIds: [],
        sessionTemplateIds: template ? [template.id] : [],
        activityTypeIds: [],
        activityFamilyIds: [],
      },
    };
  }

  const group = await prisma.metadataGroup.findUnique({
    where: { id: goal.targetId },
    select: { id: true, slug: true, label: true, kind: true },
  });
  const groupIds = group ? await getDescendantGroupIds(group.id) : [];
  const relevantGroups = groupIds.length
    ? await prisma.metadataGroup.findMany({
        where: { id: { in: groupIds } },
        select: { slug: true },
      })
    : [];
  const relevantSlugs = new Set(relevantGroups.map((item) => item.slug));

  const [routineAssignments, exerciseAssignments, subtypeRoutines, inferredExercises, templateAssignments, sessionTemplateRoutines, guidedStepAssignments, guidedSteps] = groupIds.length
    ? await Promise.all([
        prisma.routineMetadataGroup.findMany({
          where: { groupId: { in: groupIds } },
          select: { routineId: true },
        }),
        prisma.exerciseMetadataGroup.findMany({
          where: { groupId: { in: groupIds } },
          select: { exerciseId: true },
        }),
        prisma.routine.findMany({
          where: { isDeleted: false },
          select: { id: true, subtype: true },
        }),
        prisma.exercise.findMany({
          select: { id: true, name: true },
        }),
        prisma.sessionTemplateMetadataGroup.findMany({
          where: { groupId: { in: groupIds } },
          select: { templateId: true },
        }),
        prisma.sessionRoutineDetails.findMany({
          where: { templateId: { not: null } },
          select: { routineId: true, templateId: true },
        }),
        prisma.guidedStepMetadataGroup.findMany({
          where: { groupId: { in: groupIds } },
          select: { guidedStepId: true },
        }),
        prisma.guidedStep.findMany({
          select: { id: true, routineId: true, kind: true, title: true, exerciseId: true },
        }),
      ])
    : [[], [], [], [], [], [], [], []];
  const inferredRoutineIds = subtypeRoutines
    .filter((routine) => inferRoutineMetadataSlugs(routine.subtype).some((slugValue) => relevantSlugs.has(slugValue)))
    .map((routine) => routine.id);
  const inferredExerciseIds = inferredExercises
    .filter((exercise) => inferExerciseMetadataSlugs(exercise.name).some((slugValue) => relevantSlugs.has(slugValue)))
    .map((exercise) => exercise.id);
  const inferredGuidedStepIds = guidedSteps
    .filter((step) => step.kind === "STEP" && inferGuidedStepMetadataSlugs(step.title).some((slugValue) => relevantSlugs.has(slugValue)))
    .map((step) => step.id);
  const guidedExerciseIds = Array.from(
    new Set(
      guidedSteps
        .filter((step) => step.exerciseId && inferredExerciseIds.includes(step.exerciseId))
        .map((step) => step.exerciseId as string)
    )
  );
  const guidedRoutineIds = guidedSteps
    .filter(
      (step) =>
        guidedStepAssignments.some((assignment) => assignment.guidedStepId === step.id) ||
        inferredGuidedStepIds.includes(step.id) ||
        (step.exerciseId ? guidedExerciseIds.includes(step.exerciseId) : false)
    )
    .map((step) => step.routineId);
  const templateRoutineIds = sessionTemplateRoutines
    .filter((detail) => detail.templateId && templateAssignments.some((assignment) => assignment.templateId === detail.templateId))
    .map((detail) => detail.routineId);
  const routineIds = Array.from(
    new Set([...routineAssignments.map((item) => item.routineId), ...inferredRoutineIds, ...templateRoutineIds, ...guidedRoutineIds])
  );
  const exerciseIds = Array.from(new Set([...exerciseAssignments.map((item) => item.exerciseId), ...inferredExerciseIds]));
  const sessionTemplateIds = Array.from(new Set(templateAssignments.map((item) => item.templateId)));

  // Bilingual fix for post-T2 endurance: when the resolved metadata group is
  // CARDIO_ACTIVITY (the legacy way of identifying cardio sessions), also
  // collect any ActivityFamily and ActivityType ids whose slug matches the
  // group's slug or any descendant group slugs. The matcher below then ORs
  // these into the log query so synthetic-Endurance logs carrying the same
  // activityType (which don't have metadata tags) are counted toward the
  // goal. Without this, VOLUME / PERFORMANCE / COMPLETION cardio goals
  // would silently miss any log made through the post-T2 endurance section.
  let activityFamilyIds: string[] = [];
  let activityTypeIds: string[] = [];
  if (group && group.kind === "CARDIO_ACTIVITY") {
    const slugsToMatch = Array.from(relevantSlugs);
    if (slugsToMatch.length > 0) {
      const [families, types] = await Promise.all([
        prisma.enduranceFamily.findMany({
          where: { slug: { in: slugsToMatch } },
          select: { id: true },
        }),
        prisma.activityType.findMany({
          where: { slug: { in: slugsToMatch } },
          select: { id: true },
        }),
      ]);
      activityFamilyIds = families.map((f) => f.id);
      activityTypeIds = types.map((t) => t.id);
    }
  }

  return {
    label: group?.label ?? "Unknown group",
    kindLabel: goal.targetType === "CARDIO" ? GOAL_TARGET_TYPE_LABELS.CARDIO : GOAL_TARGET_TYPE_LABELS.GROUP,
    href: group ? `/progress/groups/${group.slug}?tab=overview&range=4w` : null,
    filter: { routineIds, exerciseIds, sessionTemplateIds, activityTypeIds, activityFamilyIds },
  };
}

async function getLogsForGoal(goal: GoalWithConfig, descriptor: Awaited<ReturnType<typeof getTargetDescriptor>>, start: Date, end: Date) {
  const routineIds = descriptor.filter.routineIds;
  const exerciseIds = descriptor.filter.exerciseIds;
  const sessionTemplateIds = descriptor.filter.sessionTemplateIds;
  const activityTypeIds = descriptor.filter.activityTypeIds;
  const activityFamilyIds = descriptor.filter.activityFamilyIds;
  const targetFilters = [
    ...(routineIds.length > 0 ? [{ routineId: { in: routineIds } }] : []),
    ...(exerciseIds.length > 0 ? [{ exercises: { some: { exerciseId: { in: exerciseIds } } } }] : []),
    ...(sessionTemplateIds.length > 0
      ? [{ routine: { sessionDetails: { templateId: { in: sessionTemplateIds } } } }]
      : []),
    // Bilingual fix (Phase 3b): catch post-T2 synthetic-Endurance logs that
    // don't have a metadata-tagged routine but carry an activityType matching
    // the goal's CARDIO_ACTIVITY group slug. Family + Type are ORed as
    // separate clauses so a goal targeting metadata "running" picks up both
    // family-level matches (any running type) and direct type matches.
    ...(activityTypeIds.length > 0 ? [{ activityTypeId: { in: activityTypeIds } }] : []),
    ...(activityFamilyIds.length > 0 ? [{ activityType: { familyId: { in: activityFamilyIds } } }] : []),
  ];

  const logs = await prisma.routineLog.findMany({
    where: {
      performedAt: { gte: start, lt: end },
      ...(targetFilters.length > 1 ? { OR: targetFilters } : targetFilters.length === 1 ? targetFilters[0] : { id: "__none__" }),
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
      sessionMetricValues: {
        include: {
          metricDefinition: true,
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
    // Optional rep-PR floor: e.g. a "Bench 200 for 5" goal sets minReps=5
    // and only sets with reps >= 5 count toward the peak. Sets with fewer
    // reps (or no rep count) are excluded. Undefined / <= 1 = any rep counts.
    const minReps = goal.config?.minReps ?? 0;
    const eligibleSets = minReps > 1
      ? entry.sets.filter((set) => (set.reps ?? 0) >= minReps)
      : entry.sets;
    return Math.max(0, ...eligibleSets.map((set) => set.weightLb ?? 0));
  }
  if (goal.metricType === "MAX_DURATION") {
    return Math.max(0, ...entry.sets.map((set) => set.seconds ?? 0));
  }
  if (goal.metricType === "DURATION") {
    return entry.sets.reduce((sum, set) => sum + (set.seconds ?? 0), 0);
  }
  return 0;
}

function sessionMetricValueForGoal(goal: GoalWithConfig, log: GoalLog) {
  const definitionId = goal.config?.sessionMetricDefinitionId;
  if (!definitionId) return null;
  const metricValue = log.sessionMetricValues.find((value) => value.metricDefinitionId === definitionId);
  if (!metricValue) return null;
  const definition = withSessionMetricConfig(metricValue.metricDefinition);
  return sessionMetricNumericValue(definition, metricValue);
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
  if (goal.metricType === "ELEVATION_GAIN") {
    return log.elevationGainFt ?? 0;
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
  if (goal.metricType === "SESSION_METRIC") {
    return sessionMetricValueForGoal(goal, log) ?? 0;
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
    return toAppYmd(date);
  }
  if (goal.timeframe === "MONTH") {
    return toAppYmd(date).slice(0, 7);
  }
  return toAppYmd(getWeekBoundsSunday(date).start);
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

function isExerciseTopWeightGoal(goal: GoalWithConfig) {
  return goal.goalType === "PERFORMANCE" && goal.targetType === "EXERCISE" && goal.metricType === "MAX_WEIGHT";
}

function exerciseWeightDetailLines(log: GoalLog, exerciseIds: Set<string>) {
  const relevantExercises = relevantExerciseIdsForLog(log, exerciseIds);
  const grouped = new Map<number, number[]>();

  for (const entry of relevantExercises) {
    for (const set of entry.sets) {
      const weight = set.weightLb ?? 0;
      const reps = set.reps ?? 0;
      if (weight <= 0 || reps <= 0) continue;
      const current = grouped.get(weight) ?? [];
      current.push(reps);
      grouped.set(weight, current);
    }
  }

  return Array.from(grouped.entries())
    .sort((left, right) => right[0] - left[0])
    .map(([weight, reps]) => `${weight.toFixed(1)} lb: ${reps.join(", ")} reps`);
}

function aggregateExerciseTopWeightSessionHistory(goal: GoalWithConfig, logs: GoalLog[], exerciseIds: Set<string>) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 43 * 7);

  return logs
    .filter((log) => log.performedAt.getTime() >= cutoff.getTime())
    .sort((left, right) => left.performedAt.getTime() - right.performedAt.getTime())
    .map((log) => ({
      label: formatAppDate(log.performedAt, { month: "short", day: "numeric" }),
      tooltipLabel: formatAppDateTime(log.performedAt, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      value: metricForLog(goal, log, exerciseIds),
      detailLines: exerciseWeightDetailLines(log, exerciseIds),
    }))
    .filter((point) => point.value > 0);
}

function aggregateHistory(goal: GoalWithConfig, logs: GoalLog[], exerciseIds: Set<string>) {
  if (isExerciseTopWeightGoal(goal)) {
    return aggregateExerciseTopWeightSessionHistory(goal, logs, exerciseIds);
  }

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
  if (goal.metricType === "SESSION_METRIC") {
    if (goal.config?.sessionMetricTargetText && value === goal.targetValue) return goal.config.sessionMetricTargetText;
    const targetText = goal.config?.sessionMetricTargetText?.trim();
    const isBoulderingGradeGoal =
      (goal.config?.sessionMetricDefinitionLabel === "V Grade" || /^v\d+/i.test(targetText ?? "")) &&
      Number.isFinite(value);
    if (isBoulderingGradeGoal) {
      return `V${Math.round(value)}`;
    }
    return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  }
  if (goal.metricType === "DISTANCE") return `${value.toFixed(1)} mi`;
  if (goal.metricType === "ELEVATION_GAIN") return `${value.toFixed(0)} ft`;
  if (goal.metricType === "DURATION" || goal.metricType === "MAX_DURATION") return formatSeconds(value);
  if (goal.metricType === "PACE") {
    const label = goal.config?.benchmarkLabel ?? (goal.config?.benchmarkDistanceMi ? `${goal.config.benchmarkDistanceMi.toFixed(2)} mi` : null);
    return label ? `${formatSeconds(value)} (${label})` : formatSeconds(value);
  }
  if (goal.metricType === "MAX_WEIGHT") {
    // Rep-PR: append "× N+ reps" when minReps is set, so users see the full
    // shape of the goal ("200 lb × 5+ reps") instead of just the weight.
    const minReps = goal.config?.minReps ?? 0;
    const suffix = minReps > 1 ? ` × ${minReps}+ reps` : "";
    return `${value.toFixed(1)} lb${suffix}`;
  }
  if (goal.metricType === "VOLUME") return `${value.toFixed(0)} lb`;
  if (goal.metricType === "REPS" || goal.metricType === "SETS" || goal.metricType === "SESSIONS" || goal.metricType === "COMPLETED") {
    return value.toFixed(0);
  }
  return value.toFixed(1);
}

function summaryLabel(goal: GoalWithConfig, targetLabel: string) {
  const timeframe = GOAL_TIMEFRAME_LABELS[goal.timeframe as GoalTimeframeValue].toLowerCase();
  const metric =
    goal.metricType === "SESSION_METRIC"
      ? (goal.config?.sessionMetricDefinitionLabel ?? GOAL_METRIC_LABELS[goal.metricType as GoalMetricTypeValue]).toLowerCase()
      : GOAL_METRIC_LABELS[goal.metricType as GoalMetricTypeValue].toLowerCase();
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
  if (goal.metricType === "SESSION_METRIC") {
    const definitionId = goal.config?.sessionMetricDefinitionId;
    if (definitionId) {
      const metricValue = log.sessionMetricValues.find((value) => value.metricDefinitionId === definitionId);
      if (metricValue) {
        const definition = withSessionMetricConfig(metricValue.metricDefinition);
        if (metricValue.textValue) return metricValue.textValue;
        if (metricValue.numberValue !== null && metricValue.numberValue !== undefined) {
          return sessionMetricGoalValueLabel(definition, metricValue.numberValue);
        }
      }
    }
  }
  return formatMetricValue(goal, metricForLog(goal, log, exerciseIds));
}

async function buildGoalInsightCore(
  parsedGoal: GoalWithConfig,
  descriptor: Awaited<ReturnType<typeof getTargetDescriptor>>,
  linkedRoutine: { id: string; frequencyGoalEnabled: boolean } | null
): Promise<GoalInsight> {
  const window = currentWindowForGoal(parsedGoal);
  const allLogs = await getLogsForGoal(parsedGoal, descriptor, window.historyStart, window.historyEnd);
  const currentLogs = allLogs.filter(
    (log) =>
      log.performedAt.getTime() >= window.currentStart.getTime() &&
      log.performedAt.getTime() < window.currentEnd.getTime()
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
    detailHref: `/goals/${parsedGoal.id}`,
    editHref: `/goals/${parsedGoal.id}?mode=edit`,
    toggleFrequencyGoalHref: linkedRoutine?.id ?? null,
    isToggleEnabled: linkedRoutine ? linkedRoutine.frequencyGoalEnabled : parsedGoal.isActive,
    goalTypeLabel: GOAL_TYPE_LABELS[parsedGoal.goalType as GoalTypeValue],
    metricLabel:
      parsedGoal.metricType === "SESSION_METRIC"
        ? parsedGoal.config?.sessionMetricDefinitionLabel ?? GOAL_METRIC_LABELS[parsedGoal.metricType as GoalMetricTypeValue]
        : GOAL_METRIC_LABELS[parsedGoal.metricType as GoalMetricTypeValue],
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

async function buildGoalInsight(goal: Goal) {
  const parsedGoal = toGoalWithConfig(goal);
  const descriptor = await getTargetDescriptor(parsedGoal);
  // Phase 1: the routine's per-routine frequency toggle now lives on its
  // primary FrequencyGoal (id = `fg_<routineId>`). Read its isActive and
  // surface as frequencyGoalEnabled in the legacy shape.
  const linkedRoutine = isRoutineFrequencyGoalLike(parsedGoal)
    ? await (async () => {
        const fg = await prisma.frequencyGoal.findUnique({
          where: { id: `fg_${parsedGoal.targetId}` },
          select: { isActive: true },
        });
        return { id: parsedGoal.targetId, frequencyGoalEnabled: fg?.isActive ?? false };
      })()
    : null;
  return buildGoalInsightCore(parsedGoal, descriptor, linkedRoutine);
}

// Batched version: avoids N+1 findUnique calls for ROUTINE/EXERCISE/SESSION_TEMPLATE goals
async function batchBuildGoalInsights(rawGoals: Goal[]): Promise<GoalInsight[]> {
  if (rawGoals.length === 0) return [];
  const goals = rawGoals.map(toGoalWithConfig);

  // Collect IDs to batch-fetch by target type
  const routineTargetIds = Array.from(
    new Set(
      goals
        .filter((g) => g.targetType === "ROUTINE" || isRoutineFrequencyGoalLike(g))
        .map((g) => g.targetId)
    )
  );
  const exerciseTargetIds = Array.from(new Set(goals.filter((g) => g.targetType === "EXERCISE").map((g) => g.targetId)));
  const templateTargetIds = Array.from(new Set(goals.filter((g) => g.targetType === "SESSION_TEMPLATE").map((g) => g.targetId)));

  const [rawRoutines, exercises, templates, routinePrimaryGoals] = await Promise.all([
    routineTargetIds.length > 0
      ? prisma.routine.findMany({
          where: { id: { in: routineTargetIds } },
          select: { id: true, name: true, kind: true, subtype: true },
        })
      : Promise.resolve([]),
    exerciseTargetIds.length > 0
      ? prisma.exercise.findMany({
          where: { id: { in: exerciseTargetIds } },
          select: { id: true, name: true, unit: true, supportsWeight: true },
        })
      : Promise.resolve([]),
    templateTargetIds.length > 0
      ? prisma.sessionTemplate.findMany({
          where: { id: { in: templateTargetIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    routineTargetIds.length > 0
      ? prisma.frequencyGoal.findMany({
          where: { id: { in: routineTargetIds.map((rid) => `fg_${rid}`) } },
          select: { id: true, isActive: true },
        })
      : Promise.resolve([]),
  ]);

  // Build a lookup of each routine's primary FrequencyGoal isActive flag — the
  // post-Phase-1 replacement for the dropped Routine.frequencyGoalEnabled column.
  const primaryGoalActiveByRoutineId = new Map(
    routinePrimaryGoals.map((g) => [g.id.replace(/^fg_/, ""), g.isActive])
  );
  const routines = rawRoutines.map((r) => ({
    ...r,
    frequencyGoalEnabled: primaryGoalActiveByRoutineId.get(r.id) ?? false,
  }));
  const routineMap = new Map(routines.map((r) => [r.id, r]));
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
  const templateMap = new Map(templates.map((t) => [t.id, t]));

  return Promise.all(
    goals.map(async (parsedGoal) => {
      let descriptor: Awaited<ReturnType<typeof getTargetDescriptor>>;
      if (parsedGoal.targetType === "ROUTINE") {
        const routine = routineMap.get(parsedGoal.targetId) ?? null;
        descriptor = {
          label: routine?.name ?? "Unknown routine",
          kindLabel: GOAL_TARGET_TYPE_LABELS.ROUTINE,
          href: routine ? `/progress/routines/${routine.id}?tab=overview&range=4w` : null,
          filter: { routineIds: routine ? [routine.id] : [], exerciseIds: [], sessionTemplateIds: [], activityTypeIds: [], activityFamilyIds: [] },
        };
      } else if (parsedGoal.targetType === "EXERCISE") {
        const exercise = exerciseMap.get(parsedGoal.targetId) ?? null;
        descriptor = {
          label: exercise?.name ?? "Unknown exercise",
          kindLabel: GOAL_TARGET_TYPE_LABELS.EXERCISE,
          href: exercise ? `/progress/exercises/${exercise.id}?tab=overview&range=4w` : null,
          filter: { routineIds: [], exerciseIds: exercise ? [exercise.id] : [], sessionTemplateIds: [], activityTypeIds: [], activityFamilyIds: [] },
        };
      } else if (parsedGoal.targetType === "SESSION_TEMPLATE") {
        const template = templateMap.get(parsedGoal.targetId) ?? null;
        descriptor = {
          label: template?.name ?? "Unknown session template",
          kindLabel: GOAL_TARGET_TYPE_LABELS.SESSION_TEMPLATE,
          href: null,
          filter: { routineIds: [], exerciseIds: [], sessionTemplateIds: template ? [template.id] : [], activityTypeIds: [], activityFamilyIds: [] },
        };
      } else {
        // GROUP / CARDIO: hierarchical resolution still needs its own queries
        descriptor = await getTargetDescriptor(parsedGoal);
      }

      const linkedRoutine = isRoutineFrequencyGoalLike(parsedGoal)
        ? (routineMap.get(parsedGoal.targetId) ?? null)
        : null;

      return buildGoalInsightCore(parsedGoal, descriptor, linkedRoutine);
    })
  );
}

function timeframeForRoutineFrequencyGoal(routine: RoutineFrequencyGoalRow): GoalTimeframeValue {
  if (routine.targetFrequencyUnit === "DAY") return "DAY";
  if (routine.targetFrequencyUnit === "MONTH") return "MONTH";
  return "WEEK";
}

function titleCaseFrequencyStatus(status: ReturnType<typeof getRoutineFrequencyStatus>["status"]) {
  if (status === "behind") return "Behind";
  if (status === "ahead") return "Ahead";
  if (status === "on_track") return "On track";
  return "No target";
}

function historyForRoutineFrequencyGoal(params: {
  routine: RoutineFrequencyGoalRow;
  logs: Array<{ performedAt: Date }>;
}) {
  const normalized = normalizeRoutineFrequencyTarget(params.routine);
  if (!normalized.hasTarget) return [];

  const window = getRoutineTargetWindow(params.routine);
  if (!window) return [];

  const historyLength = 8;
  const bucketMs = window.days * 24 * 60 * 60 * 1000;
  const now = Date.now();

  return Array.from({ length: historyLength }, (_, index) => {
    const offset = historyLength - index;
    const end = new Date(now - (offset - 1) * bucketMs);
    const start = new Date(end.getTime() - bucketMs);
    const value = params.logs.filter(
      (log) => log.performedAt.getTime() >= start.getTime() && log.performedAt.getTime() <= end.getTime()
    ).length;

    return {
      label:
        params.routine.targetFrequencyUnit === "DAY"
          ? formatAppDate(end, { month: "short", day: "numeric" })
          : params.routine.targetFrequencyUnit === "MONTH"
          ? new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(end)
          : formatWeekLabel(getWeekBoundsSunday(end).start.toISOString().slice(0, 10)),
      value,
    };
  });
}

function recentFrequencyContributionLabel() {
  return "1 session";
}

type RoutineFrequencyLogRow = { id: string; routineId: string; performedAt: Date; routine: { id: string; name: string } };

function buildRoutineFrequencyGoalInsightCore(routine: RoutineFrequencyGoalRow, logs: RoutineFrequencyLogRow[]): GoalInsight {
  const targetForProgress = { ...routine, frequencyGoalEnabled: true };
  const frequency = getRoutineFrequencyStatus({
    target: targetForProgress,
    logs: logs.map((log) => ({ performedAt: log.performedAt })),
  });
  const timeframe = timeframeForRoutineFrequencyGoal(routine);
  const currentWindowLogs = frequency.window
      ? logs.filter(
        (log) =>
          log.performedAt.getTime() >= frequency.window!.start.getTime() &&
          log.performedAt.getTime() < frequency.window!.end.getTime()
      )
    : [];
  const actualValue = frequency.currentCount;
  const targetValue = frequency.targetCount ?? 0;
  const fractionComplete = targetValue > 0 ? Math.min(1, actualValue / targetValue) : 0;
  const achieved = actualValue >= targetValue && targetValue > 0;
  const routineTypeLabel = formatRoutineSubtype(routine.subtype) ?? routine.kind;

  return {
    goal: {
      // Canonical id is the FrequencyGoal row's id (`fg_<routineId>`). Used to
      // be a synthetic `routine-frequency:` prefix while data was split between
      // Goal and FrequencyGoal tables; collapsed in Phase 4.
      id: `fg_${routine.id}`,
      name: routine.name,
      goalType: "FREQUENCY",
      targetType: "ROUTINE",
      targetId: routine.id,
      metricType: "SESSIONS",
      targetValue,
      timeframe,
      unit: null,
      startDate: routine.createdAt,
      endDate: null,
      isActive: routine.frequencyGoalEnabled,
      notes: null,
      config: null,
      createdAt: routine.createdAt,
      updatedAt: routine.updatedAt,
    },
    targetLabel: routine.name,
    targetKindLabel: GOAL_TARGET_TYPE_LABELS.ROUTINE,
    targetHref: `/progress/routines/${routine.id}?tab=overview&range=4w`,
    detailHref: null,
    editHref: `/routines/${routine.id}/edit`,
    toggleFrequencyGoalHref: routine.id,
    isToggleEnabled: routine.frequencyGoalEnabled,
    goalTypeLabel: GOAL_TYPE_LABELS.FREQUENCY,
    metricLabel: GOAL_METRIC_LABELS.SESSIONS,
    timeframeLabel: GOAL_TIMEFRAME_LABELS[timeframe],
    timeframeStatusLabel: titleCaseFrequencyStatus(frequency.status),
    timeframeWindowLabel: frequency.windowLabel.replace(/^last/, "Last"),
    summaryLabel: `${routine.name} | ${routineTypeLabel} | ${formatRoutineTargetLabel(targetForProgress)}`,
    actualValue,
    targetValue,
    actualDisplay: String(actualValue),
    targetDisplay: String(targetValue),
    fractionComplete,
    isAchieved: achieved,
    hasData: actualValue > 0,
    history: historyForRoutineFrequencyGoal({
      routine: targetForProgress,
      logs: logs.map((log) => ({ performedAt: log.performedAt })),
    }),
    recentItems: currentWindowLogs.slice(0, 8).map((log) => ({
      id: log.id,
      routineId: log.routineId,
      routineName: log.routine.name,
      performedAt: log.performedAt,
      contributionLabel: recentFrequencyContributionLabel(),
    })),
  } satisfies GoalInsight;
}

async function batchBuildRoutineFrequencyGoalInsights(routines: RoutineFrequencyGoalRow[]): Promise<GoalInsight[]> {
  if (routines.length === 0) return [];
  const now = new Date();
  let minHistoryStart = now;
  for (const routine of routines) {
    const win = getRoutineTargetWindow({ ...routine, frequencyGoalEnabled: true }, now);
    if (!win) continue;
    const hs = new Date(win.start.getTime() - win.days * 7 * 24 * 60 * 60 * 1000);
    if (hs < minHistoryStart) minHistoryStart = hs;
  }
  const allLogs = await prisma.routineLog.findMany({
    where: { routineId: { in: routines.map((r) => r.id) }, performedAt: { gte: minHistoryStart } },
    select: { id: true, routineId: true, performedAt: true, routine: { select: { id: true, name: true } } },
    orderBy: { performedAt: "desc" },
  });
  const logsByRoutineId = new Map<string, RoutineFrequencyLogRow[]>();
  for (const log of allLogs) {
    const bucket = logsByRoutineId.get(log.routineId) ?? [];
    bucket.push(log);
    logsByRoutineId.set(log.routineId, bucket);
  }
  return routines.map((routine) => buildRoutineFrequencyGoalInsightCore(routine, logsByRoutineId.get(routine.id) ?? []));
}

function timeframeForGroupFrequencyGoal(goal: Pick<GroupFrequencyGoalRow, "targetUnit">): GoalTimeframeValue {
  if (goal.targetUnit === "DAY") return "DAY";
  if (goal.targetUnit === "MONTH") return "MONTH";
  return "WEEK";
}

type GroupFrequencyLogRow = {
  id: string;
  routineId: string;
  performedAt: Date;
  routine: { id: string; name: string; subtype?: string | null };
  exercises?: Array<{ exerciseId: string; _count: { sets: number } }>;
};

function buildGroupFrequencyGoalInsightCore(goal: GroupFrequencyGoalRow, logs: GroupFrequencyLogRow[], now: Date): GoalInsight {
  const progress = getFrequencyGoalProgressList({
    goals: [
      {
        id: goal.id,
        name: goal.name,
        targetCount: goal.targetCount,
        targetInterval: goal.targetInterval,
        targetUnit: goal.targetUnit,
        isActive: goal.isActive,
        routineIds: goal.routines.map((entry) => entry.routineId),
        triggerSubtypes: goal.triggerSubtypes,
        triggerActivityTypeIds: goal.triggerActivityTypeIds,
        triggerActivityFamilyIds: goal.triggerActivityFamilyIds,
        triggerExerciseIds: goal.triggerExerciseIds,
        triggerMinSets: goal.triggerMinSets,
      },
    ],
    logs: logs.map((log) => ({
      id: log.id,
      routineId: log.routineId,
      performedAt: log.performedAt,
      routineSubtype: log.routine.subtype ?? null,
      exerciseSets: log.exercises?.map((e) => ({
        exerciseId: e.exerciseId,
        setCount: e._count.sets,
      })) ?? [],
    })),
    now,
  })[0];

  const currentCount = progress?.currentCount ?? 0;
  const targetValue = goal.targetCount;
  const fractionComplete = targetValue > 0 ? Math.min(1, currentCount / targetValue) : 0;
  const timeframe = timeframeForGroupFrequencyGoal(goal);
  const targetDisplay = `${goal.targetCount}`;
  const actualDisplay = `${currentCount}`;

  return {
    goal: {
      id: `group-frequency:${goal.id}`,
      name: goal.name,
      goalType: "FREQUENCY",
      targetType: "GROUP",
      targetId: goal.id,
      metricType: "SESSIONS",
      targetValue,
      timeframe,
      unit: null,
      startDate: goal.createdAt,
      endDate: null,
      isActive: goal.isActive,
      notes: null,
      config: null,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    },
    targetLabel: goal.name,
    targetKindLabel: GOAL_TARGET_TYPE_LABELS.GROUP,
    targetHref: null,
    detailHref: `/goals/group-frequency:${goal.id}?mode=edit`,
    editHref: `/goals/group-frequency:${goal.id}?mode=edit`,
    toggleFrequencyGoalHref: null,
    isToggleEnabled: goal.isActive,
    goalTypeLabel: GOAL_TYPE_LABELS.FREQUENCY,
    metricLabel: GOAL_METRIC_LABELS.SESSIONS,
    timeframeLabel: GOAL_TIMEFRAME_LABELS[timeframe],
    timeframeStatusLabel: progress?.status === "behind" ? "Behind" : progress?.status === "ahead" ? "Ahead" : "On track",
    timeframeWindowLabel:
      goal.targetUnit === "DAY"
        ? `Last ${goal.targetInterval} day${goal.targetInterval === 1 ? "" : "s"}`
        : goal.targetUnit === "WEEK"
        ? `Last ${goal.targetInterval} week${goal.targetInterval === 1 ? "" : "s"}`
        : `Last ${goal.targetInterval} month${goal.targetInterval === 1 ? "" : "s"}`,
    summaryLabel: `${goal.name} | ${goal.targetCount}x per ${goal.targetInterval} ${goal.targetUnit.toLowerCase()}${goal.targetInterval === 1 ? "" : "s"}`,
    actualValue: currentCount,
    targetValue,
    actualDisplay,
    targetDisplay,
    fractionComplete,
    isAchieved: currentCount >= targetValue && targetValue > 0,
    hasData: currentCount > 0,
    history: [],
    recentItems: logs.slice(0, 8).map((log) => ({
      id: log.id,
      routineId: log.routineId,
      routineName: log.routine.name,
      performedAt: log.performedAt,
      contributionLabel: "1 session",
    })),
    triggerExerciseCount: goal.triggerExerciseIds?.length ?? 0,
    triggerSubtypeCount: goal.triggerSubtypes?.length ?? 0,
  } satisfies GoalInsight;
}

async function batchBuildGroupFrequencyGoalInsights(goals: GroupFrequencyGoalRow[]): Promise<GoalInsight[]> {
  if (goals.length === 0) return [];
  const now = new Date();
  const maxWindowDays = Math.max(0, ...goals.map((g) => getFrequencyGoalWindowDays(g)));
  if (maxWindowDays === 0) return goals.map((goal) => buildGroupFrequencyGoalInsightCore(goal, [], now));

  // Build the union of every match criterion across all goals so we fetch
  // log rows once instead of N times. Goals without triggers contribute
  // just their routineIds; goals with triggers also broaden the fetch via
  // subtype OR exercise-id filters so the in-memory matcher actually sees
  // the trigger-matching logs.
  const allRoutineIds = Array.from(new Set(goals.flatMap((g) => g.routines.map((r) => r.routineId))));
  const allTriggerSubtypes = Array.from(new Set(goals.flatMap((g) => g.triggerSubtypes ?? [])));
  const allTriggerExerciseIds = Array.from(new Set(goals.flatMap((g) => g.triggerExerciseIds ?? [])));
  const hasTriggers = allTriggerSubtypes.length > 0 || allTriggerExerciseIds.length > 0;

  const windowStart = new Date(now.getTime() - maxWindowDays * 24 * 60 * 60 * 1000);
  const logWhere: import("@/generated/prisma").Prisma.RoutineLogWhereInput = hasTriggers
    ? {
        performedAt: { gte: windowStart },
        OR: [
          { routineId: { in: allRoutineIds } },
          ...(allTriggerSubtypes.length > 0
            ? [{ routine: { subtype: { in: allTriggerSubtypes } } }]
            : []),
          ...(allTriggerExerciseIds.length > 0
            ? [{ exercises: { some: { exerciseId: { in: allTriggerExerciseIds } } } }]
            : []),
        ],
      }
    : {
        routineId: { in: allRoutineIds },
        performedAt: { gte: windowStart },
      };

  const allLogs = await prisma.routineLog.findMany({
    where: logWhere,
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      routine: { select: { id: true, name: true, subtype: true } },
      // Per-exercise set counts so the matcher can honor triggerMinSets.
      exercises: {
        select: {
          exerciseId: true,
          _count: { select: { sets: true } },
        },
      },
    },
    orderBy: { performedAt: "desc" },
  });

  return goals.map((goal) => {
    const windowMs = getFrequencyGoalWindowDays(goal) * 24 * 60 * 60 * 1000;
    const goalWindowStart = new Date(now.getTime() - windowMs);
    // Pre-filter to logs in this goal's window — the matcher rechecks but
    // this trims the input before per-goal allocation.
    const goalLogs = allLogs.filter((log) => log.performedAt >= goalWindowStart);
    return buildGroupFrequencyGoalInsightCore(goal, goalLogs, now);
  });
}

export async function getGoalFormOptions(): Promise<GoalFormOptions> {
  const [routines, sportRoutines, exercises, groups, sessionTemplates, enduranceFamilies] = await Promise.all([
    prisma.routine.findMany({
      // Hide placeholder routines from goal target dropdowns — they exist
      // to host ad-hoc logs and were never meant to be picked by a user.
      where: { isDeleted: false, isPlaceholder: false },
      orderBy: [{ domain: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        subtype: true,
        sessionDetails: {
          select: {
            templateId: true,
            template: {
              select: {
                key: true,
              },
            },
          },
        },
      },
    }),
    // Synthetic sport routines — placeholder rows the user opts into
    // via /log → SPORTS. Surfaced as their own group in the goal-form
    // picker so a "Basketball 2x/wk" target is one tap. id pattern is
    // sports-{slug}-synthetic. isActive=true matches what /log shows
    // (soft-removed sports stay hidden until the user re-adds them).
    prisma.routine.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        isPlaceholder: true,
        kind: "SESSION",
        domain: "sport",
        // Filter by id pattern so we never accidentally surface other
        // placeholder routines (e.g. endurance-synthetic) here.
        id: { startsWith: "sports-", endsWith: "-synthetic" },
      },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, supportsWeight: true },
    }),
    prisma.metadataGroup.findMany({
      orderBy: [{ kind: "asc" }, { label: "asc" }],
      select: { id: true, label: true, kind: true },
    }),
    prisma.sessionTemplate.findMany({
      where: { isSystem: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        metricDefinitions: {
          where: { showInGoals: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    // Endurance taxonomy for the new goal-target picker: types + families.
    // Filtered by enabled status (UserActivityTypePreference.enabled !== false)
    // so the picker stays in sync with the user's settings choices.
    prisma.enduranceFamily.findMany({
      orderBy: [{ sortOrder: "asc" }],
      include: {
        types: {
          orderBy: [{ sortOrder: "asc" }],
          include: {
            userPreferences: { select: { enabled: true } },
          },
        },
      },
    }),
  ]);

  const cardioTargets = groups.filter((group) => cardioKinds.includes(group.kind));
  const standardGroups = groups.filter((group) => !cardioKinds.includes(group.kind));

  const sessionMetricOptionsByTemplateId = Object.fromEntries(
    sessionTemplates.map((template) => [
      template.id,
      template.metricDefinitions.map((definition) => {
        const definitionWithConfig = withSessionMetricConfig(definition);
        const isBoulderingGradeMetric =
          template.key.includes("bouldering") && definition.key === "highest_send_grade" && definitionWithConfig.config?.gradeSystem === "BOULDER_V";
        return {
          id: definition.id,
          label: isBoulderingGradeMetric ? "V Grade" : definition.label,
          subtitle:
            isBoulderingGradeMetric
              ? "Best send grade"
              : definition.unit ?? (definition.valueType === "TEXT" ? "Grade / text" : definition.valueType.toLowerCase()),
          metricKey: definition.key,
          gradeSystem: definitionWithConfig.config?.gradeSystem,
        };
      }),
    ])
  );
  const sessionMetricOptionsByRoutineId = Object.fromEntries(
    routines.map((routine) => [
      routine.id,
      routine.sessionDetails?.templateId ? sessionMetricOptionsByTemplateId[routine.sessionDetails.templateId] ?? [] : [],
    ])
  );

  // Shape sport routines into goal-target options with the same
  // accent palette + eyebrow used on /log + the schedule picker so
  // every surface refers to a given sport with the same color.
  const SPORT_ACCENT: Record<string, string> = {
    climbing: "rgba(251,146,60,0.9)",
    surfing: "rgba(56,189,248,0.9)",
    snowboarding: "rgba(168,85,247,0.9)",
    skiing: "rgba(99,102,241,0.9)",
    skateboarding: "rgba(244,114,182,0.9)",
    basketball: "rgba(220,38,38,0.9)",
    tennis: "rgba(132,204,22,0.9)",
    golf: "rgba(40,212,160,0.9)",
  };
  const sportTargets: GoalSportTargetOption[] = sportRoutines.flatMap((r) => {
    const slug = r.id.startsWith("sports-") && r.id.endsWith("-synthetic")
      ? r.id.slice("sports-".length, -"-synthetic".length)
      : null;
    if (!slug) return [];
    const entry = getActivityEntry(slug);
    if (!entry) return [];
    return [{
      id: r.id,
      slug,
      label: entry.label,
      subtitle: entry.eyebrow,
      eyebrow: entry.eyebrow,
      color: SPORT_ACCENT[slug] ?? "rgba(255,255,255,0.5)",
      routineKind: "SESSION" as const,
      sessionTemplateId: null,
      sessionTemplateKey: null,
    }];
  });

  return {
    routines: routines.map((routine) => ({
      id: routine.id,
      label: routine.name,
      subtitle: `${routine.kind}${routine.subtype ? ` | ${formatRoutineSubtype(routine.subtype)}` : ""}`,
      routineKind: routine.kind,
      sessionTemplateId: routine.sessionDetails?.templateId ?? null,
      sessionTemplateKey: routine.sessionDetails?.template?.key ?? null,
    })),
    sportTargets,
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
    sessionTemplates: sessionTemplates.map((template) => ({
      id: template.id,
      label: template.name,
      subtitle: template.sessionSubtype ? formatRoutineSubtype(template.sessionSubtype) : "Session template",
      sessionTemplateKey: template.key,
    })),
    sessionMetricsByRoutineId: sessionMetricOptionsByRoutineId,
    sessionMetricsByTemplateId: sessionMetricOptionsByTemplateId,
    // Flatten the EnduranceFamily → ActivityType[] tree into a list of
    // type options + a sibling list of family options. The picker UI
    // groups types under their family for display.
    activityTypes: enduranceFamilies.flatMap((fam) =>
      fam.types
        .filter((t) => t.userPreferences[0]?.enabled !== false)
        .map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          familyId: t.familyId,
          familyName: fam.name,
          familySortOrder: fam.sortOrder,
          sortOrder: t.sortOrder,
        }))
    ),
    activityFamilies: enduranceFamilies.map((fam) => ({
      id: fam.id,
      slug: fam.slug,
      name: fam.name,
      sortOrder: fam.sortOrder,
    })),
  };
}

export async function getGoalsOverview(filters: GoalListFilters = {}) {
  const where = {
    ...(filters.type && filters.type !== "all" ? { goalType: filters.type as GoalTypeValue } : {}),
    ...(filters.active === "active" ? { isActive: true } : filters.active === "inactive" ? { isActive: false } : {}),
  };
  const includeRoutineFrequencyGoals = !filters.type || filters.type === "all" || filters.type === "FREQUENCY";
  const [goals, routineFrequencyGoals, groupFrequencyGoals] = await Promise.all([
    prisma.goal.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
    // Phase 1: per-routine frequency targets are now FrequencyGoal records with
    // ids like `fg_<routineId>`. Pull those, join the routine, and shape into
    // the legacy RoutineFrequencyGoalRow form that downstream insight builders
    // already understand.
    includeRoutineFrequencyGoals
      ? prisma.frequencyGoal.findMany({
          where: {
            id: { startsWith: "fg_" },
            ...(filters.active === "active"
              ? { isActive: true }
              : filters.active === "inactive"
              ? { isActive: false }
              : {}),
          },
          include: {
            routines: {
              include: {
                routine: {
                  select: {
                    id: true,
                    name: true,
                    kind: true,
                    subtype: true,
                    isActive: true,
                    isDeleted: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    includeRoutineFrequencyGoals
      ? prisma.frequencyGoal.findMany({
          where: {
            // Exclude per-routine `fg_*` records — those render via the routine
            // frequency path above. Without this filter, single-routine
            // FrequencyGoals appeared twice on /goals (once per code path).
            id: { not: { startsWith: "fg_" } },
            ...(filters.active === "active"
              ? { isActive: true }
              : filters.active === "inactive"
              ? { isActive: false }
              : {}),
          },
          include: {
            routines: {
              select: {
                routineId: true,
                routine: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            triggerExercises: {
              select: { exerciseId: true },
            },
          },
          orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  // Adapt FrequencyGoal+routine pairs (Phase 1 source of truth) into the legacy
  // RoutineFrequencyGoalRow shape so the existing insight builder can consume them
  // without changes.
  const routineFrequencyRows: RoutineFrequencyGoalRow[] = routineFrequencyGoals
    .flatMap((fg) => {
      const link = fg.routines[0];
      if (!link?.routine || link.routine.isDeleted) return [];
      return [
        {
          id: link.routine.id,
          name: link.routine.name,
          kind: link.routine.kind,
          subtype: link.routine.subtype,
          isActive: link.routine.isActive,
          frequencyGoalEnabled: fg.isActive,
          createdAt: link.routine.createdAt,
          updatedAt: fg.updatedAt,
          targetFrequencyCount: fg.targetCount,
          targetFrequencyUnit: fg.targetUnit,
          targetFrequencyInterval: fg.targetInterval,
        },
      ];
    });
  // Flatten the triggerExercises join into a plain id list so the matcher
  // input matches the GroupFrequencyGoalRow shape it expects.
  const groupFrequencyRows: GroupFrequencyGoalRow[] = groupFrequencyGoals.map((g) => ({
    id: g.id,
    name: g.name,
    isActive: g.isActive,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    targetCount: g.targetCount,
    targetInterval: g.targetInterval,
    targetUnit: g.targetUnit,
    weekdayMask: g.weekdayMask ?? null,
    routines: g.routines.map((r) => ({
      routineId: r.routineId,
      routine: r.routine,
    })),
    triggerSubtypes: g.triggerSubtypes,
    triggerExerciseIds: g.triggerExercises.map((e) => e.exerciseId),
    triggerMinSets: g.triggerMinSets,
  }));
  const [manualInsights, routineInsights, groupFrequencyInsights] = await Promise.all([
    batchBuildGoalInsights(goals),
    batchBuildRoutineFrequencyGoalInsights(routineFrequencyRows),
    batchBuildGroupFrequencyGoalInsights(groupFrequencyRows),
  ]);
  const filteredRoutineInsights = routineInsights.filter((entry) => {
    if (filters.active === "active") return entry.goal.isActive;
    if (filters.active === "inactive") return !entry.goal.isActive;
    return true;
  });

  return [...groupFrequencyInsights, ...filteredRoutineInsights, ...manualInsights].sort((left, right) => {
    if (left.goal.isActive !== right.goal.isActive) return left.goal.isActive ? -1 : 1;
    const leftIsGroupFrequency = left.goal.id.startsWith("group-frequency:");
    const rightIsGroupFrequency = right.goal.id.startsWith("group-frequency:");
    if (leftIsGroupFrequency !== rightIsGroupFrequency) return leftIsGroupFrequency ? -1 : 1;
    return right.goal.createdAt.getTime() - left.goal.createdAt.getTime();
  });
}

export async function getGoalById(goalId: string) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  return goal ? toGoalWithConfig(goal) : null;
}

export async function getGroupFrequencyGoalById(goalId: string) {
  const normalizedGoalId = decodeURIComponent(goalId);
  const id = normalizedGoalId.startsWith("group-frequency:") ? normalizedGoalId.slice("group-frequency:".length) : normalizedGoalId;
  if (!id) return null;
  const goal = await prisma.frequencyGoal.findUnique({
    where: { id },
    include: {
      routines: {
        select: { routineId: true, role: true },
      },
      triggerExercises: {
        select: { exerciseId: true },
      },
    },
  });
  if (!goal) return null;
  // Flatten the join rows so callers consume a clean string[] (the form
  // initial values + matcher input both expect plain ids).
  return {
    ...goal,
    triggerExerciseIds: goal.triggerExercises.map((row) => row.exerciseId),
  };
}

export async function getGoalInsight(goalId: string) {
  // Three id flavors flow through here:
  //   • `group-frequency:<id>` — synthesized group frequency goal
  //   • `fg_<routineId>`       — per-routine FrequencyGoal companion
  //   • `<goalId>`             — actual Goal table row
  const decoded = decodeURIComponent(goalId);

  if (decoded.startsWith("group-frequency:")) {
    const id = decoded.slice("group-frequency:".length);
    const goal = await prisma.frequencyGoal.findUnique({
      where: { id },
      include: {
        routines: {
          select: {
            routineId: true,
            routine: { select: { id: true, name: true } },
          },
        },
        triggerExercises: {
          select: { exerciseId: true },
        },
      },
    });
    if (!goal || goal.routines.length === 0) return null;
    const shape: GroupFrequencyGoalRow = {
      id: goal.id,
      name: goal.name,
      isActive: goal.isActive,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      targetCount: goal.targetCount,
      targetInterval: goal.targetInterval,
      targetUnit: goal.targetUnit,
      weekdayMask: goal.weekdayMask ?? null,
      routines: goal.routines
        .filter((r): r is typeof r & { routine: { id: string; name: string } } => Boolean(r.routine))
        .map((r) => ({ routineId: r.routineId, routine: { id: r.routine.id, name: r.routine.name } })),
      triggerSubtypes: goal.triggerSubtypes,
      triggerExerciseIds: goal.triggerExercises.map((e) => e.exerciseId),
      triggerMinSets: goal.triggerMinSets,
    };
    const [insight] = await batchBuildGroupFrequencyGoalInsights([shape]);
    return insight ?? null;
  }

  if (decoded.startsWith("fg_")) {
    const routineId = decoded.slice("fg_".length);
    const fg = await prisma.frequencyGoal.findUnique({
      where: { id: decoded },
      include: {
        routines: {
          include: {
            routine: {
              select: { id: true, name: true, kind: true, subtype: true, isActive: true, isDeleted: true, createdAt: true },
            },
          },
        },
      },
    });
    const link = fg?.routines.find((r) => r.routineId === routineId) ?? fg?.routines[0];
    if (!fg || !link?.routine || link.routine.isDeleted) return null;
    const row: RoutineFrequencyGoalRow = {
      id: link.routine.id,
      name: link.routine.name,
      kind: link.routine.kind,
      subtype: link.routine.subtype,
      isActive: link.routine.isActive,
      frequencyGoalEnabled: fg.isActive,
      createdAt: link.routine.createdAt,
      updatedAt: fg.updatedAt,
      targetFrequencyCount: fg.targetCount,
      targetFrequencyUnit: fg.targetUnit,
      targetFrequencyInterval: fg.targetInterval,
    };
    const [insight] = await batchBuildRoutineFrequencyGoalInsights([row]);
    return insight ?? null;
  }

  const goal = await prisma.goal.findUnique({ where: { id: decoded } });
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
  return (["ROUTINE", "EXERCISE", "CARDIO", "GROUP", "SESSION_TEMPLATE"] as const).map((value) => ({
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
