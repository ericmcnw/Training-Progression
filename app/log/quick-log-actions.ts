"use server";

import { prisma } from "@/lib/prisma";
import { getActivityEntry } from "@/lib/activity-families";
import { domainColor, effectiveRoutineDomain } from "@/lib/routines";
import { sportAccent } from "@/lib/sport-accent";
import { listSelectedSports } from "@/lib/synthetic-sport-routines";

const RECENT_ROUTINE_LIMIT = 5;

export type QuickLogOptions = {
  sports: Array<{ slug: string; label: string; eyebrow: string; color: string }>;
  routines: Array<{ id: string; name: string; color: string }>;
};

export async function loadQuickLogOptions(): Promise<QuickLogOptions> {
  const [selectedSports, recent] = await Promise.all([
    listSelectedSports(),
    prisma.routineLog.groupBy({
      by: ["routineId"],
      where: { routine: { isPlaceholder: false, isActive: true, isDeleted: false } },
      _max: { performedAt: true },
      orderBy: { _max: { performedAt: "desc" } },
      take: RECENT_ROUTINE_LIMIT,
    }),
  ]);

  const recentIds = recent.map((row) => row.routineId);
  const routines = recentIds.length
    ? await prisma.routine.findMany({
        where: { id: { in: recentIds } },
        select: { id: true, name: true, domain: true, kind: true, subtype: true },
      })
    : [];
  const routineById = new Map(routines.map((routine) => [routine.id, routine]));

  return {
    sports: selectedSports.map((sport) => ({
      slug: sport.slug,
      label: sport.label,
      eyebrow: getActivityEntry(sport.slug)?.eyebrow ?? "Sport",
      color: sportAccent(sport.slug),
    })),
    routines: recentIds.flatMap((id) => {
      const routine = routineById.get(id);
      if (!routine) return [];
      return [{
        id: routine.id,
        name: routine.name,
        color: domainColor(effectiveRoutineDomain(routine.domain, routine.kind, routine.subtype)),
      }];
    }),
  };
}
