"use server";

import { getVisibleGear } from "@/lib/gear";
import type { SavedGear } from "@/lib/gear-pick-types";

// Saved gear visible when logging the given activity — powers the picker's
// "your gear" quick-add. Read-only; best-effort (returns [] on any hiccup).
export async function listGearForActivity(activitySlug: string): Promise<SavedGear[]> {
  if (!activitySlug) return [];
  return getVisibleGear(activitySlug);
}
