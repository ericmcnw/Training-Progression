"use server";

// Server actions for the endurance settings page.
//
// All actions are reversible — there's no destructive operation here.
// Toggling a type off doesn't delete its data; archiving a routine sets
// isDeleted=true (soft delete) without touching logs. Every action has
// a matching reverse path so users can recover from a misclick without
// support.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { revalidateActivityWorlds } from "@/lib/revalidate-helpers";

// Enable/disable a specific activity type for the user. Disabled types
// drop out of the log drawer's picker but keep all their data; old logs
// still display with their type name. Re-enable by calling again with
// enabled=true.
export async function setActivityTypeEnabled(input: { activityTypeId: string; enabled: boolean }) {
  await prisma.userActivityTypePreference.upsert({
    where: { activityTypeId: input.activityTypeId },
    create: { activityTypeId: input.activityTypeId, enabled: input.enabled },
    update: { enabled: input.enabled },
  });
  // Disabling a type filters it out of the log drawer picker, the goal
  // builder picker, the schedule shortcut, the world page sub-filter,
  // and the settings page itself. Layout-scoped revalidation across
  // /activities + a manual refresh of /log keeps every surface in sync.
  revalidatePath("/log");
  revalidateActivityWorlds();
}

// Soft-archive a legacy endurance routine. Equivalent to clicking the
// existing routine's archive action — sets isDeleted=true, hides it from
// the routines list and pickers, but keeps every log. Routine + logs are
// fully recoverable via restoreLegacyEnduranceRoutine.
//
// This is the T2-9 "opt-in archive" entry point: surfaced as a toggle in
// the settings page after the user has confirmed their typed-endurance
// flow works for their workflow. Nothing archives automatically.
export async function archiveLegacyEnduranceRoutine(input: { routineId: string }) {
  await prisma.routine.update({
    where: { id: input.routineId },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  // Archiving hides the routine from /log, /routines, the schedule
  // picker, and any goal-builder routine list. Layout-scoped
  // revalidation across /activities catches the settings page plus
  // any world-page surface that ever surfaced it.
  revalidatePath("/log");
  revalidatePath("/log");
  revalidateActivityWorlds();
}

// Reverse of archive — un-soft-deletes the routine. Logs are unaffected
// (they were never touched). The routine reappears in pickers + lists.
export async function restoreLegacyEnduranceRoutine(input: { routineId: string }) {
  await prisma.routine.update({
    where: { id: input.routineId },
    data: { isDeleted: false, deletedAt: null },
  });
  revalidatePath("/log");
  revalidatePath("/log");
  revalidateActivityWorlds();
}

// Manually set the activityTypeId on a routine (legacy retag from the
// type-review queue). Used when the Phase 2 heuristic migration mapped
// something incorrectly — e.g. a routine named "Sunday Adventure"
// defaulted to Run but should have been Hike.
export async function setRoutineActivityType(input: { routineId: string; activityTypeId: string | null }) {
  await prisma.routine.update({
    where: { id: input.routineId },
    data: { activityTypeId: input.activityTypeId },
  });
  // Type retagging shifts the routine's logs in the family/type
  // rollups across every world page surface.
  revalidatePath("/log");
  revalidateActivityWorlds();
}
