// Shared revalidation helpers used by every action that mutates a
// resource which surfaces across multiple top-level pages.
//
// Centralized here so the surface list stays in sync — when we add a
// new page that consumes logs/routines (e.g. a future "Today" hub or
// a reports page), updating this one function refreshes every action
// caller automatically.

import { revalidatePath } from "next/cache";

// Revalidate every top-level surface that displays log/routine data.
// Layout-scoped `/activities` catches every nested route in one call
// (endurance world page, climbing pyramids, location detail, projects,
// map, settings, sport groups, etc.) — without it the family/type
// rollups would stay cached after an edit-form activity-type switch.
export function revalidateActivityWorlds() {
  revalidatePath("/activities", "layout");
}

// Full sweep — used by any action that creates, edits, or deletes a
// log or routine. Covers home, log, plan, routines list, progress,
// goals, schedule, body, manual log, and every activity-world page.
// `routineId` adds the per-routine progress + detail surfaces.
export function revalidateAllLogSurfaces(routineId?: string) {
  revalidatePath("/");
  revalidatePath("/manual-log");
  revalidatePath("/log");
  revalidatePath("/log");
  revalidatePath("/plan");
  revalidatePath("/progress");
  revalidatePath("/goals");
  revalidatePath("/schedule");
  revalidatePath("/body");
  revalidateActivityWorlds();
  if (routineId) {
    revalidatePath(`/routines/${routineId}/log`);
    revalidatePath(`/routines/${routineId}/logs`);
    revalidatePath(`/routines/${routineId}/template`);
    revalidatePath(`/progress/routines/${routineId}`);
  }
}
