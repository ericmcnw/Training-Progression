"use server";

import { deriveExerciseLibraryKind, isMissingExerciseLibraryKindError } from "@/lib/exercise-library";
import { inferExerciseMetadataSlugs, parseTagNames, ROUTINE_METADATA_SELECTABLE_KINDS } from "@/lib/metadata";
import { parseSessionGradeValue } from "@/lib/session-templates";
import { recalculateRoutineLogStimulus } from "@/lib/stimulus";
import { parseAppDateTimeLocal } from "@/lib/dates";
import { exerciseUnitLabel, findExerciseNameMatch, normalizeExerciseName } from "@/lib/exercises";
import { prisma } from "@/lib/prisma";
import { suggestedTimesPerWeekForRoutineTarget } from "@/lib/routine-frequency";
import { buildStarterPackPlan, getStarterPackDefinition, getStarterStructureDefinition, type StarterPackFocus, type StarterPackStructure } from "@/lib/starter-packs";
import {
  normalizeRoutineKind,
  normalizeRoutineSubtype,
  supportsRoutineSteps,
} from "@/lib/routines";
import type { GuidedStepKind, RoutineFrequencyUnit, RoutineKind } from "@/generated/prisma";
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
  kind?: GuidedStepKind;
  title: string;
  exerciseId?: string | null;
  durationSec?: number | null;
  restSec?: number | null;
  repeatCount?: number | null;
  repCount?: number | null;
  setCount?: number | null;
  weightLb?: number | null;
  sortOrder: number;
};

type MetricInput = {
  name: string;
  value: number;
  unit?: string | null;
};

type SessionMetricValueInput = {
  metricDefinitionId: string;
  numberValue?: number | null;
  textValue?: string | null;
  booleanValue?: boolean | null;
};

type SessionTemplateConfig = {
  preferredClimbingGrades?: string[];
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

type RoutineStepTemplateInput = {
  kind: GuidedStepKind;
  title: string;
  exerciseId: string | null;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount: number;
  setCount: number;
  sortOrder: number;
};

function parsePerformedAt(performedAtLocal?: string | null) {
  const raw = String(performedAtLocal || "").trim();
  if (!raw) return new Date();
  return parseAppDateTimeLocal(raw);
}

function parseCategory(formData: FormData) {
  const category = String(formData.get("category") || "").trim();
  return category || "General";
}

function parseRoutineFrequencyTarget(formData: FormData) {
  const enabled = String(formData.get("frequencyTargetEnabled") || "").trim() === "1";
  if (!enabled) {
    return {
      targetFrequencyCount: null,
      targetFrequencyUnit: null,
      targetFrequencyInterval: null,
    } as const;
  }

  const countRaw = String(formData.get("targetFrequencyCount") || "").trim();
  const intervalRaw = String(formData.get("targetFrequencyInterval") || "").trim();
  const unitRaw = String(formData.get("targetFrequencyUnit") || "")
    .trim()
    .toUpperCase();

  const targetFrequencyCount = Number(countRaw);
  const targetFrequencyInterval = Number(intervalRaw || "1");
  const targetFrequencyUnit =
    unitRaw === "DAY" || unitRaw === "WEEK" || unitRaw === "MONTH"
      ? (unitRaw as RoutineFrequencyUnit)
      : null;

  if (!Number.isFinite(targetFrequencyCount) || targetFrequencyCount <= 0) {
    throw new Error("Target frequency count must be greater than 0.");
  }
  if (!Number.isFinite(targetFrequencyInterval) || targetFrequencyInterval <= 0) {
    throw new Error("Target frequency interval must be greater than 0.");
  }
  if (!targetFrequencyUnit) {
    throw new Error("Target frequency unit is required.");
  }

  return {
    targetFrequencyCount: Math.floor(targetFrequencyCount),
    targetFrequencyUnit,
    targetFrequencyInterval: Math.floor(targetFrequencyInterval),
  } as const;
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
      ...(appliesTo === "routine"
        ? { OR: [{ appliesToRoutine: true }, { kind: { in: ROUTINE_METADATA_SELECTABLE_KINDS } }] }
        : { appliesToExercise: true }),
    },
    select: { id: true },
  });
  return groups.map((group) => group.id);
}

