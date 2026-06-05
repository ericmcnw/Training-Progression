"use server";

// Server actions for the Sports section on /log. Three operations:
//   - addSportAction(slug) — create the synthetic per-sport routine
//   - removeSportAction(slug) — soft-delete it (logs preserved)
//   - logSportAction — create a RoutineLog against the synthetic routine
//
// Logging is intentionally minimal: when + duration + notes + optional
// activity-type-style sub-tag (e.g. basketball: "Pickup"). Per-sport
// rich schemas (climbing per-attempt, golf range/course) come in
// later phases — Phase 1 just lands the model end-to-end.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ensureSportSelected,
  getSyntheticSportRoutineId,
  isSyntheticSportRoutineId,
  unselectSport,
} from "@/lib/synthetic-sport-routines";
import { getActivityEntry } from "@/lib/activity-families";

export async function addSportAction(slug: string): Promise<void> {
  await ensureSportSelected(slug);
  revalidatePath("/log");
  revalidatePath("/activities/sports");
}

export async function removeSportAction(slug: string): Promise<void> {
  await unselectSport(slug);
  revalidatePath("/log");
  revalidatePath("/activities/sports");
}

export type LogSportInput = {
  sportSlug: string;
  performedAtIso: string;
  /** Total session length in minutes. Optional — some sport types
   *  (e.g. quick golf range stop) might not warrant a duration. */
  durationMinutes?: number;
  notes?: string;
};

export async function logSportAction(input: LogSportInput): Promise<{ logId: string }> {
  const entry = getActivityEntry(input.sportSlug);
  if (!entry || entry.family !== "sports") {
    throw new Error(`Unknown sport slug: ${input.sportSlug}`);
  }
  const routineId = getSyntheticSportRoutineId(input.sportSlug);

  // Ensure the routine exists in case the user logs against a sport
  // they hadn't yet "selected" via the picker — the log itself opts
  // them in. Idempotent.
  await ensureSportSelected(input.sportSlug);

  const performedAt = new Date(input.performedAtIso);
  if (Number.isNaN(performedAt.getTime())) {
    throw new Error("Invalid performedAt timestamp");
  }
  const durationSec =
    input.durationMinutes && input.durationMinutes > 0
      ? Math.round(input.durationMinutes * 60)
      : null;

  const log = await prisma.routineLog.create({
    data: {
      routineId,
      performedAt,
      durationSec: durationSec ?? undefined,
      notes: input.notes?.trim() || undefined,
    },
    select: { id: true },
  });

  revalidatePath("/log");
  revalidatePath("/activities/sports");
  revalidatePath(`/activities/${input.sportSlug}`);

  return { logId: log.id };
}

// Re-export the predicate for client code that needs to know if a
// given routine id is a synthetic sport routine.
export { isSyntheticSportRoutineId };
