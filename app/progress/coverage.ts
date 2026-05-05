import type { MetadataGroupKind, RoutineKind } from "@/generated/prisma";
import { formatAppDate } from "@/lib/dates";
import { inferExerciseMetadataSlugs, inferGuidedStepMetadataSlugs, inferRoutineMetadataSlugs } from "@/lib/metadata";
import { ROUTINE_KIND_LABEL, normalizeRoutineKind, routineKindColor } from "@/lib/routines";
import { prisma } from "@/lib/prisma";
import { getRoutineLogs, type RoutineLogWithRelations } from "./data";
import { isSportGroup, sportGroupTargetHref } from "./sports";

export type CoverageLens = "muscles" | "patterns" | "sports";
export type CoverageRange = "week" | "2w" | "4w" | "12w" | "ytd";

type GroupRow = {
  id: string;
  slug: string;
  label: string;
  kind: MetadataGroupKind;
  parentIds: string[];
};

export type CoverageDetailLog = {
  logId: string;
  routineId: string;
  routineName: string;
  routineKind: RoutineKind;
  performedAt: string;
  performedAtLabel: string;
  relevantParts: string[];
};

export type CoverageCategoryRow = {
  id: string;
  slug: string;
  label: string;
  totalCount: number;
  countsByKind: Record<RoutineKind, number>;
  contributingLogsByKind: Record<RoutineKind, CoverageDetailLog[]>;
  targetHref: string;
};

export type CoverageSection = {
  lens: CoverageLens;
  label: string;
  description: string;
  emptyMessage: string;
  categories: CoverageCategoryRow[];
};

export type CoverageOverviewModel = {
  range: CoverageRange;
  rangeLabel: string;
  totalLogs: number;
  countsByKind: Record<RoutineKind, number>;
  coveredCategoryCounts: Record<CoverageLens, number>;
  sections: CoverageSection[];
  routineKindLegend: Array<{
    kind: RoutineKind;
    label: string;
    color: string;
  }>;
};

const COVERAGE_KIND_ORDER: RoutineKind[] = ["WORKOUT", "CARDIO", "GUIDED", "SESSION", "COMPLETION"];
const COVERAGE_CATEGORY_ORDER: Record<CoverageLens, string[]> = {
  muscles: [
    "chest",
    "shoulders",
    "triceps",
    "back",
    "biceps",
    "forearms",
    "fingers",
    "neck",
    "quads",
    "hamstrings",
    "glutes",
    "hip-flexors",
    "adductors",
    "abductors",
    "calves",
    "core",
  ],
  patterns: [
    "squat",
    "hinge",
    "lunge",
    "horizontal-push",
    "vertical-push",
    "horizontal-pull",
    "vertical-pull",
    "carry",
    "rotation",
    "anti-extension",
    "anti-rotation",
    "anti-lateral-flexion",
    "isometric",
  ],
  sports: [
    "running",
    "walking",
    "hiking",
    "biking",
    "rowing",
    "swimming",
    "climbing",
    "board-sports",
    "cardio",
  ],
};

function createEmptyKindCountRecord() {
  return {
    WORKOUT: 0,
    CARDIO: 0,
    GUIDED: 0,
    SESSION: 0,
    COMPLETION: 0,
  } satisfies Record<RoutineKind, number>;
}

function createEmptyKindDetailRecord() {
  return {
    WORKOUT: [],
    CARDIO: [],
    GUIDED: [],
    SESSION: [],
    COMPLETION: [],
  } satisfies Record<RoutineKind, CoverageDetailLog[]>;
}

function rangeLabel(range: CoverageRange) {
  if (range === "week") return "This Week";
  if (range === "2w") return "Last 2 Weeks";
  if (range === "4w") return "Last 4 Weeks";
  if (range === "12w") return "Last 12 Weeks";
  return "Year to Date";
}

