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

// ── Authoring ─────────────────────────────────────────────────────────────

// Naming happens on the ladder itself, alongside the steps, rather than on a
// form that has to be filled in before you can start.
export async function createBlankProgression(): Promise<void> {
  const session = await getAppSession();

  const min = await prisma.progression.aggregate({
    where: { profileKey: session.profileKey },
    _min: { sortOrder: true },
  });

  const progression = await prisma.progression.create({
    data: {
      profileKey: session.profileKey,
      name: "New progression",
      sortOrder: (min._min.sortOrder ?? 0) - 1,
    },
    select: { id: true },
  });

  revalidateProgressions();
  redirect(`/progressions/${progression.id}?rename=1`);
}

export async function renameProgression(id: string, name: string): Promise<void> {
  await requireOwnedProgression(id);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the progression a name.");
  await prisma.progression.update({ where: { id }, data: { name: trimmed } });
  revalidateProgressions(id);
}

// Archive rather than delete — the ladder holds a real history of what was
// ticked and when, and that survives losing interest in it.
export async function archiveProgression(id: string): Promise<void> {
  await requireOwnedProgression(id);
  await prisma.progression.update({ where: { id }, data: { status: "ARCHIVED" } });
  revalidateProgressions(id);
  redirect("/progressions");
}

export type RungInput = {
  label: string;
  modifier: string | null;
  targetText: string | null;
};

export async function updateRung(id: string, input: RungInput): Promise<void> {
  const rung = await requireOwnedRung(id);
  await prisma.progressionMilestone.update({
    where: { id },
    data: {
      label: input.label.trim(),
      modifier: input.modifier?.trim() || null,
      targetText: input.targetText?.trim() || null,
    },
  });
  revalidateProgressions(rung.ownerId);
}

// Insert directly below `afterId` (or at the end when null) and shift the rest
// down, so a rung added mid-ladder lands where the cursor was.
export async function addRung(
  progressionId: string,
  afterId: string | null
): Promise<{ id: string }> {
  await requireOwnedProgression(progressionId);

  const siblings = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "PROGRESSION", ownerId: progressionId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  // Derive the slot from the neighbour's actual sortOrder, never from its
  // index — deleting a rung leaves gaps, and an index would then insert the
  // new rung above its neighbour instead of below it.
  const after = afterId
    ? siblings.find((s) => s.id === afterId)
    : siblings[siblings.length - 1];
  const position = after ? after.sortOrder + 1 : 0;

  const created = await prisma.$transaction(async (tx) => {
    await tx.progressionMilestone.updateMany({
      where: { ownerKind: "PROGRESSION", ownerId: progressionId, sortOrder: { gte: position } },
      data: { sortOrder: { increment: 1 } },
    });
    return tx.progressionMilestone.create({
      data: {
        ownerKind: "PROGRESSION",
        ownerId: progressionId,
        scopeKind: "CAPACITY",
        label: "",
        sortOrder: position,
      },
      select: { id: true },
    });
  });

  revalidateProgressions(progressionId);
  return created;
}

export async function deleteRung(id: string): Promise<void> {
  const rung = await requireOwnedRung(id);
  await prisma.progressionMilestone.delete({ where: { id } });
  revalidateProgressions(rung.ownerId);
}

export async function reorderRungs(progressionId: string, orderedIds: string[]): Promise<void> {
  await requireOwnedProgression(progressionId);
  const owned = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "PROGRESSION", ownerId: progressionId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((r) => r.id));
  if (orderedIds.length !== ownedIds.size || orderedIds.some((id) => !ownedIds.has(id))) {
    throw new Error("Step list does not match this progression.");
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.progressionMilestone.update({ where: { id }, data: { sortOrder: index } })
    )
  );
  revalidateProgressions(progressionId);
}
