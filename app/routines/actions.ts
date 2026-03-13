"use server";

import { parseTagNames } from "@/lib/metadata";
import { parseAppDateTimeLocal } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  normalizeRoutineKind,
  normalizeRoutineSubtype,
} from "@/lib/routines";
import type { RoutineKind } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type WorkoutExerciseInput = {
  customName?: string;
  unit?: "REPS" | "TIME";
  supportsWeight?: boolean;
  exerciseId: string;
  sets: {
    setNumber: number;
    reps?: number | null;
    seconds?: number | null;
    weightLb?: number | null;
  }[];
};

type GuidedStepInput = {
  guidedStepId?: string | null;
  title: string;
  durationSec?: number | null;
  restSec?: number | null;
  sortOrder: number;
};

type MetricInput = {
  name: string;
  value: number;
  unit?: string | null;
};

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type SanitizedWorkoutExercise = {
  exerciseId: string;
  sortOrder: number;
  defaultSets: number;
  loggedSets: {
    setNumber: number;
    reps: number | null;
    seconds: number | null;
    weightLb: number | null;
  }[];
};

function parsePerformedAt(performedAtLocal?: string | null) {
  const raw = String(performedAtLocal || "").trim();
  if (!raw) return new Date();
  return parseAppDateTimeLocal(raw);
}

function parseCategory(formData: FormData) {
  const categoryRaw = String(formData.get("category") || "").trim();
  const categoryPreset = String(formData.get("categoryPreset") || "").trim();
  if (categoryPreset === "__custom__" && !categoryRaw) {
    throw new Error("Custom category is required.");
  }
  return categoryRaw || (categoryPreset && categoryPreset !== "__custom__" ? categoryPreset : "General");
}

function parseTimesPerWeek(formData: FormData) {
  const timesRaw = String(formData.get("timesPerWeek") || "").trim();
  const timesPerWeek = timesRaw ? Number(timesRaw) : null;
  if (timesPerWeek !== null && (!Number.isFinite(timesPerWeek) || timesPerWeek < 0)) {
    throw new Error("timesPerWeek must be a number >= 0");
  }
  return timesPerWeek;
}

async function getValidMetadataGroupIds(groupIds: Iterable<string>, appliesTo: "routine" | "exercise") {
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
      ...(appliesTo === "routine" ? { appliesToRoutine: true } : { appliesToExercise: true }),
    },
    select: { id: true },
  });
  return groups.map((group) => group.id);
}

async function syncRoutineMetadataGroups(routineId: string, groupIds: string[]) {
  const current = await prisma.routineMetadataGroup.findMany({
    where: { routineId },
    select: { groupId: true },
  });
  const currentIds = new Set(current.map((entry) => entry.groupId));
  const nextIds = new Set(groupIds);

  await prisma.routineMetadataGroup.deleteMany({
    where: {
      routineId,
      groupId: { notIn: groupIds.length > 0 ? groupIds : ["__none__"] },
    },
  });

  for (const groupId of nextIds) {
    if (currentIds.has(groupId)) continue;
    await prisma.routineMetadataGroup.create({ data: { routineId, groupId } });
  }
}

async function syncRoutineTags(routineId: string, tagNames: string[]) {
  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.routineTag.upsert({
        where: { name },
        update: {},
        create: { name },
        select: { id: true, name: true },
      })
    )
  );

  const tagIds = tags.map((tag) => tag.id);
  const current = await prisma.routineTagAssignment.findMany({
    where: { routineId },
    select: { tagId: true },
  });
  const currentIds = new Set(current.map((entry) => entry.tagId));

  await prisma.routineTagAssignment.deleteMany({
    where: {
      routineId,
      tagId: { notIn: tagIds.length > 0 ? tagIds : ["__none__"] },
    },
  });

  for (const tagId of tagIds) {
    if (currentIds.has(tagId)) continue;
    await prisma.routineTagAssignment.create({ data: { routineId, tagId } });
  }
}

async function syncRoutineClassificationMetadata(params: {
  routineId: string;
  selectedGroupIds: string[];
  tags: string[];
}) {
  await syncRoutineMetadataGroups(params.routineId, params.selectedGroupIds);
  await syncRoutineTags(params.routineId, params.tags);
}

