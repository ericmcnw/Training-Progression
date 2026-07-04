// Goal memory. Goals historically computed isAchieved live and threw it away —
// nothing recorded that a target was ever hit, so there was no celebration
// moment, no history timeline, and no promotion ladder. GoalMilestone is that
// record. Two event kinds:
//
//   ACHIEVED   — a milestone-cadence goal (ONE_TIME timeframe) reached its
//                target. Latched lazily on read: the unique (goalId, kind,
//                value) constraint makes repeated latching a no-op, so read
//                paths can call it unconditionally.
//   BAR_RAISED — the goal's target moved (promotion on a milestone track, or
//                a recurring goal's standing bar going 3×/wk → 4×/wk).
//                Written by the goal update paths.
//
// `lineageId` groups a goal's ladder into one track for step-charts. Goals
// keep their id across promotions (edit-in-place), so lineage = goalId today;
// the column exists so a future "fork the track" flow doesn't need a schema
// change. goalId spans BOTH goal stores (Goal + FrequencyGoal) by design.

import { prisma } from "@/lib/prisma";
import type { GoalInsight } from "@/lib/goals";

export type MilestoneEvent = {
  id: string;
  goalId: string;
  lineageId: string;
  kind: "ACHIEVED" | "BAR_RAISED";
  value: number;
  valueLabel: string | null;
  achievedAt: Date;
};

// Latch ACHIEVED rows for milestone-cadence goals that currently read as hit.
// Cadence is derived, not stored: ONE_TIME timeframe = milestone (latches
// forever); recurring windows (DAY/WEEK/MONTH) refill and never latch here.
// Safe to await on read paths — one createMany, skipDuplicates makes it
// idempotent, and a failure never blocks rendering.
export async function latchAchievedMilestones(insights: GoalInsight[]): Promise<void> {
  const candidates = insights.filter(
    (entry) =>
      entry.isAchieved &&
      entry.hasData &&
      entry.goal.timeframe === "ONE_TIME" &&
      Number.isFinite(entry.targetValue) &&
      entry.targetValue > 0
  );
  if (candidates.length === 0) return;
  try {
    await prisma.goalMilestone.createMany({
      data: candidates.map((entry) => ({
        goalId: entry.goal.id,
        lineageId: entry.goal.id,
        kind: "ACHIEVED" as const,
        value: entry.targetValue,
        valueLabel: entry.targetDisplay || null,
      })),
      skipDuplicates: true,
    });
  } catch {
    // Never let goal-memory bookkeeping break a page render.
  }
}

// Record a target change. Called by the update paths after a successful
// write; duplicate (same goal re-raised to the same value) is a no-op.
export async function recordBarRaise(
  goalId: string,
  newValue: number,
  valueLabel?: string | null
): Promise<void> {
  if (!Number.isFinite(newValue) || newValue <= 0) return;
  try {
    await prisma.goalMilestone.create({
      data: {
        goalId,
        lineageId: goalId,
        kind: "BAR_RAISED",
        value: newValue,
        valueLabel: valueLabel ?? null,
      },
    });
  } catch {
    // Unique conflict (re-raised to a previous value) or transient failure —
    // history is best-effort, the goal update itself already succeeded.
  }
}

// Full ladder for a goal's track, oldest first — feeds history timelines and
// step-charts (P4 surfaces).
export async function getGoalLineage(goalId: string): Promise<MilestoneEvent[]> {
  const rows = await prisma.goalMilestone.findMany({
    where: { lineageId: goalId },
    orderBy: { achievedAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    goalId: row.goalId,
    lineageId: row.lineageId,
    kind: row.kind,
    value: row.value,
    valueLabel: row.valueLabel,
    achievedAt: row.achievedAt,
  }));
}
