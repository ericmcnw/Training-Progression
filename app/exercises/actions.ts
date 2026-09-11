"use server";

import {
  deriveExerciseLibraryKind,
  isMissingExerciseLibraryKindError,
  withDerivedExerciseLibraryKind,
} from "@/lib/exercise-library";
import { exerciseUnitLabel, findExerciseNameMatch, normalizeExerciseName } from "@/lib/exercises";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ExerciseUnit = "REPS" | "TIME";
type ExerciseLibraryKind = "STRENGTH" | "CONDITIONING" | "MOBILITY" | "STRETCH" | "BREATHWORK" | "SKILL";

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
  const selectedLibraryKind = String(formData.get("libraryKind") || "").trim() as ExerciseLibraryKind;

  if (!name) throw new Error("Exercise name is required.");
  if (!["REPS", "TIME"].includes(unit)) throw new Error("Invalid unit.");

  const selectedGroups = await prisma.metadataGroup.findMany({
    where: { id: { in: metadataGroupIds } },
    select: { slug: true },
  });
  const libraryKind = selectedLibraryKind || deriveExerciseLibraryKind({
    name,
    unit,
    metadataSlugs: selectedGroups.map((group) => group.slug),
  });

  const existing = await (async () => {
    try {
      return await prisma.exercise.findMany({
        select: { id: true, name: true, unit: true, supportsWeight: true, libraryKind: true },
      });
    } catch (error) {
      if (!isMissingExerciseLibraryKindError(error)) throw error;
      return withDerivedExerciseLibraryKind(
        await prisma.exercise.findMany({
          select: { id: true, name: true, unit: true, supportsWeight: true },
        })
      );
    }
  })();
  const match = findExerciseNameMatch(existing, name);

  if (match) {
    if (match.unit !== unit) {
      throw new Error(
        `"${match.name}" already exists as a ${exerciseUnitLabel(match.unit).toLowerCase()} exercise. Edit that exercise instead of creating a duplicate.`
      );
    }
    if (supportsWeight && !match.supportsWeight) {
      try {
        await prisma.exercise.update({
          where: { id: match.id },
          data: { supportsWeight: true, libraryKind },
        });
      } catch (error) {
        if (!isMissingExerciseLibraryKindError(error)) throw error;
        await prisma.exercise.update({
          where: { id: match.id },
          data: { supportsWeight: true },
        });
      }
    } else if (match.libraryKind !== libraryKind) {
      try {
        await prisma.exercise.update({
          where: { id: match.id },
          data: { libraryKind },
        });
      } catch (error) {
        if (!isMissingExerciseLibraryKindError(error)) throw error;
      }
    }
    await syncExerciseMetadataGroups(match.id, metadataGroupIds);
  } else {
    const created = await (async () => {
      try {
        return await prisma.exercise.create({
          data: { name: normalizeExerciseName(name), unit, supportsWeight, libraryKind },
          select: { id: true },
        });
      } catch (error) {
        if (!isMissingExerciseLibraryKindError(error)) throw error;
        return prisma.exercise.create({
          data: { name: normalizeExerciseName(name), unit, supportsWeight },
          select: { id: true },
        });
      }
    })();
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
  const selectedLibraryKind = String(formData.get("libraryKind") || "").trim() as ExerciseLibraryKind;

  if (!id) throw new Error("Missing exercise id.");
  if (!name) throw new Error("Exercise name is required.");
  if (!["REPS", "TIME"].includes(unit)) throw new Error("Invalid unit.");

  const duplicates = await prisma.exercise.findMany({
    where: { NOT: { id } },
    select: { id: true, name: true, unit: true },
  });
  const match = findExerciseNameMatch(duplicates, name);
  if (match) {
    if (match.unit !== unit) {
      throw new Error(
        `"${match.name}" already exists as a ${exerciseUnitLabel(match.unit).toLowerCase()} exercise. Rename this one or edit the existing exercise instead.`
      );
    }
    throw new Error("An exercise with that name already exists.");
  }

  const selectedGroups = await prisma.metadataGroup.findMany({
    where: { id: { in: metadataGroupIds } },
    select: { slug: true },
  });
  const libraryKind = selectedLibraryKind || deriveExerciseLibraryKind({
    name,
    unit,
    metadataSlugs: selectedGroups.map((group) => group.slug),
  });

  try {
    await prisma.exercise.update({
      where: { id },
      data: {
        name: normalizeExerciseName(name),
        unit,
        supportsWeight,
        libraryKind,
      },
    });
  } catch (error) {
    if (!isMissingExerciseLibraryKindError(error)) throw error;
    await prisma.exercise.update({
      where: { id },
      data: {
        name: normalizeExerciseName(name),
        unit,
        supportsWeight,
      },
    });
  }
  await syncExerciseMetadataGroups(id, metadataGroupIds);

  revalidatePath("/exercises");
  redirect("/exercises");
}

// Create-and-return, for inline pickers that cannot navigate away to the full
// form. Shares this file's name matching, normalization, and library-kind
// derivation, so an inline create can never quietly fork an exercise that
// already exists under a slightly different spelling — it returns the match.
export async function createExerciseInline(input: {
  name: string;
  unit: ExerciseUnit;
  supportsWeight: boolean;
}): Promise<{ id: string; name: string; created: boolean }> {
  const name = normalizeExerciseName(input.name);
  if (!name) throw new Error("Exercise name is required.");
  if (!["REPS", "TIME"].includes(input.unit)) throw new Error("Invalid unit.");

  const existing = await prisma.exercise.findMany({ select: { id: true, name: true } });
  const match = findExerciseNameMatch(existing, name);
  if (match) return { id: match.id, name: match.name, created: false };

  const libraryKind = deriveExerciseLibraryKind({ name, unit: input.unit, metadataSlugs: [] });
  const created = await prisma.exercise.create({
    data: { name, unit: input.unit, supportsWeight: input.supportsWeight, libraryKind },
    select: { id: true, name: true },
  });

  revalidatePath("/exercises");
  return { id: created.id, name: created.name, created: true };
}