async function getValidSessionTemplateId(templateId: FormDataEntryValue | null) {
  const value = String(templateId ?? "").trim();
  if (!value) return null;
  const template = await prisma.sessionTemplate.findUnique({
    where: { id: value },
    select: { id: true },
  });
  if (!template) throw new Error("Session template not found.");
  return template.id;
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
  // Auto-include metadata groups whose slug matches any tag name (e.g. tag "climbing" → climbing group)
  const tagMatchedGroups =
    params.tags.length > 0
      ? await prisma.metadataGroup.findMany({
          where: { slug: { in: params.tags }, appliesToRoutine: true },
          select: { id: true },
        })
      : [];
  const mergedGroupIds = Array.from(new Set([...params.selectedGroupIds, ...tagMatchedGroups.map((g) => g.id)]));

  await syncRoutineMetadataGroups(params.routineId, mergedGroupIds);
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

async function sanitizeSessionMetricValues(params: {
  routineId: string;
  values?: SessionMetricValueInput[];
}) {
  const routine = await prisma.routine.findUnique({
    where: { id: params.routineId },
    select: {
      sessionDetails: {
        select: {
          templateId: true,
          template: {
            select: {
              id: true,
              metricDefinitions: {
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  valueType: true,
                  isRequired: true,
                  key: true,
                  config: true,
                },
              },
            },
          },
        },
      },
    },
  });
  const template = routine?.sessionDetails?.template;
  if (!template) return [];

  const inputById = new Map(
    (params.values ?? [])
      .map((value) => ({
        metricDefinitionId: String(value.metricDefinitionId || "").trim(),
        numberValue: value.numberValue ?? null,
        textValue: value.textValue?.trim() || null,
        booleanValue: value.booleanValue ?? null,
      }))
      .filter((value) => value.metricDefinitionId.length > 0)
      .map((value) => [value.metricDefinitionId, value])
  );

  const sanitizedValues: Array<{
    metricDefinitionId: string;
    numberValue: number | null;
    textValue: string | null;
    booleanValue: boolean | null;
  }> = [];

  for (const definition of template.metricDefinitions) {
    const input = inputById.get(definition.id);
    const hasValue =
      (input?.numberValue !== null && input?.numberValue !== undefined) ||
      (input?.textValue !== null && input?.textValue !== undefined) ||
      (input?.booleanValue !== null && input?.booleanValue !== undefined);

    if (!input || !hasValue) {
      if (definition.isRequired) throw new Error("Missing required session metric value.");
      continue;
    }

    if (definition.valueType === "INTEGER" || definition.valueType === "DECIMAL") {
      if (!Number.isFinite(input.numberValue)) throw new Error("Session metric number value is invalid.");
      sanitizedValues.push({
        metricDefinitionId: definition.id,
        numberValue: definition.valueType === "INTEGER" ? Math.round(input.numberValue ?? 0) : input.numberValue ?? null,
        textValue: null,
        booleanValue: null,
      });
      continue;
    }

    if (definition.valueType === "BOOLEAN") {
      sanitizedValues.push({
        metricDefinitionId: definition.id,
        numberValue: null,
        textValue: null,
        booleanValue: Boolean(input.booleanValue),
      });
      continue;
    }

    if (!input.textValue) {
      if (definition.isRequired) throw new Error("Missing required session metric value.");
      continue;
    }

    sanitizedValues.push({
      metricDefinitionId: definition.id,
      numberValue: null,
      textValue: input.textValue,
      booleanValue: null,
    });
  }

  const sanitizedByDefinitionId = new Map(sanitizedValues.map((value) => [value.metricDefinitionId, value]));

  const highestGradeForColumn = (column: "DONE" | "FLASHED") => {
    let bestGrade = "";
    let bestValue = -1;
    for (const definition of template.metricDefinitions) {
      const config =
        definition.config && typeof definition.config === "object" && !Array.isArray(definition.config)
          ? (definition.config as Record<string, unknown>)
          : null;
      if (!config || config.climbingColumn !== column || typeof config.gradeBucket !== "string") continue;
      const entry = sanitizedByDefinitionId.get(definition.id);
      if (!entry || !entry.numberValue || entry.numberValue <= 0) continue;
      const parsedGrade = parseSessionGradeValue(
        config.gradeBucket,
        config.gradeSystem === "BOULDER_V" || config.gradeSystem === "YOSEMITE" ? config.gradeSystem : undefined
      );
      if (parsedGrade === null || parsedGrade < bestValue) continue;
      bestValue = parsedGrade;
      bestGrade = config.gradeBucket;
    }
    return bestGrade || null;
  };

  const highestFlashGrade = highestGradeForColumn("FLASHED");
  const highestSendGrade = highestGradeForColumn("DONE");

  for (const definition of template.metricDefinitions) {
    if (definition.key === "highest_flash_grade" && highestFlashGrade) {
      sanitizedByDefinitionId.set(definition.id, {
        metricDefinitionId: definition.id,
        numberValue: null,
        textValue: highestFlashGrade,
        booleanValue: null,
      });
    }
    if (definition.key === "highest_send_grade" && highestSendGrade) {
      sanitizedByDefinitionId.set(definition.id, {
        metricDefinitionId: definition.id,
        numberValue: null,
        textValue: highestSendGrade,
        booleanValue: null,
      });
    }
  }

  return Array.from(sanitizedByDefinitionId.values());
}

function sanitizePreferredClimbingGrades(grades?: string[]) {
  return Array.from(
    new Set(
      (grades ?? [])
        .map((grade) => grade.trim())
        .filter((grade) => grade.length > 0)
    )
  );
}

