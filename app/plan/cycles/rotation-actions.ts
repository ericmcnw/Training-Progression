"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function revalidate() {
  revalidatePath("/plan");
}

export async function createRotation(name: string): Promise<{ id: string }> {
  const clean = name.trim() || "My rotation";
  const rotation = await prisma.rotation.create({ data: { name: clean } });
  revalidate();
  return { id: rotation.id };
}

export async function renameRotation(id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  await prisma.rotation.update({ where: { id }, data: { name: clean } });
  revalidate();
}

export async function deleteRotation(id: string): Promise<void> {
  // Hard delete is fine here — a rotation holds no logs, only config, and
  // slots/coverage cascade. The user's training history is untouched.
  await prisma.rotation.delete({ where: { id } });
  revalidate();
}

export async function addSlot(rotationId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  const max = await prisma.rotationSlot.aggregate({
    where: { rotationId },
    _max: { position: true },
  });
  await prisma.rotationSlot.create({
    data: { rotationId, name: clean, position: (max._max.position ?? -1) + 1 },
  });
  revalidate();
}

export async function updateSlot(
  slotId: string,
  data: { name?: string; primaryRoutineId?: string | null }
): Promise<void> {
  const patch: { name?: string; primaryRoutineId?: string | null } = {};
  if (typeof data.name === "string" && data.name.trim()) patch.name = data.name.trim();
  if (data.primaryRoutineId !== undefined) patch.primaryRoutineId = data.primaryRoutineId || null;
  if (Object.keys(patch).length === 0) return;
  await prisma.rotationSlot.update({ where: { id: slotId }, data: patch });
  revalidate();
}

export async function deleteSlot(slotId: string): Promise<void> {
  await prisma.rotationSlot.delete({ where: { id: slotId } });
  revalidate();
}

// Move a slot one step toward the start or end by swapping positions with its
// neighbor. Keeps positions contiguous enough for ordering.
export async function moveSlot(slotId: string, direction: "up" | "down"): Promise<void> {
  const slot = await prisma.rotationSlot.findUnique({ where: { id: slotId } });
  if (!slot) return;
  const siblings = await prisma.rotationSlot.findMany({
    where: { rotationId: slot.rotationId },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  const idx = siblings.findIndex((s) => s.id === slotId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;
  const a = siblings[idx];
  const b = siblings[swapIdx];
  await prisma.$transaction([
    prisma.rotationSlot.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.rotationSlot.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);
  revalidate();
}

export async function addCoverage(
  slotId: string,
  ref: { routineId?: string; tag?: string }
): Promise<void> {
  const routineId = ref.routineId?.trim() || null;
  const tag = ref.tag?.trim() || null;
  if ((routineId ? 1 : 0) + (tag ? 1 : 0) !== 1) return; // exactly one
  // Skip duplicates.
  const existing = await prisma.rotationSlotCoverage.findFirst({
    where: { slotId, routineId, tag },
    select: { id: true },
  });
  if (existing) return;
  await prisma.rotationSlotCoverage.create({ data: { slotId, routineId, tag } });
  revalidate();
}

export async function removeCoverage(coverageId: string): Promise<void> {
  await prisma.rotationSlotCoverage.delete({ where: { id: coverageId } });
  revalidate();
}
