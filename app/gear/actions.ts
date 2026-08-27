"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { resolveGearTypeSlug } from "@/lib/gear-types";

const GRAMS_PER_OZ = 28.349523125;

function revalidate(id?: string) {
  revalidatePath("/gear");
  if (id) revalidatePath(`/gear/${id}`);
}

// Confirm the gear belongs to the current profile before any write.
async function owns(id: string): Promise<boolean> {
  const session = await getAppSession();
  const g = await prisma.gear.findFirst({ where: { id, profileKey: session.profileKey }, select: { id: true } });
  return Boolean(g);
}

export async function updateGear(
  id: string,
  input: { name?: string; type?: string; weightOz?: string; consumable?: boolean; worn?: boolean | null; activitySlug?: string | null }
): Promise<void> {
  if (!(await owns(id))) return;
  const data: { name?: string; type?: string; weightGrams?: number | null; consumable?: boolean; worn?: boolean | null; activitySlug?: string | null } = {};
  if (input.name !== undefined) data.name = input.name.trim() || "Gear";
  if (input.type !== undefined) data.type = resolveGearTypeSlug(input.type);
  if (input.consumable !== undefined) data.consumable = input.consumable;
  if (input.worn !== undefined) data.worn = input.worn;
  if (input.activitySlug !== undefined) data.activitySlug = input.activitySlug || null;
  if (input.weightOz !== undefined) {
    const oz = input.weightOz.trim();
    data.weightGrams = oz ? Math.round(Number(oz) * GRAMS_PER_OZ) : null;
  }
  await prisma.gear.update({ where: { id }, data });
  revalidate(id);
}

export async function retireGear(id: string): Promise<void> {
  if (!(await owns(id))) return;
  await prisma.gear.update({ where: { id }, data: { retiredAt: new Date() } });
  revalidate(id);
}

export async function unretireGear(id: string): Promise<void> {
  if (!(await owns(id))) return;
  await prisma.gear.update({ where: { id }, data: { retiredAt: null } });
  revalidate(id);
}

// Hard delete. Usage links (RoutineLogGear) cascade away; gear-list items keep
// their label (gearId set null). History is lost — the UI steers toward Retire.
export async function deleteGear(id: string): Promise<void> {
  if (!(await owns(id))) return;
  await prisma.gear.delete({ where: { id } });
  revalidate();
}
