import { cache } from "react";
import { getGoalsOverview, type GoalInsight } from "@/lib/goals";
import { prisma } from "@/lib/prisma";

/**
 * Active goals targeting a given activity slug — for use on activity-world
 * pages. A goal counts as "for" an activity when its target resolves to the
 * activity's metadata group (or any descendant), or to a routine tagged with
 * one of those groups.
 *
 * Returns insights in the same shape as getGoalsOverview, so the calling UI
 * can use the existing GoalInsight surface directly (fractionComplete,
 * actualDisplay, targetDisplay, isAchieved, detailHref, summaryLabel, etc.).
 *
 * Inactive goals are excluded.
 */
export const getActivityGoals = cache(async function getActivityGoals(
  activitySlug: string
): Promise<GoalInsight[]> {
  const group = await prisma.metadataGroup.findUnique({
    where: { slug: activitySlug },
    select: { id: true },
  });
  if (!group) return [];

  // All metadata-group ids that count as "this activity": the slug's own group
  // plus every descendant (e.g., bouldering rolls up under climbing).
  const relations = await prisma.metadataGroupRelation.findMany({
    select: { parentGroupId: true, childGroupId: true },
  });
  const activityGroupIds = new Set<string>([group.id]);
  const queue: string[] = [group.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const relation of relations) {
      if (relation.parentGroupId !== current || activityGroupIds.has(relation.childGroupId)) continue;
      activityGroupIds.add(relation.childGroupId);
      queue.push(relation.childGroupId);
    }
  }

  // Pull all active insights — manual goals + per-routine frequency goals +
  // group frequency goals all flow through this single overview call.
  const allInsights = await getGoalsOverview({ active: "active" });

  // For ROUTINE / SESSION_TEMPLATE / EXERCISE goals, we need each entity's
  // metadata-group memberships to decide if it belongs to this activity.
  // Batch-fetch in three parallel queries.
  const routineTargetIds = unique(allInsights.filter((e) => e.goal.targetType === "ROUTINE").map((e) => e.goal.targetId));
  const templateTargetIds = unique(allInsights.filter((e) => e.goal.targetType === "SESSION_TEMPLATE").map((e) => e.goal.targetId));
  const exerciseTargetIds = unique(allInsights.filter((e) => e.goal.targetType === "EXERCISE").map((e) => e.goal.targetId));

  const [routineMembership, templateMembership, exerciseMembership] = await Promise.all([
    fetchGroupMembership(routineTargetIds, "routine"),
    fetchGroupMembership(templateTargetIds, "sessionTemplate"),
    fetchGroupMembership(exerciseTargetIds, "exercise"),
  ]);

  return allInsights.filter((insight) => {
    const targetType = insight.goal.targetType;
    const targetId = insight.goal.targetId;

    // GROUP and CARDIO both store a metadata-group id in targetId — CARDIO is
    // just a labeling distinction for cardio-shaped activity groups.
    if (targetType === "GROUP" || targetType === "CARDIO") {
      return activityGroupIds.has(targetId);
    }
    if (targetType === "ROUTINE") {
      return intersectsActivity(routineMembership.get(targetId), activityGroupIds);
    }
    if (targetType === "SESSION_TEMPLATE") {
      return intersectsActivity(templateMembership.get(targetId), activityGroupIds);
    }
    if (targetType === "EXERCISE") {
      return intersectsActivity(exerciseMembership.get(targetId), activityGroupIds);
    }
    return false;
  });
});

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function intersectsActivity(memberships: Set<string> | undefined, activityGroupIds: Set<string>): boolean {
  if (!memberships) return false;
  for (const groupId of memberships) {
    if (activityGroupIds.has(groupId)) return true;
  }
  return false;
}

async function fetchGroupMembership(
  ids: string[],
  entity: "routine" | "sessionTemplate" | "exercise"
): Promise<Map<string, Set<string>>> {
  if (ids.length === 0) return new Map();
  const result = new Map<string, Set<string>>();

  if (entity === "routine") {
    const rows = await prisma.routine.findMany({
      where: { id: { in: ids } },
      select: { id: true, metadataGroups: { select: { groupId: true } } },
    });
    for (const row of rows) {
      result.set(row.id, new Set(row.metadataGroups.map((m) => m.groupId)));
    }
    return result;
  }
  if (entity === "sessionTemplate") {
    const rows = await prisma.sessionTemplate.findMany({
      where: { id: { in: ids } },
      select: { id: true, metadataGroups: { select: { groupId: true } } },
    });
    for (const row of rows) {
      result.set(row.id, new Set(row.metadataGroups.map((m) => m.groupId)));
    }
    return result;
  }
  // exercise
  const rows = await prisma.exercise.findMany({
    where: { id: { in: ids } },
    select: { id: true, metadataGroups: { select: { groupId: true } } },
  });
  for (const row of rows) {
    result.set(row.id, new Set(row.metadataGroups.map((m) => m.groupId)));
  }
  return result;
}
