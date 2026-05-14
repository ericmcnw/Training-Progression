// Resolves "what frequency goals does this routine contribute to?" — used by
// the log page's Contributes-to strip so the user can see in advance what
// their log will satisfy.
//
// For each goal the routine is linked to, we compute the current window's
// progress (e.g. 3 of 4 this week) and flag whether this routine participates
// as a PRIMARY (real completion) or SUBSTITUTE (covers a slot).

import { prisma } from "@/lib/prisma";
import { computeFrequencyState, type FrequencyTarget } from "@/lib/frequency-state";

export type RoutineGoalContribution = {
  goalId: string;
  goalName: string;
  /** Whether this routine is a PRIMARY contributor or a SUBSTITUTE on the goal. */
  role: "PRIMARY" | "SUBSTITUTE";
  /** True when the goal is a group (more than one PRIMARY routine). */
  isGroup: boolean;
  /** "1× / day", "3× / week", etc. */
  cadenceLabel: string;
  /** Current window progress / target. */
  progress: number;
  target: number;
  /** Whether today's log is *already* counted for this goal (any primary or
   *  substitute routine on the goal logged today). Lets the strip distinguish
   *  "you'll hit X" vs "X already hit today, this is bonus." */
  hitToday: boolean;
};

const WINDOW_DAYS = 35; // enough for monthly windows to compute current progress

export async function getRoutineGoalContributions(
  routineId: string,
  today: string
): Promise<RoutineGoalContribution[]> {
  // All FrequencyGoalRoutine links for this routine → goal IDs.
  const ownLinks = await prisma.frequencyGoalRoutine.findMany({
    where: { routineId, goal: { isActive: true } },
    select: { goalId: true, role: true },
  });
  if (ownLinks.length === 0) return [];

  const goalIds = ownLinks.map((l) => l.goalId);
  const goals = await prisma.frequencyGoal.findMany({
    where: { id: { in: goalIds } },
    include: {
      routines: {
        include: {
          routine: { select: { id: true, name: true, isActive: true, isDeleted: true } },
        },
      },
    },
  });

  // Pull recent logs for every routine across all those goals in one shot.
  const allRoutineIds = Array.from(
    new Set(goals.flatMap((g) => g.routines.map((r) => r.routineId)))
  );
  const sinceMs = new Date(`${today}T00:00:00.000Z`).getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const logs = await prisma.routineLog.findMany({
    where: { routineId: { in: allRoutineIds }, performedAt: { gte: new Date(sinceMs) } },
    select: { performedAt: true, routineId: true },
  });
  const logsByRoutineId = new Map<string, Array<{ performedAt: Date }>>();
  for (const log of logs) {
    const list = logsByRoutineId.get(log.routineId) ?? [];
    list.push({ performedAt: log.performedAt });
    logsByRoutineId.set(log.routineId, list);
  }

  const ownRoleByGoalId = new Map(ownLinks.map((l) => [l.goalId, l.role]));

  const contributions: RoutineGoalContribution[] = goals
    .map((goal): RoutineGoalContribution | null => {
      const ownRole = ownRoleByGoalId.get(goal.id);
      if (!ownRole) return null;
      const liveLinks = goal.routines.filter(
        (rel) => rel.routine && rel.routine.isActive && !rel.routine.isDeleted
      );
      const primaryLinks = liveLinks.filter((rel) => rel.role !== "SUBSTITUTE");
      if (primaryLinks.length === 0) return null;

      // Build state from all routine logs, marking primary vs substitute so
      // the window progress includes covered days.
      const primaryRoutineIds = new Set(primaryLinks.map((rel) => rel.routineId));
      const stateLogs = liveLinks.flatMap((rel) => {
        const isPrimary = primaryRoutineIds.has(rel.routineId);
        return (logsByRoutineId.get(rel.routineId) ?? []).map((log) => ({
          performedAt: log.performedAt,
          isPrimary,
        }));
      });

      const target: FrequencyTarget = {
        targetCount: goal.targetCount,
        targetInterval: goal.targetInterval,
        targetUnit: goal.targetUnit,
        weekdayMask: goal.weekdayMask ?? null,
      };
      const state = computeFrequencyState({
        target,
        logs: stateLogs,
        today,
        trailingDays: WINDOW_DAYS,
      });

      const isGroup = primaryLinks.length > 1;
      const isPerRoutine = goal.id.startsWith("fg_");
      const displayName = isPerRoutine ? primaryLinks[0].routine!.name : goal.name;

      return {
        goalId: goal.id,
        goalName: displayName,
        role: ownRole,
        isGroup,
        cadenceLabel: formatCadence(target),
        progress: state.currentWindow.progress,
        target: state.currentWindow.target,
        hitToday: state.dailyState[today] === "done" || state.dailyState[today] === "covered",
      };
    })
    .filter((c): c is RoutineGoalContribution => c !== null);

  // Sort: in-progress (not yet hit) before complete; primaries before substitutes.
  contributions.sort((a, b) => {
    if (a.progress < a.target && b.progress >= b.target) return -1;
    if (a.progress >= a.target && b.progress < b.target) return 1;
    if (a.role !== b.role) return a.role === "PRIMARY" ? -1 : 1;
    return a.goalName.localeCompare(b.goalName);
  });

  return contributions;
}

function formatCadence(target: FrequencyTarget): string {
  const unitWord = target.targetUnit === "DAY" ? "day" : target.targetUnit === "WEEK" ? "week" : "month";
  if (target.targetInterval === 1) return `${target.targetCount}× / ${unitWord}`;
  return `${target.targetCount}× / ${target.targetInterval} ${unitWord}s`;
}