function sanitizeMetrics(metrics?: MetricInput[]) {
  return (metrics ?? [])
    .map((metric, index) => ({
      name: metric.name.trim(),
      value: metric.value,
      unit: metric.unit?.trim() || null,
      sortOrder: index,
    }))
    .filter((metric) => metric.name && Number.isFinite(metric.value));
}

function sanitizeGuidedSteps(steps?: GuidedStepInput[]) {
  return (steps ?? [])
    .map((step, index) => ({
      guidedStepId: step.guidedStepId || null,
      title: step.title.trim(),
      durationSec: step.durationSec ?? null,
      restSec: step.restSec ?? null,
      sortOrder: Number.isFinite(step.sortOrder) ? step.sortOrder : index,
    }))
    .filter((step) => step.title.length > 0);
}

function hasWorkoutSetValue(set: { reps?: number | null; seconds?: number | null; weightLb?: number | null }) {
  return set.reps !== null && set.reps !== undefined
    || set.seconds !== null && set.seconds !== undefined
    || set.weightLb !== null && set.weightLb !== undefined;
}

function normalizeExerciseName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

async function ensureExerciseExists(
  tx: PrismaTx,
  params: Pick<WorkoutExerciseInput, "exerciseId" | "customName" | "unit" | "supportsWeight">
) {
  if (params.exerciseId) {
    const existing = await tx.exercise.findUnique({
      where: { id: params.exerciseId },
      select: { id: true },
    });
    if (!existing) throw new Error("Exercise not found.");
    return existing.id;
  }

  const name = normalizeExerciseName(params.customName || "");
  const unit = params.unit === "TIME" ? "TIME" : "REPS";
  if (!name) throw new Error("Exercise name is required.");

  const existing = await tx.exercise.findFirst({
    where: { name, unit },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.exercise.create({
    data: {
      name,
      unit,
      supportsWeight: Boolean(params.supportsWeight),
    },
    select: { id: true },
  });
  return created.id;
}

async function sanitizeWorkoutExercises(tx: PrismaTx, exercises: WorkoutExerciseInput[]) {
  const sanitized: SanitizedWorkoutExercise[] = [];
  const seenExerciseIds = new Set<string>();

  for (const [index, exercise] of (exercises ?? []).entries()) {
    const exerciseId = await ensureExerciseExists(tx, exercise);
    if (seenExerciseIds.has(exerciseId)) continue;
    seenExerciseIds.add(exerciseId);

    const allRows = (exercise.sets ?? []).map((set, rowIndex) => ({
      setNumber: Number.isFinite(set.setNumber) && set.setNumber > 0 ? Math.floor(set.setNumber) : rowIndex + 1,
      reps: set.reps ?? null,
      seconds: set.seconds ?? null,
      weightLb: set.weightLb ?? null,
    }));

    const loggedSets = allRows
      .filter((set) => hasWorkoutSetValue(set))
      .map((set, rowIndex) => ({
        setNumber: rowIndex + 1,
        reps: set.reps,
        seconds: set.seconds,
        weightLb: set.weightLb,
      }));

    sanitized.push({
      exerciseId,
      sortOrder: index,
      defaultSets: Math.max(1, allRows.length || 1),
      loggedSets,
    });
  }

  return sanitized;
}

async function syncWorkoutTemplateTx(tx: PrismaTx, routineId: string, exercises: SanitizedWorkoutExercise[]) {
  const existing = await tx.routineExercise.findMany({
    where: { routineId },
    select: { id: true, exerciseId: true },
  });

  const desiredIds = exercises.map((exercise) => exercise.exerciseId);

  if (desiredIds.length === 0) {
    await tx.routineExercise.deleteMany({ where: { routineId } });
    return;
  }

  await tx.routineExercise.deleteMany({
    where: {
      routineId,
      exerciseId: { notIn: desiredIds },
    },
  });

  for (const exercise of exercises) {
    const current = existing.find((item) => item.exerciseId === exercise.exerciseId);
    const data = {
      sortOrder: exercise.sortOrder,
      defaultSets: exercise.defaultSets,
    };

    if (current) {
      await tx.routineExercise.update({
        where: { id: current.id },
        data,
      });
      continue;
    }

    await tx.routineExercise.create({
      data: {
        routineId,
        exerciseId: exercise.exerciseId,
        ...data,
      },
    });
  }
}

async function ensureRoutineKind(routineId: string, expectedKind: RoutineKind) {
  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { id: true, kind: true, isDeleted: true },
  });
  if (!routine) throw new Error("Routine not found.");
  if (routine.isDeleted) throw new Error("Routine is deleted.");
  if (normalizeRoutineKind(routine.kind) !== expectedKind) {
    throw new Error(`This routine is not a ${expectedKind.toLowerCase()} routine.`);
  }
  return routine;
}

