import type { MetadataGroupKind, RoutineKind } from "@/generated/prisma";
import { toAppYmd } from "@/lib/dates";
import { inferExerciseMetadataSlugs, inferGuidedStepMetadataSlugs, inferRoutineMetadataSlugs } from "@/lib/metadata";
import { prisma } from "@/lib/prisma";
import { getMaxRoutineFrequencyWindowDays, getRoutineFrequencyStatuses, routineWithFrequencyTarget, type RoutineFrequencySummary } from "@/lib/routine-frequency";
import { getStimulusOverviewModel } from "@/lib/stimulus-preferences";

export const RECENT_WINDOW_DAYS = 7;
export const LONG_WINDOW_DAYS = 28;
export const BASELINE_WINDOW_DAYS = 56;
export const NEW_USER_MIN_LOGS = 3;
export const SPARSE_HISTORY_MIN_LOGS = 6;
export const MAX_PRIMARY_RECOMMENDATIONS = 1;
export const MAX_SECONDARY_RECOMMENDATIONS = 2;

const COVERAGE_GAP_WINDOW_DAYS = 7;
const MAINTENANCE_WINDOW_DAYS = 28;
const THIN_COVERAGE_MAX_COUNT = 1;
const MAINTENANCE_MAX_COUNT = 1;
const ROUTINE_RECENT_REPETITION_THRESHOLD = 3;
const ROUTINE_KIND_DOMINANCE_MIN_COUNT = 4;
const ROUTINE_KIND_DOMINANCE_SHARE = 0.68;
const CATEGORY_DOMINANCE_MIN_COUNT = 3;
const CATEGORY_DOMINANCE_SHARE = 0.58;
const FOCUS_ALIGNMENT_BONUS_CAP = 0.18;
const MATCH_DEPTH_WEIGHTS = {
  routine_direct: 1,
  exercise_direct: 0.94,
  session_template: 0.9,
  guided_step: 0.88,
  inferred: 0.72,
} as const satisfies Record<MatchSourceType, number>;
const ANCESTOR_MATCH_PENALTY = 0.24;
const SUPPORT_SOURCE_BONUS = 0.04;
const MAX_SUPPORT_SOURCE_BONUS = 0.12;

type RelativeBaselineLabel =
  | "far below typical"
  | "below typical"
  | "near typical"
  | "above typical"
  | "high for this user";

export type RecommendationPriority = "high" | "medium" | "low";

export type RecommendationAction = {
  kind: "log_routine" | "open_progress" | "explore_category" | "lighter_day" | "stay_the_course";
  label: string;
  href: string;
  routineId?: string;
  categorySlug?: string;
};

export type RecommendationSignalSet = {
  recentLoad: number;
  baselineLoad: number;
  deltaFromBaseline: number;
  emphasisWeight: number;
  neglectScore: number;
  overloadScore: number;
  relativeLoad: RelativeBaselineLabel;
  frequencyDelta: RelativeBaselineLabel;
};

export type RecommendationSourceType = "ROUTINE_TARGET" | "COVERAGE_GAP" | "REPETITION" | "MAINTENANCE" | "LIGHT" | "FOUNDATION";
export type RecommendationTargetLens = "ROUTINE" | "MUSCLE_GROUP" | "MOVEMENT_PATTERN" | "SPORT" | "ROUTINE_KIND" | null;
export type RoutineMatchDirectType = "routine_direct" | "exercise_direct" | "session_template" | "guided_step" | "inferred" | "ancestor_only" | "none";

export type RoutineMatchSignals = {
  directMatchType: RoutineMatchDirectType;
  categoryRelevanceScore: number;
  metadataDepthScore: number;
  spacingScore: number;
  recencyPenalty: number;
  behindTargetBoost: number;
  repetitionPenalty: number;
  activeEligibleScore: number;
  routineKindFit: number;
  focusModifier: number;
  finalRoutineMatchScore: number;
};

export type SuggestedRoutineOption = {
  id: string;
  name: string;
  kind: RoutineKind;
  href: string;
  matchSignals?: RoutineMatchSignals;
};

export type TrainingRecommendation = {
  id: string;
  type: "routine_target" | "coverage_gap" | "repetition" | "maintenance" | "light_day" | "foundation";
  sourceType: RecommendationSourceType;
  targetLens: RecommendationTargetLens;
  targetLabel: string | null;
  priority: RecommendationPriority;
  title: string;
  summary: string;
  rationale: string[];
  targetCategories: string[];
  suggestedRoutineIds: string[];
  suggestedRoutines: SuggestedRoutineOption[];
  suggestedAction: RecommendationAction;
  behindByCount?: number;
  coverageWindowDays?: number;
  matchingRoutineIds: string[];
  rationaleSignals: string[];
  routineMatchSignals?: RoutineMatchSignals | null;
  signals: RecommendationSignalSet;
};

export type RecommendationCategorySnapshot = {
  slug: string;
  label: string;
  lens: "muscles" | "patterns" | "sports";
  recentCount: number;
  longCount: number;
  recentShare: number;
  longShare: number;
  isThin: boolean;
  isAbsent: boolean;
  hasMatchingRoutine: boolean;
};

export type RecommendationDensitySnapshot = {
  recentSessionCount: number;
  recentActiveDays: number;
  recentThreeDaySessions: number;
  baselineSessionsPerWeek: number;
  baselineActiveDaysPerWeek: number;
  baselineRecentExpectedSessions: number;
  baselineRecentExpectedActiveDays: number;
  relativeRecentSessions: RelativeBaselineLabel;
};

export type RecommendationModel = {
  generatedAt: Date;
  windows: {
    recentDays: number;
    longDays: number;
    baselineDays: number;
  };
  hasEnoughHistory: boolean;
  isNewUser: boolean;
  emphasisLabels: string[];
  categorySnapshots: RecommendationCategorySnapshot[];
  density: RecommendationDensitySnapshot;
  recommendations: TrainingRecommendation[];
  primaryRecommendation: TrainingRecommendation | null;
  secondaryRecommendations: TrainingRecommendation[];
  hiddenDueToInjury: Array<{
    routineId: string;
    routineName: string;
    reason: string;
    href: string;
  }>;
};

type GroupRow = {
  id: string;
  slug: string;
  label: string;
  kind: MetadataGroupKind;
  parentIds: string[];
};

type Lens = "muscles" | "patterns" | "sports";

type LoadedRoutine = Awaited<ReturnType<typeof loadRecommendationInputs>>["routines"][number];
type LoadedLog = Awaited<ReturnType<typeof loadRecommendationInputs>>["logs"][number];
type MatchSourceType = "routine_direct" | "exercise_direct" | "session_template" | "guided_step" | "inferred";

type RoutineInsight = {
  routineId: string;
  name: string;
  kind: RoutineKind;
  href: string;
  lensLabels: Record<Lens, string[]>;
  lensSlugs: Record<Lens, string[]>;
  stimulusSlugs: string[];
  lastLoggedAt: Date | null;
  recentCount: number;
  maintenanceCount: number;
  focusWeight: number;
  sourceGroupIdsByType: Record<MatchSourceType, Set<string>>;
  frequencyStatus: RoutineFrequencySummary;
};

type CoverageCategoryInsight = RecommendationCategorySnapshot & {
  dominantRoutineKind: RoutineKind | null;
  href: string;
};

type RepetitionSignal = {
  id: string;
  targetLens: RecommendationTargetLens;
  label: string;
  lensCategorySlugs: string[];
  count: number;
  share: number;
  suggestedLabel: string;
  suggestedRoutineIds: string[];
  suggestedRoutines: SuggestedRoutineOption[];
  suggestedAction: RecommendationAction;
};

type InjuryRecommendationContext = {
  activeZoneLabels: string[];
  activeMetadataSlugs: Set<string>;
  flaredMetadataSlugs: Set<string>;
  recoveringMetadataSlugs: Set<string>;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getWindowStart(days: number) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - days);
  return since;
}

