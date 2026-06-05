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

export async function scheduleRoutineForDay(input: { routineId: string; ymd: string; activityTypeId?: string | null }) {
  const routineId = input.routineId.trim();
  const ymd = input.ymd.trim();
  const activityTypeId = input.activityTypeId?.trim() || null;

  if (!routineId) throw new Error("Missing routineId.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("Invalid date.");

  const routine = await prisma.routine.findFirst({
    where: { id: routineId, isDeleted: false },
    select: { id: true },
  });
  if (!routine) throw new Error("Routine not found.");

  // Validate the activity type exists if one was passed. Most schedule
  // entries leave it null (legacy routines, non-endurance). When set, the
  // slot renders as "Run · Tuesday" instead of the synthetic Endurance
  // routine name.
  if (activityTypeId) {
    const type = await prisma.activityType.findUnique({
      where: { id: activityTypeId },
      select: { id: true },
    });
    if (!type) throw new Error("Activity type not found.");
  }

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
      activityTypeId,
      scheduledDate: dayStart,
      sortOrder: nextSortOrder,
    },
  });

  // Home + Plan both pull schedule data into their week/month views, so
  // both need invalidation here. /schedule survives the legacy redirect
  // (see app/schedule/page.tsx) but we cover it too in case the user
  // bookmarked the old URL.
  revalidatePath("/");
  revalidatePath("/plan");
  revalidatePath("/schedule");
}

// Schedule a typed endurance slot for a day. Convenience wrapper around
// scheduleRoutineForDay that targets the synthetic Endurance routine + a
// specific activity type. Used by the new "Schedule endurance" UI in the
// WaG day picker.
export async function scheduleEnduranceTypeForDay(input: { activityTypeId: string; ymd: string }) {
  const { SYNTHETIC_ENDURANCE_ROUTINE_ID } = await import("@/lib/activity-types");
  return scheduleRoutineForDay({
    routineId: SYNTHETIC_ENDURANCE_ROUTINE_ID,
    activityTypeId: input.activityTypeId,
    ymd: input.ymd,
  });
}

// Schedule a sport for a day. Same shape as the endurance shortcut —
// resolves the sport's synthetic routine id (sports-{slug}-synthetic)
// and writes a ScheduleManualEntry. Auto-creates the synthetic routine
// if it doesn't exist yet (user can schedule a sport they haven't
// added via /log first; this opts them in).
export async function scheduleSportForDay(input: { sportSlug: string; ymd: string }) {
  const { ensureSportSelected, getSyntheticSportRoutineId } = await import(
    "@/lib/synthetic-sport-routines"
  );
  await ensureSportSelected(input.sportSlug);
  return scheduleRoutineForDay({
    routineId: getSyntheticSportRoutineId(input.sportSlug),
    ymd: input.ymd,
  });
}