async function syncRoutineTypeDetails(routineId: string, kind: RoutineKind) {
  if (kind === "CARDIO") {
    await prisma.cardioRoutineDetails.upsert({
      where: { routineId },
      update: {},
      create: { routineId },
    });
  }
  if (kind !== "CARDIO") {
    await prisma.cardioRoutineDetails.deleteMany({ where: { routineId } });
  }

  if (kind === "SESSION") {
    await prisma.sessionRoutineDetails.upsert({
      where: { routineId },
      update: {},
      create: { routineId },
    });
  }
  if (kind !== "SESSION") {
    await prisma.sessionRoutineDetails.deleteMany({ where: { routineId } });
  }
}

function revalidateRoutineSurfaces(routineId?: string) {
  revalidatePath("/");
  revalidatePath("/manual-log");
  revalidatePath("/routines");
  revalidatePath("/progress");
  revalidatePath("/goals");
  revalidatePath("/schedule");
  if (routineId) {
    revalidatePath(`/routines/${routineId}/log`);
    revalidatePath(`/routines/${routineId}/log-cardio`);
    revalidatePath(`/routines/${routineId}/log-guided`);
    revalidatePath(`/routines/${routineId}/log-session`);
    revalidatePath(`/routines/${routineId}/template`);
    revalidatePath(`/progress/routines/${routineId}`);
  }
}

export async function createRoutine(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const category = parseCategory(formData);
  const domain = String(formData.get("domain") || "general").trim() || "general";
  const kind = normalizeRoutineKind(String(formData.get("kind") || "COMPLETION"));
  const subtype = normalizeRoutineSubtype(kind, String(formData.get("subtype") || ""));
  const timesPerWeek = parseTimesPerWeek(formData);
  const postCreate = String(formData.get("postCreate") || "").trim();
  const selectedGroupIds = await getValidMetadataGroupIds(formData.getAll("metadataGroupIds").map(String), "routine");
  const tagNames = parseTagNames(String(formData.get("tags") || ""));

  if (!name) throw new Error("Name is required.");

  const created = await prisma.routine.create({
    data: {
      name,
      category,
      domain,
      kind,
      subtype,
      timesPerWeek,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
    },
    select: { id: true },
  });

  await syncRoutineTypeDetails(created.id, kind);
  await syncRoutineClassificationMetadata({
    routineId: created.id,
    selectedGroupIds,
    tags: tagNames,
  });

  revalidateRoutineSurfaces(created.id);
  if (kind === "WORKOUT" && postCreate === "template") {
    redirect(`/routines/${created.id}/template`);
  }
  if (kind === "GUIDED" && postCreate === "template") {
    redirect(`/routines/${created.id}/edit`);
  }
  redirect("/routines");
}

export async function updateRoutine(formData: FormData) {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const category = parseCategory(formData);
  const domain = String(formData.get("domain") || "general").trim() || "general";
  const kind = normalizeRoutineKind(String(formData.get("kind") || "COMPLETION"));
  const subtype = normalizeRoutineSubtype(kind, String(formData.get("subtype") || ""));
  const timesPerWeek = parseTimesPerWeek(formData);
  const selectedGroupIds = await getValidMetadataGroupIds(formData.getAll("metadataGroupIds").map(String), "routine");
  const tagNames = parseTagNames(String(formData.get("tags") || ""));

  if (!id) throw new Error("Missing routine id.");
  if (!name) throw new Error("Name is required.");

  const existing = await prisma.routine.findUnique({
    where: { id },
    select: { isDeleted: true },
  });
  if (!existing) throw new Error("Routine not found.");
  if (existing.isDeleted) {
    revalidateRoutineSurfaces();
    redirect("/routines");
  }

  await prisma.routine.update({
    where: { id },
    data: { name, category, domain, kind, subtype, timesPerWeek },
  });
  await syncRoutineTypeDetails(id, kind);
  await syncRoutineClassificationMetadata({
    routineId: id,
    selectedGroupIds,
    tags: tagNames,
  });

  revalidateRoutineSurfaces(id);
  redirect("/routines");
}