function diffInDays(from: Date | null, to = new Date()) {
  if (!from) return 999;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

function dayKey(date: Date) {
  return toAppYmd(date);
}

function normalizeRelativeLabel(value: number, baseline: number): RelativeBaselineLabel {
  const typical = Math.max(0.01, baseline);
  const ratio = value / typical;
  if (ratio <= 0.5) return "far below typical";
  if (ratio < 0.82) return "below typical";
  if (ratio >= 1.5) return "high for this user";
  if (ratio > 1.18) return "above typical";
  return "near typical";
}

function scorePriority(score: number): RecommendationPriority {
  if (score >= 0.8) return "high";
  if (score >= 0.52) return "medium";
  return "low";
}

function createEmptyKindCountRecord() {
  return {
    WORKOUT: 0,
    CARDIO: 0,
    GUIDED: 0,
    SESSION: 0,
    COMPLETION: 0,
  } satisfies Record<RoutineKind, number>;
}

function createEmptySourceGroupRecord() {
  return {
    routine_direct: new Set<string>(),
    exercise_direct: new Set<string>(),
    session_template: new Set<string>(),
    guided_step: new Set<string>(),
    inferred: new Set<string>(),
  } satisfies Record<MatchSourceType, Set<string>>;
}

function lensKind(lens: Lens): MetadataGroupKind {
  if (lens === "muscles") return "MUSCLE_GROUP";
  if (lens === "patterns") return "MOVEMENT_PATTERN";
  return "CARDIO_ACTIVITY";
}

function categoryHref(group: GroupRow) {
  // CARDIO_ACTIVITY groups have detail pages at /activities/[slug] (Phase 2).
  // TRAINING_GROUP / MUSCLE_GROUP / etc. still live under /progress/groups/[slug].
  return group.kind === "CARDIO_ACTIVITY"
    ? `/activities/${group.slug}?tab=overview&range=4w`
    : `/progress/groups/${group.slug}?tab=overview&range=4w`;
}

function shouldShowGroupInLens(group: GroupRow, lens: Lens) {
  if (group.kind !== lensKind(lens)) return false;
  if (lens === "sports" && group.slug === "run-walk") return false;
  return true;
}

function appendSet(target: Set<string>, values: Iterable<string>) {
  for (const value of values) target.add(value);
}

function groupIdsFromSlugs(slugs: string[], groupIdBySlug: Map<string, string>) {
  return slugs.map((slug) => groupIdBySlug.get(slug)).filter((value): value is string => Boolean(value));
}

function expandAncestorIds(groupIds: Iterable<string>, groupById: Map<string, GroupRow>) {
  const expanded = new Set<string>();
  const queue = [...groupIds];

  for (const groupId of queue) expanded.add(groupId);

  while (queue.length > 0) {
    const groupId = queue.shift();
    if (!groupId) continue;
    const group = groupById.get(groupId);
    if (!group) continue;
    for (const parentId of group.parentIds) {
      if (expanded.has(parentId)) continue;
      expanded.add(parentId);
      queue.push(parentId);
    }
  }

  return expanded;
}

function buildDescendantIdsByGroupId(groups: GroupRow[]) {
  const childIdsByGroupId = new Map<string, string[]>();
  for (const group of groups) {
    for (const parentId of group.parentIds) {
      const current = childIdsByGroupId.get(parentId) ?? [];
      current.push(group.id);
      childIdsByGroupId.set(parentId, current);
    }
  }

  const descendantsByGroupId = new Map<string, Set<string>>();
  for (const group of groups) {
    const descendants = new Set<string>();
    const queue = [...(childIdsByGroupId.get(group.id) ?? [])];
    while (queue.length > 0) {
      const childId = queue.shift();
      if (!childId || descendants.has(childId)) continue;
      descendants.add(childId);
      queue.push(...(childIdsByGroupId.get(childId) ?? []));
    }
    descendantsByGroupId.set(group.id, descendants);
  }

  return descendantsByGroupId;
}

function collectLogGroupIds(log: LoadedLog, groupIdBySlug: Map<string, string>) {
  const groupIds = new Set<string>();
  const routineGroupIds = log.routine.metadataGroups.map((entry) => entry.group.id);
  const subtypeGroupIds = groupIdsFromSlugs(inferRoutineMetadataSlugs(log.routine.subtype), groupIdBySlug);
  const templateGroupIds = log.routine.sessionDetails?.template?.metadataGroups.map((entry) => entry.group.id) ?? [];

  appendSet(groupIds, routineGroupIds);
  appendSet(groupIds, subtypeGroupIds);
  appendSet(groupIds, templateGroupIds);

  if (log.routine.kind === "WORKOUT") {
    const exerciseGroupIds = new Set<string>();
    for (const exercise of log.exercises) {
      const directGroupIds = exercise.exercise.metadataGroups.map((entry) => entry.group.id);
      const inferredGroupIds =
        directGroupIds.length > 0 ? [] : groupIdsFromSlugs(inferExerciseMetadataSlugs(exercise.exercise.name), groupIdBySlug);
      appendSet(exerciseGroupIds, directGroupIds);
      appendSet(exerciseGroupIds, inferredGroupIds);
    }
    appendSet(groupIds, exerciseGroupIds.size > 0 ? exerciseGroupIds : routineGroupIds);
  }

  if (log.routine.kind === "GUIDED") {
    const guidedGroupIds = new Set<string>();
    for (const step of log.guidedSteps) {
      const stepGroupIds = step.guidedStep?.metadataGroups.map((entry) => entry.group.id) ?? [];
      const exerciseGroupIds = step.exercise?.metadataGroups.map((entry) => entry.group.id) ?? [];
      const inferredGroupIds =
        stepGroupIds.length === 0 && exerciseGroupIds.length === 0
          ? groupIdsFromSlugs(inferGuidedStepMetadataSlugs(step.title), groupIdBySlug)
          : [];
      appendSet(guidedGroupIds, stepGroupIds);
      appendSet(guidedGroupIds, exerciseGroupIds);
      appendSet(guidedGroupIds, inferredGroupIds);
    }
    appendSet(groupIds, guidedGroupIds.size > 0 ? guidedGroupIds : routineGroupIds);
  }

  return groupIds;
}

function collectRoutineGroupIds(routine: LoadedRoutine, groupIdBySlug: Map<string, string>) {
  const groupIds = new Set<string>();
  const routineGroupIds = routine.metadataGroups.map((entry) => entry.group.id);
  appendSet(groupIds, routineGroupIds);
  appendSet(groupIds, groupIdsFromSlugs(inferRoutineMetadataSlugs(routine.subtype), groupIdBySlug));
  appendSet(groupIds, routine.sessionDetails?.template?.metadataGroups.map((entry) => entry.group.id) ?? []);

  for (const exercise of routine.exercises) {
    const directGroupIds = exercise.exercise.metadataGroups.map((entry) => entry.group.id);
    const inferredGroupIds =
      directGroupIds.length > 0 ? [] : groupIdsFromSlugs(inferExerciseMetadataSlugs(exercise.exercise.name), groupIdBySlug);
    appendSet(groupIds, directGroupIds);
    appendSet(groupIds, inferredGroupIds);
  }

  for (const step of routine.guidedSteps) {
    const stepGroupIds = step.metadataGroups.map((entry) => entry.group.id);
    const exerciseGroupIds = step.exercise?.metadataGroups.map((entry) => entry.group.id) ?? [];
    const inferredGroupIds =
      stepGroupIds.length === 0 && exerciseGroupIds.length === 0
        ? groupIdsFromSlugs(inferGuidedStepMetadataSlugs(step.title), groupIdBySlug)
        : [];
    appendSet(groupIds, stepGroupIds);
    appendSet(groupIds, exerciseGroupIds);
    appendSet(groupIds, inferredGroupIds);
  }

  return groupIds;
}

function collectRoutineSourceGroupIds(routine: LoadedRoutine, groupIdBySlug: Map<string, string>) {
  const sourceGroupIds = createEmptySourceGroupRecord();

  for (const entry of routine.metadataGroups) sourceGroupIds.routine_direct.add(entry.group.id);
  for (const groupId of groupIdsFromSlugs(inferRoutineMetadataSlugs(routine.subtype), groupIdBySlug)) sourceGroupIds.inferred.add(groupId);
  for (const entry of routine.sessionDetails?.template?.metadataGroups ?? []) sourceGroupIds.session_template.add(entry.group.id);

  for (const exercise of routine.exercises) {
    const directGroupIds = exercise.exercise.metadataGroups.map((entry) => entry.group.id);
    if (directGroupIds.length > 0) {
      for (const groupId of directGroupIds) sourceGroupIds.exercise_direct.add(groupId);
    } else {
      for (const groupId of groupIdsFromSlugs(inferExerciseMetadataSlugs(exercise.exercise.name), groupIdBySlug)) sourceGroupIds.inferred.add(groupId);
    }
  }

  for (const step of routine.guidedSteps) {
    const stepGroupIds = step.metadataGroups.map((entry) => entry.group.id);
    const exerciseGroupIds = step.exercise?.metadataGroups.map((entry) => entry.group.id) ?? [];
    const directGroupIds = [...stepGroupIds, ...exerciseGroupIds];
    if (directGroupIds.length > 0) {
      for (const groupId of directGroupIds) sourceGroupIds.guided_step.add(groupId);
    } else {
      for (const groupId of groupIdsFromSlugs(inferGuidedStepMetadataSlugs(step.title), groupIdBySlug)) sourceGroupIds.inferred.add(groupId);
    }
  }

  return sourceGroupIds;
}

function routineKindFitScore(params: {
  routine: RoutineInsight;
  lens: Lens | null;
  preferLighter?: boolean;
  rebalanceAwayFromKind?: RoutineKind | null;
}) {
  let score = 0;
  if (params.lens === "sports") {
    if (params.routine.kind === "SESSION") score += 0.18;
    else if (params.routine.kind === "CARDIO") score += 0.16;
    else if (params.routine.kind === "COMPLETION") score += 0.06;
    else if (params.routine.kind === "WORKOUT") score += 0.02;
  } else if (params.lens === "patterns" || params.lens === "muscles") {
    if (params.routine.kind === "WORKOUT") score += 0.16;
    else if (params.routine.kind === "GUIDED") score += 0.1;
    else if (params.routine.kind === "SESSION") score += 0.06;
    else if (params.routine.kind === "COMPLETION") score += 0.04;
  } else {
    if (params.routine.kind === "GUIDED") score += 0.12;
    else if (params.routine.kind === "COMPLETION") score += 0.1;
    else if (params.routine.kind === "CARDIO") score += 0.08;
  }

  if (params.preferLighter) {
    if (params.routine.kind === "GUIDED") score += 0.1;
    else if (params.routine.kind === "COMPLETION") score += 0.08;
    else if (params.routine.kind === "CARDIO") score += 0.06;
    else if (params.routine.kind === "WORKOUT") score -= 0.04;
  }

  if (params.rebalanceAwayFromKind && params.routine.kind === params.rebalanceAwayFromKind) {
    score -= 0.1;
  }

  return round(score);
}

function spacingSignalsForRoutine(routine: RoutineInsight) {
  const daysSinceLast = diffInDays(routine.lastLoggedAt);
  const targetCount = routine.frequencyStatus.targetCount ?? 0;
  const targetWindowDays = routine.frequencyStatus.window?.days ?? 0;
  const idealSpacingDays = targetCount > 0 && targetWindowDays > 0 ? Math.max(1, Math.floor(targetWindowDays / targetCount)) : 5;
  const rawSpacingScore = clamp(daysSinceLast / Math.max(1, idealSpacingDays), 0, 1) * 0.22;

  let recencyPenalty =
    daysSinceLast <= 0 ? 0.24 : daysSinceLast === 1 ? 0.16 : daysSinceLast === 2 ? 0.08 : daysSinceLast === 3 ? 0.03 : 0;
  if (routine.frequencyStatus.status === "behind") recencyPenalty *= 0.45;
  if (routine.frequencyStatus.status === "ahead") recencyPenalty += 0.06;

  const behindTargetBoost =
    routine.frequencyStatus.status === "behind"
      ? Math.min(0.28, routine.frequencyStatus.remainingCount * 0.08 + Math.min(0.08, daysSinceLast * 0.01))
      : routine.frequencyStatus.status === "ahead"
      ? -0.08
      : 0;

  const repetitionPenalty = clamp(
    routine.recentCount >= ROUTINE_RECENT_REPETITION_THRESHOLD
      ? 0.06 + (routine.recentCount - ROUTINE_RECENT_REPETITION_THRESHOLD + 1) * 0.04
      : Math.max(0, routine.recentCount - 1) * 0.03,
    0,
    0.22
  );

  return {
    spacingScore: round(rawSpacingScore),
    recencyPenalty: round(recencyPenalty),
    behindTargetBoost: round(behindTargetBoost),
    repetitionPenalty: round(routine.frequencyStatus.status === "behind" ? repetitionPenalty * 0.65 : repetitionPenalty),
  };
}

function categoryMatchSignals(params: {
  routine: RoutineInsight;
  targetGroupId: string | null;
  descendantsByGroupId: Map<string, Set<string>>;
}) {
  if (!params.targetGroupId) {
    return {
      directMatchType: "none" as const,
      categoryRelevanceScore: 0,
      metadataDepthScore: 0,
    };
  }

  const descendants = params.descendantsByGroupId.get(params.targetGroupId) ?? new Set<string>();
  const sourceEntries = Object.entries(params.routine.sourceGroupIdsByType) as Array<[MatchSourceType, Set<string>]>;
  let bestDirectType: RoutineMatchDirectType = "none";
  let bestCategoryScore = 0;
  let supportCount = 0;

  for (const [sourceType, groupIds] of sourceEntries) {
    const exact = groupIds.has(params.targetGroupId);
    const descendantMatch = !exact && Array.from(groupIds).some((groupId) => descendants.has(groupId));
    if (!exact && !descendantMatch) continue;
    supportCount += 1;

    const baseWeight = MATCH_DEPTH_WEIGHTS[sourceType];
    const candidateScore = exact ? baseWeight : Math.max(0.35, baseWeight - ANCESTOR_MATCH_PENALTY);
    if (candidateScore > bestCategoryScore) {
      bestCategoryScore = candidateScore;
      bestDirectType = exact ? sourceType : "ancestor_only";
    }
  }

  return {
    directMatchType: bestDirectType,
    categoryRelevanceScore: round(bestCategoryScore),
    metadataDepthScore: round(clamp(bestCategoryScore + Math.min(MAX_SUPPORT_SOURCE_BONUS, Math.max(0, supportCount - 1) * SUPPORT_SOURCE_BONUS), 0, 1)),
  };
}

function makeAction(params: {
  kind: RecommendationAction["kind"];
  fallbackLabel: string;
  categorySlug?: string;
  categoryHref?: string;
  suggestedRoutine?: { id: string; name: string; kind: RoutineKind; href: string };
}) {
  if (params.suggestedRoutine) {
    return {
      kind: "log_routine" as const,
      label: `Log ${params.suggestedRoutine.name}`,
      href: params.suggestedRoutine.href,
      routineId: params.suggestedRoutine.id,
      categorySlug: params.categorySlug,
    };
  }

  return {
    kind: params.kind,
    label: params.fallbackLabel,
    href: params.categoryHref ?? "/progress",
    categorySlug: params.categorySlug,
  };
}

function createRecommendation(params: Omit<TrainingRecommendation, "suggestedRoutineIds">) {
  return {
    ...params,
    suggestedRoutineIds: params.suggestedRoutines.map((routine) => routine.id),
  } satisfies TrainingRecommendation;
}

// Phase 1: legacy per-routine frequency columns dropped; frequency targets now
// come from the FrequencyGoal model via the frequencyGoalRoutines relation.
// routineWithFrequencyTarget() flattens that into the legacy shape consumers
// already expect.
const routineScalarSelect = {
  id: true,
  name: true,
  subtype: true,
  domain: true,
  kind: true,
  timesPerWeek: true,
  isActive: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  frequencyGoalRoutines: {
    include: { goal: true },
  },
} as const;

const routineRelationSelect = {
  ...routineScalarSelect,
  metadataGroups: {
    include: { group: { select: { id: true, slug: true, label: true, kind: true } } },
  },
  sessionDetails: {
    include: {
      template: {
        include: {
          metadataGroups: {
            include: { group: { select: { id: true, slug: true, label: true, kind: true } } },
          },
        },
      },
    },
  },
} as const;

async function loadRecommendationInputs() {
  const stimulusOverviewPromise = getStimulusOverviewModel();
  const groupsPromise = prisma.metadataGroup.findMany({
    orderBy: [{ kind: "asc" }, { label: "asc" }],
    select: {
      id: true,
      slug: true,
      label: true,
      kind: true,
      parentRelations: {
        select: { parentGroupId: true },
      },
    },
  });
  const routineSelectShared = {
    exercises: {
      include: {
        exercise: {
          include: {
            metadataGroups: {
              include: { group: { select: { id: true, slug: true, label: true, kind: true } } },
            },
          },
        },
      },
    },
    sessionDetails: {
      include: {
        template: {
          include: {
            metadataGroups: {
              include: { group: { select: { id: true, slug: true, label: true, kind: true } } },
            },
          },
        },
      },
    },
    guidedSteps: {
      include: {
        metadataGroups: {
          include: { group: { select: { id: true, slug: true, label: true, kind: true } } },
        },
        exercise: {
          include: {
            metadataGroups: {
              include: { group: { select: { id: true, slug: true, label: true, kind: true } } },
            },
          },
        },
      },
    },
    metadataGroups: {
      include: { group: { select: { id: true, slug: true, label: true, kind: true } } },
    },
  } as const;

  const rawRoutines = await prisma.routine.findMany({
    where: { isDeleted: false, isActive: true },
    orderBy: [{ domain: "asc" }, { name: "asc" }],
    select: {
      ...routineScalarSelect,
      ...routineSelectShared,
    },
  });
  const routines = rawRoutines.map(routineWithFrequencyTarget);

  const maxTargetWindowDays = Math.max(getMaxRoutineFrequencyWindowDays(routines), BASELINE_WINDOW_DAYS, MAINTENANCE_WINDOW_DAYS);
  const logSince = getWindowStart(maxTargetWindowDays);
  const logIncludeShared = {
    exercises: {
      include: {
        exercise: {
          include: {
            metadataGroups: {
              include: { group: { select: { id: true, slug: true, label: true, kind: true } } },
            },
          },
        },
      },
    },
    guidedSteps: {
      include: {
        guidedStep: {
          include: {
            metadataGroups: {
              include: { group: { select: { id: true, slug: true, label: true, kind: true } } },
            },
          },
        },
        exercise: {
          include: {
            metadataGroups: {
              include: { group: { select: { id: true, slug: true, label: true, kind: true } } },
            },
          },
        },
      },
    },
  } as const;

  const rawLogs = await prisma.routineLog.findMany({
    where: {
      performedAt: { gte: logSince },
      routine: {
        isDeleted: false,
      },
    },
    orderBy: [{ performedAt: "desc" }],
    include: {
      routine: {
        select: routineRelationSelect,
      },
      ...logIncludeShared,
    },
  });
  const logs = rawLogs.map((log) => ({
    ...log,
    routine: routineWithFrequencyTarget(log.routine),
  }));

  const [stimulusOverview, groups] = await Promise.all([stimulusOverviewPromise, groupsPromise]);
  return { stimulusOverview, groups, routines, logs };
}

function buildDensitySnapshot(logs: LoadedLog[]): RecommendationDensitySnapshot {
  const recentStart = getWindowStart(RECENT_WINDOW_DAYS);
  const baselineStart = getWindowStart(BASELINE_WINDOW_DAYS);
  const recentLogs = logs.filter((log) => log.performedAt >= recentStart);
  const baselineLogs = logs.filter((log) => log.performedAt >= baselineStart);
  const recentActiveDays = new Set(recentLogs.map((log) => dayKey(log.performedAt))).size;
  const baselineActiveDays = new Set(baselineLogs.map((log) => dayKey(log.performedAt))).size;
  const baselineSessionsPerWeek = baselineLogs.length * (7 / BASELINE_WINDOW_DAYS);
  const baselineActiveDaysPerWeek = baselineActiveDays * (7 / BASELINE_WINDOW_DAYS);

  return {
    recentSessionCount: recentLogs.length,
    recentActiveDays,
    recentThreeDaySessions: recentLogs.filter((log) => diffInDays(log.performedAt) <= 2).length,
    baselineSessionsPerWeek: round(baselineSessionsPerWeek),
    baselineActiveDaysPerWeek: round(baselineActiveDaysPerWeek),
    baselineRecentExpectedSessions: round(baselineLogs.length * (RECENT_WINDOW_DAYS / BASELINE_WINDOW_DAYS)),
    baselineRecentExpectedActiveDays: round(baselineActiveDays * (RECENT_WINDOW_DAYS / BASELINE_WINDOW_DAYS)),
    relativeRecentSessions: normalizeRelativeLabel(recentLogs.length, baselineLogs.length * (RECENT_WINDOW_DAYS / BASELINE_WINDOW_DAYS)),
  };
}

function buildRecommendationSignals(params: {
  recentValue: number;
  baselineValue?: number;
  emphasisWeight?: number;
  neglectScore?: number;
  overloadScore?: number;
}): RecommendationSignalSet {
  const baselineLoad = params.baselineValue ?? 0;
  return {
    recentLoad: round(params.recentValue),
    baselineLoad: round(baselineLoad),
    deltaFromBaseline: round(params.recentValue - baselineLoad),
    emphasisWeight: round(params.emphasisWeight ?? 1),
    neglectScore: round(params.neglectScore ?? 0),
    overloadScore: round(params.overloadScore ?? 0),
    relativeLoad: normalizeRelativeLabel(params.recentValue, baselineLoad || Math.max(1, params.recentValue)),
    frequencyDelta: normalizeRelativeLabel(params.recentValue, baselineLoad || Math.max(1, params.recentValue)),
  };
}

function buildInsights(params: Awaited<ReturnType<typeof loadRecommendationInputs>>) {
  const groupRows: GroupRow[] = params.groups.map((group) => ({
    id: group.id,
    slug: group.slug,
    label: group.label,
    kind: group.kind,
    parentIds: group.parentRelations.map((relation) => relation.parentGroupId),
  }));
  const groupById = new Map(groupRows.map((group) => [group.id, group]));
  const groupBySlug = new Map(groupRows.map((group) => [group.slug, group]));
  const groupIdBySlug = new Map(groupRows.map((group) => [group.slug, group.id]));
  const descendantsByGroupId = buildDescendantIdsByGroupId(groupRows);
  const recentStart = getWindowStart(COVERAGE_GAP_WINDOW_DAYS);
  const maintenanceStart = getWindowStart(MAINTENANCE_WINDOW_DAYS);
  const baselineStart = getWindowStart(BASELINE_WINDOW_DAYS);
  const recentRoutineCounts = new Map<string, number>();
  const maintenanceRoutineCounts = new Map<string, number>();
  const lastLoggedAtByRoutineId = new Map<string, Date>();
  const recentKindCounts = createEmptyKindCountRecord();
  const routineFrequencyStatuses = getRoutineFrequencyStatuses({
    routines: params.routines,
    logs: params.logs.map((log) => ({ routineId: log.routineId, performedAt: log.performedAt })),
  });
  const focusWeightBySlug = new Map<string, number>(params.stimulusOverview.effectivePreferences.map((entry) => [entry.slug, entry.priorityWeight]));
  const lensCountsRecent = new Map<Lens, Map<string, number>>(
    (["muscles", "patterns", "sports"] as Lens[]).map((lens) => [lens, new Map()])
  );
  const lensCountsLong = new Map<Lens, Map<string, number>>(
    (["muscles", "patterns", "sports"] as Lens[]).map((lens) => [lens, new Map()])
  );
  const lensKindCountsRecent = new Map<Lens, Map<string, Record<RoutineKind, number>>>(
    (["muscles", "patterns", "sports"] as Lens[]).map((lens) => [lens, new Map()])
  );
  let baselineLogCount = 0;

  for (const log of params.logs) {
    const currentLastLoggedAt = lastLoggedAtByRoutineId.get(log.routineId);
    if (!currentLastLoggedAt || log.performedAt > currentLastLoggedAt) {
      lastLoggedAtByRoutineId.set(log.routineId, log.performedAt);
    }

    if (log.performedAt >= baselineStart) baselineLogCount += 1;
    if (log.performedAt < maintenanceStart) continue;

    const expandedGroupIds = expandAncestorIds(collectLogGroupIds(log, groupIdBySlug), groupById);
    const routineKind = log.routine.kind;

    if (log.performedAt >= recentStart) {
      recentRoutineCounts.set(log.routineId, (recentRoutineCounts.get(log.routineId) ?? 0) + 1);
      recentKindCounts[routineKind] += 1;
    }
    maintenanceRoutineCounts.set(log.routineId, (maintenanceRoutineCounts.get(log.routineId) ?? 0) + 1);

    for (const lens of ["muscles", "patterns", "sports"] as Lens[]) {
      const matchingGroups = Array.from(expandedGroupIds)
        .map((groupId) => groupById.get(groupId))
        .filter((group): group is GroupRow => Boolean(group))
        .filter((group) => shouldShowGroupInLens(group, lens));
      const seenIds = new Set<string>();
      for (const group of matchingGroups) {
        if (seenIds.has(group.id)) continue;
        seenIds.add(group.id);

        if (log.performedAt >= recentStart) {
          const currentRecent = lensCountsRecent.get(lens)!;
          currentRecent.set(group.id, (currentRecent.get(group.id) ?? 0) + 1);

          const byKindMap = lensKindCountsRecent.get(lens)!;
          const kindCounts = byKindMap.get(group.id) ?? createEmptyKindCountRecord();
          kindCounts[routineKind] += 1;
          byKindMap.set(group.id, kindCounts);
        }

        const currentLong = lensCountsLong.get(lens)!;
        currentLong.set(group.id, (currentLong.get(group.id) ?? 0) + 1);
      }
    }
  }

  const routineInsights: RoutineInsight[] = params.routines.map((routine) => {
    const sourceGroupIdsByType = collectRoutineSourceGroupIds(routine, groupIdBySlug);
    const expandedGroupIds = expandAncestorIds(collectRoutineGroupIds(routine, groupIdBySlug), groupById);
    const lensGroups = (["muscles", "patterns", "sports"] as Lens[]).reduce(
      (acc, lens) => {
        const groupsForLens = Array.from(expandedGroupIds)
          .map((groupId) => groupById.get(groupId))
          .filter((group): group is GroupRow => Boolean(group))
          .filter((group) => shouldShowGroupInLens(group, lens));
        acc.labels[lens] = Array.from(new Set(groupsForLens.map((group) => group.label)));
        acc.slugs[lens] = Array.from(new Set(groupsForLens.map((group) => group.slug)));
        return acc;
      },
      {
        labels: { muscles: [], patterns: [], sports: [] } as Record<Lens, string[]>,
        slugs: { muscles: [], patterns: [], sports: [] } as Record<Lens, string[]>,
      }
    );

    const stimulusSlugs = Array.from(
      new Set(
        [...lensGroups.slugs.patterns, ...lensGroups.slugs.sports, ...lensGroups.slugs.muscles].filter((slug) => focusWeightBySlug.has(slug))
      )
    );
    const strongestFocusWeight = stimulusSlugs.reduce((max, slug) => Math.max(max, focusWeightBySlug.get(slug) ?? 1), 1);

    return {
      routineId: routine.id,
      name: routine.name,
      kind: routine.kind,
      href: `/routines/${routine.id}/log`,
      lensLabels: lensGroups.labels,
      lensSlugs: lensGroups.slugs,
      stimulusSlugs,
      lastLoggedAt: lastLoggedAtByRoutineId.get(routine.id) ?? null,
      recentCount: recentRoutineCounts.get(routine.id) ?? 0,
      maintenanceCount: maintenanceRoutineCounts.get(routine.id) ?? 0,
      focusWeight: strongestFocusWeight,
      sourceGroupIdsByType,
      frequencyStatus: routineFrequencyStatuses.get(routine.id) ?? {
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
      },
    };
  });

  const coverageInsights: CoverageCategoryInsight[] = groupRows
    .filter((group) => ["muscles", "patterns", "sports"].some((lens) => shouldShowGroupInLens(group, lens as Lens)))
    .map((group) => {
      const lens = group.kind === "MUSCLE_GROUP" ? "muscles" : group.kind === "MOVEMENT_PATTERN" ? "patterns" : "sports";
      const recentCount = lensCountsRecent.get(lens)?.get(group.id) ?? 0;
      const longCount = lensCountsLong.get(lens)?.get(group.id) ?? 0;
      const totalRecent = Array.from(lensCountsRecent.get(lens)?.values() ?? []).reduce((sum, count) => sum + count, 0);
      const totalLong = Array.from(lensCountsLong.get(lens)?.values() ?? []).reduce((sum, count) => sum + count, 0);
      const matchingRoutines = routineInsights.filter((routine) => routine.lensSlugs[lens].includes(group.slug));
      const kindCounts = lensKindCountsRecent.get(lens)?.get(group.id) ?? createEmptyKindCountRecord();
      const dominantRoutineKind =
        Object.entries(kindCounts)
          .sort((left, right) => right[1] - left[1])
          .find((entry) => entry[1] > 0)?.[0] as RoutineKind | undefined;

      return {
        slug: group.slug,
        label: group.label,
        lens,
        recentCount,
        longCount,
        recentShare: totalRecent > 0 ? round(recentCount / totalRecent) : 0,
        longShare: totalLong > 0 ? round(longCount / totalLong) : 0,
        isThin: recentCount <= THIN_COVERAGE_MAX_COUNT,
        isAbsent: recentCount === 0,
        hasMatchingRoutine: matchingRoutines.length > 0,
        dominantRoutineKind: dominantRoutineKind ?? null,
        href: categoryHref(group),
      };
    });

  return {
    baselineLogCount,
    routineInsights,
    coverageInsights,
    recentKindCounts,
    recentRoutineCounts,
    groupBySlug,
    descendantsByGroupId,
  };
}

type RoutineMatchTarget =
  | {
      mode: "category";
      lens: Lens;
      categorySlug: string;
      preferLighter?: boolean;
      rebalanceAwayFromKind?: RoutineKind | null;
    }
  | {
      mode: "general";
      lens: Lens | null;
      preferLighter?: boolean;
      rebalanceAwayFromKind?: RoutineKind | null;
    };

function scoreRoutineCandidate(params: {
  routine: RoutineInsight;
  target: RoutineMatchTarget;
  groupBySlug: Map<string, GroupRow>;
  descendantsByGroupId: Map<string, Set<string>>;
}) {
  const targetGroup = params.target.mode === "category" ? params.groupBySlug.get(params.target.categorySlug) ?? null : null;
  const categorySignals =
    params.target.mode === "category"
      ? categoryMatchSignals({
          routine: params.routine,
          targetGroupId: targetGroup?.id ?? null,
          descendantsByGroupId: params.descendantsByGroupId,
        })
      : {
          directMatchType: "none" as const,
          categoryRelevanceScore: 0.4,
          metadataDepthScore: 0.4,
        };
  const spacingSignals = spacingSignalsForRoutine(params.routine);
  const routineKindFit = routineKindFitScore({
    routine: params.routine,
    lens: params.target.lens,
    preferLighter: params.target.preferLighter,
    rebalanceAwayFromKind: params.target.rebalanceAwayFromKind,
  });
  const activeEligibleScore = 0.12;
  const focusModifier = clamp((params.routine.focusWeight - 1) * 0.08, -0.05, 0.08);
  const finalRoutineMatchScore = round(
    clamp(
      categorySignals.categoryRelevanceScore * 0.38 +
        categorySignals.metadataDepthScore * 0.26 +
        spacingSignals.spacingScore +
        spacingSignals.behindTargetBoost +
        routineKindFit +
        activeEligibleScore +
        focusModifier -
        spacingSignals.recencyPenalty -
        spacingSignals.repetitionPenalty,
      0,
      1.5
    )
  );

  return {
    directMatchType: categorySignals.directMatchType,
    categoryRelevanceScore: categorySignals.categoryRelevanceScore,
    metadataDepthScore: categorySignals.metadataDepthScore,
    spacingScore: spacingSignals.spacingScore,
    recencyPenalty: spacingSignals.recencyPenalty,
    behindTargetBoost: spacingSignals.behindTargetBoost,
    repetitionPenalty: spacingSignals.repetitionPenalty,
    activeEligibleScore,
    routineKindFit,
    focusModifier,
    finalRoutineMatchScore,
  } satisfies RoutineMatchSignals;
}

function formatDirectMatchType(value: RoutineMatchDirectType) {
  if (value === "routine_direct") return "direct routine metadata";
  if (value === "exercise_direct") return "direct exercise metadata";
  if (value === "session_template") return "session-template metadata";
  if (value === "guided_step") return "guided-step metadata";
  if (value === "inferred") return "inferred metadata";
  if (value === "ancestor_only") return "ancestor coverage rather than a direct tag";
  return "general fit";
}

function pickSuggestedRoutines(params: {
  routines: RoutineInsight[];
  target: RoutineMatchTarget;
  groupBySlug: Map<string, GroupRow>;
  descendantsByGroupId: Map<string, Set<string>>;
  excludeRoutineIds?: string[];
}) {
  const excludeIds = new Set(params.excludeRoutineIds ?? []);

  return params.routines
    .filter((routine) => !excludeIds.has(routine.routineId))
    .filter((routine) =>
      params.target.mode === "category" ? routine.lensSlugs[params.target.lens].includes(params.target.categorySlug) : true
    )
    .map((routine) => ({
      routine,
      matchSignals: scoreRoutineCandidate({
        routine,
        target: params.target,
        groupBySlug: params.groupBySlug,
        descendantsByGroupId: params.descendantsByGroupId,
      }),
    }))
    .sort((left, right) => {
      return (
        right.matchSignals.finalRoutineMatchScore - left.matchSignals.finalRoutineMatchScore ||
        right.matchSignals.metadataDepthScore - left.matchSignals.metadataDepthScore ||
        diffInDays(left.routine.lastLoggedAt) - diffInDays(right.routine.lastLoggedAt) ||
        left.routine.name.localeCompare(right.routine.name)
      );
    })
    .slice(0, 3)
    .map(({ routine, matchSignals }) => ({
      id: routine.routineId,
      name: routine.name,
      kind: routine.kind,
      href: routine.href,
      matchSignals,
    }));
}

function buildFoundationRecommendation(params: {
  routineInsights: RoutineInsight[];
  emphasisLabels: string[];
  baselineLogCount: number;
  density: RecommendationDensitySnapshot;
  groupBySlug: Map<string, GroupRow>;
  descendantsByGroupId: Map<string, Set<string>>;
}) {
  const suggestedRoutine = pickSuggestedRoutines({
    routines: params.routineInsights,
    target: { mode: "general", lens: "patterns", preferLighter: true },
    groupBySlug: params.groupBySlug,
    descendantsByGroupId: params.descendantsByGroupId,
  })[0];

  return createRecommendation({
    id: "foundation-start",
    type: "foundation",
    sourceType: "FOUNDATION",
    targetLens: "ROUTINE",
    targetLabel: suggestedRoutine?.name ?? null,
    priority: "medium",
    title: "Build a clearer baseline",
    summary: "A few more completions will make the next-step suggestions much more specific and trustworthy.",
    rationale: [
      `Only ${params.baselineLogCount} recent logs are available, so routine targets and coverage gaps are still sparse.`,
      "Once a little more history is in place, the dashboard can rank behind-target routines and thin coverage more confidently.",
      suggestedRoutine
        ? `${suggestedRoutine.name} is a straightforward place to add another data point.`
        : "Any active routine is enough here. The goal is just to establish your normal rhythm.",
    ],
    targetCategories: params.emphasisLabels.slice(0, 2),
    suggestedRoutines: suggestedRoutine ? [suggestedRoutine] : [],
    suggestedAction: makeAction({
      kind: "log_routine",
      fallbackLabel: "Open routines",
      suggestedRoutine,
    }),
    matchingRoutineIds: suggestedRoutine ? [suggestedRoutine.id] : [],
    rationaleSignals: ["sparse_history"],
    routineMatchSignals: suggestedRoutine?.matchSignals ?? null,
    signals: buildRecommendationSignals({
      recentValue: params.density.recentSessionCount,
      baselineValue: params.density.baselineRecentExpectedSessions,
    }),
  });
}

function buildBehindTargetRecommendations(params: {
  routineInsights: RoutineInsight[];
  groupBySlug: Map<string, GroupRow>;
  descendantsByGroupId: Map<string, Set<string>>;
}) {
  return params.routineInsights
    .filter((routine) => routine.frequencyStatus.hasTarget && routine.frequencyStatus.status === "behind")
    .map((routine) => {
      const routineMatchSignals = scoreRoutineCandidate({
        routine,
        target: { mode: "general", lens: null, preferLighter: routine.kind === "GUIDED" || routine.kind === "COMPLETION" },
        groupBySlug: params.groupBySlug,
        descendantsByGroupId: params.descendantsByGroupId,
      });
      const suggestedRoutines = [
        {
          id: routine.routineId,
          name: routine.name,
          kind: routine.kind,
          href: routine.href,
          matchSignals: routineMatchSignals,
        },
      ];
      const focusBonus = clamp((routine.focusWeight - 1) * 0.18, -0.08, FOCUS_ALIGNMENT_BONUS_CAP);
      const behindRatio =
        routine.frequencyStatus.targetCount && routine.frequencyStatus.targetCount > 0
          ? routine.frequencyStatus.remainingCount / routine.frequencyStatus.targetCount
          : 0;
      const sortScore = clamp(
        0.78 +
          Math.min(0.2, routine.frequencyStatus.remainingCount * 0.08) +
          Math.min(0.12, behindRatio * 0.18) +
          Math.min(0.08, diffInDays(routine.lastLoggedAt) * 0.01) +
          focusBonus -
          Math.min(0.08, routine.recentCount * 0.03),
        0,
        1
      );

      return {
        recommendation: createRecommendation({
          id: `routine-target-${routine.routineId}`,
          type: "routine_target",
          sourceType: "ROUTINE_TARGET",
          targetLens: "ROUTINE",
          targetLabel: routine.name,
          priority: scorePriority(sortScore),
          title: `${routine.name} is behind target`,
          summary: `${routine.frequencyStatus.detailLabel}. It is one of the clearest ways to get back toward your intended routine rhythm.`,
          rationale: [
            `${routine.name} is set for ${routine.frequencyStatus.targetLabel}.`,
            `It is currently ${routine.frequencyStatus.detailLabel.toLowerCase()}.`,
            routineMatchSignals.spacingScore > 0.08
              ? `${routine.name} also has enough spacing from its last completion that it still makes sense to surface now.`
              : routine.focusWeight > 1.04
              ? "It also lines up with your current focus, which lifts it slightly in the ranking."
              : "This is ranked mainly because of the missed routine target, not because of preference weighting.",
          ],
          targetCategories: Array.from(new Set([...routine.lensLabels.patterns, ...routine.lensLabels.sports])).slice(0, 3),
          suggestedRoutines,
          suggestedAction: makeAction({
            kind: "log_routine",
            fallbackLabel: `Log ${routine.name}`,
            suggestedRoutine: suggestedRoutines[0],
          }),
          behindByCount: routine.frequencyStatus.remainingCount,
          coverageWindowDays: routine.frequencyStatus.window?.days ?? undefined,
          matchingRoutineIds: [routine.routineId],
          rationaleSignals: ["behind_target", routine.focusWeight > 1.04 ? "focus_aligned" : "focus_neutral"],
          routineMatchSignals,
          signals: buildRecommendationSignals({
            recentValue: routine.frequencyStatus.currentCount,
            baselineValue: routine.frequencyStatus.targetCount ?? 0,
            emphasisWeight: routine.focusWeight,
            neglectScore: routine.frequencyStatus.remainingCount,
          }),
        }),
        sortScore,
      };
    });
}

function buildCoverageGapRecommendations(params: {
  coverageInsights: CoverageCategoryInsight[];
  routineInsights: RoutineInsight[];
  groupBySlug: Map<string, GroupRow>;
  descendantsByGroupId: Map<string, Set<string>>;
}) {
  return params.coverageInsights
    .filter((entry) => entry.isThin && entry.hasMatchingRoutine)
    .map((entry) => {
      const suggestedRoutines = pickSuggestedRoutines({
        routines: params.routineInsights,
        target: { mode: "category", lens: entry.lens, categorySlug: entry.slug },
        groupBySlug: params.groupBySlug,
        descendantsByGroupId: params.descendantsByGroupId,
      });
      const primaryRoutine = suggestedRoutines[0];
      const primaryMatchSignals = primaryRoutine?.matchSignals ?? null;
      const routineFocusWeight =
        primaryRoutine ? params.routineInsights.find((routine) => routine.routineId === primaryRoutine.id)?.focusWeight ?? 1 : 1;
      const primaryRoutineBehind =
        primaryRoutine &&
        params.routineInsights.find((routine) => routine.routineId === primaryRoutine.id)?.frequencyStatus.status === "behind";
      const sortScore = clamp(
        0.64 +
          (entry.isAbsent ? 0.16 : 0.08) +
          Math.min(0.12, entry.longCount * 0.01) +
          (primaryRoutineBehind ? 0.08 : 0) +
          clamp((routineFocusWeight - 1) * 0.12, -0.06, 0.1),
        0,
        1
      );
      const lensLabel =
        entry.lens === "muscles" ? "muscle-group" : entry.lens === "patterns" ? "movement-pattern" : "sport";

      return {
        recommendation: createRecommendation({
          id: `coverage-gap-${entry.lens}-${entry.slug}`,
          type: "coverage_gap",
          sourceType: "COVERAGE_GAP",
          targetLens: entry.lens === "muscles" ? "MUSCLE_GROUP" : entry.lens === "patterns" ? "MOVEMENT_PATTERN" : "SPORT",
          targetLabel: entry.label,
          priority: scorePriority(sortScore),
          title: `${entry.label} coverage has been thin`,
          summary: `Recent ${lensLabel} coverage for ${entry.label} has been ${entry.isAbsent ? "absent" : "light"} this week${primaryRoutine ? `, and ${primaryRoutine.name} is a solid match.` : "."}`,
          rationale: [
            entry.isAbsent
              ? `${entry.label} has not shown up in the last ${COVERAGE_GAP_WINDOW_DAYS} days.`
              : `${entry.label} has only shown up ${entry.recentCount} time${entry.recentCount === 1 ? "" : "s"} in the last ${COVERAGE_GAP_WINDOW_DAYS} days.`,
            `This uses the visible ${entry.lens === "muscles" ? "Muscle Groups" : entry.lens === "patterns" ? "Movement Patterns" : "Sports"} lens rather than a hidden aggregate score.`,
            primaryRoutineBehind
              ? `${primaryRoutine?.name} is also behind target, so it addresses two signals at once.`
              : primaryRoutine
              ? `${primaryRoutine.name} won on ${formatDirectMatchType(primaryMatchSignals?.directMatchType ?? "none")} and spacing, so it beat more recent alternatives.`
              : "There is no strong routine match yet, so this stays at the category level.",
          ],
          targetCategories: [entry.label],
          suggestedRoutines,
          suggestedAction: makeAction({
            kind: "explore_category",
            fallbackLabel: `Open ${entry.label}`,
            categorySlug: entry.slug,
            categoryHref: primaryRoutine ? undefined : entry.href,
            suggestedRoutine: primaryRoutine,
          }),
          coverageWindowDays: COVERAGE_GAP_WINDOW_DAYS,
          matchingRoutineIds: suggestedRoutines.map((routine) => routine.id),
          rationaleSignals: ["thin_coverage", entry.isAbsent ? "coverage_absent" : "coverage_light"],
          routineMatchSignals: primaryMatchSignals,
          signals: buildRecommendationSignals({
            recentValue: entry.recentCount,
            baselineValue: Math.max(entry.longCount / 4, 1),
            emphasisWeight: routineFocusWeight,
            neglectScore: Math.max(0, THIN_COVERAGE_MAX_COUNT - entry.recentCount + 1),
          }),
        }),
        sortScore,
      };
    });
}

function buildMaintenanceRecommendations(params: {
  coverageInsights: CoverageCategoryInsight[];
  routineInsights: RoutineInsight[];
  groupBySlug: Map<string, GroupRow>;
  descendantsByGroupId: Map<string, Set<string>>;
}) {
  return params.coverageInsights
    .filter((entry) => entry.longCount <= MAINTENANCE_MAX_COUNT && entry.hasMatchingRoutine)
    .map((entry) => {
      const suggestedRoutines = pickSuggestedRoutines({
        routines: params.routineInsights,
        target: { mode: "category", lens: entry.lens, categorySlug: entry.slug, preferLighter: true },
        groupBySlug: params.groupBySlug,
        descendantsByGroupId: params.descendantsByGroupId,
      });
      const primaryRoutine = suggestedRoutines[0];
      const primaryMatchSignals = primaryRoutine?.matchSignals ?? null;
      const sortScore = clamp(
        0.42 +
          (entry.recentCount === 0 ? 0.1 : 0) +
          (primaryRoutine?.kind === "GUIDED" || primaryRoutine?.kind === "COMPLETION" ? 0.06 : 0),
        0,
        1
      );

      return {
        recommendation: createRecommendation({
          id: `maintenance-${entry.lens}-${entry.slug}`,
          type: "maintenance",
          sourceType: "MAINTENANCE",
          targetLens: entry.lens === "muscles" ? "MUSCLE_GROUP" : entry.lens === "patterns" ? "MOVEMENT_PATTERN" : "SPORT",
          targetLabel: entry.label,
          priority: scorePriority(sortScore),
          title: `${entry.label} has stayed quiet`,
          summary: `${entry.label} has barely appeared across the last ${MAINTENANCE_WINDOW_DAYS} days${primaryRoutine ? `, so ${primaryRoutine.name} could keep it in the mix without forcing a hard session.` : "."}`,
          rationale: [
            `${entry.label} only shows ${entry.longCount} relevant log${entry.longCount === 1 ? "" : "s"} in the last ${MAINTENANCE_WINDOW_DAYS} days.`,
            "This is framed as maintenance, not a missed-target problem.",
            primaryRoutine
              ? `${primaryRoutine.name} is favored because it fits the gap through ${formatDirectMatchType(primaryMatchSignals?.directMatchType ?? "none")} and carries a lighter routine-kind profile.`
              : "No routine match is available, so this stays as a light coverage reminder.",
          ],
          targetCategories: [entry.label],
          suggestedRoutines,
          suggestedAction: makeAction({
            kind: "explore_category",
            fallbackLabel: `Review ${entry.label}`,
            categorySlug: entry.slug,
            categoryHref: primaryRoutine ? undefined : entry.href,
            suggestedRoutine: primaryRoutine,
          }),
          coverageWindowDays: MAINTENANCE_WINDOW_DAYS,
          matchingRoutineIds: suggestedRoutines.map((routine) => routine.id),
          rationaleSignals: ["maintenance_gap"],
          routineMatchSignals: primaryMatchSignals,
          signals: buildRecommendationSignals({
            recentValue: entry.longCount,
            baselineValue: 2,
            emphasisWeight: primaryRoutine ? params.routineInsights.find((routine) => routine.routineId === primaryRoutine.id)?.focusWeight ?? 1 : 1,
            neglectScore: Math.max(0, 2 - entry.longCount),
          }),
        }),
        sortScore,
      };
    });
}

function buildRepetitionSignals(params: {
  coverageInsights: CoverageCategoryInsight[];
  routineInsights: RoutineInsight[];
  recentKindCounts: Record<RoutineKind, number>;
  recentRoutineCounts: Map<string, number>;
  groupBySlug: Map<string, GroupRow>;
  descendantsByGroupId: Map<string, Set<string>>;
}) {
  const signals: RepetitionSignal[] = [];

  for (const lens of ["patterns", "sports"] as const) {
    const entries = params.coverageInsights.filter((entry) => entry.lens === lens && entry.recentCount > 0);
    const total = entries.reduce((sum, entry) => sum + entry.recentCount, 0);
    const dominant = entries
      .slice()
      .sort((left, right) => right.recentCount - left.recentCount || left.label.localeCompare(right.label))[0];
    if (!dominant || total < CATEGORY_DOMINANCE_MIN_COUNT) continue;
    const share = dominant.recentCount / Math.max(1, total);
    if (share < CATEGORY_DOMINANCE_SHARE) continue;

    const alternative = params.coverageInsights
      .filter((entry) => entry.lens === lens && entry.slug !== dominant.slug && entry.hasMatchingRoutine)
      .sort((left, right) => left.recentCount - right.recentCount || left.label.localeCompare(right.label))[0];
    const suggestedRoutines = alternative
      ? pickSuggestedRoutines({
          routines: params.routineInsights,
          target: {
            mode: "category",
            lens,
            categorySlug: alternative.slug,
            rebalanceAwayFromKind: dominant.dominantRoutineKind,
          },
          groupBySlug: params.groupBySlug,
          descendantsByGroupId: params.descendantsByGroupId,
          excludeRoutineIds: Array.from(params.recentRoutineCounts.entries())
            .filter(([, count]) => count >= ROUTINE_RECENT_REPETITION_THRESHOLD)
            .map(([routineId]) => routineId),
        })
      : [];

    signals.push({
      id: `repetition-${lens}-${dominant.slug}`,
      targetLens: lens === "patterns" ? "MOVEMENT_PATTERN" : "SPORT",
      label: dominant.label,
      lensCategorySlugs: [dominant.label],
      count: dominant.recentCount,
      share,
      suggestedLabel: alternative?.label ?? "something different",
      suggestedRoutineIds: suggestedRoutines.map((routine) => routine.id),
      suggestedRoutines,
      suggestedAction: makeAction({
        kind: "explore_category",
        fallbackLabel: alternative ? `Open ${alternative.label}` : "Open progress",
        categorySlug: alternative?.slug,
        categoryHref: alternative?.href,
        suggestedRoutine: suggestedRoutines[0],
      }),
    });
  }

  const recentKindEntries = Object.entries(params.recentKindCounts).filter(([, count]) => count > 0) as Array<[RoutineKind, number]>;
  const recentKindTotal = recentKindEntries.reduce((sum, [, count]) => sum + count, 0);
  const dominantKind = recentKindEntries.sort((left, right) => right[1] - left[1])[0];
  if (dominantKind && recentKindTotal >= ROUTINE_KIND_DOMINANCE_MIN_COUNT) {
    const share = dominantKind[1] / Math.max(1, recentKindTotal);
    if (share >= ROUTINE_KIND_DOMINANCE_SHARE) {
      const suggestedRoutines = pickSuggestedRoutines({
        routines: params.routineInsights.filter((routine) => routine.kind !== dominantKind[0]),
        target: { mode: "general", lens: null, rebalanceAwayFromKind: dominantKind[0], preferLighter: true },
        groupBySlug: params.groupBySlug,
        descendantsByGroupId: params.descendantsByGroupId,
      });

      signals.push({
        id: `repetition-kind-${dominantKind[0]}`,
        targetLens: "ROUTINE_KIND",
        label: dominantKind[0],
        lensCategorySlugs: [dominantKind[0]],
        count: dominantKind[1],
        share,
        suggestedLabel: suggestedRoutines[0]?.kind ?? "another routine type",
        suggestedRoutineIds: suggestedRoutines.map((routine) => routine.id),
        suggestedRoutines,
        suggestedAction: makeAction({
          kind: "open_progress",
          fallbackLabel: "Open progress",
          suggestedRoutine: suggestedRoutines[0],
        }),
      });
    }
  }

  return signals;
}

function buildRepetitionRecommendations(params: {
  signals: RepetitionSignal[];
}) {
  return params.signals.map((signal) => {
    const overloadScore = clamp(signal.share, 0, 1);
    const sortScore = clamp(0.56 + (signal.share - 0.5) * 0.5 + Math.min(0.12, signal.count * 0.02), 0, 1);

    return {
      recommendation: createRecommendation({
        id: signal.id,
        type: "repetition",
        sourceType: "REPETITION",
        targetLens: signal.targetLens,
        targetLabel: signal.label,
        priority: scorePriority(sortScore),
        title: `${signal.label} has dominated recent training`,
        summary: `${signal.label} has made up ${Math.round(signal.share * 100)}% of the most recent relevant logs. A different category could round out the week better.`,
        rationale: [
          `${signal.label} appears ${signal.count} time${signal.count === 1 ? "" : "s"} in the recent window.`,
          "This is a concentration signal, not a claim that the recent work was bad.",
          signal.suggestedRoutines[0]
            ? `${signal.suggestedRoutines[0].name} is suggested because it points away from the current cluster and still scores well on direct fit and spacing.`
            : `A shift toward ${signal.suggestedLabel} would better rebalance the recent mix.`,
        ],
        targetCategories: signal.lensCategorySlugs,
        suggestedRoutines: signal.suggestedRoutines,
        suggestedAction: signal.suggestedAction,
        matchingRoutineIds: signal.suggestedRoutineIds,
        rationaleSignals: ["recent_concentration"],
        routineMatchSignals: signal.suggestedRoutines[0]?.matchSignals ?? null,
        signals: buildRecommendationSignals({
          recentValue: signal.count,
          baselineValue: Math.max(1, signal.count * (1 - signal.share)),
          overloadScore,
        }),
      }),
      sortScore,
    };
  });
}

function buildLightRecommendation(params: {
  routineInsights: RoutineInsight[];
  density: RecommendationDensitySnapshot;
  groupBySlug: Map<string, GroupRow>;
  descendantsByGroupId: Map<string, Set<string>>;
}) {
  const suggestedRoutines = pickSuggestedRoutines({
    routines: params.routineInsights.filter((routine) => routine.kind === "GUIDED" || routine.kind === "CARDIO" || routine.kind === "COMPLETION"),
    target: { mode: "general", lens: null, preferLighter: true },
    groupBySlug: params.groupBySlug,
    descendantsByGroupId: params.descendantsByGroupId,
  });

  const primaryRoutine = suggestedRoutines[0];
  return createRecommendation({
    id: "light-day-option",
    type: "light_day",
    sourceType: "LIGHT",
    targetLens: primaryRoutine ? "ROUTINE" : null,
    targetLabel: primaryRoutine?.name ?? null,
    priority: "low",
    title: "You are mostly on track",
    summary: primaryRoutine
      ? `${primaryRoutine.name} is a light option if you want to keep momentum without forcing a bigger rebalancing move.`
      : "Nothing looks obviously behind or thin right now. A light optional session is enough if you want to keep the rhythm going.",
    rationale: [
      "No major routine-target misses or coverage gaps outranked the lighter options.",
      "This avoids inventing a problem story when your recent rhythm is already fairly balanced.",
      primaryRoutine
        ? `${primaryRoutine.name} is suggested because it is active, accessible, and low-friction.`
        : "Use this as optional maintenance rather than a must-do correction.",
    ],
    targetCategories: [],
    suggestedRoutines,
    suggestedAction: makeAction({
      kind: primaryRoutine ? "lighter_day" : "stay_the_course",
      fallbackLabel: primaryRoutine ? `Log ${primaryRoutine.name}` : "Open dashboard",
      suggestedRoutine: primaryRoutine,
    }),
    matchingRoutineIds: suggestedRoutines.map((routine) => routine.id),
    rationaleSignals: ["mostly_on_track"],
    routineMatchSignals: primaryRoutine?.matchSignals ?? null,
    signals: buildRecommendationSignals({
      recentValue: params.density.recentSessionCount,
      baselineValue: params.density.baselineRecentExpectedSessions,
    }),
  });
}

function dedupeRecommendations(recommendations: Array<{ recommendation: TrainingRecommendation; sortScore: number }>) {
  const selected: Array<TrainingRecommendation & { sortScore: number }> = [];
  const seenRoutineIds = new Set<string>();
  const seenKeys = new Set<string>();

  const sourceTypePriority: Record<string, number> = {
    ROUTINE_TARGET: 0,
    COVERAGE_GAP: 1,
    REPETITION: 2,
    MAINTENANCE: 3,
    LIGHT: 4,
    FOUNDATION: 5,
  };

  for (const item of recommendations.sort((left, right) => {
    const leftPri = sourceTypePriority[left.recommendation.sourceType] ?? 9;
    const rightPri = sourceTypePriority[right.recommendation.sourceType] ?? 9;
    if (leftPri !== rightPri) return leftPri - rightPri;
    return right.sortScore - left.sortScore || left.recommendation.title.localeCompare(right.recommendation.title);
  })) {
    const recommendation = { ...item.recommendation, sortScore: item.sortScore };
    const categoryKey = `${recommendation.sourceType}:${recommendation.targetLens ?? "GLOBAL"}:${recommendation.targetLabel ?? recommendation.id}`;
    if (seenKeys.has(categoryKey)) continue;

    const primaryRoutineId = recommendation.suggestedRoutines[0]?.id;
    if (primaryRoutineId && seenRoutineIds.has(primaryRoutineId) && recommendation.sourceType !== "ROUTINE_TARGET") continue;

    selected.push(recommendation);
    seenKeys.add(categoryKey);
    if (primaryRoutineId) seenRoutineIds.add(primaryRoutineId);
    if (selected.length >= MAX_PRIMARY_RECOMMENDATIONS + MAX_SECONDARY_RECOMMENDATIONS) break;
  }

  return selected;
}

async function loadInjuryRecommendationContext(): Promise<InjuryRecommendationContext> {
  const injuryZones = await prisma.injuryZone.findMany({
    where: { injury: { status: { in: ["ACTIVE", "FLARED", "RECOVERING"] } } },
    include: {
      injury: { select: { status: true } },
      zone: { select: { label: true, metadataGroupSlug: true, region: true } },
    },
  });

  const activeZoneLabels = new Set<string>();
  const activeMetadataSlugs = new Set<string>();
  const flaredMetadataSlugs = new Set<string>();
  const recoveringMetadataSlugs = new Set<string>();

  for (const entry of injuryZones) {
    const slug = entry.zone.metadataGroupSlug ?? entry.zone.region;
    if (entry.injury.status === "ACTIVE") {
      activeZoneLabels.add(entry.zone.label);
      activeMetadataSlugs.add(slug);
    } else if (entry.injury.status === "FLARED") {
      activeZoneLabels.add(entry.zone.label);
      flaredMetadataSlugs.add(slug);
    } else if (entry.injury.status === "RECOVERING") {
      recoveringMetadataSlugs.add(slug);
    }
  }

  return {
    activeZoneLabels: Array.from(activeZoneLabels),
    activeMetadataSlugs,
    flaredMetadataSlugs,
    recoveringMetadataSlugs,
  };
}

function routineFocusSlugs(routine: LoadedRoutine) {
  return new Set(
    routine.metadataGroups
      .filter((entry) => entry.group.kind === "ROUTINE_FOCUS" || entry.group.kind === "TRAINING_GROUP")
      .map((entry) => entry.group.slug)
  );
}

function routineHitsInjury(routine: RoutineInsight, context: InjuryRecommendationContext) {
  const muscleSlugs = new Set(routine.lensSlugs.muscles);
  const hitsFlared = Array.from(context.flaredMetadataSlugs).some((slug) => muscleSlugs.has(slug));
  const hitsActive = Array.from(context.activeMetadataSlugs).some((slug) => muscleSlugs.has(slug));
  const hitsRecovering = Array.from(context.recoveringMetadataSlugs).some((slug) => muscleSlugs.has(slug));
  return { hitsFlared, hitsActive, hitsRecovering };
}

function applyInjuryContextToRecommendations(params: {
  recommendations: TrainingRecommendation[];
  routineInsights: RoutineInsight[];
  routines: LoadedRoutine[];
  context: InjuryRecommendationContext;
}) {
  if (
    params.context.activeMetadataSlugs.size === 0 &&
    params.context.flaredMetadataSlugs.size === 0 &&
    params.context.recoveringMetadataSlugs.size === 0
  ) {
    return { recommendations: params.recommendations, hiddenDueToInjury: [] as RecommendationModel["hiddenDueToInjury"] };
  }

  const insightById = new Map(params.routineInsights.map((routine) => [routine.routineId, routine]));
  const routineById = new Map(params.routines.map((routine) => [routine.id, routine]));
  const hidden = new Map<string, RecommendationModel["hiddenDueToInjury"][number]>();
  const injuredLabel = params.context.activeZoneLabels.slice(0, 3).join(", ") || "injured zone";

  const recommendations = params.recommendations
    .map((recommendation) => {
      let changed = false;
      const suggestedRoutines = recommendation.suggestedRoutines.filter((routine) => {
        const insight = insightById.get(routine.id);
        const loadedRoutine = routineById.get(routine.id);
        if (!insight || !loadedRoutine) return true;
        const focusSlugs = routineFocusSlugs(loadedRoutine);
        const isRehab = ["rehab", "mobility", "recovery"].some((slug) => focusSlugs.has(slug));
        const hit = routineHitsInjury(insight, params.context);

        if (hit.hitsFlared) {
          hidden.set(routine.id, {
            routineId: routine.id,
            routineName: routine.name,
            href: routine.href,
            reason: `Not recommended - loads your ${injuredLabel}.`,
          });
          changed = true;
          return false;
        }

        if (hit.hitsActive && !isRehab) {
          hidden.set(routine.id, {
            routineId: routine.id,
            routineName: routine.name,
            href: routine.href,
            reason: `Avoiding exercises that load your ${injuredLabel}.`,
          });
          changed = true;
          return false;
        }

        return true;
      });

      const survivingRoutineIds = suggestedRoutines.map((routine) => routine.id);
      const injuryRationale =
        suggestedRoutines.length !== recommendation.suggestedRoutines.length
          ? [`Avoiding exercises that load your ${injuredLabel}.`]
          : suggestedRoutines.some((routine) => {
              const insight = insightById.get(routine.id);
              const loadedRoutine = routineById.get(routine.id);
              return Boolean(
                insight &&
                  loadedRoutine &&
                  routineHitsInjury(insight, params.context).hitsActive &&
                  ["rehab", "mobility", "recovery"].some((slug) => routineFocusSlugs(loadedRoutine).has(slug))
              );
            })
          ? [`Supporting recovery of your ${injuredLabel}.`]
          : [];

      if (changed && suggestedRoutines.length === 0 && recommendation.suggestedRoutines.length > 0) return null;

      return {
        ...recommendation,
        rationale: [...injuryRationale, ...recommendation.rationale],
        suggestedRoutines,
        suggestedRoutineIds: survivingRoutineIds,
        matchingRoutineIds: recommendation.matchingRoutineIds.filter((id) => survivingRoutineIds.includes(id)),
        suggestedAction: suggestedRoutines[0]
          ? {
              kind: "log_routine" as const,
              label: `Log ${suggestedRoutines[0].name}`,
              href: suggestedRoutines[0].href,
              routineId: suggestedRoutines[0].id,
            }
          : recommendation.suggestedAction,
      };
    })
    .filter((recommendation): recommendation is TrainingRecommendation => Boolean(recommendation));

  return { recommendations, hiddenDueToInjury: Array.from(hidden.values()) };
}

export async function getRecommendationModel(): Promise<RecommendationModel> {
  try {
    const inputs = await loadRecommendationInputs();
    const density = buildDensitySnapshot(inputs.logs);
    const insights = buildInsights(inputs);
    const injuryContext = await loadInjuryRecommendationContext();
    const isNewUser = insights.baselineLogCount < NEW_USER_MIN_LOGS;
    const hasEnoughHistory = insights.baselineLogCount >= SPARSE_HISTORY_MIN_LOGS;

    if (isNewUser) {
      const foundation = buildFoundationRecommendation({
        routineInsights: insights.routineInsights,
        emphasisLabels: inputs.stimulusOverview.selectedPresetLabels,
        baselineLogCount: insights.baselineLogCount,
        density,
        groupBySlug: insights.groupBySlug,
        descendantsByGroupId: insights.descendantsByGroupId,
      });

      const injuryAdjusted = applyInjuryContextToRecommendations({
        recommendations: [foundation],
        routineInsights: insights.routineInsights,
        routines: inputs.routines,
        context: injuryContext,
      });
      const adjustedFoundation = injuryAdjusted.recommendations[0] ?? foundation;

      return {
        generatedAt: new Date(),
        windows: {
          recentDays: RECENT_WINDOW_DAYS,
          longDays: LONG_WINDOW_DAYS,
          baselineDays: BASELINE_WINDOW_DAYS,
        },
        hasEnoughHistory,
        isNewUser,
        emphasisLabels: inputs.stimulusOverview.selectedPresetLabels,
        categorySnapshots: insights.coverageInsights,
        density,
        recommendations: [adjustedFoundation],
        primaryRecommendation: adjustedFoundation,
        secondaryRecommendations: [],
        hiddenDueToInjury: injuryAdjusted.hiddenDueToInjury,
      };
    }

    const behindTargetRecommendations = buildBehindTargetRecommendations({
      routineInsights: insights.routineInsights,
      groupBySlug: insights.groupBySlug,
      descendantsByGroupId: insights.descendantsByGroupId,
    });
    const coverageGapRecommendations = buildCoverageGapRecommendations({
      coverageInsights: insights.coverageInsights,
      routineInsights: insights.routineInsights,
      groupBySlug: insights.groupBySlug,
      descendantsByGroupId: insights.descendantsByGroupId,
    });
    const maintenanceRecommendations = buildMaintenanceRecommendations({
      coverageInsights: insights.coverageInsights,
      routineInsights: insights.routineInsights,
      groupBySlug: insights.groupBySlug,
      descendantsByGroupId: insights.descendantsByGroupId,
    });
    const repetitionSignals = buildRepetitionSignals({
      coverageInsights: insights.coverageInsights,
      routineInsights: insights.routineInsights,
      recentKindCounts: insights.recentKindCounts,
      recentRoutineCounts: insights.recentRoutineCounts,
      groupBySlug: insights.groupBySlug,
      descendantsByGroupId: insights.descendantsByGroupId,
    });
    const repetitionRecommendations = buildRepetitionRecommendations({
      signals: repetitionSignals,
    });

    const rankedRecommendations = dedupeRecommendations([
      ...behindTargetRecommendations,
      ...coverageGapRecommendations,
      ...repetitionRecommendations,
      ...maintenanceRecommendations,
    ]);

    const unfilteredFinalRecommendations =
      rankedRecommendations.length > 0
        ? rankedRecommendations.map(({ sortScore, ...rest }) => {
            void sortScore;
            return rest;
          })
        : [buildLightRecommendation({
            routineInsights: insights.routineInsights,
            density,
            groupBySlug: insights.groupBySlug,
            descendantsByGroupId: insights.descendantsByGroupId,
          })];
    const injuryAdjusted = applyInjuryContextToRecommendations({
      recommendations: unfilteredFinalRecommendations,
      routineInsights: insights.routineInsights,
      routines: inputs.routines,
      context: injuryContext,
    });
    const finalRecommendations =
      injuryAdjusted.recommendations.length > 0
        ? injuryAdjusted.recommendations
        : [buildLightRecommendation({
            routineInsights: insights.routineInsights,
            density,
            groupBySlug: insights.groupBySlug,
            descendantsByGroupId: insights.descendantsByGroupId,
          })];

    const primaryRecommendation = finalRecommendations[0] ?? null;
    const secondaryRecommendations = finalRecommendations.slice(1, 1 + MAX_SECONDARY_RECOMMENDATIONS);

    return {
      generatedAt: new Date(),
      windows: {
        recentDays: RECENT_WINDOW_DAYS,
        longDays: LONG_WINDOW_DAYS,
        baselineDays: BASELINE_WINDOW_DAYS,
      },
      hasEnoughHistory,
      isNewUser,
      emphasisLabels: inputs.stimulusOverview.selectedPresetLabels,
      categorySnapshots: insights.coverageInsights,
      density,
      recommendations: finalRecommendations,
      primaryRecommendation,
      secondaryRecommendations,
      hiddenDueToInjury: injuryAdjusted.hiddenDueToInjury,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("StimulusCategory") || message.includes("AppProfile") || message.includes("UserStimulusPreference")) {
      return {
        generatedAt: new Date(),
        windows: {
          recentDays: RECENT_WINDOW_DAYS,
          longDays: LONG_WINDOW_DAYS,
          baselineDays: BASELINE_WINDOW_DAYS,
        },
        hasEnoughHistory: false,
        isNewUser: true,
        emphasisLabels: [],
        categorySnapshots: [],
        density: {
          recentSessionCount: 0,
          recentActiveDays: 0,
          recentThreeDaySessions: 0,
          baselineSessionsPerWeek: 0,
          baselineActiveDaysPerWeek: 0,
          baselineRecentExpectedSessions: 0,
          baselineRecentExpectedActiveDays: 0,
          relativeRecentSessions: "near typical",
        },
        recommendations: [],
        primaryRecommendation: null,
        secondaryRecommendations: [],
        hiddenDueToInjury: [],
      };
    }
    throw error;
  }
}