async function updateSessionRoutineTemplateConfig(routineId: string, nextConfig: SessionTemplateConfig) {
  const current = await prisma.sessionRoutineDetails.findUnique({
    where: { routineId },
    select: { templateConfig: true },
  });
  const currentConfig =
    current?.templateConfig && typeof current.templateConfig === "object" && !Array.isArray(current.templateConfig)
      ? (current.templateConfig as Record<string, unknown>)
      : {};

  await prisma.sessionRoutineDetails.update({
    where: { routineId },
    data: {
      templateConfig: {
        ...currentConfig,
        ...nextConfig,
      },
    },
  });
}

function sanitizeGuidedSteps(steps?: GuidedStepInput[]) {
  return (steps ?? [])
    .map((step, index) => ({
      guidedStepId: step.guidedStepId || null,
      kind: (step.kind === "EXERCISE" ? "EXERCISE" : "STEP") as GuidedStepKind,
      title: step.title.trim(),
      exerciseId: step.exerciseId?.trim() || null,
      durationSec: step.durationSec ?? null,
      restSec: step.restSec ?? null,
      repeatCount:
        step.repeatCount !== null && step.repeatCount !== undefined && Number.isFinite(step.repeatCount)
          ? Math.max(1, Math.floor(step.repeatCount))
          : 1,
      repCount:
        step.repCount !== null && step.repCount !== undefined && Number.isFinite(step.repCount)
          ? Math.max(1, Math.floor(step.repCount))
          : step.repeatCount !== null && step.repeatCount !== undefined && Number.isFinite(step.repeatCount)
          ? Math.max(1, Math.floor(step.repeatCount))
          : 1,
      setCount:
        step.setCount !== null && step.setCount !== undefined && Number.isFinite(step.setCount)
          ? Math.max(1, Math.floor(step.setCount))
          : 1,
      weightLb:
        step.weightLb !== null && step.weightLb !== undefined && Number.isFinite(step.weightLb)
          ? step.weightLb
          : null,
      sortOrder: Number.isFinite(step.sortOrder) ? step.sortOrder : index,
    }))
    .filter((step) => step.title.length > 0 || step.exerciseId) as Array<{
      guidedStepId: string | null;
      kind: GuidedStepKind;
      title: string;
      exerciseId: string | null;
      durationSec: number | null;
      restSec: number | null;
      repeatCount: number;
      repCount: number;
      setCount: number;
      weightLb: number | null;
      sortOrder: number;
    }>;
}

function guidedTemplateDurationSec(
  steps: Array<{
    durationSec?: number | null;
    restSec?: number | null;
    repeatCount?: number | null;
    repCount?: number | null;
    setCount?: number | null;
  }>
) {
  return steps.reduce((sum, step) => {
    const repCount =
      step.repCount !== null && step.repCount !== undefined && Number.isFinite(step.repCount)
        ? Math.max(1, Math.floor(step.repCount))
        : step.repeatCount !== null && step.repeatCount !== undefined && Number.isFinite(step.repeatCount)
        ? Math.max(1, Math.floor(step.repeatCount))
        : 1;
    const setCount =
      step.setCount !== null && step.setCount !== undefined && Number.isFinite(step.setCount)
        ? Math.max(1, Math.floor(step.setCount))
        : 1;
    const roundCount = repCount * setCount;
    const workSec = step.durationSec ?? 0;
    const restSec = step.restSec ?? 0;
    const restMultiplier = restSec > 0 ? Math.max(0, roundCount - 1) : 0;
    return sum + workSec * roundCount + restSec * restMultiplier;
  }, 0);
}

