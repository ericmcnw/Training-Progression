// Helper for goal-detail pages — given a goal id (routine `fg_*`, group
// `group-frequency:<id>`, or a legacy Goal record with FREQUENCY type),
// returns everything needed to render a FrequencyHeatmap: the FrequencyTarget,
// the computed state, the linked routine ids, and the weekday mask.
//
// Returns null when the id doesn't resolve to a frequency-aware target — the
// goal detail page just skips rendering the consistency section in that case.

import { prisma } from "@/lib/prisma";
import { todayAppYmd } from "@/lib/dates";
import { computeFrequencyState, type FrequencyState, type FrequencyTarget } from "@/lib/frequency-state";

export type FrequencyConsistency = {
  target: FrequencyTarget;
  state: FrequencyState;
  weekdayMask: number | null;
  routineIds: string[];
  routineNames: string[];
};

const HEATMAP_DAYS = 8 * 7 + 7; // 8 weeks of grid + a week of buffer for streak math

export async function getFrequencyConsistency(rawGoalId: string): Promise<FrequencyConsistency | null> {
  const goalId = decodeURIComponent(rawGoalId);
  const today = todayAppYmd();

  // Group-frequency goals carry a `group-frequency:<id>` URL prefix.
  if (goalId.startsWith("group-frequency:")) {
    const id = goalId.slice("group-frequency:".length);
    const goal = await prisma.frequencyGoal.findUnique({
      where: { id },
      include: {
        routines: {
          include: { routine: { select: { id: true, name: true, isDeleted: true } } },
        },
      },
    });
    if (!goal) return null;
    return loadAndCompute({
      target: {
        targetCount: goal.targetCount,
        targetInterval: goal.targetInterval,
        targetUnit: goal.targetUnit,
        weekdayMask: goal.weekdayMask,
      },
      routines: goal.routines
        .map((rel) => rel.routine)
        .filter((r): r is NonNullable<typeof r> => Boolean(r) && !r!.isDeleted),
      today,
    });
  }

  // Per-routine `fg_*` ids resolve directly to a FrequencyGoal.
  if (goalId.startsWith("fg_")) {
    const goal = await prisma.frequencyGoal.findUnique({
      where: { id: goalId },
      include: {
        routines: {
          include: { routine: { select: { id: true, name: true, isDeleted: true } } },
        },
      },
    });
    if (!goal) return null;
    return loadAndCompute({
      target: {
        targetCount: goal.targetCount,
        targetInterval: goal.targetInterval,
        targetUnit: goal.targetUnit,
        weekdayMask: goal.weekdayMask,
      },
      routines: goal.routines
        .map((rel) => rel.routine)
        .filter((r): r is NonNullable<typeof r> => Boolean(r) && !r!.isDeleted),
      today,
    });
  }

  // Legacy Goal records with FREQUENCY/ROUTINE — fetch the routine and its
  // companion FrequencyGoal (`fg_<routineId>`) for cadence + mask.
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { id: true, goalType: true, targetType: true, targetId: true },
  });
  if (!goal || goal.goalType !== "FREQUENCY" || goal.targetType !== "ROUTINE") return null;

  const [routine, fg] = await Promise.all([
    prisma.routine.findUnique({
      where: { id: goal.targetId },
      select: { id: true, name: true, isDeleted: true },
    }),
    prisma.frequencyGoal.findUnique({
      where: { id: `fg_${goal.targetId}` },
      select: { targetCount: true, targetInterval: true, targetUnit: true, weekdayMask: true },
    }),
  ]);
  if (!routine || routine.isDeleted || !fg) return null;
  return loadAndCompute({
    target: {
      targetCount: fg.targetCount,
      targetInterval: fg.targetInterval,
      targetUnit: fg.targetUnit,
      weekdayMask: fg.weekdayMask,
    },
    routines: [routine],
    today,
  });
}

async function loadAndCompute(params: {
  target: FrequencyTarget;
  routines: Array<{ id: string; name: string }>;
  today: string;
}): Promise<FrequencyConsistency | null> {
  const { target, routines, today } = params;
  if (routines.length === 0) return null;

  const routineIds = routines.map((r) => r.id);
  const routineNames = routines.map((r) => r.name);

  const since = new Date(Date.now() - HEATMAP_DAYS * 24 * 60 * 60 * 1000);
  const logs = await prisma.routineLog.findMany({
    where: { routineId: { in: routineIds }, performedAt: { gte: since } },
    select: { performedAt: true },
    orderBy: { performedAt: "asc" },
  });

  const state = computeFrequencyState({ target, logs, today, trailingDays: 8 * 7 });

  return {
    target,
    state,
    weekdayMask: target.weekdayMask ?? null,
    routineIds,
    routineNames,
  };
}
