"use server";

// Tag / untag exercises as climbing training, straight from the hub's
// "what counts" panel. Routine-level tags are edited on the routine's
// own edit page (SupportsSportsField) — these actions only handle the
// exercise side of the hybrid match.

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditExercise } from "@/lib/profile-scope";

const SHARED_EXERCISE_ERROR = "That exercise is part of the shared library, so it can't be tagged.";

export async function tagExerciseForClimbing(input: { exerciseName: string }) {
  const name = input.exerciseName.trim();
  if (!name) throw new Error("Pick an exercise first.");
  const exercise = await prisma.exercise.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, supportsSports: true, profileKey: true },
  });
  if (!exercise) throw new Error(`No exercise named "${name}" in the library.`);
  if (!canEditExercise(exercise.profileKey, (await getAppSession()).profileKey)) throw new Error(SHARED_EXERCISE_ERROR);
  if (!exercise.supportsSports.includes("climbing")) {
    await prisma.exercise.update({
      where: { id: exercise.id },
      data: { supportsSports: { push: "climbing" } },
    });
  }
  revalidatePath("/activities/climbing");
}

export async function untagExerciseForClimbing(input: { exerciseId: string }) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: input.exerciseId },
    select: { id: true, supportsSports: true, profileKey: true },
  });
  if (!exercise) return;
  if (!canEditExercise(exercise.profileKey, (await getAppSession()).profileKey)) throw new Error(SHARED_EXERCISE_ERROR);
  await prisma.exercise.update({
    where: { id: exercise.id },
    data: { supportsSports: exercise.supportsSports.filter((s) => s !== "climbing") },
  });
  revalidatePath("/activities/climbing");
}