function hasWorkoutSetValue(set: { reps?: number | null; seconds?: number | null; weightLb?: number | null }) {
  return set.reps !== null && set.reps !== undefined
    || set.seconds !== null && set.seconds !== undefined
    || set.weightLb !== null && set.weightLb !== undefined;
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

  const existingExercises = await tx.exercise.findMany({
    select: { id: true, name: true, unit: true, supportsWeight: true },
  });
  const existing = findExerciseNameMatch(existingExercises, name);
  if (existing) {
    if (existing.unit !== unit) {
      throw new Error(
        `"${existing.name}" already exists as a ${exerciseUnitLabel(existing.unit).toLowerCase()} exercise. Rename this one or use the existing exercise instead.`
      );
    }
    if (params.supportsWeight && !existing.supportsWeight) {
      await tx.exercise.update({
        where: { id: existing.id },
        data: { supportsWeight: true },
      });
    }
    return existing.id;
  }

  const created = await (async () => {
    try {
      return await tx.exercise.create({
        data: {
          name,
          unit,
          supportsWeight: Boolean(params.supportsWeight),
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
        data: {
          name,
          unit,
          supportsWeight: Boolean(params.supportsWeight),
        },
        select: { id: true },
      });
    }
  })();
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

async function buildStepTemplateFromWorkoutTx(tx: PrismaTx, routineId: string): Promise<RoutineStepTemplateInput[]> {
  const exercises = await tx.routineExercise.findMany({
    where: { routineId },
    orderBy: { sortOrder: "asc" },
    select: {
      exerciseId: true,
      defaultSets: true,
      sortOrder: true,
      exercise: { select: { name: true } },
    },
  });

  return exercises.map((exercise, index) => ({
    kind: "EXERCISE" as GuidedStepKind,
    title: exercise.exercise.name,
    exerciseId: exercise.exerciseId,
    durationSec: null,
    restSec: null,
    repeatCount: Math.max(1, exercise.defaultSets ?? 1),
    repCount: 1,
    setCount: Math.max(1, exercise.defaultSets ?? 1),
    sortOrder: Number.isFinite(exercise.sortOrder) ? exercise.sortOrder : index,
  }));
}

async function buildWorkoutTemplateFromStepsTx(tx: PrismaTx, routineId: string): Promise<SanitizedWorkoutExercise[]> {
  const steps = await tx.guidedStep.findMany({
    where: { routineId, kind: "EXERCISE", exerciseId: { not: null } },
    orderBy: { sortOrder: "asc" },
    select: {
      exerciseId: true,
      repeatCount: true,
      setCount: true,
      sortOrder: true,
    },
  });

  const seenExerciseIds = new Set<string>();
  return steps
    .filter((step) => {
      const exerciseId = step.exerciseId;
      if (!exerciseId || seenExerciseIds.has(exerciseId)) return false;
      seenExerciseIds.add(exerciseId);
      return true;
    })
    .map((step, index) => ({
      exerciseId: step.exerciseId as string,
      sortOrder: Number.isFinite(step.sortOrder) ? step.sortOrder : index,
      defaultSets: Math.max(1, step.setCount ?? step.repeatCount ?? 1),
      loggedSets: [],
    }));
}

async function replaceRoutineStepTemplateTx(tx: PrismaTx, routineId: string, steps: RoutineStepTemplateInput[]) {
  await tx.guidedStep.deleteMany({ where: { routineId } });
  if (steps.length === 0) return;

  for (const [index, step] of steps.entries()) {
    await tx.guidedStep.create({
      data: {
        routineId,
        kind: step.kind,
        title: step.title,
        exerciseId: step.exerciseId,
        durationSec: step.durationSec,
        restSec: step.restSec,
        repeatCount: Math.max(1, step.repeatCount || 1),
        repCount: Math.max(1, step.repCount || 1),
        setCount: Math.max(1, step.setCount || 1),
        sortOrder: Number.isFinite(step.sortOrder) ? step.sortOrder : index,
      },
    });
  }
}

async function convertRoutineStructureTx(tx: PrismaTx, params: {
  routineId: string;
  currentKind: RoutineKind;
  nextKind: RoutineKind;
}) {
  const { routineId, currentKind, nextKind } = params;
  if (currentKind === nextKind) return;

  const currentSupportsSteps = supportsRoutineSteps(currentKind);
  const nextSupportsSteps = supportsRoutineSteps(nextKind);

  if (currentKind === "WORKOUT" && nextSupportsSteps) {
    const steps = await buildStepTemplateFromWorkoutTx(tx, routineId);
    await replaceRoutineStepTemplateTx(tx, routineId, steps);
    await tx.routineExercise.deleteMany({ where: { routineId } });
    return;
  }

  if (currentSupportsSteps && nextKind === "WORKOUT") {
    const exercises = await buildWorkoutTemplateFromStepsTx(tx, routineId);
    await syncWorkoutTemplateTx(tx, routineId, exercises);
    await tx.guidedStep.deleteMany({ where: { routineId } });
    return;
  }

  if (currentSupportsSteps && !nextSupportsSteps) {
    await tx.guidedStep.deleteMany({ where: { routineId } });
    return;
  }

  if (currentKind === "WORKOUT" && nextKind !== "WORKOUT") {
    await tx.routineExercise.deleteMany({ where: { routineId } });
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

async function syncRoutineTypeDetails(routineId: string, kind: RoutineKind, sessionTemplateId?: string | null) {
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
      update: { templateId: sessionTemplateId ?? null },
      create: { routineId, templateId: sessionTemplateId ?? null },
    });
  }
  if (kind !== "SESSION") {
    await prisma.sessionRoutineDetails.updateMany({
      where: { routineId },
      data: { templateId: null },
    });
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
    revalidatePath(`/routines/${routineId}/logs`);
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
  const frequencyTarget = parseRoutineFrequencyTarget(formData);
  const postCreate = String(formData.get("postCreate") || "").trim();
  const sessionTemplateId = await getValidSessionTemplateId(formData.get("sessionTemplateId"));
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
      targetFrequencyCount: frequencyTarget.targetFrequencyCount,
      targetFrequencyUnit: frequencyTarget.targetFrequencyUnit,
      targetFrequencyInterval: frequencyTarget.targetFrequencyInterval,
      timesPerWeek: suggestedTimesPerWeekForRoutineTarget(frequencyTarget),
      isActive: true,
      isDeleted: false,
      deletedAt: null,
    },
    select: { id: true },
  });

  await syncRoutineTypeDetails(created.id, kind, sessionTemplateId);
  await syncRoutineClassificationMetadata({
    routineId: created.id,
    selectedGroupIds,
    tags: tagNames,
  });

  revalidateRoutineSurfaces(created.id);
  if (kind === "WORKOUT" && postCreate === "template") {
    redirect(`/routines/${created.id}/template`);
  }
  redirect("/routines");
}

