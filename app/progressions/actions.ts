"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { findPreset } from "@/lib/progression-presets";

// Progression-owned rungs get their own guard rather than widening the Focus
// one. requireOwnedFocusMilestone throws unless ownerKind is FOCUS, and
// generalizing it would reach across the whole milestone surface — the wrong
// trade for an additive phase. The two merge once programs adopt progressions.
async function requireOwnedProgression(id: string) {
  const session = await getAppSession();
  const row = await prisma.progression.findFirst({
    where: { id, profileKey: session.profileKey },
    select: { id: true },
  });
  if (!row) throw new Error("Progression not found.");
  return row;
}

async function requireOwnedRung(id: string) {
  const rung = await prisma.progressionMilestone.findUnique({
    where: { id },
    select: { id: true, ownerKind: true, ownerId: true },
  });
  if (!rung || rung.ownerKind !== "PROGRESSION") throw new Error("Step not found.");
  await requireOwnedProgression(rung.ownerId);
  return rung;
}

function revalidateProgressions(id?: string) {
  revalidatePath("/progressions");
  if (id) revalidatePath(`/progressions/${id}`);
}

export async function createProgressionFromPreset(
  presetKey: string,
  nameOverride?: string
): Promise<{ id: string }> {
  const session = await getAppSession();
  const preset = findPreset(presetKey);
  if (!preset) throw new Error("Unknown preset.");
  const name = (nameOverride ?? "").trim() || preset.name;

  // New progressions go to the top of the list.
  const min = await prisma.progression.aggregate({
    where: { profileKey: session.profileKey },
    _min: { sortOrder: true },
  });
  const sortOrder = (min._min.sortOrder ?? 0) - 1;

  const progression = await prisma.progression.create({
    data: { profileKey: session.profileKey, name, sortOrder },
    select: { id: true },
  });

  await prisma.progressionMilestone.createMany({
    data: preset.rungs.map((rung, index) => ({
      ownerKind: "PROGRESSION" as const,
      ownerId: progression.id,
      scopeKind: "CAPACITY" as const,
      label: rung.label,
      modifier: rung.modifier ?? null,
      targetText: rung.targetText ?? null,
      sortOrder: index,
    })),
  });

  revalidateProgressions();
  return { id: progression.id };
}

export async function markRungMet(id: string): Promise<void> {
  const rung = await requireOwnedRung(id);
  await prisma.progressionMilestone.update({
    where: { id },
    data: { status: "ACHIEVED", achievedAt: new Date() },
  });
  revalidateProgressions(rung.ownerId);
}

export async function reopenRung(id: string): Promise<void> {
  const rung = await requireOwnedRung(id);
  await prisma.progressionMilestone.update({
    where: { id },
    data: { status: "ACTIVE", achievedAt: null },
  });
  revalidateProgressions(rung.ownerId);
}

// Form-post entry point for the preset picker: create, then land the user on
// the new ladder rather than back on a list where they'd have to find it.
export async function applyPreset(formData: FormData): Promise<void> {
  const key = String(formData.get("presetKey") ?? "");
  const { id } = await createProgressionFromPreset(key);
  redirect(`/progressions/${id}`);
}