export async function toggleArchiveRoutine(id: string) {
  if (!id) throw new Error("Missing routine id.");

  const routine = await prisma.routine.findUnique({
    where: { id },
    select: { isActive: true, isDeleted: true },
  });
  if (!routine) throw new Error("Routine not found.");
  if (routine.isDeleted) {
    revalidateRoutineSurfaces();
    redirect("/routines");
  }

  await prisma.routine.update({
    where: { id },
    data: { isActive: !routine.isActive },
  });

  revalidateRoutineSurfaces(id);
  redirect("/routines");
}

export async function deleteRoutine(id: string) {
  if (!id) throw new Error("Missing routine id.");

  await prisma.routine.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false,
    },
  });

  revalidateRoutineSurfaces(id);
  redirect("/routines");
}

export async function createCompletionLog(params: {
  routineId: string;
  notes?: string;
  completionCount?: number | null;
  performedAtLocal?: string;
}) {
  await ensureRoutineKind(params.routineId, "COMPLETION");
  const completionCount =
    params.completionCount === null || params.completionCount === undefined || params.completionCount === 0
      ? null
      : Math.max(1, Math.floor(params.completionCount));

  await prisma.routineLog.create({
    data: {
      routineId: params.routineId,
      performedAt: parsePerformedAt(params.performedAtLocal),
      notes: params.notes?.trim() || null,
      completionCount,
    },
  });
  revalidateRoutineSurfaces(params.routineId);
}

export async function logRoutineCompletion(routineId: string, performedAtLocal?: string) {
  await createCompletionLog({ routineId, performedAtLocal });
}

