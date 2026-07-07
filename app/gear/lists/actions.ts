"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { resolveGearPicks, type GearPickInput } from "@/lib/gear";
import { getActivityEntry } from "@/lib/activity-families";

const GRAMS_PER_OZ = 28.349523125;

function revalidate(listId?: string) {
  revalidatePath("/gear");
  revalidatePath("/gear/lists");
  if (listId) revalidatePath(`/gear/lists/${listId}`);
}

// Confirm the list belongs to the current profile before any write. Returns the
// list id when owned, else null — every mutation no-ops on a foreign/missing id.
async function ownedListId(id: string): Promise<string | null> {
  const session = await getAppSession();
  const list = await prisma.gearList.findFirst({
    where: { id, profileKey: session.profileKey, isDeleted: false },
    select: { id: true },
  });
  return list?.id ?? null;
}

async function ownedItemListId(itemId: string): Promise<string | null> {
  const session = await getAppSession();
  const item = await prisma.gearListItem.findFirst({
    where: { id: itemId, list: { profileKey: session.profileKey, isDeleted: false } },
    select: { listId: true },
  });
  return item?.listId ?? null;
}

export async function createGearList(input: { name: string; activitySlug?: string | null }): Promise<{ id: string }> {
  const session = await getAppSession();
  const name = input.name.trim() || "New list";
  const list = await prisma.gearList.create({
    data: { profileKey: session.profileKey, name, activitySlug: input.activitySlug || null },
    select: { id: true },
  });
  revalidate(list.id);
  return { id: list.id };
}

// Build a reusable list from a log's current gear picks — "save this trip's
// gear as a list". Resolves the picks to inventory (create-or-reuse) so the
// list's items link to real gear (weight/usage carry), then creates the list
// with everything checked. Returns the new list id, or null if nothing named.
export async function createGearListFromPicks(
  activitySlug: string,
  picks: GearPickInput[],
  name?: string
): Promise<{ id: string } | null> {
  const named = picks.filter((p) => p.name.trim());
  if (named.length === 0) return null;
  const session = await getAppSession();
  const resolved = await resolveGearPicks(named, activitySlug);
  const fallback = getActivityEntry(activitySlug)?.label;
  const listName = name?.trim() || (fallback ? `${fallback} kit` : "Gear list");
  const list = await prisma.gearList.create({
    data: {
      profileKey: session.profileKey,
      name: listName,
      activitySlug: activitySlug || null,
      items: {
        create: resolved.map((r, i) => ({
          label: r.name,
          gearId: r.gearId,
          consumable: r.consumable,
          quantity: r.quantity > 0 ? r.quantity : 1,
          // Gear-ref items inherit the gear's weight (null = inherit); only
          // ad-hoc items that never resolved carry a snapshot override.
          weightGramsOverride: r.gearId ? null : r.weightGrams,
          sortOrder: i,
          checked: true,
        })),
      },
    },
    select: { id: true },
  });
  revalidate(list.id);
  return { id: list.id };
}

export async function renameGearList(
  id: string,
  patch: { name?: string; activitySlug?: string | null; notes?: string | null }
): Promise<void> {
  if (!(await ownedListId(id))) return;
  const data: { name?: string; activitySlug?: string | null; notes?: string | null } = {};
  if (patch.name !== undefined) data.name = patch.name.trim() || "Untitled list";
  if (patch.activitySlug !== undefined) data.activitySlug = patch.activitySlug || null;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  await prisma.gearList.update({ where: { id }, data });
  revalidate(id);
}

export async function deleteGearList(id: string): Promise<void> {
  if (!(await ownedListId(id))) return;
  await prisma.gearList.update({ where: { id }, data: { isDeleted: true } });
  revalidate(id);
}

// Add an inventory item to a list. Label seeds from the gear name and consumable
// from the gear flag; weight inherits the gear (no override) so a later gear
// re-weigh flows through.
export async function addGearListItemFromGear(listId: string, gearId: string): Promise<void> {
  if (!(await ownedListId(listId))) return;
  const session = await getAppSession();
  const gear = await prisma.gear.findFirst({
    where: { id: gearId, profileKey: session.profileKey },
    select: { name: true, consumable: true },
  });
  if (!gear) return;
  const max = await prisma.gearListItem.aggregate({ where: { listId }, _max: { sortOrder: true } });
  await prisma.gearListItem.create({
    data: {
      listId,
      label: gear.name,
      gearId,
      consumable: gear.consumable,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidate(listId);
}

// Add a free-text (non-inventory) item — sunscreen, permit, 2 L water. Weight is
// entered in oz; consumable flags food/fuel/water for the base/total split.
export async function addGearListItemAdHoc(
  listId: string,
  input: { label: string; weightOz?: string; consumable?: boolean }
): Promise<void> {
  if (!(await ownedListId(listId))) return;
  const label = input.label.trim();
  if (!label) return;
  const oz = input.weightOz?.trim();
  const weightGramsOverride = oz ? Math.round(Number(oz) * GRAMS_PER_OZ) : null;
  const max = await prisma.gearListItem.aggregate({ where: { listId }, _max: { sortOrder: true } });
  await prisma.gearListItem.create({
    data: {
      listId,
      label,
      weightGramsOverride: Number.isFinite(weightGramsOverride) ? weightGramsOverride : null,
      consumable: Boolean(input.consumable),
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidate(listId);
}

export async function updateGearListItem(
  itemId: string,
  patch: { checked?: boolean; quantity?: number; weightOz?: string; label?: string; consumable?: boolean }
): Promise<void> {
  const listId = await ownedItemListId(itemId);
  if (!listId) return;
  const data: {
    checked?: boolean;
    quantity?: number;
    weightGramsOverride?: number | null;
    label?: string;
    consumable?: boolean;
  } = {};
  if (patch.checked !== undefined) data.checked = patch.checked;
  if (patch.consumable !== undefined) data.consumable = patch.consumable;
  if (patch.quantity !== undefined) data.quantity = patch.quantity > 0 ? Math.round(patch.quantity) : 1;
  if (patch.label !== undefined) data.label = patch.label.trim() || "Item";
  if (patch.weightOz !== undefined) {
    const oz = patch.weightOz.trim();
    data.weightGramsOverride = oz ? Math.round(Number(oz) * GRAMS_PER_OZ) : null;
  }
  await prisma.gearListItem.update({ where: { id: itemId }, data });
  revalidate(listId);
}

export async function removeGearListItem(itemId: string): Promise<void> {
  const listId = await ownedItemListId(itemId);
  if (!listId) return;
  await prisma.gearListItem.delete({ where: { id: itemId } });
  revalidate(listId);
}

export async function reorderGearListItems(listId: string, orderedIds: string[]): Promise<void> {
  if (!(await ownedListId(listId))) return;
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.gearListItem.updateMany({ where: { id, listId }, data: { sortOrder: i } })
    )
  );
  revalidate(listId);
}
