// Auto-ticking progression rungs off logged sets.
//
// This runs from inside the log transaction, against the sets that were just
// written rather than a re-query of all-time bests. That is deliberate: a rung
// should be marked by the session that earned it, so achievedAt is the date you
// actually did the thing. Re-querying the max would also tick a rung you had
// already beaten months ago the next time you touched the exercise.
//
// Only rungs that opted in are touched. A wrong auto-tick is worse than none.

import type { Prisma, RungMetric } from "@/generated/prisma";

type Tx = Prisma.TransactionClient;

export type LoggedExercise = {
  exerciseId: string;
  loggedSets: { reps: number | null; seconds: number | null; weightLb: number | null }[];
};

function bestOf(sets: LoggedExercise["loggedSets"]): Record<RungMetric, number | null> {
  let weight: number | null = null;
  let reps: number | null = null;
  let seconds: number | null = null;
  for (const set of sets) {
    if (set.weightLb != null) weight = Math.max(weight ?? set.weightLb, set.weightLb);
    if (set.reps != null) reps = Math.max(reps ?? set.reps, set.reps);
    if (set.seconds != null) seconds = Math.max(seconds ?? set.seconds, set.seconds);
  }
  return { WEIGHT: weight, REPS: reps, SECONDS: seconds };
}

/** Returns the rung ids it marked achieved. */
export async function autoTickRungsForLog(
  tx: Tx,
  exercises: LoggedExercise[]
): Promise<string[]> {
  const exerciseIds = exercises.map((e) => e.exerciseId);
  if (exerciseIds.length === 0) return [];

  const candidates = await tx.progressionMilestone.findMany({
    where: {
      ownerKind: "PROGRESSION",
      status: "ACTIVE",
      autoTick: true,
      scopeKind: "EXERCISE",
      scopeRef: { in: exerciseIds },
      gateMetric: { not: null },
      gateValue: { not: null },
    },
    select: { id: true, scopeRef: true, gateMetric: true, gateValue: true },
  });
  if (candidates.length === 0) return [];

  const bestByExercise = new Map(exercises.map((e) => [e.exerciseId, bestOf(e.loggedSets)]));

  const earned = candidates.filter((rung) => {
    const best = rung.scopeRef ? bestByExercise.get(rung.scopeRef) : undefined;
    if (!best || rung.gateMetric == null || rung.gateValue == null) return false;
    const reached = best[rung.gateMetric];
    return reached != null && reached >= rung.gateValue;
  });
  if (earned.length === 0) return [];

  const ids = earned.map((r) => r.id);
  await tx.progressionMilestone.updateMany({
    where: { id: { in: ids } },
    data: { status: "ACHIEVED", achievedAt: new Date() },
  });
  return ids;
}