export async function removeLastRoutineCompletion(routineId: string) {
  if (!routineId) throw new Error("Missing routine id.");
  await ensureRoutineKind(routineId, "COMPLETION");

  const latestCompletion = await prisma.routineLog.findFirst({
    where: {
      routineId,
      exercises: { none: {} },
      guidedSteps: { none: {} },
      metrics: { none: {} },
      distanceMi: null,
      durationSec: null,
      location: null,
    },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  if (!latestCompletion) return;
  await prisma.routineLog.delete({ where: { id: latestCompletion.id } });
  revalidateRoutineSurfaces(routineId);
}

export async function logWorkout(params: {
  routineId: string;
  notes?: string;
  performedAtLocal?: string;
  exercises: WorkoutExerciseInput[];
}) {
  await ensureRoutineKind(params.routineId, "WORKOUT");
  await prisma.$transaction(async (tx) => {
    const exercises = await sanitizeWorkoutExercises(tx, params.exercises);
    await syncWorkoutTemplateTx(tx, params.routineId, exercises);

    const loggedExercises = exercises.filter((exercise) => exercise.loggedSets.length > 0);
    if (loggedExercises.length === 0) return;

    const log = await tx.routineLog.create({
      data: {
        routineId: params.routineId,
        performedAt: parsePerformedAt(params.performedAtLocal),
        notes: params.notes?.trim() || null,
      },
      select: { id: true },
    });

    for (const exercise of loggedExercises) {
      const sessionExercise = await tx.sessionExercise.create({
        data: { routineLogId: log.id, exerciseId: exercise.exerciseId },
        select: { id: true },
      });

      await tx.setEntry.createMany({
        data: exercise.loggedSets.map((set) => ({
          sessionExerciseId: sessionExercise.id,
          setNumber: set.setNumber,
          reps: set.reps,
          seconds: set.seconds,
          weightLb: set.weightLb,
        })),
      });
    }
  });

  revalidateRoutineSurfaces(params.routineId);
}

export async function createWorkoutExerciseOption(params: {
  routineId: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight?: boolean;
}) {
  await ensureRoutineKind(params.routineId, "WORKOUT");

  const name = normalizeExerciseName(params.name || "");
  const unit = params.unit === "TIME" ? "TIME" : "REPS";
  if (!name) throw new Error("Exercise name is required.");

  const exercise = await prisma.$transaction(async (tx) => {
    const exerciseId = await ensureExerciseExists(tx, {
      exerciseId: "",
      customName: name,
      unit,
      supportsWeight: Boolean(params.supportsWeight),
    });

    const existing = await tx.routineExercise.findUnique({
      where: {
        routineId_exerciseId: {
          routineId: params.routineId,
          exerciseId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      const max = await tx.routineExercise.aggregate({
        where: { routineId: params.routineId },
        _max: { sortOrder: true },
      });

      await tx.routineExercise.create({
        data: {
          routineId: params.routineId,
          exerciseId,
          sortOrder: (max._max.sortOrder ?? 0) + 1,
          defaultSets: 3,
        },
      });
    }

    return tx.exercise.findUniqueOrThrow({
      where: { id: exerciseId },
      select: {
        id: true,
        name: true,
        unit: true,
        supportsWeight: true,
      },
    });
  });

  revalidateRoutineSurfaces(params.routineId);
  revalidatePath("/exercises");

  return exercise;
}

export async function logCardio(params: {
  routineId: string;
  distanceMi: number;
  durationSec: number;
  notes?: string;
  performedAtLocal?: string;
  metrics?: MetricInput[];
}) {
  await ensureRoutineKind(params.routineId, "CARDIO");
  if (!Number.isFinite(params.distanceMi) || params.distanceMi <= 0) {
    throw new Error("Distance must be > 0.");
  }
  if (!Number.isFinite(params.durationSec) || params.durationSec <= 0) {
    throw new Error("Duration must be > 0.");
  }

  const log = await prisma.routineLog.create({
    data: {
      routineId: params.routineId,
      performedAt: parsePerformedAt(params.performedAtLocal),
      distanceMi: params.distanceMi,
      durationSec: params.durationSec,
      notes: params.notes?.trim() || null,
    },
    select: { id: true },
  });

  const metrics = sanitizeMetrics(params.metrics);
  if (metrics.length > 0) {
    await prisma.routineLogMetric.createMany({
      data: metrics.map((metric) => ({ ...metric, routineLogId: log.id })),
    });
  }

  revalidateRoutineSurfaces(params.routineId);
}

export async function logRun(params: {
  routineId: string;
  distanceMi: number;
  durationSec: number;
  notes?: string;
  performedAtLocal?: string;
}) {
  await logCardio(params);
}

export async function logGuided(params: {
  routineId: string;
  durationSec?: number | null;
  notes?: string;
  performedAtLocal?: string;
  steps?: GuidedStepInput[];
}) {
  await ensureRoutineKind(params.routineId, "GUIDED");
  const steps = sanitizeGuidedSteps(params.steps);
  const fallbackDuration = steps.reduce((sum, step) => sum + (step.durationSec ?? 0) + (step.restSec ?? 0), 0);
  const durationSec = params.durationSec ?? (fallbackDuration > 0 ? fallbackDuration : null);

  const log = await prisma.routineLog.create({
    data: {
      routineId: params.routineId,
      performedAt: parsePerformedAt(params.performedAtLocal),
      durationSec,
      notes: params.notes?.trim() || null,
    },
    select: { id: true },
  });

  if (steps.length > 0) {
    await prisma.guidedStepLog.createMany({
      data: steps.map((step) => ({
        routineLogId: log.id,
        guidedStepId: step.guidedStepId,
        title: step.title,
        durationSec: step.durationSec,
        restSec: step.restSec,
        sortOrder: step.sortOrder,
      })),
    });
  }

  revalidateRoutineSurfaces(params.routineId);
}

export async function logSession(params: {
  routineId: string;
  durationSec: number;
  location?: string;
  notes?: string;
  performedAtLocal?: string;
  metrics?: MetricInput[];
}) {
  await ensureRoutineKind(params.routineId, "SESSION");
  if (!Number.isFinite(params.durationSec) || params.durationSec <= 0) {
    throw new Error("Duration must be > 0.");
  }

  const log = await prisma.routineLog.create({
    data: {
      routineId: params.routineId,
      performedAt: parsePerformedAt(params.performedAtLocal),
      durationSec: params.durationSec,
      location: params.location?.trim() || null,
      notes: params.notes?.trim() || null,
    },
    select: { id: true },
  });

  const metrics = sanitizeMetrics(params.metrics);
  if (metrics.length > 0) {
    await prisma.routineLogMetric.createMany({
      data: metrics.map((metric) => ({ ...metric, routineLogId: log.id })),
    });
  }

  revalidateRoutineSurfaces(params.routineId);
}

export async function updateCardioLog(params: {
  routineId: string;
  logId: string;
  distanceMi: number;
  durationSec: number;
  notes?: string;
  performedAtLocal?: string;
  metrics?: MetricInput[];
}) {
  await ensureRoutineKind(params.routineId, "CARDIO");
  if (!params.logId) throw new Error("Missing logId.");
  if (!Number.isFinite(params.distanceMi) || params.distanceMi <= 0) throw new Error("Distance must be > 0.");
  if (!Number.isFinite(params.durationSec) || params.durationSec <= 0) throw new Error("Duration must be > 0.");

  const existing = await prisma.routineLog.findUnique({
    where: { id: params.logId },
    select: { routineId: true },
  });
  if (!existing || existing.routineId !== params.routineId) throw new Error("Log not found for routine.");

  await prisma.$transaction(async (tx) => {
    await tx.routineLog.update({
      where: { id: params.logId },
      data: {
        performedAt: parsePerformedAt(params.performedAtLocal),
        distanceMi: params.distanceMi,
        durationSec: params.durationSec,
        notes: params.notes?.trim() || null,
      },
    });
    await tx.routineLogMetric.deleteMany({ where: { routineLogId: params.logId } });
    const metrics = sanitizeMetrics(params.metrics);
    if (metrics.length > 0) {
      await tx.routineLogMetric.createMany({
        data: metrics.map((metric) => ({ ...metric, routineLogId: params.logId })),
      });
    }
  });

  revalidateRoutineSurfaces(params.routineId);
}

export async function updateRunLog(params: {
  routineId: string;
  logId: string;
  distanceMi: number;
  durationSec: number;
  notes?: string;
  performedAtLocal?: string;
}) {
  await updateCardioLog(params);
}

export async function updateWorkoutLog(params: {
  routineId: string;
  logId: string;
  notes?: string;
  performedAtLocal?: string;
  exercises: {
    customName?: string;
    unit?: "REPS" | "TIME";
    supportsWeight?: boolean;
    exerciseId: string;
    sets: {
      setNumber: number;
      reps?: number | null;
      seconds?: number | null;
      weightLb?: number | null;
    }[];
  }[];
}) {
  await ensureRoutineKind(params.routineId, "WORKOUT");
  if (!params.logId) throw new Error("Missing logId.");

  const existing = await prisma.routineLog.findUnique({
    where: { id: params.logId },
    select: { routineId: true },
  });
  if (!existing || existing.routineId !== params.routineId) throw new Error("Log not found for routine.");

  await prisma.$transaction(async (tx) => {
    const exercises = await sanitizeWorkoutExercises(tx, params.exercises);
    await syncWorkoutTemplateTx(tx, params.routineId, exercises);

    await tx.routineLog.update({
      where: { id: params.logId },
      data: {
        performedAt: parsePerformedAt(params.performedAtLocal),
        notes: params.notes?.trim() || null,
      },
    });

    await tx.sessionExercise.deleteMany({ where: { routineLogId: params.logId } });

    for (const exercise of exercises.filter((item) => item.loggedSets.length > 0)) {
      const sessionExercise = await tx.sessionExercise.create({
        data: {
          routineLogId: params.logId,
          exerciseId: exercise.exerciseId,
        },
        select: { id: true },
      });

      await tx.setEntry.createMany({
        data: exercise.loggedSets.map((set) => ({
          sessionExerciseId: sessionExercise.id,
          setNumber: set.setNumber,
          reps: set.reps,
          seconds: set.seconds,
          weightLb: set.weightLb,
        })),
      });
    }
  });

  revalidateRoutineSurfaces(params.routineId);
}

export async function updateCompletionLog(params: {
  routineId: string;
  logId: string;
  notes?: string;
  completionCount?: number | null;
  performedAtLocal?: string;
}) {
  await ensureRoutineKind(params.routineId, "COMPLETION");
  if (!params.logId) throw new Error("Missing logId.");

  const existing = await prisma.routineLog.findUnique({
    where: { id: params.logId },
    select: {
      routineId: true,
      exercises: { select: { id: true } },
      guidedSteps: { select: { id: true } },
      metrics: { select: { id: true } },
      distanceMi: true,
      durationSec: true,
      location: true,
    },
  });
  if (!existing || existing.routineId !== params.routineId) throw new Error("Log not found for routine.");
  if (
    existing.exercises.length > 0 ||
    existing.guidedSteps.length > 0 ||
    existing.metrics.length > 0 ||
    existing.distanceMi !== null ||
    existing.durationSec !== null ||
    existing.location !== null
  ) {
    throw new Error("This is not a completion log.");
  }

  const completionCount =
    params.completionCount === null || params.completionCount === undefined || params.completionCount === 0
      ? null
      : Math.max(1, Math.floor(params.completionCount));

  await prisma.routineLog.update({
    where: { id: params.logId },
    data: {
      performedAt: parsePerformedAt(params.performedAtLocal),
      notes: params.notes?.trim() || null,
      completionCount,
    },
  });

  revalidateRoutineSurfaces(params.routineId);
}

export async function updateGuidedLog(params: {
  routineId: string;
  logId: string;
  durationSec?: number | null;
  notes?: string;
  performedAtLocal?: string;
  steps?: GuidedStepInput[];
}) {
  await ensureRoutineKind(params.routineId, "GUIDED");
  if (!params.logId) throw new Error("Missing logId.");

  const existing = await prisma.routineLog.findUnique({
    where: { id: params.logId },
    select: { routineId: true },
  });
  if (!existing || existing.routineId !== params.routineId) throw new Error("Log not found for routine.");

  const steps = sanitizeGuidedSteps(params.steps);
  const fallbackDuration = steps.reduce((sum, step) => sum + (step.durationSec ?? 0) + (step.restSec ?? 0), 0);
  const durationSec = params.durationSec ?? (fallbackDuration > 0 ? fallbackDuration : null);

  await prisma.$transaction(async (tx) => {
    await tx.routineLog.update({
      where: { id: params.logId },
      data: {
        performedAt: parsePerformedAt(params.performedAtLocal),
        durationSec,
        notes: params.notes?.trim() || null,
      },
    });
    await tx.guidedStepLog.deleteMany({ where: { routineLogId: params.logId } });
    if (steps.length > 0) {
      await tx.guidedStepLog.createMany({
        data: steps.map((step) => ({
          routineLogId: params.logId,
          guidedStepId: step.guidedStepId,
          title: step.title,
          durationSec: step.durationSec,
          restSec: step.restSec,
          sortOrder: step.sortOrder,
        })),
      });
    }
  });

  revalidateRoutineSurfaces(params.routineId);
}

export async function updateSessionLog(params: {
  routineId: string;
  logId: string;
  durationSec: number;
  location?: string;
  notes?: string;
  performedAtLocal?: string;
  metrics?: MetricInput[];
}) {
  await ensureRoutineKind(params.routineId, "SESSION");
  if (!params.logId) throw new Error("Missing logId.");
  if (!Number.isFinite(params.durationSec) || params.durationSec <= 0) throw new Error("Duration must be > 0.");

  const existing = await prisma.routineLog.findUnique({
    where: { id: params.logId },
    select: { routineId: true },
  });
  if (!existing || existing.routineId !== params.routineId) throw new Error("Log not found for routine.");

  await prisma.$transaction(async (tx) => {
    await tx.routineLog.update({
      where: { id: params.logId },
      data: {
        performedAt: parsePerformedAt(params.performedAtLocal),
        durationSec: params.durationSec,
        location: params.location?.trim() || null,
        notes: params.notes?.trim() || null,
      },
    });
    await tx.routineLogMetric.deleteMany({ where: { routineLogId: params.logId } });
    const metrics = sanitizeMetrics(params.metrics);
    if (metrics.length > 0) {
      await tx.routineLogMetric.createMany({
        data: metrics.map((metric) => ({ ...metric, routineLogId: params.logId })),
      });
    }
  });

  revalidateRoutineSurfaces(params.routineId);
}

export async function deleteRoutineLog(logId: string) {
  if (!logId) throw new Error("Missing logId.");

  const existing = await prisma.routineLog.findUnique({
    where: { id: logId },
    select: { routineId: true },
  });
  if (!existing) return;

  await prisma.routineLog.delete({ where: { id: logId } });
  revalidateRoutineSurfaces(existing.routineId);
}

export async function setRoutineExerciseDefaultSets(params: {
  routineId: string;
  defaults: { exerciseId: string; defaultSets: number }[];
}) {
  if (!params.routineId) throw new Error("Missing routineId");
  await ensureRoutineKind(params.routineId, "WORKOUT");

  await prisma.$transaction(
    params.defaults.map((item) =>
      prisma.routineExercise.update({
        where: { routineId_exerciseId: { routineId: params.routineId, exerciseId: item.exerciseId } },
        data: { defaultSets: Math.max(1, Math.min(20, Math.floor(item.defaultSets || 3))) },
      })
    )
  );

  revalidateRoutineSurfaces(params.routineId);
}
