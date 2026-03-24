"use server";

import { inferGuidedStepMetadataSlugs } from "@/lib/metadata";
import { prisma } from "@/lib/prisma";
import { supportsRoutineSteps } from "@/lib/routines";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function routeFor(routineId: string) {
  return `/routines/${routineId}/guided`;
}

async function metadataGroupIdsForSlugs(slugs: string[]) {
  if (slugs.length === 0) return [];
  const groups = await prisma.metadataGroup.findMany({
    where: {
      slug: { in: slugs },
    },
    select: { id: true },
  });
  return groups.map((group) => group.id);
}

async function ensureStepRoutine(routineId: string) {
  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { kind: true },
  });
  if (!routine) throw new Error("Routine not found.");
  if (!supportsRoutineSteps(routine.kind)) throw new Error("This routine type does not support reusable steps.");
  return routine;
}

async function syncGuidedStepMetadataGroups(guidedStepId: string, groupIds: string[]) {
  await prisma.guidedStepMetadataGroup.deleteMany({
    where: {
      guidedStepId,
      groupId: { notIn: groupIds.length > 0 ? groupIds : ["__none__"] },
    },
  });

  if (groupIds.length === 0) return;

  await prisma.guidedStepMetadataGroup.createMany({
    data: groupIds.map((groupId) => ({ guidedStepId, groupId })),
    skipDuplicates: true,
  });
}

function parseStepKind(value: FormDataEntryValue | null) {
  return String(value || "").trim() === "EXERCISE" ? "EXERCISE" : "STEP";
}

function parseOptionalSeconds(value: FormDataEntryValue | null, label: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be greater than 0.`);
  return Math.floor(parsed);
}

function parseRepeatCount(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return 1;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Repeat count must be at least 1.");
  return Math.floor(parsed);
}

function parseOptionalCount(value: FormDataEntryValue | null, label: string) {
  const raw = String(value || "").trim();
  if (!raw) return 1;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be at least 1.`);
  return Math.floor(parsed);
}

export async function addGuidedStep(formData: FormData) {
  const routineId = String(formData.get("routineId") || "").trim();
  const kind = parseStepKind(formData.get("kind"));
  const title = String(formData.get("title") || "").trim();
  const exerciseId = String(formData.get("exerciseId") || "").trim();
  if (!routineId) throw new Error("Missing routine id.");
  await ensureStepRoutine(routineId);
  if (kind === "STEP" && !title) throw new Error("Title is required.");
  if (kind === "EXERCISE" && !exerciseId) throw new Error("Exercise is required.");

  const durationSec = parseOptionalSeconds(formData.get("durationSec"), "Duration");
  const restSec = parseOptionalSeconds(formData.get("restSec"), "Rest");
  const repeatCount = parseRepeatCount(formData.get("repeatCount"));
  const repCount = parseOptionalCount(formData.get("repCount"), "Reps");
  const setCount = parseOptionalCount(formData.get("setCount"), "Sets");

  let exerciseName: string | null = null;
  if (exerciseId) {
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, name: true },
    });
    if (!exercise) throw new Error("Exercise not found.");
    exerciseName = exercise.name;
  }

  const existing = await prisma.guidedStep.findMany({
    where: { routineId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  const created = await prisma.guidedStep.create({
    data: {
      routineId,
      kind,
      title: kind === "EXERCISE" ? exerciseName ?? title : title,
      exerciseId: exerciseId || null,
      durationSec,
      restSec,
      repeatCount,
      repCount,
      setCount,
      sortOrder: existing.length,
    },
    select: { id: true },
  });

  if (kind === "STEP") {
    const inferredGroupIds = await metadataGroupIdsForSlugs(inferGuidedStepMetadataSlugs(title));
    await syncGuidedStepMetadataGroups(created.id, inferredGroupIds);
  }

  revalidatePath(routeFor(routineId));
  revalidatePath(`/routines/${routineId}/log`);
  redirect(routeFor(routineId));
}

export async function updateGuidedStep(formData: FormData) {
  const routineId = String(formData.get("routineId") || "").trim();
  const stepId = String(formData.get("stepId") || "").trim();
  const kind = parseStepKind(formData.get("kind"));
  const title = String(formData.get("title") || "").trim();
  const exerciseId = String(formData.get("exerciseId") || "").trim();
  if (!routineId || !stepId) throw new Error("Missing ids.");
  await ensureStepRoutine(routineId);
  if (kind === "STEP" && !title) throw new Error("Title is required.");
  if (kind === "EXERCISE" && !exerciseId) throw new Error("Exercise is required.");

  const durationSec = parseOptionalSeconds(formData.get("durationSec"), "Duration");
  const restSec = parseOptionalSeconds(formData.get("restSec"), "Rest");
  const repeatCount = parseRepeatCount(formData.get("repeatCount"));
  const repCount = parseOptionalCount(formData.get("repCount"), "Reps");
  const setCount = parseOptionalCount(formData.get("setCount"), "Sets");

  let exerciseName: string | null = null;
  if (exerciseId) {
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, name: true },
    });
    if (!exercise) throw new Error("Exercise not found.");
    exerciseName = exercise.name;
  }

  await prisma.guidedStep.update({
    where: { id: stepId },
    data: {
      kind,
      title: kind === "EXERCISE" ? exerciseName ?? title : title,
      exerciseId: exerciseId || null,
      durationSec,
      restSec,
      repeatCount,
      repCount,
      setCount,
    },
  });

  if (kind === "STEP") {
    const inferredGroupIds = await metadataGroupIdsForSlugs(inferGuidedStepMetadataSlugs(title));
    await syncGuidedStepMetadataGroups(stepId, inferredGroupIds);
  } else {
    await syncGuidedStepMetadataGroups(stepId, []);
  }

  revalidatePath(routeFor(routineId));
  revalidatePath(`/routines/${routineId}/log`);
  redirect(routeFor(routineId));
}

