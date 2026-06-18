"use server";

import { prisma } from "@/lib/prisma";
import { clampEffort } from "@/lib/strain";

// Learned RPE pre-fill: the median of the user's own recent ratings for THIS
// activity. It only personalizes the slider's starting position — it never
// touches the stored effort or the computed load (those always come from what
// the user actually picks). Returns null until there's enough signal, so the
// caller falls back to the duration heuristic.
//
// Activity identity is whatever the calling form knows: a routineId (sports,
// climbing, strength — one synthetic/real routine per activity) and/or an
// activityTypeId (endurance, where one synthetic routine hosts every type).

const MIN_SAMPLES = 3;
const WINDOW = 30;

export async function learnedEffortForActivity(opts: {
  routineId?: string | null;
  activityTypeId?: string | null;
}): Promise<number | null> {
  // Prefer activityTypeId when present — for endurance one synthetic routine
  // hosts every type, so the type is the specific key (a Run shouldn't borrow
  // a Bike's ratings). Everything else (sports, climbing, strength) has one
  // routine per activity, so the routineId is specific enough.
  const match = opts.activityTypeId
    ? { activityTypeId: opts.activityTypeId }
    : opts.routineId
      ? { routineId: opts.routineId }
      : null;
  if (!match) return null;

  const logs = await prisma.routineLog.findMany({
    where: { effort: { not: null }, ...match },
    orderBy: { performedAt: "desc" },
    take: WINDOW,
    select: { effort: true },
  });
  const efforts = logs
    .map((l) => l.effort)
    .filter((e): e is number => e != null);
  if (efforts.length < MIN_SAMPLES) return null;

  efforts.sort((a, b) => a - b);
  const mid = Math.floor(efforts.length / 2);
  const median =
    efforts.length % 2 === 0 ? (efforts[mid - 1] + efforts[mid]) / 2 : efforts[mid];
  return clampEffort(median);
}