function lensLabel(lens: CoverageLens) {
  if (lens === "muscles") return "Muscle Groups";
  if (lens === "patterns") return "Movement Patterns";
  return "Sports";
}

function lensDescription(lens: CoverageLens) {
  if (lens === "muscles") return "Frequency of completed logs contributing to each muscle group, broken down by routine kind.";
  if (lens === "patterns") return "Pattern coverage from completed logs, with each routine kind tracked separately.";
  return "Recent sport and activity coverage based on the existing cardio and session metadata.";
}

function lensEmptyMessage(lens: CoverageLens, label: string) {
  if (lens === "muscles") return `No muscle-group coverage has been logged in ${label.toLowerCase()}.`;
  if (lens === "patterns") return `No movement-pattern coverage has been logged in ${label.toLowerCase()}.`;
  return `No sport or activity coverage has been logged in ${label.toLowerCase()}.`;
}

function lensKind(lens: CoverageLens): MetadataGroupKind {
  if (lens === "muscles") return "MUSCLE_GROUP";
  if (lens === "patterns") return "MOVEMENT_PATTERN";
  return "CARDIO_ACTIVITY";
}

function shouldShowGroupInLens(group: GroupRow, lens: CoverageLens) {
  if (lens === "sports") {
    return isSportGroup(group);
  }
  if (group.kind !== lensKind(lens)) return false;
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

function collectLogGroupIds(log: RoutineLogWithRelations, groupIdBySlug: Map<string, string>) {
  const groupIds = new Set<string>();

  // For workouts, only credit muscle groups / movement patterns from exercises
  // that were actually logged — never from the routine's own metadata tags.
  if (log.routine.kind === "WORKOUT") {
    for (const exercise of log.exercises) {
      const directGroupIds = exercise.exercise.metadataGroups.map((entry) => entry.group.id);
      const inferredGroupIds =
        directGroupIds.length > 0 ? [] : groupIdsFromSlugs(inferExerciseMetadataSlugs(exercise.exercise.name), groupIdBySlug);
      appendSet(groupIds, directGroupIds);
      appendSet(groupIds, inferredGroupIds);
    }
    return groupIds;
  }

  const routineGroupIds = log.routine.metadataGroups.map((entry) => entry.group.id);
  const subtypeGroupIds = groupIdsFromSlugs(inferRoutineMetadataSlugs(log.routine.subtype), groupIdBySlug);
  const templateGroupIds = log.routine.sessionDetails?.template?.metadataGroups.map((entry) => entry.group.id) ?? [];

  appendSet(groupIds, routineGroupIds);
  appendSet(groupIds, subtypeGroupIds);
  appendSet(groupIds, templateGroupIds);

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

function matchesSelectedGroup(targetGroupId: string, groupIds: Iterable<string>, descendantsByGroupId: Map<string, Set<string>>) {
  const descendants = descendantsByGroupId.get(targetGroupId) ?? new Set<string>();
  for (const groupId of groupIds) {
    if (groupId === targetGroupId || descendants.has(groupId)) return true;
  }
  return false;
}

function relevantPartsForLog(params: {
  log: RoutineLogWithRelations;
  targetGroupId: string;
  groupIdBySlug: Map<string, string>;
  descendantsByGroupId: Map<string, Set<string>>;
}) {
  const relevantParts = new Set<string>();
  const matchingExerciseNames = new Set<string>();
  const matchingGuidedExerciseNames = new Set<string>();
  const matchingGuidedStepTitles = new Set<string>();
  const { log, targetGroupId, groupIdBySlug, descendantsByGroupId } = params;

  const routineGroupIds = new Set<string>([
    ...log.routine.metadataGroups.map((entry) => entry.group.id),
    ...groupIdsFromSlugs(inferRoutineMetadataSlugs(log.routine.subtype), groupIdBySlug),
  ]);

  if (log.routine.sessionDetails?.template) {
    const templateGroupIds = log.routine.sessionDetails.template.metadataGroups.map((entry) => entry.group.id);
    if (matchesSelectedGroup(targetGroupId, templateGroupIds, descendantsByGroupId)) {
      relevantParts.add(`Template: ${log.routine.sessionDetails.template.name}`);
    }
  }

  if (log.routine.kind === "WORKOUT") {
    for (const exercise of log.exercises) {
      const directGroupIds = exercise.exercise.metadataGroups.map((entry) => entry.group.id);
      const inferredGroupIds =
        directGroupIds.length > 0 ? [] : groupIdsFromSlugs(inferExerciseMetadataSlugs(exercise.exercise.name), groupIdBySlug);
      if (matchesSelectedGroup(targetGroupId, [...directGroupIds, ...inferredGroupIds], descendantsByGroupId)) {
        matchingExerciseNames.add(exercise.exercise.name);
      }
    }
  }

  if (log.routine.kind === "GUIDED") {
    for (const step of log.guidedSteps) {
      const stepGroupIds = step.guidedStep?.metadataGroups.map((entry) => entry.group.id) ?? [];
      const exerciseGroupIds = step.exercise?.metadataGroups.map((entry) => entry.group.id) ?? [];
      const inferredGroupIds =
        stepGroupIds.length === 0 && exerciseGroupIds.length === 0
          ? groupIdsFromSlugs(inferGuidedStepMetadataSlugs(step.title), groupIdBySlug)
          : [];
      if (matchesSelectedGroup(targetGroupId, [...stepGroupIds, ...exerciseGroupIds, ...inferredGroupIds], descendantsByGroupId)) {
        if (step.exercise?.name) {
          matchingGuidedExerciseNames.add(step.exercise.name);
        } else {
          matchingGuidedStepTitles.add(step.title);
        }
      }
    }
  }

  if (matchingExerciseNames.size > 0) {
    relevantParts.add(`Exercises: ${Array.from(matchingExerciseNames).sort((left, right) => left.localeCompare(right)).join(", ")}`);
  }
  if (matchingGuidedExerciseNames.size > 0) {
    relevantParts.add(
      `Guided exercises: ${Array.from(matchingGuidedExerciseNames).sort((left, right) => left.localeCompare(right)).join(", ")}`
    );
  }
  if (matchingGuidedStepTitles.size > 0) {
    relevantParts.add(
      `Guided steps: ${Array.from(matchingGuidedStepTitles).sort((left, right) => left.localeCompare(right)).join(", ")}`
    );
  }

  if (relevantParts.size === 0 && matchesSelectedGroup(targetGroupId, routineGroupIds, descendantsByGroupId)) {
    relevantParts.add("Routine metadata");
  }

  return Array.from(relevantParts).slice(0, 6);
}

function categoryHref(group: GroupRow) {
  return sportGroupTargetHref(group);
}

function coverageCategorySort(lens: CoverageLens, left: CoverageCategoryRow, right: CoverageCategoryRow) {
  const order = COVERAGE_CATEGORY_ORDER[lens];
  const leftIndex = order.indexOf(left.slug);
  const rightIndex = order.indexOf(right.slug);
  const leftRank = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
  const rightRank = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

  if (leftRank !== rightRank) return leftRank - rightRank;
  if (left.totalCount !== right.totalCount) return right.totalCount - left.totalCount;
  return left.label.localeCompare(right.label);
}

export async function getCoverageOverviewModel(range: CoverageRange = "4w"): Promise<CoverageOverviewModel> {
  const [logs, groups] = await Promise.all([
    getRoutineLogs(range),
    prisma.metadataGroup.findMany({
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
    }),
  ]);

  const groupRows: GroupRow[] = groups.map((group) => ({
    id: group.id,
    slug: group.slug,
    label: group.label,
    kind: group.kind,
    parentIds: group.parentRelations.map((relation) => relation.parentGroupId),
  }));
  const groupById = new Map(groupRows.map((group) => [group.id, group]));
  const groupIdBySlug = new Map(groupRows.map((group) => [group.slug, group.id]));
  const descendantsByGroupId = buildDescendantIdsByGroupId(groupRows);

  const sectionsByLens = new Map<CoverageLens, Map<string, CoverageCategoryRow>>(
    (["muscles", "patterns", "sports"] as CoverageLens[]).map((lens) => [lens, new Map()])
  );
  const logsByKind = createEmptyKindCountRecord();

  for (const lens of ["muscles", "patterns", "sports"] as CoverageLens[]) {
    const sectionMap = sectionsByLens.get(lens)!;
    for (const group of groupRows) {
      if (!shouldShowGroupInLens(group, lens)) continue;
      sectionMap.set(group.id, {
        id: group.id,
        slug: group.slug,
        label: group.label,
        totalCount: 0,
        countsByKind: createEmptyKindCountRecord(),
        contributingLogsByKind: createEmptyKindDetailRecord(),
        targetHref: categoryHref(group),
      });
    }
  }

  for (const log of logs) {
    const routineKind = normalizeRoutineKind(log.routine.kind);
    logsByKind[routineKind] += 1;

    const expandedGroupIds = expandAncestorIds(collectLogGroupIds(log, groupIdBySlug), groupById);

    for (const lens of ["muscles", "patterns", "sports"] as CoverageLens[]) {
      const matchingGroups = Array.from(expandedGroupIds)
        .map((groupId) => groupById.get(groupId))
        .filter((group): group is GroupRow => Boolean(group))
        .filter((group) => shouldShowGroupInLens(group, lens));

      const seenCategoryIds = new Set<string>();
      for (const group of matchingGroups) {
        if (seenCategoryIds.has(group.id)) continue;
        seenCategoryIds.add(group.id);

        const sectionMap = sectionsByLens.get(lens)!;
        const current =
          sectionMap.get(group.id) ??
          {
            id: group.id,
            slug: group.slug,
            label: group.label,
            totalCount: 0,
            countsByKind: createEmptyKindCountRecord(),
            contributingLogsByKind: createEmptyKindDetailRecord(),
            targetHref: categoryHref(group),
          };

        current.totalCount += 1;
        current.countsByKind[routineKind] += 1;
        current.contributingLogsByKind[routineKind].push({
          logId: log.id,
          routineId: log.routineId,
          routineName: log.routine.name,
          routineKind,
          performedAt: log.performedAt.toISOString(),
          performedAtLabel: formatAppDate(log.performedAt, { month: "short", day: "numeric" }),
          relevantParts: relevantPartsForLog({
            log,
            targetGroupId: group.id,
            groupIdBySlug,
            descendantsByGroupId,
          }),
        });
        sectionMap.set(group.id, current);
      }
    }
  }

  const sections = (["muscles", "patterns", "sports"] as CoverageLens[]).map((lens) => {
    const categories = Array.from(sectionsByLens.get(lens)!.values()).sort((left, right) => coverageCategorySort(lens, left, right));

    return {
      lens,
      label: lensLabel(lens),
      description: lensDescription(lens),
      emptyMessage: lensEmptyMessage(lens, rangeLabel(range)),
      categories,
    } satisfies CoverageSection;
  });

  return {
    range,
    rangeLabel: rangeLabel(range),
    totalLogs: logs.length,
    countsByKind: logsByKind,
    coveredCategoryCounts: {
      muscles: sections[0].categories.filter((category) => category.totalCount > 0).length,
      patterns: sections[1].categories.filter((category) => category.totalCount > 0).length,
      sports: sections[2].categories.filter((category) => category.totalCount > 0).length,
    },
    sections,
    routineKindLegend: COVERAGE_KIND_ORDER.map((kind) => ({
      kind,
      label: ROUTINE_KIND_LABEL[kind],
      color: routineKindColor(kind),
    })),
  };
}
