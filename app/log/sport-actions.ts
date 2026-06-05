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
  /** "Where" — free-text for now (spot/court/mountain/etc.).
   *  Persisted on RoutineLog.location so it shows up in log lists
   *  + the climbing-style location resolution path later. */
  location?: string;
  /** Sport-specific subtype dropdown — e.g. basketball: "Game" /
   *  "Pickup" / "Shoot around" / "Drills". Stored in sportData. */
  sessionType?: string;
  /** Free-form per-sport extras (wave count, runs, opponent,
   *  conditions, etc.). Shape varies per sport. Stored verbatim
   *  inside RoutineLog.sportData under `extras`. */
  extras?: Record<string, string | number | undefined>;
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

  // Strip empty extras so the JSON blob only carries fields the user
  // actually filled in.
  const cleanExtras: Record<string, string | number> = {};
  if (input.extras) {
    for (const [k, v] of Object.entries(input.extras)) {
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (typeof v === "number" && Number.isNaN(v)) continue;
      cleanExtras[k] = typeof v === "string" ? v.trim() : v;
    }
  }

  const sportType = input.sessionType?.trim();
  const sportData =
    sportType || Object.keys(cleanExtras).length > 0
      ? {
          sport: input.sportSlug,
          ...(sportType ? { sessionType: sportType } : {}),
          ...(Object.keys(cleanExtras).length > 0 ? { extras: cleanExtras } : {}),
        }
      : undefined;

  const log = await prisma.routineLog.create({
    data: {
      routineId,
      performedAt,
      durationSec: durationSec ?? undefined,
      notes: input.notes?.trim() || undefined,
      location: input.location?.trim() || undefined,
      sportData,
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
