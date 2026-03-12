"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ExerciseUnit = "REPS" | "TIME";

function normalizeExerciseName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

async function getValidExerciseMetadataGroupIds(groupIds: Iterable<string>) {
  const uniqueIds = Array.from(
    new Set(
      Array.from(groupIds)
        .map((value) => String(value || "").trim())
        .filter((value) => value.length > 0)
    )
  );
  if (uniqueIds.length === 0) return [];

  const groups = await prisma.metadataGroup.findMany({
    where: {
      id: { in: uniqueIds },
      appliesToExercise: true,
    },
    select: { id: true },
  });
  return groups.map((group) => group.id);
}

async function syncExerciseMetadataGroups(exerciseId: string, groupIds: string[]) {
  const current = await prisma.exerciseMetadataGroup.findMany({
    where: { exerciseId },
    select: { groupId: true },
  });
  const currentIds = new Set(current.map((entry) => entry.groupId));
  const nextIds = new Set(groupIds);

  await prisma.exerciseMetadataGroup.deleteMany({
    where: {
      exerciseId,
      groupId: { notIn: groupIds.length > 0 ? groupIds : ["__none__"] },
    },
  });

  for (const groupId of nextIds) {
    if (currentIds.has(groupId)) continue;
    await prisma.exerciseMetadataGroup.create({ data: { exerciseId, groupId } });
  }
}

export async function createExercise(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "REPS") as ExerciseUnit;
  const supportsWeight = String(formData.get("supportsWeight") || "") === "on";
  const metadataGroupIds = await getValidExerciseMetadataGroupIds(formData.getAll("metadataGroupIds").map(String));

  if (!name) throw new Error("Exercise name is required.");
  if (!["REPS", "TIME"].includes(unit)) throw new Error("Invalid unit.");

  const normalized = normalizeExerciseName(name);
  const existing = await prisma.exercise.findMany({
    select: { id: true, name: true },
  });
  const match = existing.find((exercise) => normalizeExerciseName(exercise.name) === normalized);

  if (!match) {
    const created = await prisma.exercise.create({
      data: { name: name.replace(/\s+/g, " "), unit, supportsWeight },
      select: { id: true },
    });
    await syncExerciseMetadataGroups(created.id, metadataGroupIds);
  }

  revalidatePath("/exercises");
  redirect("/exercises");
}

export async function updateExercise(formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "REPS") as ExerciseUnit;
  const supportsWeight = String(formData.get("supportsWeight") || "") === "on";
  const metadataGroupIds = await getValidExerciseMetadataGroupIds(formData.getAll("metadataGroupIds").map(String));

  if (!id) throw new Error("Missing exercise id.");
  if (!name) throw new Error("Exercise name is required.");
  if (!["REPS", "TIME"].includes(unit)) throw new Error("Invalid unit.");

  const normalized = normalizeExerciseName(name);
  const duplicates = await prisma.exercise.findMany({
    where: { NOT: { id } },
    select: { id: true, name: true },
  });
  const match = duplicates.find((exercise) => normalizeExerciseName(exercise.name) === normalized);
  if (match) throw new Error("An exercise with that name already exists.");

  await prisma.exercise.update({
    where: { id },
    data: {
      name: name.replace(/\s+/g, " "),
      unit,
      supportsWeight,
    },
  });
  await syncExerciseMetadataGroups(id, metadataGroupIds);

  revalidatePath("/exercises");
  redirect("/exercises");
}
