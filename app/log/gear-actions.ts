"use server";

import { getVisibleGear, type GearPickInput } from "@/lib/gear";
import { getGearListsForActivity, getGearListApplyPicks, type GearListSummary } from "@/lib/gear-lists";
import type { SavedGear } from "@/lib/gear-pick-types";

// Saved gear visible when logging the given activity — powers the picker's
// "your gear" quick-add. Read-only; best-effort (returns [] on any hiccup).
export async function listGearForActivity(activitySlug: string): Promise<SavedGear[]> {
  if (!activitySlug) return [];
  return getVisibleGear(activitySlug);
}

// The gear lists that can seed a log of this activity — the picker's "＋ From a
// list" menu. Read-only, best-effort.
export async function listGearListsForActivity(activitySlug: string): Promise<GearListSummary[]> {
  if (!activitySlug) return [];
  return getGearListsForActivity(activitySlug);
}

// The checked, inventory-backed items of a list, ready to append to the picker.
// Applying never mutates the list — this just reads its snapshot.
export async function applyGearList(listId: string): Promise<GearPickInput[]> {
  if (!listId) return [];
  return getGearListApplyPicks(listId);
}