export async function createStarterPack(formData: FormData) {
  const focus = String(formData.get("focus") || "MIXED").trim().toUpperCase() as StarterPackFocus;
  const structure = String(formData.get("structure") || "BALANCED").trim().toUpperCase() as StarterPackStructure;
  const pack = getStarterPackDefinition(focus);
  const structureDef = getStarterStructureDefinition(structure);
  const plan = buildStarterPackPlan(pack.key, structureDef.key);

  if (plan.length === 0) {
    throw new Error("Starter pack is empty.");
  }

  const sessionTemplateKeys = Array.from(
    new Set(plan.map((item) => item.sessionTemplateKey).filter((value): value is string => Boolean(value)))
  );
  const sessionTemplates = sessionTemplateKeys.length > 0
    ? await prisma.sessionTemplate.findMany({
        where: { key: { in: sessionTemplateKeys } },
        select: { id: true, key: true },
      })
    : [];
  const sessionTemplateIdByKey = new Map(sessionTemplates.map((template) => [template.key, template.id]));

  for (const routine of plan) {
    const created = await prisma.routine.create({
      data: {
        name: routine.name,
        category: routine.category,
        domain: "general",
      kind: routine.kind,
      subtype: normalizeRoutineSubtype(routine.kind, routine.subtype),
      targetFrequencyCount: routine.timesPerWeek,
      targetFrequencyUnit: routine.timesPerWeek ? "WEEK" : null,
      targetFrequencyInterval: routine.timesPerWeek ? 1 : null,
      timesPerWeek: routine.timesPerWeek,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      },
      select: { id: true },
    });

    await syncRoutineTypeDetails(
      created.id,
      routine.kind,
      routine.sessionTemplateKey ? sessionTemplateIdByKey.get(routine.sessionTemplateKey) ?? null : null
    );
    await syncRoutineClassificationMetadata({
      routineId: created.id,
      selectedGroupIds: [],
      tags: [],
    });
  }

  revalidateRoutineSurfaces();
  redirect("/routines");
}

export async function updateRoutine(formData: FormData) {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const category = parseCategory(formData);
  const domain = String(formData.get("domain") || "general").trim() || "general";
  const kind = normalizeRoutineKind(String(formData.get("kind") || "COMPLETION"));
  const subtype = normalizeRoutineSubtype(kind, String(formData.get("subtype") || ""));
  const frequencyTarget = parseRoutineFrequencyTarget(formData);
  const postSave = String(formData.get("postSave") || "").trim();
  const sessionTemplateId = await getValidSessionTemplateId(formData.get("sessionTemplateId"));
  const selectedGroupIds = await getValidMetadataGroupIds(formData.getAll("metadataGroupIds").map(String), "routine");
  const tagNames = parseTagNames(String(formData.get("tags") || ""));

  if (!id) throw new Error("Missing routine id.");
  if (!name) throw new Error("Name is required.");

  const existing = await prisma.routine.findUnique({
    where: { id },
    select: { isDeleted: true, kind: true },
  });
  if (!existing) throw new Error("Routine not found.");
  if (existing.isDeleted) {
    revalidateRoutineSurfaces();
    redirect("/routines");
  }

  const currentKind = normalizeRoutineKind(existing.kind);

  await prisma.$transaction(async (tx) => {
    await convertRoutineStructureTx(tx, {
      routineId: id,
      currentKind,
      nextKind: kind,
    });

    await tx.routine.update({
      where: { id },
      data: {
        name,
        category,
        domain,
        kind,
        subtype,
        targetFrequencyCount: frequencyTarget.targetFrequencyCount,
        targetFrequencyUnit: frequencyTarget.targetFrequencyUnit,
        targetFrequencyInterval: frequencyTarget.targetFrequencyInterval,
        timesPerWeek: suggestedTimesPerWeekForRoutineTarget(frequencyTarget),
      },
    });
  });
  await syncRoutineTypeDetails(id, kind, sessionTemplateId);
  await syncRoutineClassificationMetadata({
    routineId: id,
    selectedGroupIds,
    tags: tagNames,
  });

  revalidateRoutineSurfaces(id);
  if (kind === "GUIDED" && postSave === "steps") {
    redirect(`/routines/${id}/guided`);
  }
  if (kind === "WORKOUT" && postSave === "template") {
    redirect(`/routines/${id}/template`);
  }
  redirect("/routines");
}

