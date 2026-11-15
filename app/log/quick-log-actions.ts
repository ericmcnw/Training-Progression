"use server";

import { prisma } from "@/lib/prisma";
import { getActivityEntry } from "@/lib/activity-families";
import { addDaysYmd, toAppYmd, todayAppYmd } from "@/lib/dates";
import { domainColor, effectiveRoutineDomain } from "@/lib/routines";
import { sportAccent } from "@/lib/sport-accent";
import { listSelectedSports } from "@/lib/synthetic-sport-routines";

const SUGGESTION_LIMIT = 3;

export type QuickLogRoutine = { id: string; name: string; color: string };

export type QuickLogOptions = {
  sports: Array<{ slug: string; label: string; eyebrow: string; color: string }>;
  /** Planned for today first, then most recently logged. */
  suggestions: Array<QuickLogRoutine & { reason: string }>;
  /** Every active routine, for the search box. */
  routines: QuickLogRoutine[];
};

export async function loadQuickLogOptions(): Promise<QuickLogOptions> {
  const today = todayAppYmd();
  const [selectedSports, routines, lastLogged, scheduled] = await Promise.all([
    listSelectedSports(),
    prisma.routine.findMany({
      where: { isActive: true, isDeleted: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, domain: true, kind: true, subtype: true, isPlaceholder: true },
    }),
    prisma.routineLog.groupBy({
      by: ["routineId"],
      where: { routine: { isPlaceholder: false, isActive: true, isDeleted: false } },
      _max: { performedAt: true },
      orderBy: { _max: { performedAt: "desc" } },
      take: SUGGESTION_LIMIT * 2,
    }),
    prisma.scheduleManualEntry.findMany({
      where: {
        scheduledDate: {
          gte: new Date(`${addDaysYmd(today, -1)}T00:00:00.000Z`),
          lt: new Date(`${addDaysYmd(today, 2)}T00:00:00.000Z`),
        },
      },
      orderBy: { sortOrder: "asc" },
      select: { routineId: true, scheduledDate: true },
    }),
  ]);

  const routineById = new Map(
    routines.map((routine) => [
      routine.id,
      {
        id: routine.id,
        name: routine.name,
        color: domainColor(effectiveRoutineDomain(routine.domain, routine.kind, routine.subtype)),
      },
    ])
  );

  const loggedToday = new Set(
    lastLogged.filter((row) => row._max.performedAt && toAppYmd(row._max.performedAt) === today).map((row) => row.routineId)
  );
  const suggestions: QuickLogOptions["suggestions"] = [];
  const suggest = (routineId: string, reason: string) => {
    const routine = routineById.get(routineId);
    if (!routine || suggestions.length >= SUGGESTION_LIMIT || suggestions.some((s) => s.id === routineId)) return;
    suggestions.push({ ...routine, reason });
  };
  for (const entry of scheduled) {
    if (toAppYmd(entry.scheduledDate) === today && !loggedToday.has(entry.routineId)) suggest(entry.routineId, "Planned today");
  }
  for (const row of lastLogged) {
    if (!loggedToday.has(row.routineId)) suggest(row.routineId, "Recent");
  }

  return {
    sports: selectedSports.map((sport) => ({
      slug: sport.slug,
      label: sport.label,
      eyebrow: getActivityEntry(sport.slug)?.eyebrow ?? "Sport",
      color: sportAccent(sport.slug),
    })),
    suggestions,
    routines: routines.filter((routine) => !routine.isPlaceholder).map((routine) => routineById.get(routine.id)!),
  };
}
