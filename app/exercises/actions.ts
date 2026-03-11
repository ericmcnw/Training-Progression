"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ExerciseUnit = "REPS" | "TIME";

function normalizeExerciseName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function createExercise(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "REPS") as ExerciseUnit;
  const supportsWeight = String(formData.get("supportsWeight") || "") === "on";

  if (!name) throw new Error("Exercise name is required.");
  if (!["REPS", "TIME"].includes(unit)) throw new Error("Invalid unit.");

  const normalized = normalizeExerciseName(name);
  const existing = await prisma.exercise.findMany({
    select: { id: true, name: true },
  });
  const match = existing.find((exercise) => normalizeExerciseName(exercise.name) === normalized);

  if (!match) {
    await prisma.exercise.create({
      data: { name: name.replace(/\s+/g, " "), unit, supportsWeight },
    });
  }

  revalidatePath("/exercises");
  redirect("/exercises");
}