export async function updateRoutineFrequencyTarget(formData: FormData) {
  const routineId = String(formData.get("routineId") || "").trim();
  const intent = String(formData.get("intent") || "save").trim();
  if (!routineId) throw new Error("Missing routine id.");

  const existing = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { id: true, isDeleted: true },
  });
  if (!existing) throw new Error("Routine not found.");
  if (existing.isDeleted) {
    revalidateRoutineSurfaces(routineId);
    return;
  }

  if (intent === "clear") {
    await prisma.routine.update({
      where: { id: routineId },
      data: {
        targetFrequencyCount: null,
        targetFrequencyUnit: null,
        targetFrequencyInterval: null,
        timesPerWeek: null,
      },
    });
    revalidateRoutineSurfaces(routineId);
    return;
  }

  const targetFrequencyCount = Number(String(formData.get("targetFrequencyCount") || "").trim());
  const targetFrequencyInterval = Number(String(formData.get("targetFrequencyInterval") || "").trim() || "1");
  const unitRaw = String(formData.get("targetFrequencyUnit") || "").trim().toUpperCase();
  const targetFrequencyUnit =
    unitRaw === "DAY" || unitRaw === "WEEK" || unitRaw === "MONTH"
      ? (unitRaw as RoutineFrequencyUnit)
      : null;

  if (!Number.isFinite(targetFrequencyCount) || targetFrequencyCount <= 0) {
    throw new Error("Target count must be greater than 0.");
  }
  if (!Number.isFinite(targetFrequencyInterval) || targetFrequencyInterval <= 0) {
    throw new Error("Target interval must be greater than 0.");
  }
  if (!targetFrequencyUnit) {
    throw new Error("Target unit is required.");
  }

  const frequencyTarget = {
    targetFrequencyCount: Math.floor(targetFrequencyCount),
    targetFrequencyUnit,
    targetFrequencyInterval: Math.floor(targetFrequencyInterval),
  } as const;

  await prisma.routine.update({
    where: { id: routineId },
    data: {
      ...frequencyTarget,
      timesPerWeek: suggestedTimesPerWeekForRoutineTarget(frequencyTarget),
    },
  });

  revalidateRoutineSurfaces(routineId);
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

// --- FrequencyGoal CRUD ---

function parseFrequencyGoalFields(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const targetCount = Math.floor(Number(String(formData.get("targetCount") || "").trim()));
  const targetInterval = Math.floor(Number(String(formData.get("targetInterval") || "1").trim()));
  const unitRaw = String(formData.get("targetUnit") || "").trim().toUpperCase();
  const targetUnit =
    unitRaw === "DAY" || unitRaw === "WEEK" || unitRaw === "MONTH"
      ? (unitRaw as import("@/generated/prisma").RoutineFrequencyUnit)
      : null;
  const routineIds = formData.getAll("routineIds").map(String).filter(Boolean);

  if (!name) throw new Error("Goal name is required.");
  if (!Number.isFinite(targetCount) || targetCount <= 0) throw new Error("Target count must be greater than 0.");
  if (!Number.isFinite(targetInterval) || targetInterval <= 0) throw new Error("Target interval must be greater than 0.");
  if (!targetUnit) throw new Error("Target unit is required.");

  return { name, targetCount, targetInterval, targetUnit, routineIds };
}

async function syncFrequencyGoalRoutines(goalId: string, routineIds: string[]) {
  await prisma.frequencyGoalRoutine.deleteMany({ where: { goalId } });
  if (routineIds.length > 0) {
    await prisma.frequencyGoalRoutine.createMany({
      data: routineIds.map((routineId) => ({ goalId, routineId })),
      skipDuplicates: true,
    });
  }
}

export async function createFrequencyGoal(formData: FormData) {
  const { name, targetCount, targetInterval, targetUnit, routineIds } = parseFrequencyGoalFields(formData);

  const goal = await prisma.frequencyGoal.create({
    data: { name, targetCount, targetInterval, targetUnit },
    select: { id: true },
  });
  await syncFrequencyGoalRoutines(goal.id, routineIds);

  revalidatePath("/routines");
  revalidatePath("/goals");
  redirect("/goals");
}

export async function updateFrequencyGoal(formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing goal id.");
  const { name, targetCount, targetInterval, targetUnit, routineIds } = parseFrequencyGoalFields(formData);

  await prisma.frequencyGoal.update({
    where: { id },
    data: { name, targetCount, targetInterval, targetUnit },
  });
  await syncFrequencyGoalRoutines(id, routineIds);

  revalidatePath("/routines");
  revalidatePath("/goals");
}

export async function deleteFrequencyGoal(id: string) {
  if (!id) throw new Error("Missing goal id.");
  await prisma.frequencyGoal.delete({ where: { id } });
  revalidatePath("/routines");
  revalidatePath("/goals");
}

// --- End FrequencyGoal CRUD ---

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

  const log = await prisma.routineLog.create({
    data: {
      routineId: params.routineId,
      performedAt: parsePerformedAt(params.performedAtLocal),
      notes: params.notes?.trim() || null,
      completionCount,
    },
    select: { id: true },
  });
  await recalculateRoutineLogStimulus(log.id);
  revalidateRoutineSurfaces(params.routineId);
}

export async function logRoutineCompletion(routineId: string) {
  await createCompletionLog({ routineId });
}

