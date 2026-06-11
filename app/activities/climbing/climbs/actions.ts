"use server";

// Inline single-attempt edit from the climbs database. The full session
// edit form still exists for restructuring a whole session; this covers
// the common "that grade/outcome/area/note is wrong" fix without leaving
// the browse view.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fuzzyDuplicateKey } from "@/lib/activity-spots";
import type { ClimbOutcome } from "@/lib/climb-types";

const VALID_OUTCOMES = new Set<ClimbOutcome>(["FLASH", "ONSIGHT", "SEND", "REDPOINT", "FELL", "PROJECT"]);

export async function updateClimbAttempt(input: {
  id: string;
  grade: string;
  outcome: ClimbOutcome;
  notes: string | null;
  /** Area by NAME — fuzzily resolved to an existing ClimbArea at the
   *  attempt's location (punctuation/case/plural variants reuse the
   *  existing row), or materialized as a new one. Empty string clears. */
  areaName: string | null;
}): Promise<{ id: string; grade: string; outcome: ClimbOutcome; notes: string | null; areaId: string | null; areaName: string | null }> {
  const grade = input.grade.trim();
  if (!grade) throw new Error("Grade can't be empty.");
  if (!VALID_OUTCOMES.has(input.outcome)) throw new Error("Unknown outcome.");

  const attempt = await prisma.climbAttempt.findUnique({
    where: { id: input.id },
    select: { id: true, sessionLog: { select: { climbLocationId: true } } },
  });
  if (!attempt) throw new Error("Climb not found.");

  const locationId = attempt.sessionLog.climbLocationId;
  const rawArea = input.areaName?.trim() ?? "";

  let areaId: string | null = null;
  let areaName: string | null = null;
  if (rawArea && locationId) {
    const key = fuzzyDuplicateKey(rawArea);
    const existing = (await prisma.climbArea.findMany({
      where: { locationId },
      select: { id: true, name: true },
    })).find((a) => fuzzyDuplicateKey(a.name) === key);
    if (existing) {
      areaId = existing.id;
      areaName = existing.name;
    } else {
      const created = await prisma.climbArea.create({
        data: { locationId, name: rawArea },
        select: { id: true, name: true },
      });
      areaId = created.id;
      areaName = created.name;
    }
  }

  await prisma.climbAttempt.update({
    where: { id: input.id },
    data: {
      grade,
      outcome: input.outcome,
      notes: input.notes?.trim() || null,
      areaId,
      // Keep legacy free-text in sync: set when location-less (FK can't
      // apply), clear when the FK carries the truth.
      area: !locationId && rawArea ? rawArea : null,
    },
  });

  revalidatePath("/activities/climbing/climbs");
  revalidatePath("/activities/climbing");
  if (locationId) revalidatePath(`/activities/climbing/locations/${locationId}`);

  return {
    id: input.id,
    grade,
    outcome: input.outcome,
    notes: input.notes?.trim() || null,
    areaId,
    areaName: areaName ?? (!locationId && rawArea ? rawArea : null),
  };
}
