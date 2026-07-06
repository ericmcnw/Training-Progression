import { cache } from "react";
import { getGoalsOverview, type GoalInsight } from "@/lib/goals";
import { prisma } from "@/lib/prisma";
import { effectiveRoutineDomain } from "@/lib/routines";
import { getSyntheticSportRoutineId } from "@/lib/synthetic-sport-routines";

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

  // Group-frequency goals store the FrequencyGoal record id (not a
  // metadata-group id) in targetId. To match them to an activity we
  // need to look up the goal's linked routines and check their
  // metadata-group memberships — same join the matcher uses at log
  // time. Sport-targeted goals also match here when one of their
  // linked routines is the activity's synthetic sport routine.
  const groupGoalIds = unique(
    allInsights
      .filter((e) => e.goal.targetType === "GROUP")
      .map((e) => e.goal.targetId)
  );
  const [groupGoalRoutineLinks, sportTaggedGoalRows, sportTaggedRoutineRows] = await Promise.all([
    groupGoalIds.length > 0
      ? prisma.frequencyGoalRoutine.findMany({
          where: { goalId: { in: groupGoalIds } },
          select: { goalId: true, routineId: true },
        })
      : Promise.resolve([]),
    // Sport-tag goals — "training FOR climbing 2×/wk" belongs on the
    // climbing hub even with zero linked routines.
    groupGoalIds.length > 0
      ? prisma.frequencyGoal.findMany({
          where: { id: { in: groupGoalIds }, triggerSupportedSports: { has: activitySlug } },
          select: { id: true },
        })
      : Promise.resolve([]),
    // ROUTINE-target goals whose routine declares it trains for this sport.
    prisma.routine.findMany({
      where: { supportsSports: { has: activitySlug } },
      select: { id: true },
    }),
  ]);
  const sportTaggedGoalIds = new Set(sportTaggedGoalRows.map((r) => r.id));
  const sportTaggedRoutineIds = new Set(sportTaggedRoutineRows.map((r) => r.id));
  const groupGoalRoutineMap = new Map<string, string[]>();
  for (const link of groupGoalRoutineLinks) {
    const list = groupGoalRoutineMap.get(link.goalId) ?? [];
    list.push(link.routineId);
    groupGoalRoutineMap.set(link.goalId, list);
  }
  // Membership for every routine linked to a group-frequency goal —
  // batched once, indexed by routineId for the activity check below.
  const groupLinkedRoutineIds = unique(
    Array.from(groupGoalRoutineMap.values()).flat()
  );
  const groupGoalRoutineMembership = await fetchGroupMembership(
    groupLinkedRoutineIds,
    "routine"
  );
  // Synthetic sport routine for THIS activity — if a group-frequency
  // goal links it directly, the goal belongs to this activity.
  const syntheticSportRoutineId = getSyntheticSportRoutineId(activitySlug);

  const [routineMembership, templateMembership, exerciseMembership] = await Promise.all([
    fetchGroupMembership(routineTargetIds, "routine"),
    fetchGroupMembership(templateTargetIds, "sessionTemplate"),
    fetchGroupMembership(exerciseTargetIds, "exercise"),
  ]);

  return allInsights.filter((insight) => {
    const targetType = insight.goal.targetType;
    const targetId = insight.goal.targetId;

    if (targetType === "CARDIO") {
      // CARDIO stores a metadata-group id in targetId.
      return activityGroupIds.has(targetId);
    }
    if (targetType === "GROUP") {
      // GROUP-frequency goals carry the FrequencyGoal id (not a
      // metadata-group id). Resolve via the goal's linked routines:
      // the goal belongs to this activity if any linked routine is
      // tagged with a matching metadata group OR is the synthetic
      // sport routine for this activity — or the goal itself carries
      // this sport in triggerSupportedSports (tag-targeted goals have
      // no roster at all).
      if (sportTaggedGoalIds.has(targetId)) return true;
      const linkedRoutines = groupGoalRoutineMap.get(targetId) ?? [];
      for (const routineId of linkedRoutines) {
        if (routineId === syntheticSportRoutineId) return true;
        if (intersectsActivity(groupGoalRoutineMembership.get(routineId), activityGroupIds)) return true;
      }
      return false;
    }
    if (targetType === "ROUTINE") {
      if (sportTaggedRoutineIds.has(targetId)) return true;
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

/**
 * Active goals for a training DOMAIN (strength/cardio/mobility/lifestyle).
 * Domains have no metadata-group slug (they derive from kind+subtype), so
 * getActivityGoals can't be used. This filter includes:
 *   - ROUTINE-target goals where the routine's effective domain matches
 *   - EXERCISE-target goals where the exercise was performed in a session
 *     of that domain (covers per-exercise PR goals like "185 RDL")
 *   - Group-frequency goals where every linked routine is in the domain
 *     ("lift 3x/wk" across Push/Pull/Legs), OR whose targetDomain IS the
 *     domain (first-class domain goals — "Strength 3×/week"). "Any training"
 *     goals stay home-only; they'd be noise repeated on every hub.
 */
export const getDomainGoals = cache(async function getDomainGoals(
  domain: "strength" | "cardio" | "mobility" | "lifestyle"
): Promise<GoalInsight[]> {
  const allInsights = await getGoalsOverview({ active: "active" });

  const routineTargetIds = unique(allInsights.filter((e) => e.goal.targetType === "ROUTINE").map((e) => e.goal.targetId));
  const exerciseTargetIds = unique(allInsights.filter((e) => e.goal.targetType === "EXERCISE").map((e) => e.goal.targetId));
  const groupFreqIds = allInsights
    .filter((e) => e.goal.id.startsWith("group-frequency:"))
    .map((e) => e.goal.id.replace("group-frequency:", ""));

  const [routineRows, exerciseSessionRows, freqGoalLinks, freqGoalRows] = await Promise.all([
    routineTargetIds.length > 0
      ? prisma.routine.findMany({
          where: { id: { in: routineTargetIds } },
          select: { id: true, kind: true, subtype: true, domain: true },
        })
      : Promise.resolve([]),
    exerciseTargetIds.length > 0
      ? prisma.sessionExercise.findMany({
          where: {
            exerciseId: { in: exerciseTargetIds },
            // Strength keeps the cheap kind pre-filter (WORKOUT ⊂ strength ∪
            // mobility-rehab); other domains JS-filter on effective domain.
            ...(domain === "strength" ? { routineLog: { routine: { kind: "WORKOUT" } } } : {}),
          },
          select: {
            exerciseId: true,
            routineLog: { select: { routine: { select: { kind: true, subtype: true, domain: true } } } },
          },
        })
      : Promise.resolve([]),
    groupFreqIds.length > 0
      ? prisma.frequencyGoalRoutine.findMany({
          where: { goalId: { in: groupFreqIds } },
          select: {
            goalId: true,
            routine: { select: { kind: true, subtype: true, domain: true } },
          },
        })
      : Promise.resolve([]),
    groupFreqIds.length > 0
      ? prisma.frequencyGoal.findMany({
          where: { id: { in: groupFreqIds } },
          select: { id: true, targetDomain: true },
        })
      : Promise.resolve([]),
  ]);

  const domainRoutineIds = new Set(
    routineRows.filter((r) => effectiveRoutineDomain(r.domain, r.kind, r.subtype) === domain).map((r) => r.id)
  );

  const domainExerciseIds = new Set<string>();
  for (const row of exerciseSessionRows) {
    if (effectiveRoutineDomain(row.routineLog.routine.domain, row.routineLog.routine.kind, row.routineLog.routine.subtype) === domain) {
      domainExerciseIds.add(row.exerciseId);
    }
  }

  // A group-frequency goal counts when every linked routine is in the domain
  // (strict — mixed-domain groups would double-surface if relaxed) OR when
  // it's a first-class domain goal targeting this domain.
  const groupFreqRoutinesByGoal = new Map<string, Array<{ kind: string; subtype: string | null; domain: string }>>();
  for (const link of freqGoalLinks) {
    const list = groupFreqRoutinesByGoal.get(link.goalId) ?? [];
    list.push(link.routine);
    groupFreqRoutinesByGoal.set(link.goalId, list);
  }
  const domainGroupFreqIds = new Set<string>();
  for (const [goalId, routines] of groupFreqRoutinesByGoal) {
    if (routines.length === 0) continue;
    if (routines.every((r) => effectiveRoutineDomain(r.domain, r.kind, r.subtype) === domain)) {
      domainGroupFreqIds.add(`group-frequency:${goalId}`);
    }
  }
  for (const row of freqGoalRows) {
    if (row.targetDomain === domain) domainGroupFreqIds.add(`group-frequency:${row.id}`);
  }

  return allInsights.filter((insight) => {
    const goal = insight.goal;
    if (goal.id.startsWith("group-frequency:")) return domainGroupFreqIds.has(goal.id);
    if (goal.targetType === "ROUTINE") return domainRoutineIds.has(goal.targetId);
    if (goal.targetType === "EXERCISE") return domainExerciseIds.has(goal.targetId);
    return false;
  });
});

/** Back-compat alias — the strength hub predates the generalized loader. */
export const getStrengthGoals = () => getDomainGoals("strength");

/**
 * The hub header's frequency chip — "2/3 this week". Prefers a first-class
 * domain goal (targetKindLabel "Domain"), falls back to any frequency goal
 * pointed at the hub. Rolling window only (world-page rule) — no
 * vs-previous-period language here.
 */
export function frequencyChipFor(goals: GoalInsight[]): { label: string; href: string } | null {
  const frequency = goals.filter((g) => g.goal.goalType === "FREQUENCY" && g.goal.isActive);
  if (frequency.length === 0) return null;
  const pick = frequency.find((g) => g.targetKindLabel === "Domain") ?? frequency[0];
  const unitWord =
    pick.goal.timeframe === "DAY" ? "today" : pick.goal.timeframe === "MONTH" ? "this month" : "this week";
  return {
    label: `${pick.actualDisplay}/${pick.targetDisplay} ${unitWord}`,
    href: pick.detailHref ?? `/plan/goals/${encodeURIComponent(pick.goal.id)}`,
  };
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