export async function logCompletionWithDate(routineId: string, formData: FormData) {
  const performedAtLocal = String(formData.get("performedAtLocal") || "").trim();
  await createCompletionLog({ routineId, performedAtLocal: performedAtLocal || undefined });
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
  const logId = await prisma.$transaction(async (tx) => {
    const exercises = await sanitizeWorkoutExercises(tx, params.exercises);
    await syncWorkoutTemplateTx(tx, params.routineId, exercises);

    const loggedExercises = exercises.filter((exercise) => exercise.loggedSets.length > 0);
    if (loggedExercises.length === 0) return null;

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
    return log.id;
  });
  if (logId) await recalculateRoutineLogStimulus(logId);

  revalidateRoutineSurfaces(params.routineId);
}

export async function logAdHocWorkout(params: {
  routineId: string;
  notes?: string;
  performedAtLocal?: string;
  exercises: WorkoutExerciseInput[];
}) {
  await ensureRoutineKind(params.routineId, "WORKOUT");
  const logId = await prisma.$transaction(async (tx) => {
    const exercises = await sanitizeWorkoutExercises(tx, params.exercises);
    const loggedExercises = exercises.filter((exercise) => exercise.loggedSets.length > 0);
    if (loggedExercises.length === 0) return null;

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
    return log.id;
  });
  if (logId) await recalculateRoutineLogStimulus(logId);

  revalidateRoutineSurfaces(params.routineId);
}

export async function createWorkoutLogExerciseOption(params: {
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

    try {
      return await tx.exercise.findUniqueOrThrow({
        where: { id: exerciseId },
        select: {
          id: true,
          name: true,
          unit: true,
          supportsWeight: true,
          libraryKind: true,
        },
      });
    } catch (error) {
      if (!isMissingExerciseLibraryKindError(error)) throw error;
      return tx.exercise.findUniqueOrThrow({
        where: { id: exerciseId },
        select: {
          id: true,
          name: true,
          unit: true,
          supportsWeight: true,
        },
      });
    }
  });

  revalidateRoutineSurfaces(params.routineId);
  revalidatePath("/exercises");

  return exercise;
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

    try {
      return await tx.exercise.findUniqueOrThrow({
        where: { id: exerciseId },
        select: {
          id: true,
          name: true,
          unit: true,
          supportsWeight: true,
          libraryKind: true,
        },
      });
    } catch (error) {
      if (!isMissingExerciseLibraryKindError(error)) throw error;
      return tx.exercise.findUniqueOrThrow({
        where: { id: exerciseId },
        select: {
          id: true,
          name: true,
          unit: true,
          supportsWeight: true,
        },
      });
    }
  });

  revalidateRoutineSurfaces(params.routineId);
  revalidatePath("/exercises");

  return exercise;
}

export async function logCardio(params: {
  routineId: string;
  distanceMi: number;
  durationSec: number;
  elevationGainFt?: number | null;
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
  if (
    params.elevationGainFt !== null &&
    params.elevationGainFt !== undefined &&
    (!Number.isFinite(params.elevationGainFt) || params.elevationGainFt < 0)
  ) {
    throw new Error("Elevation gain must be 0 or greater.");
  }

  const log = await prisma.routineLog.create({
    data: {
      routineId: params.routineId,
      performedAt: parsePerformedAt(params.performedAtLocal),
      distanceMi: params.distanceMi,
      durationSec: params.durationSec,
      elevationGainFt:
        params.elevationGainFt !== null && params.elevationGainFt !== undefined
          ? Math.round(params.elevationGainFt)
          : null,
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
  await recalculateRoutineLogStimulus(log.id);

  revalidateRoutineSurfaces(params.routineId);
}

export async function logRun(params: {
  routineId: string;
  distanceMi: number;
  durationSec: number;
  elevationGainFt?: number | null;
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
  const fallbackDuration = guidedTemplateDurationSec(steps);
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
          kind: step.kind,
          title: step.title,
          exerciseId: step.exerciseId,
          durationSec: step.durationSec,
          restSec: step.restSec,
          repeatCount: step.repeatCount,
          repCount: step.repCount,
          setCount: step.setCount,
          weightLb: step.weightLb,
          sortOrder: step.sortOrder,
        })),
      });
  }
  await recalculateRoutineLogStimulus(log.id);

  revalidateRoutineSurfaces(params.routineId);
}

