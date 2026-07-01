import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { compatibleActivitySlugs } from "@/lib/activity-spots";
import type { GearPickInput } from "@/lib/gear";

// Server reads for gear lists (loadouts + checklists). A list is a reusable
// template; a log's gear snapshot is the per-trip instance, so nothing here
// mutates a log. All reads are best-effort — a not-yet-migrated / empty DB
// returns [] or null rather than throwing on a hot path.

export type GearListItemRow = {
  id: string;
  label: string;
  gearId: string | null;
  type: string | null; // gear type slug when linked to inventory
  weightGrams: number | null; // per-unit effective weight (override ?? gear)
  consumable: boolean;
  quantity: number;
  checked: boolean;
  sortOrder: number;
};

export type GearListDetail = {
  id: string;
  name: string;
  activitySlug: string | null;
  notes: string | null;
  items: GearListItemRow[];
};

export type GearListSummary = {
  id: string;
  name: string;
  activitySlug: string | null;
  itemCount: number;
  checkedCount: number;
  applyGearCount: number; // checked items backed by inventory (what "apply" adds)
  totalGrams: number; // all items × qty
  checkedGrams: number; // checked items × qty
  hasConsumable: boolean;
};

type RawItem = {
  id: string;
  label: string;
  gearId: string | null;
  weightGramsOverride: number | null;
  consumable: boolean;
  quantity: number;
  checked: boolean;
  sortOrder: number;
  gear: { type: string; weightGrams: number | null } | null;
};

function toItemRow(it: RawItem): GearListItemRow {
  const weightGrams = it.weightGramsOverride ?? it.gear?.weightGrams ?? null;
  return {
    id: it.id,
    label: it.label,
    gearId: it.gearId,
    type: it.gear?.type ?? null,
    weightGrams,
    consumable: it.consumable,
    quantity: it.quantity > 0 ? it.quantity : 1,
    checked: it.checked,
    sortOrder: it.sortOrder,
  };
}

function summarize(list: { id: string; name: string; activitySlug: string | null; items: RawItem[] }): GearListSummary {
  let totalGrams = 0;
  let checkedGrams = 0;
  let checkedCount = 0;
  let applyGearCount = 0;
  let hasConsumable = false;
  for (const it of list.items) {
    const per = it.weightGramsOverride ?? it.gear?.weightGrams ?? 0;
    const qty = it.quantity > 0 ? it.quantity : 1;
    const g = per * qty;
    totalGrams += g;
    if (it.consumable) hasConsumable = true;
    if (it.checked) {
      checkedGrams += g;
      checkedCount += 1;
      if (it.gearId) applyGearCount += 1;
    }
  }
  return {
    id: list.id,
    name: list.name,
    activitySlug: list.activitySlug,
    itemCount: list.items.length,
    checkedCount,
    applyGearCount,
    totalGrams,
    checkedGrams,
    hasConsumable,
  };
}

const ITEM_SELECT = {
  id: true,
  label: true,
  gearId: true,
  weightGramsOverride: true,
  consumable: true,
  quantity: true,
  checked: true,
  sortOrder: true,
  gear: { select: { type: true, weightGrams: true } },
} as const;

// All of the user's lists (for the /gear hub + /gear/lists index), summarized.
export async function getGearLists(): Promise<GearListSummary[]> {
  try {
    const session = await getAppSession();
    const rows = await prisma.gearList.findMany({
      where: { profileKey: session.profileKey, isDeleted: false },
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true, name: true, activitySlug: true, items: { select: ITEM_SELECT } },
    });
    return rows.map(summarize);
  } catch {
    return [];
  }
}

// One list with its items, for the editor.
export async function getGearList(id: string): Promise<GearListDetail | null> {
  try {
    const session = await getAppSession();
    const list = await prisma.gearList.findFirst({
      where: { id, profileKey: session.profileKey, isDeleted: false },
      select: {
        id: true,
        name: true,
        activitySlug: true,
        notes: true,
        items: { orderBy: [{ sortOrder: "asc" }], select: ITEM_SELECT },
      },
    });
    if (!list) return null;
    return {
      id: list.id,
      name: list.name,
      activitySlug: list.activitySlug,
      notes: list.notes,
      items: list.items.map(toItemRow),
    };
  } catch {
    return null;
  }
}

// Lists that can seed a log of the given activity: universal (activitySlug null)
// or scoped to the activity / a compatible one. Powers the picker's "From a
// list" menu.
export async function getGearListsForActivity(activitySlug: string): Promise<GearListSummary[]> {
  if (!activitySlug) return [];
  try {
    const session = await getAppSession();
    const compatible = compatibleActivitySlugs(activitySlug);
    const rows = await prisma.gearList.findMany({
      where: {
        profileKey: session.profileKey,
        isDeleted: false,
        OR: [{ activitySlug: null }, { activitySlug: { in: compatible } }],
      },
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true, name: true, activitySlug: true, items: { select: ITEM_SELECT } },
    });
    return rows.map(summarize);
  } catch {
    return [];
  }
}

// The checked, inventory-backed items of a list, as picker-resolve inputs — what
// "＋ From a list" appends to a log's gear picker. Pure label items (no gearId)
// are skipped: they aren't tracked gear. Applying never touches the list.
export async function getGearListApplyPicks(listId: string): Promise<GearPickInput[]> {
  try {
    const session = await getAppSession();
    const list = await prisma.gearList.findFirst({
      where: { id: listId, profileKey: session.profileKey, isDeleted: false },
      select: { items: { orderBy: [{ sortOrder: "asc" }], select: ITEM_SELECT } },
    });
    if (!list) return [];
    return list.items
      .filter((it) => it.checked && it.gearId)
      .map((it) => ({
        gearId: it.gearId,
        type: it.gear?.type ?? "other",
        name: it.label,
        weightGrams: it.weightGramsOverride ?? it.gear?.weightGrams ?? null,
        quantity: it.quantity > 0 ? it.quantity : 1,
        consumable: it.consumable,
      }));
  } catch {
    return [];
  }
}
