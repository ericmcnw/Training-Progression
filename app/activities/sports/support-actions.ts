"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { activitiesByFamily } from "@/lib/activity-families";

const VALID_SPORT_SLUGS = new Set(activitiesByFamily("sports").map((s) => s.slug));

// Strip a single sport from a routine's supportsSports list. Used by
// the inline "Remove" affordance on the Supporting Training section
// — lets the user curate which routines surface for which sport
// without going into the routine editor. The routine itself stays
// (it might still support other sports or be useful as a workout).
export async function removeSportSupportAction(
  routineId: string,
  sportSlug: string
): Promise<void> {
  if (!routineId || !VALID_SPORT_SLUGS.has(sportSlug)) return;

  const current = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { supportsSports: true },
  });
  if (!current) return;

  const next = (current.supportsSports ?? []).filter((s) => s !== sportSlug);

  await prisma.routine.update({
    where: { id: routineId },
    data: { supportsSports: next },
  });

  revalidatePath("/activities/sports");
  revalidatePath(`/activities/${sportSlug}`);
}
