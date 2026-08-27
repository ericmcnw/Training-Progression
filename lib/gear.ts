import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { compatibleActivitySlugs, normalizeSpotName } from "@/lib/activity-spots";
import { gearTypeMeta, isUniversalGearType, resolveGearTypeSlug } from "@/lib/gear-types";
import type { GearPick, SavedGear } from "@/lib/gear-pick-types";

const GRAMS_PER_OZ = 28.349523125;

// Server-side gear helpers: the visible-inventory read for the picker, and the
// resolve-on-save that turns picked lines into Gear rows (create-or-reuse).
// Both are best-effort — gear must never block a save or crash a form load.

// Gear visible when logging activity A: universal items (activitySlug null,
// e.g. footwear) + items scoped to A or a compatible activity.
export async function getVisibleGear(activitySlug: string): Promise<SavedGear[]> {
  try {
    const session = await getAppSession();
    const compatible = compatibleActivitySlugs(activitySlug);
    const rows = await prisma.gear.findMany({
      where: {
        profileKey: session.profileKey,
        retiredAt: null,
        OR: [{ activitySlug: null }, { activitySlug: { in: compatible } }],
      },
      orderBy: [{ name: "asc" }],
      select: { id: true, type: true, name: true, weightGrams: true, consumable: true, worn: true },
    });
    return rows;
  } catch {
    return [];
  }
}

export type GearRow = {
  id: string;
  type: string;
  name: string;
  weightGrams: number | null;
  activitySlug: string | null;
  consumable: boolean;
  worn: boolean | null;
  retiredAt: Date | null;
};

// All of the user's gear (active + retired) for the /gear hub. Best-effort.
export async function getAllGear(): Promise<GearRow[]> {
  try {
    const session = await getAppSession();
    return await prisma.gear.findMany({
      where: { profileKey: session.profileKey },
      orderBy: [{ retiredAt: "asc" }, { name: "asc" }],
      select: { id: true, type: true, name: true, weightGrams: true, activitySlug: true, consumable: true, worn: true, retiredAt: true },
    });
  } catch {
    return [];
  }
}

// One gear item (profile-scoped) for the /gear/[id] detail + edit page.
export async function getGear(id: string): Promise<GearRow | null> {
  try {
    const session = await getAppSession();
    return await prisma.gear.findFirst({
      where: { id, profileKey: session.profileKey },
      select: { id: true, type: true, name: true, weightGrams: true, activitySlug: true, consumable: true, worn: true, retiredAt: true },
    });
  } catch {
    return null;
  }
}

export type GearPickInput = {
  gearId: string | null;
  type: string;
  name: string;
  weightGrams: number | null;
  quantity: number;
  consumable: boolean;
};

// A resolved gear line ready to snapshot onto a log/trip. `gearId` is the linked
// inventory item, or null if linking failed (the line is still preserved so the
// user never loses what they entered).
export type ResolvedGear = {
  gearId: string | null;
  type: string;
  name: string;
  weightGrams: number | null;
  quantity: number;
  consumable: boolean;
};

// Turn picked lines into inventory-backed snapshots: reuse by explicit id, then
// by normalized name, else create. Per-line best-effort so a single DB hiccup
// only drops that line's inventory link, not its data.
export async function resolveGearPicks(picks: GearPickInput[], activitySlug: string): Promise<ResolvedGear[]> {
  const out: ResolvedGear[] = [];
  let session: Awaited<ReturnType<typeof getAppSession>> | null = null;
  const byId = new Map<string, { id: string }>();
  const byName = new Map<string, { id: string }>();
  try {
    session = await getAppSession();
    const existing = await prisma.gear.findMany({
      where: { profileKey: session.profileKey },
      select: { id: true, name: true },
    });
    for (const g of existing) {
      byId.set(g.id, g);
      byName.set(normalizeSpotName(g.name), g);
    }
  } catch {
    // Couldn't preload — every line falls through to a create attempt below.
  }

  for (const p of picks) {
    const name = p.name.trim();
    if (!name) continue;
    const typeSlug = resolveGearTypeSlug(p.type);
    const weightGrams = Number.isFinite(p.weightGrams) ? p.weightGrams : null;
    const quantity = Number.isFinite(p.quantity) && p.quantity > 0 ? Math.round(p.quantity) : 1;
    const consumable = Boolean(p.consumable);

    let gearId: string | null = null;
    try {
      const key = normalizeSpotName(name);
      let match = p.gearId ? byId.get(p.gearId) : undefined;
      if (!match) match = byName.get(key);
      if (!match && session) {
        const created = await prisma.gear.create({
          data: {
            profileKey: session.profileKey,
            type: typeSlug,
            name,
            weightGrams,
            activitySlug: isUniversalGearType(typeSlug) ? null : activitySlug,
            consumable,
          },
          select: { id: true },
        });
        match = created;
        byId.set(created.id, created);
        byName.set(key, created);
      }
      gearId = match?.id ?? null;
    } catch {
      gearId = null;
    }

    out.push({ gearId, type: typeSlug, name, weightGrams, quantity, consumable });
  }
  return out;
}

// Set the gear linked to a snapshot-less log (cardio / sport session): resolve
// picks to inventory, then replace the log's RoutineLogGear links. Best-effort.
export async function setLogGear(logId: string, picks: GearPickInput[], activitySlug: string): Promise<void> {
  try {
    const resolved = await resolveGearPicks(picks, activitySlug);
    await prisma.routineLogGear.deleteMany({ where: { routineLogId: logId } });
    const links = resolved
      .filter((r) => r.gearId)
      .map((r) => ({ routineLogId: logId, gearId: r.gearId as string }));
    if (links.length > 0) {
      await prisma.routineLogGear.createMany({ data: links, skipDuplicates: true });
    }
  } catch {
    // best-effort — gear linking must never break a save.
  }
}

// The gear linked to a log, as picker values (for prefilling an edit form).
export async function getLogGearPicks(logId: string): Promise<GearPick[]> {
  try {
    const links = await prisma.routineLogGear.findMany({
      where: { routineLogId: logId },
      select: { gear: { select: { id: true, type: true, name: true, weightGrams: true, consumable: true, worn: true } } },
    });
    return links.map((l) => ({
      localId: Math.random().toString(36).slice(2),
      gearId: l.gear.id,
      type: gearTypeMeta(l.gear.type).label,
      name: l.gear.name,
      weightOz: l.gear.weightGrams != null ? String(Math.round((l.gear.weightGrams / GRAMS_PER_OZ) * 10) / 10) : "",
      quantity: "1",
      consumable: l.gear.consumable,
      worn: l.gear.worn ?? undefined,
    }));
  } catch {
    return [];
  }
}
