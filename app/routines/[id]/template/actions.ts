"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ExerciseUnit = "REPS" | "TIME";

function baseExerciseName(name: string) {
  return name.replace(/\s+\((Reps|Time)\)$/i, "").trim();
}

function metricVariantName(baseName: string, unit: ExerciseUnit) {
  return `${baseName} (${unit === "REPS" ? "Reps" : "Time"})`;
}

async function ensureMetricVariant(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  baseName: string,
  unit: ExerciseUnit,
  supportsWeight: boolean
) {
  const name = metricVariantName(baseName, unit);
  const existing = await tx.exercise.findUnique({
    where: { name },
    select: { id: true },
  });
  if (existing) return existing;

  return tx.exercise.create({
    data: { name, unit, supportsWeight },
    select: { id: true },
  });
}

async function switchRoutineExerciseMetricTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  routineId: string,
  routineExerciseId: string,
  unit: ExerciseUnit
) {
  const row = await tx.routineExercise.findUnique({
    where: { id: routineExerciseId },
    include: { exercise: true },
  });
  if (!row || row.routineId !== routineId) return;

  const baseName = baseExerciseName(row.exercise.name);
  const supportsWeight = row.exercise.supportsWeight;

  const reps = await ensureMetricVariant(tx, baseName, "REPS", supportsWeight);
  const time = await ensureMetricVariant(tx, baseName, "TIME", supportsWeight);
  const targetExerciseId = unit === "REPS" ? reps.id : time.id;

  if (row.exerciseId === targetExerciseId) return;

  const collision = await tx.routineExercise.findUnique({
    where: {
      routineId_exerciseId: {
        routineId,
        exerciseId: targetExerciseId,
      },
    },
    select: { id: true },
  });

  if (collision) {
    await tx.routineExercise.delete({ where: { id: row.id } });
    return;
  }

  await tx.routineExercise.update({
    where: { id: row.id },
    data: { exerciseId: targetExerciseId },
  });
}

async function attachExerciseToRoutine(routineId: string, exerciseId: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.routineExercise.findUnique({
      where: { routineId_exerciseId: { routineId, exerciseId } },
      select: { id: true },
    });

    if (existing) return;

    const max = await tx.routineExercise.aggregate({
      where: { routineId },
      _max: { sortOrder: true },
    });

    const nextOrder = (max._max.sortOrder ?? 0) + 1;

    await tx.routineExercise.create({
      data: {
        routineId,
        exerciseId,
        sortOrder: nextOrder,
        defaultSets: 3,
      },
    });
  });
}

export async function saveRoutineTemplate(formData: FormData) {
  const routineId = String(formData.get("routineId") || "");

  if (!routineId) throw new Error("Missing routineId");

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { id: true, kind: true },
  });

  if (!routine || routine.kind !== "WORKOUT") {
    throw new Error("Routine not found.");
  }

  const metricUpdates: Array<{ routineExerciseId: string; unit: ExerciseUnit }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("metric:")) continue;
    const routineExerciseId = key.slice("metric:".length);
    const unit = String(value || "REPS") as ExerciseUnit;
    if (!routineExerciseId) continue;
    if (!["REPS", "TIME"].includes(unit)) continue;
    metricUpdates.push({ routineExerciseId, unit });
  }

  if (metricUpdates.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const update of metricUpdates) {
        await switchRoutineExerciseMetricTx(tx, routineId, update.routineExerciseId, update.unit);
      }
    });
  }

  revalidatePath(`/routines/${routineId}/template`);
  revalidatePath("/routines");
  revalidatePath("/exercises");
  revalidatePath("/progress");
  redirect("/routines");
}

export async function addExerciseToRoutine(formData: FormData) {
  const routineId = String(formData.get("routineId") || "");
  const mode = String(formData.get("mode") || "existing");

  if (!routineId) throw new Error("Missing routineId");

  if (mode === "new") {
    const name = String(formData.get("customName") || "");
    const unit = String(formData.get("unit") || "REPS") as ExerciseUnit;
    const supportsWeight = String(formData.get("supportsWeight") || "") === "on";

    if (!name.trim()) throw new Error("Exercise name is required.");
    if (!["REPS", "TIME"].includes(unit)) throw new Error("Invalid unit.");

    const rawBase = name.trim().replace(/\s+/g, " ");
    const baseName = baseExerciseName(rawBase);

    const targetExerciseId = await prisma.$transaction(async (tx) => {
      const reps = await ensureMetricVariant(tx, baseName, "REPS", supportsWeight);
      const time = await ensureMetricVariant(tx, baseName, "TIME", supportsWeight);
      return unit === "REPS" ? reps.id : time.id;
    });

    await attachExerciseToRoutine(routineId, targetExerciseId);
  } else {
    const exerciseId = String(formData.get("exerciseId") || "");
    if (!exerciseId) throw new Error("Missing exerciseId");
    await attachExerciseToRoutine(routineId, exerciseId);
  }

  revalidatePath(`/routines/${routineId}/template`);
  revalidatePath("/exercises");
  redirect(`/routines/${routineId}/template`);
}

