"use server";

// Home-flavored schedule actions. These mirror the schedule-page actions but
// revalidate `/` instead of `/schedule` and never redirect — they're called
// from the WeekAtGlance day picker which lives on the Home dashboard. Keeping
// them in `_home/` makes the dependency direction Home → schedule-data
// instead of Home → Schedule UI.

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAppDayRange } from "@/lib/dates";
import { revalidatePath } from "next/cache";

function makeId() {
  return randomUUID().replace(/-/g, "");
}

export async function scheduleRoutineForDay(input: { routineId: string; ymd: string }) {
  const routineId = input.routineId.trim();
  const ymd = input.ymd.trim();

  if (!routineId) throw new Error("Missing routineId.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("Invalid date.");

  const routine = await prisma.routine.findFirst({
    where: { id: routineId, isDeleted: false },
    select: { id: true },
  });
  if (!routine) throw new Error("Routine not found.");

  const dayStart = getAppDayRange(ymd).start;
  const nextDayStart = getAppDayRange(ymd).end;
  const existing = await prisma.scheduleManualEntry.aggregate({
    where: {
      scheduledDate: { gte: dayStart, lt: nextDayStart },
    },
    _max: { sortOrder: true },
  });
  const nextSortOrder = (existing._max.sortOrder ?? -1) + 1;

  await prisma.scheduleManualEntry.create({
    data: {
      id: makeId(),
      routineId,
      scheduledDate: dayStart,
      sortOrder: nextSortOrder,
    },
  });

  // Home pulls schedule data into the WeekAtGlance — refresh that route. The
  // legacy `/schedule` surface stays in sync naturally since it reads the
  // same table on its next visit.
  revalidatePath("/");
}