export async function logSession(params: {
  routineId: string;
  durationSec?: number | null;
  location?: string;
  notes?: string;
  performedAtLocal?: string;
  metrics?: MetricInput[];
  sessionMetricValues?: SessionMetricValueInput[];
  preferredClimbingGrades?: string[];
}) {
  await ensureRoutineKind(params.routineId, "SESSION");
  if (params.durationSec !== null && params.durationSec !== undefined && (!Number.isFinite(params.durationSec) || params.durationSec <= 0)) {
    throw new Error("Duration must be > 0.");
  }

  const logId = await prisma.$transaction(async (tx) => {
    const log = await tx.routineLog.create({
      data: {
        routineId: params.routineId,
        performedAt: parsePerformedAt(params.performedAtLocal),
        durationSec: params.durationSec ?? null,
        location: params.location?.trim() || null,
        notes: params.notes?.trim() || null,
      },
      select: { id: true },
    });

    const metrics = sanitizeMetrics(params.metrics);
    if (metrics.length > 0) {
      await tx.routineLogMetric.createMany({
        data: metrics.map((metric) => ({ ...metric, routineLogId: log.id })),
      });
    }

    const sessionMetricValues = await sanitizeSessionMetricValues({
      routineId: params.routineId,
      values: params.sessionMetricValues,
    });
    if (sessionMetricValues.length > 0) {
      await tx.sessionLogMetricValue.createMany({
        data: sessionMetricValues.map((value) => ({
          routineLogId: log.id,
          metricDefinitionId: value.metricDefinitionId,
          numberValue: value.numberValue ?? null,
          textValue: value.textValue ?? null,
          booleanValue: value.booleanValue ?? null,
        })),
      });
    }
    return log.id;
  });
  if (logId) await recalculateRoutineLogStimulus(logId);

  revalidateRoutineSurfaces(params.routineId);
  if (params.preferredClimbingGrades) {
    await updateSessionRoutineTemplateConfig(params.routineId, {
      preferredClimbingGrades: sanitizePreferredClimbingGrades(params.preferredClimbingGrades),
    });
  }
}

export async function updateCardioLog(params: {
  routineId: string;
  logId: string;
  distanceMi: number;
  durationSec: number;
  elevationGainFt?: number | null;
  notes?: string;
  performedAtLocal?: string;
  metrics?: MetricInput[];
}) {
  await ensureRoutineKind(params.routineId, "CARDIO");
  if (!params.logId) throw new Error("Missing logId.");
  if (!Number.isFinite(params.distanceMi) || params.distanceMi <= 0) throw new Error("Distance must be > 0.");
  if (!Number.isFinite(params.durationSec) || params.durationSec <= 0) throw new Error("Duration must be > 0.");
  if (
    params.elevationGainFt !== null &&
    params.elevationGainFt !== undefined &&
    (!Number.isFinite(params.elevationGainFt) || params.elevationGainFt < 0)
  ) {
    throw new Error("Elevation gain must be 0 or greater.");
  }

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
        elevationGainFt:
          params.elevationGainFt !== null && params.elevationGainFt !== undefined
            ? Math.round(params.elevationGainFt)
            : null,
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
  await recalculateRoutineLogStimulus(params.logId);

  revalidateRoutineSurfaces(params.routineId);
}

export async function updateRunLog(params: {
  routineId: string;
  logId: string;
  distanceMi: number;
  durationSec: number;
  elevationGainFt?: number | null;
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
  await recalculateRoutineLogStimulus(params.logId);

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
  await recalculateRoutineLogStimulus(params.logId);

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
  const fallbackDuration = guidedTemplateDurationSec(steps);
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
          kind: step.kind,
          title: step.title,
          exerciseId: step.exerciseId,
          durationSec: step.durationSec,
          restSec: step.restSec,
          repeatCount: step.repeatCount,
          repCount: step.repCount,
          setCount: step.setCount,
          weightLb: step.weightLb,
          sortOrder: step.sortOrder,
        })),
      });
    }
  });
  await recalculateRoutineLogStimulus(params.logId);

  revalidateRoutineSurfaces(params.routineId);
}

export async function updateSessionLog(params: {
  routineId: string;
  logId: string;
  durationSec?: number | null;
  location?: string;
  notes?: string;
  performedAtLocal?: string;
  metrics?: MetricInput[];
  sessionMetricValues?: SessionMetricValueInput[];
  preferredClimbingGrades?: string[];
}) {
  await ensureRoutineKind(params.routineId, "SESSION");
  if (!params.logId) throw new Error("Missing logId.");
  if (params.durationSec !== null && params.durationSec !== undefined && (!Number.isFinite(params.durationSec) || params.durationSec <= 0)) {
    throw new Error("Duration must be > 0.");
  }

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
        durationSec: params.durationSec ?? null,
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
    await tx.sessionLogMetricValue.deleteMany({ where: { routineLogId: params.logId } });
    const sessionMetricValues = await sanitizeSessionMetricValues({
      routineId: params.routineId,
      values: params.sessionMetricValues,
    });
    if (sessionMetricValues.length > 0) {
      await tx.sessionLogMetricValue.createMany({
        data: sessionMetricValues.map((value) => ({
          routineLogId: params.logId,
          metricDefinitionId: value.metricDefinitionId,
          numberValue: value.numberValue ?? null,
          textValue: value.textValue ?? null,
          booleanValue: value.booleanValue ?? null,
        })),
      });
    }
  });
  await recalculateRoutineLogStimulus(params.logId);

  revalidateRoutineSurfaces(params.routineId);
  if (params.preferredClimbingGrades) {
    await updateSessionRoutineTemplateConfig(params.routineId, {
      preferredClimbingGrades: sanitizePreferredClimbingGrades(params.preferredClimbingGrades),
    });
  }
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