export async function saveAllGuidedStepsAndExit(formData: FormData) {
  const routineId = String(formData.get("routineId") || "").trim();
  if (!routineId) throw new Error("Missing routine id.");
  await ensureStepRoutine(routineId);

  const stepIds = formData.getAll("stepId").map((value) => String(value || "").trim()).filter(Boolean);
  const kinds = formData.getAll("kind");
  const titles = formData.getAll("title");
  const exerciseIds = formData.getAll("exerciseId");
  const durationValues = formData.getAll("durationSec");
  const restValues = formData.getAll("restSec");
  const repeatValues = formData.getAll("repeatCount");
  const repValues = formData.getAll("repCount");
  const setValues = formData.getAll("setCount");

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < stepIds.length; index += 1) {
      const stepId = stepIds[index];
      const kind = parseStepKind(kinds[index] ?? null);
      const title = String(titles[index] || "").trim();
      const exerciseId = String(exerciseIds[index] || "").trim();
      if (!stepId) throw new Error("Missing step id.");
      if (kind === "STEP" && !title) throw new Error("Title is required.");
      if (kind === "EXERCISE" && !exerciseId) throw new Error("Exercise is required.");

      const durationSec = parseOptionalSeconds(durationValues[index] ?? null, "Duration");
      const restSec = parseOptionalSeconds(restValues[index] ?? null, "Rest");
      const repeatCount = parseRepeatCount(repeatValues[index] ?? null);
      const repCount = parseOptionalCount(repValues[index] ?? null, "Reps");
      const setCount = parseOptionalCount(setValues[index] ?? null, "Sets");

      let exerciseName: string | null = null;
      if (exerciseId) {
        const exercise = await tx.exercise.findUnique({
          where: { id: exerciseId },
          select: { id: true, name: true },
        });
        if (!exercise) throw new Error("Exercise not found.");
        exerciseName = exercise.name;
      }

      await tx.guidedStep.update({
        where: { id: stepId },
        data: {
          kind,
          title: kind === "EXERCISE" ? exerciseName ?? title : title,
          exerciseId: exerciseId || null,
          durationSec,
          restSec,
          repeatCount,
          repCount,
          setCount,
        },
      });

      const nextGroupIds =
        kind === "STEP"
          ? await metadataGroupIdsForSlugs(inferGuidedStepMetadataSlugs(title))
          : [];

      await tx.guidedStepMetadataGroup.deleteMany({
        where: {
          guidedStepId: stepId,
          groupId: { notIn: nextGroupIds.length > 0 ? nextGroupIds : ["__none__"] },
        },
      });

      if (nextGroupIds.length > 0) {
        await tx.guidedStepMetadataGroup.createMany({
          data: nextGroupIds.map((groupId) => ({ guidedStepId: stepId, groupId })),
          skipDuplicates: true,
        });
      }
    }
  });

  revalidatePath(routeFor(routineId));
  revalidatePath(`/routines/${routineId}/log`);
  revalidatePath("/routines");
  redirect("/routines");
}

export async function moveGuidedStep(direction: "UP" | "DOWN", formData: FormData) {
  const routineId = String(formData.get("routineId") || "").trim();
  const stepId = String(formData.get("stepId") || "").trim();
  if (!routineId || !stepId) throw new Error("Missing ids.");
  await ensureStepRoutine(routineId);

  const steps = await prisma.guidedStep.findMany({
    where: { routineId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });

  const currentIndex = steps.findIndex((step) => step.id === stepId);
  if (currentIndex < 0) throw new Error("Step not found.");
  const swapIndex = direction === "UP" ? currentIndex - 1 : currentIndex + 1;
  if (swapIndex < 0 || swapIndex >= steps.length) {
    revalidatePath(routeFor(routineId));
    redirect(routeFor(routineId));
  }

  const current = steps[currentIndex];
  const target = steps[swapIndex];

  await prisma.$transaction([
    prisma.guidedStep.update({
      where: { id: current.id },
      data: { sortOrder: target.sortOrder },
    }),
    prisma.guidedStep.update({
      where: { id: target.id },
      data: { sortOrder: current.sortOrder },
    }),
  ]);

  revalidatePath(routeFor(routineId));
  revalidatePath(`/routines/${routineId}/log`);
  redirect(routeFor(routineId));
}

export async function deleteGuidedStep(formData: FormData) {
  const routineId = String(formData.get("routineId") || "").trim();
  const stepId = String(formData.get("stepId") || "").trim();
  if (!routineId || !stepId) throw new Error("Missing ids.");
  await ensureStepRoutine(routineId);

  await prisma.guidedStep.delete({ where: { id: stepId } });
  const remaining = await prisma.guidedStep.findMany({
    where: { routineId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    remaining.map((step, index) =>
      prisma.guidedStep.update({
        where: { id: step.id },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath(routeFor(routineId));
  revalidatePath(`/routines/${routineId}/log`);
  redirect(routeFor(routineId));
}
