"use server";

import { deriveExerciseLibraryKind, isMissingExerciseLibraryKindError } from "@/lib/exercise-library";
import { inferExerciseMetadataSlugs } from "@/lib/metadata";
import { prisma } from "@/lib/prisma";
import type { LoadUnit } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ExerciseUnit = "REPS" | "TIME";

const LOAD_UNITS: LoadUnit[] = ["LB", "KG", "PCT_1RM", "RPE", "STACK", "BODYWEIGHT"];

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

  try {
    return await tx.exercise.create({
      data: {
        name,
        unit,
        supportsWeight,
        libraryKind: deriveExerciseLibraryKind({
          name,
          unit,
          metadataSlugs: inferExerciseMetadataSlugs(name),
        }),
      },
      select: { id: true },
    });
  } catch (error) {
    if (!isMissingExerciseLibraryKindError(error)) throw error;
    return tx.exercise.create({
      data: { name, unit, supportsWeight },
      select: { id: true },
    });
  }
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
  revalidatePath("/log");
  revalidatePath("/exercises");
  revalidatePath("/progress");
  redirect("/log");
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

export async function updateDefaultSetsQuiet(routineId: string, routineExerciseId: string, defaultSets: number) {
  if (!Number.isFinite(defaultSets) || defaultSets < 1 || defaultSets > 20) return;
  await prisma.routineExercise.update({
    where: { id: routineExerciseId },
    data: { defaultSets },
  });
  revalidatePath(`/routines/${routineId}/template`);
}

// Empty string must not coerce to 0 — restSec allows 0, so Number("") === 0
// would silently store a real "0s rest" target for a field left blank.
function isBlank(value: unknown) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function clampInt(value: unknown, min: number, max: number): number | null {
  if (isBlank(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return null;
  return rounded;
}

function clampFloat(value: unknown, min: number, max: number): number | null {
  if (isBlank(value)) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function clampText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export async function updatePrescriptionQuiet(
  routineId: string,
  routineExerciseId: string,
  input: {
    sets?: unknown;
    repsMin?: unknown;
    repsMax?: unknown;
    seconds?: unknown;
    load?: unknown;
    loadUnit?: unknown;
    tempo?: unknown;
    restSec?: unknown;
    cue?: unknown;
  }
) {
  const owner = await prisma.routineExercise.findUnique({
    where: { id: routineExerciseId },
    select: { routineId: true },
  });
  if (!owner || owner.routineId !== routineId) return;

  let repsMin = clampInt(input.repsMin, 1, 999);
  let repsMax = clampInt(input.repsMax, 1, 999);
  if (repsMin != null && repsMax != null && repsMin > repsMax) {
    [repsMin, repsMax] = [repsMax, repsMin];
  }

  const data = {
    sets: clampInt(input.sets, 1, 20),
    repsMin,
    repsMax,
    seconds: clampInt(input.seconds, 1, 86_400),
    load: clampFloat(input.load, 0, 10_000),
    loadUnit: LOAD_UNITS.includes(input.loadUnit as LoadUnit) ? (input.loadUnit as LoadUnit) : "LB",
    tempo: clampText(input.tempo, 40),
    restSec: clampInt(input.restSec, 0, 3_600),
    cue: clampText(input.cue, 500),
  };

  const isEmpty =
    data.sets == null &&
    data.repsMin == null &&
    data.repsMax == null &&
    data.seconds == null &&
    data.load == null &&
    data.tempo == null &&
    data.restSec == null &&
    data.cue == null;

  if (isEmpty) {
    await prisma.prescription.deleteMany({ where: { routineExerciseId } });
  } else {
    await prisma.prescription.upsert({
      where: { routineExerciseId },
      create: { routineExerciseId, ...data },
      update: data,
    });
  }

  revalidatePath(`/routines/${routineId}/template`);
  revalidatePath(`/routines/${routineId}/log`);
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