export async function switchRoutineExerciseMetric(
  formData:
    | FormData
    | {
        routineId: string;
        routineExerciseId: string;
        unit: ExerciseUnit;
      }
) {
  const routineId =
    formData instanceof FormData
      ? String(formData.get("routineId") || "")
      : String(formData.routineId || "");
  const routineExerciseId =
    formData instanceof FormData
      ? String(formData.get("routineExerciseId") || "")
      : String(formData.routineExerciseId || "");
  const unit =
    (formData instanceof FormData
      ? String(formData.get("unit") || "REPS")
      : String(formData.unit || "REPS")) as ExerciseUnit;

  if (!routineId) throw new Error("Missing routineId");
  if (!routineExerciseId) throw new Error("Missing routineExerciseId");
  if (!["REPS", "TIME"].includes(unit)) throw new Error("Invalid unit.");

  await prisma.$transaction(async (tx) => {
    await switchRoutineExerciseMetricTx(tx, routineId, routineExerciseId, unit);
  });

  revalidatePath(`/routines/${routineId}/template`);
  revalidatePath("/exercises");
  revalidatePath("/progress");
  redirect(`/routines/${routineId}/template`);
}

export async function removeRoutineExercise(formData: FormData) {
  const routineId = String(formData.get("routineId") || "");
  const routineExerciseId = String(formData.get("routineExerciseId") || "");

  if (!routineId) throw new Error("Missing routineId");
  if (!routineExerciseId) throw new Error("Missing routineExerciseId");

  await prisma.routineExercise.delete({ where: { id: routineExerciseId } });

  revalidatePath(`/routines/${routineId}/template`);
  redirect(`/routines/${routineId}/template`);
}

export async function setDefaultSets(formData: FormData) {
  const routineId = String(formData.get("routineId") || "");
  const routineExerciseId = String(formData.get("routineExerciseId") || "");
  const raw = String(formData.get("defaultSets") || "").trim();
  const defaultSets = Number(raw);

  if (!routineId) throw new Error("Missing routineId");
  if (!routineExerciseId) throw new Error("Missing routineExerciseId");
  if (!Number.isFinite(defaultSets) || defaultSets < 1 || defaultSets > 20) {
    throw new Error("defaultSets must be between 1 and 20");
  }

  await prisma.routineExercise.update({
    where: { id: routineExerciseId },
    data: { defaultSets },
  });

  revalidatePath(`/routines/${routineId}/template`);
  redirect(`/routines/${routineId}/template`);
}

export async function moveRoutineExercise(formData: FormData) {
  const routineId = String(formData.get("routineId") || "");
  const routineExerciseId = String(formData.get("routineExerciseId") || "");
  const dir = String(formData.get("dir") || "up");

  if (!routineId) throw new Error("Missing routineId");
  if (!routineExerciseId) throw new Error("Missing routineExerciseId");

  const list = await prisma.routineExercise.findMany({
    where: { routineId },
    orderBy: [{ sortOrder: "asc" }],
    select: { id: true, sortOrder: true },
  });

  const idx = list.findIndex((x) => x.id === routineExerciseId);
  if (idx === -1) {
    revalidatePath(`/routines/${routineId}/template`);
    redirect(`/routines/${routineId}/template`);
  }

  const swapWith = dir === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= list.length) {
    revalidatePath(`/routines/${routineId}/template`);
    redirect(`/routines/${routineId}/template`);
  }

  const a = list[idx];
  const b = list[swapWith];

  await prisma.$transaction([
    prisma.routineExercise.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.routineExercise.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidatePath(`/routines/${routineId}/template`);
  redirect(`/routines/${routineId}/template`);
}
