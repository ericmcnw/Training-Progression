"use server";

// Server action for the freeform "Activity" log. Writes a RoutineLog
// against the pinned synthetic activity routine. Deliberately minimal:
// when + tags + duration + effort + notes. Body-part "worked/sore"
// tagging arrives in Phase 1b.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { clampEffort, effortIntensity } from "@/lib/strain";
import {
  createActivityZoneActivitiesForLog,
  createManualZoneActivitiesForLog,
} from "@/lib/zone-activities";
import { stampLogWeather } from "@/lib/weather-stamp";
import {
  ACTIVITY_TAGS,
  BODY_PART_ZONE_GROUPS,
  FREEFORM_ACTIVITY_ROUTINE_ID,
  activityTagLabel,
  bodyPartsToZoneGroups,
} from "@/lib/freeform-activity";

const VALID_TAG_KEYS = new Set(ACTIVITY_TAGS.map((t) => t.key));
const VALID_BODY_PART_KEYS = new Set(Object.keys(BODY_PART_ZONE_GROUPS));

// Create the pinned activity routine if it doesn't exist yet; un-archive
// if it was ever soft-removed. Idempotent — the first log opts the user in.
async function ensureFreeformActivityRoutine(): Promise<void> {
  await prisma.routine.upsert({
    where: { id: FREEFORM_ACTIVITY_ROUTINE_ID },
    update: { isActive: true, isDeleted: false },
    create: {
      id: FREEFORM_ACTIVITY_ROUTINE_ID,
      name: "Activity",
      kind: "SESSION",
      domain: "sport",
      isActive: true,
      isPlaceholder: true,
      isDeleted: false,
    },
  });
}

export type LogActivityInput = {
  performedAtIso: string;
  /** What you did — tag keys from ACTIVITY_TAGS. Unknown keys are dropped. */
  tags?: string[];
  /** Total session length in minutes (from a bucket or exact entry). */
  durationMinutes?: number;
  notes?: string;
  /** Perceived effort 1-10 (RPE). null/omitted = unrated. */
  effort?: number | null;
  /** Optional user-asserted body parts that felt worked — keys from
   *  BODY_PART_OPTIONS. Each lights the body map via a MANUAL ZoneActivity. */
  bodyParts?: string[];
};

export async function logActivityAction(input: LogActivityInput): Promise<{ logId: string }> {
  await ensureFreeformActivityRoutine();

  const performedAt = new Date(input.performedAtIso);
  if (Number.isNaN(performedAt.getTime())) {
    throw new Error("Invalid performedAt timestamp");
  }

  const durationSec =
    input.durationMinutes && input.durationMinutes > 0
      ? Math.round(input.durationMinutes * 60)
      : null;

  const tags = (input.tags ?? []).filter((t) => VALID_TAG_KEYS.has(t));
  const bodyParts = (input.bodyParts ?? []).filter((p) => VALID_BODY_PART_KEYS.has(p));

  // sportData always carries the `sport: "activity"` discriminator so
  // surfaces can recognize a freeform log even when it has no tags.
  const sportData = {
    sport: "activity",
    ...(tags.length > 0 ? { tags } : {}),
    ...(bodyParts.length > 0 ? { bodyParts } : {}),
  };

  const effort = input.effort != null ? clampEffort(input.effort) : null;

  const log = await prisma.routineLog.create({
    data: {
      routineId: FREEFORM_ACTIVITY_ROUTINE_ID,
      performedAt,
      durationSec: durationSec ?? undefined,
      notes: input.notes?.trim() || undefined,
      effort,
      sportData,
    },
    select: { id: true },
  });

  // No-op today (the "activity" slug has no muscle map, by design), but
  // keeps the write path uniform and clears stale SPORT_TAG rows on re-log.
  await createActivityZoneActivitiesForLog(prisma, log.id);

  // User-asserted body parts → MANUAL zone activity, lighting the body map's
  // recently-worked view. Intensity follows the session's effort if rated,
  // else a sensible "moderate" (the user said it got worked).
  const zoneLabel =
    tags.length > 0 ? `Activity — ${tags.map(activityTagLabel).join(", ")}` : "Activity";
  await createManualZoneActivitiesForLog(
    prisma,
    log.id,
    bodyPartsToZoneGroups(bodyParts),
    effort != null ? effortIntensity(effort) : "moderate",
    zoneLabel,
  );

  await stampLogWeather(log.id);

  revalidatePath("/log");
  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/profile");
  revalidatePath("/body");

  return { logId: log.id };
}
