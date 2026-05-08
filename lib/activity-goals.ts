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

  // For ROUTINE-target goals, we need to know each routine's metadata-group
  // memberships to decide if it belongs to this activity. Batch-fetch in one
  // query.
  const routineTargetIds = Array.from(
    new Set(
      allInsights
        .filter((entry) => entry.goal.targetType === "ROUTINE")
        .map((entry) => entry.goal.targetId)
    )
  );

  const routineGroupMembership = new Map<string, Set<string>>();
  if (routineTargetIds.length > 0) {
    const routines = await prisma.routine.findMany({
      where: { id: { in: routineTargetIds } },
      select: {
        id: true,
        metadataGroups: { select: { groupId: true } },
      },
    });
    for (const routine of routines) {
      routineGroupMembership.set(
        routine.id,
        new Set(routine.metadataGroups.map((entry) => entry.groupId))
      );
    }
  }

  return allInsights.filter((insight) => {
    const targetType = insight.goal.targetType;
    const targetId = insight.goal.targetId;

    if (targetType === "GROUP") {
      return activityGroupIds.has(targetId);
    }
    if (targetType === "ROUTINE") {
      const memberships = routineGroupMembership.get(targetId);
      if (!memberships) return false;
      for (const groupId of memberships) {
        if (activityGroupIds.has(groupId)) return true;
      }
      return false;
    }

    // EXERCISE / SESSION_TEMPLATE / CARDIO targets — out of scope for v1.
    return false;
  });
});
