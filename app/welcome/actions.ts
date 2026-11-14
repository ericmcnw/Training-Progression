"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActivityEntry } from "@/lib/activity-families";
import { ensureSportSelected, listSelectedSports, unselectSport } from "@/lib/synthetic-sport-routines";
import { revalidateActivityWorlds } from "@/lib/revalidate-helpers";

export async function saveWelcomeActivities(input: { sportSlugs: string[]; enduranceFamilySlugs: string[] }) {
  const { profileKey } = await getAppSession();

  const sportSlugs = new Set(
    input.sportSlugs.filter((slug) => {
      const entry = getActivityEntry(slug);
      return entry?.family === "sports" && !entry.pinnedCatchAll;
    })
  );
  const current = await listSelectedSports();
  for (const sport of current) {
    if (!sportSlugs.has(sport.slug)) await unselectSport(sport.slug);
  }
  for (const slug of sportSlugs) await ensureSportSelected(slug);

  // Picking no endurance at all leaves every type on rather than hiding the whole picker.
  if (input.enduranceFamilySlugs.length > 0) {
    const picked = new Set(input.enduranceFamilySlugs);
    const families = await prisma.enduranceFamily.findMany({
      select: { slug: true, types: { select: { id: true } } },
    });
    for (const family of families) {
      const enabled = picked.has(family.slug);
      for (const type of family.types) {
        await prisma.userActivityTypePreference.upsert({
          where: { profileKey_activityTypeId: { profileKey, activityTypeId: type.id } },
          create: { activityTypeId: type.id, enabled },
          update: { enabled },
        });
      }
    }
  }

  revalidatePath("/log");
  revalidatePath("/profile/settings");
  revalidateActivityWorlds();
}

export async function finishWelcome() {
  const { profileKey } = await getAppSession();
  await prisma.appProfile.update({
    where: { key: profileKey },
    data: { onboardedAt: new Date() },
  });
  revalidatePath("/");
}
