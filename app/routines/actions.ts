"use server";

import { deriveExerciseLibraryKind, isMissingExerciseLibraryKindError } from "@/lib/exercise-library";
import { inferExerciseMetadataSlugs, parseTagNames, ROUTINE_METADATA_SELECTABLE_KINDS } from "@/lib/metadata";
import { activitiesByFamily } from "@/lib/activity-families";

// Validate the supportsSports submitted by the routine form against
// the activity registry — only sport-family slugs are allowed, dedup
// + lexsort for stable storage.
const VALID_SPORT_SLUGS = new Set(activitiesByFamily("sports").map((s) => s.slug));
function parseSupportsSports(raw: string[]): string[] {
  const filtered = raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && VALID_SPORT_SLUGS.has(s));
  return Array.from(new Set(filtered)).sort();
}
import { parseSessionGradeValue } from "@/lib/session-templates";
import { recalculateRoutineLogStimulus } from "@/lib/stimulus";
import { createExerciseZoneActivitiesForLog } from "@/lib/zone-activities";
import { getAppDayRange, parseAppDateTimeLocal } from "@/lib/dates";
import { exerciseUnitLabel, findExerciseNameMatch, normalizeExerciseName } from "@/lib/exercises";
import { compatibleActivitySlugs, normalizeSpotName } from "@/lib/activity-spots";
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
import { revalidateAllLogSurfaces } from "@/lib/revalidate-helpers";
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

type ZoneTagInput = {
  zoneSlugs: string[];
  label: string;
  intensity?: string | null;
};

type PainCheckInput = {
  context?: "AT_REST" | "DURING_ACTIVITY" | "AFTER_ACTIVITY" | "MORNING" | "GENERAL";
  rows: Array<{ zoneSlug: string; level: number }>;
};

async function applyZoneTagsToLog(
  logId: string,
  performedAt: Date,
  tags: ZoneTagInput | null | undefined,
) {
  if (!tags) return;
  const slugs = Array.from(new Set((tags.zoneSlugs ?? []).map((s) => String(s).trim()).filter(Boolean)));
  if (slugs.length === 0) return;
  const zones = await prisma.bodyZone.findMany({
    where: { slug: { in: slugs } },
    select: { id: true },
  });
  if (zones.length === 0) return;
  await prisma.zoneActivity.createMany({
    data: zones.map((zone) => ({
      zoneId: zone.id,
      routineLogId: logId,
      performedAt,
      source: "SPORT_TAG",
      label: tags.label?.trim() || "Sport session",
      intensity: tags.intensity?.trim() || null,
    })),
  });
}

async function applyPainCheckToLog(
  logId: string,
  painCheck: PainCheckInput | null | undefined,
) {
  if (!painCheck || !painCheck.rows || painCheck.rows.length === 0) return;
  const validContexts = new Set(["AT_REST", "DURING_ACTIVITY", "AFTER_ACTIVITY", "MORNING", "GENERAL"]);
  const context = painCheck.context && validContexts.has(painCheck.context) ? painCheck.context : "AFTER_ACTIVITY";
  const rows = painCheck.rows
    .map((row) => ({
      zoneSlug: String(row.zoneSlug || "").trim(),
      level: Math.max(0, Math.min(10, Math.round(Number(row.level)))),
    }))
    .filter((row) => row.zoneSlug && row.level > 0);
  if (rows.length === 0) return;
  const zones = await prisma.bodyZone.findMany({
    where: { slug: { in: rows.map((r) => r.zoneSlug) } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(zones.map((z) => [z.slug, z.id]));
  const data = rows
    .map((row) => {
      const zoneId = idBySlug.get(row.zoneSlug);
      if (!zoneId) return null;
      return { zoneId, level: row.level, context, routineLogId: logId };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  if (data.length === 0) return;
  await prisma.painLog.createMany({ data });
}

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

// Frequency target parsing — Phase 1 cleanup.
// The legacy per-routine target columns are gone; the canonical target is now a
// FrequencyGoal row linked via FrequencyGoalRoutine. This parser still produces
// the legacy shape for compatibility with downstream helpers like
// suggestedTimesPerWeekForRoutineTarget(); the actual write happens in
// syncRoutineFrequencyGoal() below.
function parseRoutineFrequencyTarget(formData: FormData) {
  const enabled = String(formData.get("frequencyTargetEnabled") || "").trim() === "1";
  // Substitute routine ids — present whether or not a target is enabled, but
  // only persisted when enabled (no target → no goal → nothing to attach to).
  const substituteRoutineIds = formData
    .getAll("substituteRoutineId")
    .map((v) => String(v || "").trim())
    .filter((v) => v.length > 0);

  if (!enabled) {
    return {
      frequencyGoalEnabled: false,
      targetFrequencyCount: null,
      targetFrequencyUnit: null,
      targetFrequencyInterval: null,
      substituteRoutineIds: [] as string[],
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
    frequencyGoalEnabled: true,
    targetFrequencyCount: Math.floor(targetFrequencyCount),
    targetFrequencyUnit,
    targetFrequencyInterval: Math.floor(targetFrequencyInterval),
    substituteRoutineIds,
  } as const;
}

// Persist a routine's "primary" frequency target as a FrequencyGoal record.
// Convention: a routine's primary goal has the deterministic id `fg_<routineId>`
// so the upsert is straightforward and 1-to-1 routine→goal lookup is trivial.
// Multi-routine goals (set up through the Goals UI) live alongside this with
// non-deterministic ids and are unaffected.
async function syncRoutineFrequencyGoal(
  routineId: string,
  routineName: string,
  target: {
    frequencyGoalEnabled: boolean;
    targetFrequencyCount: number | null;
    targetFrequencyUnit: RoutineFrequencyUnit | null;
    targetFrequencyInterval: number | null;
    substituteRoutineIds?: string[];
  }
) {
  const goalId = `fg_${routineId}`;
  const valid =
    target.frequencyGoalEnabled &&
    target.targetFrequencyCount != null &&
    target.targetFrequencyCount > 0 &&
    target.targetFrequencyUnit != null &&
    target.targetFrequencyInterval != null &&
    target.targetFrequencyInterval > 0;

  if (!valid) {
    // Clear the routine's primary goal if it exists. Cascade will clean up
    // ALL FrequencyGoalRoutine join rows (primary + substitutes).
    await prisma.frequencyGoal.deleteMany({ where: { id: goalId } });
    return;
  }

  await prisma.frequencyGoal.upsert({
    where: { id: goalId },
    update: {
      name: `${routineName} frequency goal`,
      targetCount: target.targetFrequencyCount!,
      targetInterval: target.targetFrequencyInterval!,
      targetUnit: target.targetFrequencyUnit!,
      isActive: true,
    },
    create: {
      id: goalId,
      name: `${routineName} frequency goal`,
      targetCount: target.targetFrequencyCount!,
      targetInterval: target.targetFrequencyInterval!,
      targetUnit: target.targetFrequencyUnit!,
      isActive: true,
    },
  });
  // Ensure the primary join exists. Composite PK makes this idempotent. Force
  // role=PRIMARY in case a stale row had been demoted.
  await prisma.frequencyGoalRoutine.upsert({
    where: { goalId_routineId: { goalId, routineId } },
    update: { role: "PRIMARY" },
    create: { goalId, routineId, role: "PRIMARY" },
  });

  // Reconcile substitute links — remove any prior substitute that's no longer
  // checked, then upsert each currently-checked one. The primary is excluded
  // from substitutes (a routine can't substitute for itself).
  const requestedSubs = (target.substituteRoutineIds ?? []).filter((id) => id !== routineId);
  await prisma.frequencyGoalRoutine.deleteMany({
    where: {
      goalId,
      role: "SUBSTITUTE",
      routineId: { notIn: requestedSubs.length > 0 ? requestedSubs : ["__none__"] },
    },
  });
  for (const subId of requestedSubs) {
    await prisma.frequencyGoalRoutine.upsert({
      where: { goalId_routineId: { goalId, routineId: subId } },
      update: { role: "SUBSTITUTE" },
      create: { goalId, routineId: subId, role: "SUBSTITUTE" },
    });
  }
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

async function syncRoutineMetadataGroupsTx(tx: PrismaTx, routineId: string, groupIds: string[]) {
  const current = await tx.routineMetadataGroup.findMany({
    where: { routineId },
    select: { groupId: true },
  });
  const currentIds = new Set(current.map((entry) => entry.groupId));
  const nextIds = new Set(groupIds);

  await tx.routineMetadataGroup.deleteMany({
    where: {
      routineId,
      groupId: { notIn: groupIds.length > 0 ? groupIds : ["__none__"] },
    },
  });

  for (const groupId of nextIds) {
    if (currentIds.has(groupId)) continue;
    await tx.routineMetadataGroup.create({ data: { routineId, groupId } });
  }
}

async function mergeWorkoutExerciseMetadataIntoRoutineTx(tx: PrismaTx, routineId: string, exerciseIds: string[]) {
  const uniqueExerciseIds = Array.from(
    new Set(
      exerciseIds
        .map((exerciseId) => String(exerciseId || "").trim())
        .filter((exerciseId) => exerciseId.length > 0)
    )
  );

  const [currentRoutineGroups, exerciseMetadataGroups, exercises] = await Promise.all([
    tx.routineMetadataGroup.findMany({
      where: { routineId },
      select: { groupId: true },
    }),
    uniqueExerciseIds.length > 0
      ? tx.exerciseMetadataGroup.findMany({
          where: { exerciseId: { in: uniqueExerciseIds } },
          select: { groupId: true },
        })
      : Promise.resolve([]),
    uniqueExerciseIds.length > 0
      ? tx.exercise.findMany({
          where: { id: { in: uniqueExerciseIds } },
          select: { name: true },
        })
      : Promise.resolve([]),
  ]);

  const inferredExerciseSlugs = Array.from(
    new Set(exercises.flatMap((exercise) => inferExerciseMetadataSlugs(exercise.name)))
  );
  const inferredExerciseMetadataGroups =
    inferredExerciseSlugs.length > 0
      ? await tx.metadataGroup.findMany({
          where: { slug: { in: inferredExerciseSlugs } },
          select: { id: true },
        })
      : [];

  const mergedGroupIds = Array.from(
    new Set([
      ...currentRoutineGroups.map((entry) => entry.groupId),
      ...exerciseMetadataGroups.map((entry) => entry.groupId),
      ...inferredExerciseMetadataGroups.map((entry) => entry.id),
    ])
  );

  // TODO(workout-metadata): If a workout exercise is removed from the template and the routine keeps getting logged
  // without it for long enough, consider pruning stale derived routine metadata instead of only merging it forward.
  await syncRoutineMetadataGroupsTx(tx, routineId, mergedGroupIds);
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
    metricKey: string;
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
        metricKey: definition.key,
        numberValue: definition.valueType === "INTEGER" ? Math.round(input.numberValue ?? 0) : input.numberValue ?? null,
        textValue: null,
        booleanValue: null,
      });
      continue;
    }

    if (definition.valueType === "BOOLEAN") {
      sanitizedValues.push({
        metricDefinitionId: definition.id,
        metricKey: definition.key,
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
      metricKey: definition.key,
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
        metricKey: definition.key,
        numberValue: null,
        textValue: highestFlashGrade,
        booleanValue: null,
      });
    }
    if (definition.key === "highest_send_grade" && highestSendGrade) {
      sanitizedByDefinitionId.set(definition.id, {
        metricDefinitionId: definition.id,
        metricKey: definition.key,
        numberValue: null,
        textValue: highestSendGrade,
        booleanValue: null,
      });
    }
  }

  return Array.from(sanitizedByDefinitionId.values());
}

function sessionDistanceMiFromValues(
  values: Array<{
    metricKey: string;
    numberValue: number | null;
  }>
) {
  const distanceValue = values.find((value) => value.metricKey === "distance_mi")?.numberValue;
  return Number.isFinite(distanceValue) ? distanceValue : null;
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

  await mergeWorkoutExerciseMetadataIntoRoutineTx(
    tx,
    routineId,
    exercises.map((exercise) => exercise.exerciseId)
  );
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

// Thin wrapper around the shared helper so existing call sites in this
// file keep their familiar name. Centralizing the surface list in
// lib/revalidate-helpers keeps every action — routines, settings,
// media, location detail, etc. — in sync without each having to
// re-list the activity-world paths.
function revalidateRoutineSurfaces(routineId?: string) {
  revalidateAllLogSurfaces(routineId);
}

export async function createRoutine(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const domain = String(formData.get("domain") || "general").trim() || "general";
  const kind = normalizeRoutineKind(String(formData.get("kind") || "COMPLETION"));
  const subtype = normalizeRoutineSubtype(kind, String(formData.get("subtype") || ""));
  const frequencyTarget = parseRoutineFrequencyTarget(formData);
  const postCreate = String(formData.get("postCreate") || "").trim();
  const sessionTemplateId = await getValidSessionTemplateId(formData.get("sessionTemplateId"));
  const selectedGroupIds = await getValidMetadataGroupIds(formData.getAll("metadataGroupIds").map(String), "routine");
  const tagNames = parseTagNames(String(formData.get("tags") || ""));
  const supportsSports = parseSupportsSports(formData.getAll("supportsSports").map(String));
  // COMPLETION routines can opt in to capturing optional per-session duration
  // (cold plunge, sauna, etc.). The flag is hidden for other kinds — they
  // already record duration through their main log shape — so we silently
  // coerce it to false for non-COMPLETION submissions.
  const capturesDuration =
    kind === "COMPLETION" && String(formData.get("capturesDuration") || "") === "1";

  if (!name) throw new Error("Name is required.");

  const created = await prisma.routine.create({
    data: {
      name,
      domain,
      kind,
      subtype,
      timesPerWeek: suggestedTimesPerWeekForRoutineTarget(frequencyTarget),
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      supportsSports,
      capturesDuration,
    },
    select: { id: true },
  });

  await syncRoutineFrequencyGoal(created.id, name, frequencyTarget);
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
  if (formData.get("noRedirect") === "1") return;
  redirect("/log");
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
        domain: "general",
        kind: routine.kind,
        subtype: normalizeRoutineSubtype(routine.kind, routine.subtype),
        timesPerWeek: routine.timesPerWeek,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (routine.timesPerWeek && routine.timesPerWeek > 0) {
      await syncRoutineFrequencyGoal(created.id, routine.name, {
        frequencyGoalEnabled: true,
        targetFrequencyCount: routine.timesPerWeek,
        targetFrequencyUnit: "WEEK",
        targetFrequencyInterval: 1,
      });
    }

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
  redirect("/log");
}

export async function updateRoutine(formData: FormData) {
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const domain = String(formData.get("domain") || "general").trim() || "general";
  const kind = normalizeRoutineKind(String(formData.get("kind") || "COMPLETION"));
  const subtype = normalizeRoutineSubtype(kind, String(formData.get("subtype") || ""));
  const frequencyTarget = parseRoutineFrequencyTarget(formData);
  const postSave = String(formData.get("postSave") || "").trim();
  const sessionTemplateId = await getValidSessionTemplateId(formData.get("sessionTemplateId"));
  const selectedGroupIds = await getValidMetadataGroupIds(formData.getAll("metadataGroupIds").map(String), "routine");
  const tagNames = parseTagNames(String(formData.get("tags") || ""));
  const supportsSports = parseSupportsSports(formData.getAll("supportsSports").map(String));

  if (!id) throw new Error("Missing routine id.");
  if (!name) throw new Error("Name is required.");

  const existing = await prisma.routine.findUnique({
    where: { id },
    select: { isDeleted: true, kind: true },
  });
  if (!existing) throw new Error("Routine not found.");
  if (existing.isDeleted) {
    revalidateRoutineSurfaces();
    redirect("/log");
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
        domain,
        kind,
        subtype,
        timesPerWeek: suggestedTimesPerWeekForRoutineTarget(frequencyTarget),
        supportsSports,
      },
    });
  });

  await syncRoutineFrequencyGoal(id, name, frequencyTarget);
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
  if (formData.get("noRedirect") === "1") return;
  redirect("/log");
}

export async function updateRoutineFrequencyTarget(formData: FormData) {
  const routineId = String(formData.get("routineId") || "").trim();
  const intent = String(formData.get("intent") || "save").trim();
  if (!routineId) throw new Error("Missing routine id.");

  const existing = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { id: true, name: true, isDeleted: true },
  });
  if (!existing) throw new Error("Routine not found.");
  if (existing.isDeleted) {
    revalidateRoutineSurfaces(routineId);
    return;
  }

  if (intent === "clear") {
    await syncRoutineFrequencyGoal(routineId, existing.name, {
      frequencyGoalEnabled: false,
      targetFrequencyCount: null,
      targetFrequencyUnit: null,
      targetFrequencyInterval: null,
    });
    await prisma.routine.update({
      where: { id: routineId },
      data: { timesPerWeek: null },
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
    frequencyGoalEnabled: true,
    targetFrequencyCount: Math.floor(targetFrequencyCount),
    targetFrequencyUnit,
    targetFrequencyInterval: Math.floor(targetFrequencyInterval),
  } as const;

  await syncRoutineFrequencyGoal(routineId, existing.name, frequencyTarget);
  await prisma.routine.update({
    where: { id: routineId },
    data: { timesPerWeek: suggestedTimesPerWeekForRoutineTarget(frequencyTarget) },
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
    redirect("/log");
  }

  await prisma.routine.update({
    where: { id },
    data: { isActive: !routine.isActive },
  });

  revalidateRoutineSurfaces(id);
  redirect("/log");
}

export async function deleteRoutine(id: string) {
  if (!id) throw new Error("Missing routine id.");

  await prisma.$transaction([
    prisma.routine.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    }),
    // Drop the per-routine FrequencyGoal companion (id = `fg_<routineId>`) —
    // otherwise it lingers as an orphan and surfaces on /goals pointing at a
    // routine that no longer exists. Group FrequencyGoals are unaffected; they
    // just lose the join row via the cascade on FrequencyGoalRoutine.
    prisma.frequencyGoal.deleteMany({ where: { id: `fg_${id}` } }),
  ]);

  revalidateRoutineSurfaces(id);
  redirect("/log");
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
  // Substitute routine ids — render as "covered" when only they fire on a
  // day. We dedup against the primary list; a routine listed in both is
  // treated as PRIMARY (the stronger claim wins).
  const rawSubs = formData.getAll("substituteRoutineIds").map(String).filter(Boolean);
  const primarySet = new Set(routineIds);
  const substituteRoutineIds = Array.from(new Set(rawSubs.filter((id) => !primarySet.has(id))));

  // "Also count when these appear" — optional broaden-the-net triggers.
  // - triggerExerciseIds: catches any log containing one of these exercises
  //   (including quick workouts that aren't in any saved routine).
  // - triggerSubtypes: catches any log whose routine's activity-type subtype
  //   is in this set (e.g. "any CLIMBING session", "any STRENGTH workout").
  const triggerExerciseIds = Array.from(
    new Set(formData.getAll("triggerExerciseIds").map(String).filter(Boolean))
  );
  const triggerSubtypes = Array.from(
    new Set(
      formData
        .getAll("triggerSubtypes")
        .map((v) => String(v).trim().toUpperCase())
        .filter(Boolean)
    )
  );
  // Endurance type/family triggers — populated by the new goal builder's
  // activity-type picker. A goal can mix routine, subtype, type, and
  // family triggers freely; the rollup ORs them all together.
  const triggerActivityTypeIds = Array.from(
    new Set(formData.getAll("triggerActivityTypeIds").map(String).filter(Boolean))
  );
  const triggerActivityFamilyIds = Array.from(
    new Set(formData.getAll("triggerActivityFamilyIds").map(String).filter(Boolean))
  );
  // Minimum trigger-exercise sets gate for the exercise-trigger path. Clamp
  // to [1, 99] so a typo can't make a goal impossible to satisfy. Defaults
  // to 1 when absent — same as the DB default and pre-feature behavior.
  const rawMinSets = String(formData.get("triggerMinSets") ?? "").trim();
  const parsedMinSets = Number(rawMinSets);
  const triggerMinSets = Number.isFinite(parsedMinSets) && parsedMinSets >= 1
    ? Math.min(99, Math.floor(parsedMinSets))
    : 1;

  // Weekday mask: posted as multiple form fields named "weekday" with bit
  // values 1, 2, 4, 8, 16, 32, 64 (Sun..Sat). We OR them and clamp to a
  // valid 0–127 range; null means "any day counts" (flexible weekly).
  let weekdayMask: number | null = null;
  if (targetUnit === "WEEK") {
    let mask = 0;
    for (const raw of formData.getAll("weekday")) {
      const bit = Math.floor(Number(String(raw)));
      if (Number.isFinite(bit) && bit > 0 && bit <= 64) mask |= bit;
    }
    weekdayMask = mask > 0 ? mask & 0x7f : null;
  }

  if (!name) throw new Error("Goal name is required.");
  if (!Number.isFinite(targetCount) || targetCount <= 0) throw new Error("Target count must be greater than 0.");
  if (!Number.isFinite(targetInterval) || targetInterval <= 0) throw new Error("Target interval must be greater than 0.");
  if (!targetUnit) throw new Error("Target unit is required.");

  return {
    name,
    targetCount,
    targetInterval,
    targetUnit,
    weekdayMask,
    routineIds,
    substituteRoutineIds,
    triggerExerciseIds,
    triggerSubtypes,
    triggerActivityTypeIds,
    triggerActivityFamilyIds,
    triggerMinSets,
  };
}

// Before writing a join row that references a synthetic sport routine
// (sports-{slug}-synthetic), make sure that routine actually exists.
// The goal form lets users pick a sport they haven't added on /log
// yet — opting in via the goal is itself an opt-in for the sport.
//
// Side-effect note: ensureSportSelected() upserts with isActive=true,
// so creating a goal for a sport the user PREVIOUSLY removed from
// /log will silently re-add it. This is intentional — a goal
// targeting a non-existent / inactive sport routine would be
// confusing dead state. The /log SPORT section already shows the
// sport again on next render, no separate notification needed
// because the goal form is itself the affirmative "I want this
// sport tracked" action.
async function ensureSyntheticSportRoutinesForGoal(routineIds: string[]) {
  const { isSyntheticSportRoutineId, sportSlugFromRoutineId, ensureSportSelected } = await import(
    "@/lib/synthetic-sport-routines"
  );
  const slugs = Array.from(
    new Set(
      routineIds
        .filter(isSyntheticSportRoutineId)
        .map(sportSlugFromRoutineId)
        .filter((s): s is string => Boolean(s))
    )
  );
  for (const slug of slugs) {
    await ensureSportSelected(slug);
  }
}

async function syncFrequencyGoalRoutines(
  goalId: string,
  routineIds: string[],
  substituteRoutineIds: string[] = []
) {
  // Make sure any sport routines referenced exist (sports-{slug}-
  // synthetic) before we try to write the FK rows. The goal can
  // target a sport the user hasn't added on /log yet; we opt them
  // in automatically.
  await ensureSyntheticSportRoutinesForGoal([...routineIds, ...substituteRoutineIds]);

  await prisma.frequencyGoalRoutine.deleteMany({ where: { goalId } });
  const rows = [
    ...routineIds.map((routineId) => ({ goalId, routineId, role: "PRIMARY" as const })),
    ...substituteRoutineIds.map((routineId) => ({ goalId, routineId, role: "SUBSTITUTE" as const })),
  ];
  if (rows.length > 0) {
    await prisma.frequencyGoalRoutine.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }
}

// Mirror of syncFrequencyGoalRoutines but for the trigger-exercise join.
// Wipe-and-rewrite is simpler than diffing and the table is tiny per goal.
async function syncFrequencyGoalTriggerExercises(goalId: string, exerciseIds: string[]) {
  await prisma.frequencyGoalTriggerExercise.deleteMany({ where: { goalId } });
  const rows = Array.from(new Set(exerciseIds)).map((exerciseId) => ({ goalId, exerciseId }));
  if (rows.length > 0) {
    await prisma.frequencyGoalTriggerExercise.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }
}

export async function createFrequencyGoal(formData: FormData) {
  const {
    name,
    targetCount,
    targetInterval,
    targetUnit,
    weekdayMask,
    routineIds,
    substituteRoutineIds,
    triggerExerciseIds,
    triggerSubtypes,
    triggerActivityTypeIds,
    triggerActivityFamilyIds,
    triggerMinSets,
  } = parseFrequencyGoalFields(formData);

  const goal = await prisma.frequencyGoal.create({
    data: {
      name,
      targetCount,
      targetInterval,
      targetUnit,
      weekdayMask,
      triggerSubtypes,
      triggerActivityTypeIds,
      triggerActivityFamilyIds,
      triggerMinSets,
    },
    select: { id: true },
  });
  await syncFrequencyGoalRoutines(goal.id, routineIds, substituteRoutineIds);
  await syncFrequencyGoalTriggerExercises(goal.id, triggerExerciseIds);

  revalidatePath("/log");
  revalidatePath("/goals");
  if (formData.get("noRedirect") === "1") return;
  redirect("/goals");
}

export async function updateFrequencyGoal(formData: FormData) {
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Missing goal id.");
  const {
    name,
    targetCount,
    targetInterval,
    targetUnit,
    weekdayMask,
    routineIds,
    substituteRoutineIds,
    triggerExerciseIds,
    triggerSubtypes,
    triggerActivityTypeIds,
    triggerActivityFamilyIds,
    triggerMinSets,
  } = parseFrequencyGoalFields(formData);

  await prisma.frequencyGoal.update({
    where: { id },
    data: {
      name,
      targetCount,
      targetInterval,
      targetUnit,
      weekdayMask,
      triggerSubtypes,
      triggerActivityTypeIds,
      triggerActivityFamilyIds,
      triggerMinSets,
    },
  });
  await syncFrequencyGoalRoutines(id, routineIds, substituteRoutineIds);
  await syncFrequencyGoalTriggerExercises(id, triggerExerciseIds);

  revalidatePath("/log");
  revalidatePath("/goals");
  if (formData.get("noRedirect") === "1") return;
  redirect("/goals");
}

export async function deleteFrequencyGoal(id: string) {
  if (!id) throw new Error("Missing goal id.");
  await prisma.frequencyGoal.delete({ where: { id } });
  revalidatePath("/log");
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
  await createExerciseZoneActivitiesForLog(prisma, log.id);
  revalidateRoutineSurfaces(params.routineId);
}

export async function logRoutineCompletion(routineId: string) {
  await createCompletionLog({ routineId });
}

export async function logCompletionWithDate(routineId: string, formData: FormData) {
  const performedAtLocal = String(formData.get("performedAtLocal") || "").trim();
  await createCompletionLog({ routineId, performedAtLocal: performedAtLocal || undefined });
}

export async function setCompletionForDay(routineId: string, ymd: string, done: boolean) {
  if (!routineId) throw new Error("Missing routine id.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("Invalid date.");
  await ensureRoutineKind(routineId, "COMPLETION");

  if (done) {
    const log = await prisma.routineLog.create({
      data: {
        routineId,
        performedAt: parseAppDateTimeLocal(`${ymd}T12:00`),
      },
      select: { id: true },
    });
    await recalculateRoutineLogStimulus(log.id);
    await createExerciseZoneActivitiesForLog(prisma, log.id);
  } else {
    // For capturesDuration routines, the "bare completion" log may have
    // a durationSec set — relax that filter so unchecking removes the
    // tap-recorded log even after the user has added minutes to it.
    // Other completion routines keep the strict durationSec:null filter
    // so a manual-log entry with a duration isn't deleted by tapping the
    // day card to uncheck.
    const routine = await prisma.routine.findUnique({
      where: { id: routineId },
      select: { capturesDuration: true },
    });
    const { start, end } = getAppDayRange(ymd);
    const latest = await prisma.routineLog.findFirst({
      where: {
        routineId,
        performedAt: { gte: start, lt: end },
        exercises: { none: {} },
        guidedSteps: { none: {} },
        metrics: { none: {} },
        distanceMi: null,
        ...(routine?.capturesDuration ? {} : { durationSec: null }),
        location: null,
      },
      orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    if (latest) await prisma.routineLog.delete({ where: { id: latest.id } });
  }

  revalidateRoutineSurfaces(routineId);
}

// Set the optional duration on the most-recent bare completion log for a
// given day. No-op when the routine doesn't capture duration or there's no
// matching log on that day. Pass `null` to clear an existing duration —
// the log itself stays (the day is still marked done, just without minutes).
export async function setCompletionDurationForDay(
  routineId: string,
  ymd: string,
  minutes: number | null
) {
  if (!routineId) throw new Error("Missing routine id.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("Invalid date.");

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { kind: true, capturesDuration: true },
  });
  if (!routine) throw new Error("Routine not found.");
  if (routine.kind !== "COMPLETION") throw new Error("Routine is not a completion routine.");
  if (!routine.capturesDuration) throw new Error("Routine doesn't capture duration.");

  const durationSec =
    minutes == null
      ? null
      : Number.isFinite(minutes) && minutes > 0
      ? Math.round(minutes * 60)
      : null;

  const { start, end } = getAppDayRange(ymd);
  const latest = await prisma.routineLog.findFirst({
    where: {
      routineId,
      performedAt: { gte: start, lt: end },
      exercises: { none: {} },
      guidedSteps: { none: {} },
      metrics: { none: {} },
      distanceMi: null,
      location: null,
    },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  if (!latest) return; // Day isn't marked done — nothing to attach duration to.

  await prisma.routineLog.update({
    where: { id: latest.id },
    data: { durationSec },
  });

  revalidateRoutineSurfaces(routineId);
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
  painCheck?: PainCheckInput;
}) {
  await ensureRoutineKind(params.routineId, "WORKOUT");
  const performedAt = parsePerformedAt(params.performedAtLocal);
  const logId = await prisma.$transaction(async (tx) => {
    const exercises = await sanitizeWorkoutExercises(tx, params.exercises);
    await syncWorkoutTemplateTx(tx, params.routineId, exercises);

    const loggedExercises = exercises.filter((exercise) => exercise.loggedSets.length > 0);
    if (loggedExercises.length === 0) return null;

    const log = await tx.routineLog.create({
      data: {
        routineId: params.routineId,
        performedAt,
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
  if (logId) {
    await recalculateRoutineLogStimulus(logId);
    await createExerciseZoneActivitiesForLog(prisma, logId);
    await applyPainCheckToLog(logId, params.painCheck);
  }

  revalidateRoutineSurfaces(params.routineId);
  return logId;
}

export async function logAdHocWorkout(params: {
  /** Training Balance domain the user chose (or auto-suggested) for this
   *  one-off session. Used to find-or-create the placeholder routine that
   *  hosts the log, so the contribution lands in the right bar. */
  domain: import("@/lib/quick-log").QuickLogDomain;
  /** Activity subtype (STRENGTH / HYPERTROPHY / REHAB / OTHER) — same role
   *  as `subtype` on a saved routine. Also used to pick the placeholder
   *  and to feed frequency-goal trigger-subtype matching. */
  subtype: string;
  notes?: string;
  performedAtLocal?: string;
  exercises: WorkoutExerciseInput[];
}) {
  const { findOrCreateQuickLogPlaceholder, sanitizeQuickLogDomain, sanitizeQuickWorkoutSubtype } =
    await import("@/lib/quick-log");
  const domain = sanitizeQuickLogDomain(params.domain);
  const subtype = sanitizeQuickWorkoutSubtype(params.subtype);

  const result = await prisma.$transaction(async (tx) => {
    const placeholder = await findOrCreateQuickLogPlaceholder(tx, {
      kind: "WORKOUT",
      domain,
      subtype,
    });
    const exercises = await sanitizeWorkoutExercises(tx, params.exercises);
    const loggedExercises = exercises.filter((exercise) => exercise.loggedSets.length > 0);
    if (loggedExercises.length === 0) return { logId: null as string | null, routineId: placeholder.id };

    const log = await tx.routineLog.create({
      data: {
        routineId: placeholder.id,
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
    return { logId: log.id, routineId: placeholder.id };
  });

  if (result.logId) {
    await recalculateRoutineLogStimulus(result.logId);
    await createExerciseZoneActivitiesForLog(prisma, result.logId);
  }
  revalidateRoutineSurfaces(result.routineId);
}

export async function createWorkoutLogExerciseOption(params: {
  /** Optional — when absent (e.g. the quick-workout flow, which has no
   *  caller-side routine), we skip the kind guard and just add the
   *  exercise to the library. */
  routineId?: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight?: boolean;
}) {
  if (params.routineId) {
    await ensureRoutineKind(params.routineId, "WORKOUT");
  }

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

  if (params.routineId) revalidateRoutineSurfaces(params.routineId);
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

/** Resolves an ActivitySpot reference for a log: either the explicit
 *  spotId, or upserts a new spot from the supplied draft fields. Returns
 *  the resolved id (or null if nothing supplied). Backfills region/coords
 *  on existing rows when the user supplies new values, but never clobbers.
 *  Mirrors the climbing version inside logSession.
 *
 *  Returns a discriminated union — when the supplied spot matches an
 *  existing ClimbLocation by OSM pin (e.g. a trail-run logged at a place
 *  already saved as a climbing crag), the caller writes the log's
 *  `climbLocationId` instead of `activitySpotId` so the two tables share
 *  one row per real-world place. */
type ResolvedSpot =
  | { kind: "activitySpot"; id: string }
  | { kind: "climbLocation"; id: string };

async function resolveActivitySpotId(input: {
  activitySlug?: string;
  activitySpotId?: string;
  newActivitySpotName?: string;
  newActivitySpotType?: string | null;
  newActivitySpotRegion?: string | null;
  newActivitySpotLatitude?: number | null;
  newActivitySpotLongitude?: number | null;
  newActivitySpotOsmType?: string | null;
  newActivitySpotOsmId?: string | null;
}): Promise<ResolvedSpot | null> {
  if (input.activitySpotId?.trim())
    return { kind: "activitySpot", id: input.activitySpotId.trim() };
  const name = input.newActivitySpotName?.trim();
  const slug = input.activitySlug?.trim();
  if (!name) return null;
  // Name supplied but no activity slug = user data we'd otherwise drop on
  // the floor. Surface it so the caller (and form) knows the spot didn't
  // land in the library, instead of silently saving only the free-text
  // location field.
  if (!slug) {
    throw new Error(
      "Can't save spot: this routine has no activity tag, so we don't know which library to put it in.",
    );
  }

  const region = input.newActivitySpotRegion?.trim() || null;
  const lat = typeof input.newActivitySpotLatitude === "number" && Number.isFinite(input.newActivitySpotLatitude)
    ? input.newActivitySpotLatitude
    : null;
  const lng = typeof input.newActivitySpotLongitude === "number" && Number.isFinite(input.newActivitySpotLongitude)
    ? input.newActivitySpotLongitude
    : null;
  const osmType = input.newActivitySpotOsmType?.trim() || null;
  const osmId = input.newActivitySpotOsmId?.trim() || null;

  // Dedup across the compatible-activity group, not just the caller's slug.
  // The picker already surfaces saved spots from compatible activities so
  // users typically tap an existing one — but if they re-type the name
  // (autocomplete miss, transcription, different routine) we still need to
  // land them on the existing record instead of cloning it under a new
  // slug. This is what kept producing parallel "Hubbard Park" rows under
  // trail-running + hiking + walking when the same spot was reused.
  //
  // Same normalized name + same OSM id (or both null) = same spot.
  // Different name = a different spot even when sharing an OSM pin (so
  // "Clinton road boulder" pinned to OSM Clinton Road stays separate
  // from a "Clinton Road" spot picked directly from OSM).
  //
  // Postgres `mode: "insensitive"` handles case, but not curly vs
  // straight apostrophes / quotation marks — comparing in JS after a
  // narrow DB lookup catches that without scanning the whole table.
  const compatibleSlugs = compatibleActivitySlugs(slug);
  const slugFilter = compatibleSlugs.length > 0 ? { in: compatibleSlugs } : slug;
  const normalizedTarget = normalizeSpotName(name);

  // Cross-table dedup: if the activity is climbing-compatible (hiking,
  // trail-running) AND the user supplied an OSM pin that matches an
  // existing ClimbLocation with the same normalized name, return that
  // ClimbLocation. RoutineLog can carry climbLocationId for any kind, so
  // the log links to the same row a climbing session would use — no
  // parallel "Paugussett State Forest" in both tables. Restricted to
  // OSM-pinned matches because that's the only proof the two rows are
  // the same real-world place; name-only matches across tables are too
  // weak to merge silently (the migration script surfaces them for a
  // manual review).
  if (osmType && osmId && compatibleSlugs.includes("climbing")) {
    const climbMatch = await prisma.climbLocation.findFirst({
      where: { osmType, osmId },
      select: { id: true, name: true, region: true, latitude: true, longitude: true },
    });
    if (climbMatch && normalizeSpotName(climbMatch.name) === normalizedTarget) {
      const updates: { region?: string; latitude?: number; longitude?: number } = {};
      if (region && !climbMatch.region) updates.region = region;
      if (lat !== null && climbMatch.latitude == null) updates.latitude = lat;
      if (lng !== null && climbMatch.longitude == null) updates.longitude = lng;
      if (Object.keys(updates).length > 0) {
        await prisma.climbLocation.update({ where: { id: climbMatch.id }, data: updates });
      }
      return { kind: "climbLocation", id: climbMatch.id };
    }
  }

  const candidates = await prisma.activitySpot.findFirst({
    where: {
      activitySlug: slugFilter,
      ...(osmType && osmId
        ? { osmType, osmId }
        : { osmType: null, osmId: null }),
    },
    select: { id: true, name: true, region: true, latitude: true, longitude: true },
  });
  // If the narrow filter returned a row whose name normalizes to the same
  // value, use it. Otherwise, broaden to find any same-OSM / same-slug
  // candidates with a name match (handles the rare case where the picker
  // saved a curly-apostrophe variant first).
  let existing: { id: string; region: string | null; latitude: number | null; longitude: number | null } | null =
    candidates && normalizeSpotName(candidates.name) === normalizedTarget ? candidates : null;
  if (!existing) {
    const broad = await prisma.activitySpot.findMany({
      where: {
        activitySlug: slugFilter,
        ...(osmType && osmId
          ? { osmType, osmId }
          : { osmType: null, osmId: null }),
      },
      select: { id: true, name: true, region: true, latitude: true, longitude: true },
    });
    existing = broad.find((c) => normalizeSpotName(c.name) === normalizedTarget) ?? null;
  }
  if (existing) {
    const updates: { region?: string; latitude?: number; longitude?: number } = {};
    if (region && !existing.region) updates.region = region;
    if (lat !== null && existing.latitude == null) updates.latitude = lat;
    if (lng !== null && existing.longitude == null) updates.longitude = lng;
    if (Object.keys(updates).length > 0) {
      await prisma.activitySpot.update({ where: { id: existing.id }, data: updates });
    }
    return { kind: "activitySpot", id: existing.id };
  }
  const created = await prisma.activitySpot.create({
    data: {
      activitySlug: slug,
      name,
      type: input.newActivitySpotType ?? null,
      region,
      latitude: lat,
      longitude: lng,
      osmType,
      osmId,
    },
    select: { id: true },
  });
  return { kind: "activitySpot", id: created.id };
}

// Helper that flattens the discriminated ResolvedSpot back into the two
// nullable FK columns on RoutineLog. `existing` (when provided) is the
// existing climbLocationId set elsewhere — used by the session log path
// where a separate climbing template might already have resolved one.
function splitResolvedSpot(
  resolved: ResolvedSpot | null,
  existing?: { climbLocationId?: string | null }
): { activitySpotId: string | null; climbLocationId: string | null } {
  const fromExisting = existing?.climbLocationId ?? null;
  if (!resolved) return { activitySpotId: null, climbLocationId: fromExisting };
  if (resolved.kind === "activitySpot")
    return { activitySpotId: resolved.id, climbLocationId: fromExisting };
  return { activitySpotId: null, climbLocationId: resolved.id };
}

export async function logCardio(params: {
  routineId: string;
  distanceMi: number;
  durationSec: number;
  elevationGainFt?: number | null;
  location?: string;
  notes?: string;
  performedAtLocal?: string;
  metrics?: MetricInput[];
  activitySlug?: string;
  /** Activity type for the endurance type-driven model. Required for new
   *  logs against the synthetic Endurance routine; preselected for legacy
   *  endurance routines based on their migrated type. Stored on the log
   *  so the progress view can roll up by type/family without inspecting
   *  the routine. */
  activityTypeId?: string;
  /** Structured interval payload for types where usesIntervals is true
   *  (Interval Run, Sprint, …). Persisted as JSON on RoutineLog so the
   *  log detail page can render the reps/work/rest structure later. */
  intervalsConfig?: {
    reps: number | null;
    workDistanceM: number | null;
    workDurationSec: number | null;
    restSec: number | null;
  };
  activitySpotId?: string;
  /** Cross-activity link: cardio log can reference an existing climbing
   *  crag's location (e.g. trail run at a crag the user has saved
   *  through the climbing flow) without duplicating the spot. */
  climbLocationId?: string;
  newActivitySpotName?: string;
  newActivitySpotType?: string | null;
  newActivitySpotRegion?: string | null;
  newActivitySpotLatitude?: number | null;
  newActivitySpotLongitude?: number | null;
  newActivitySpotOsmType?: string | null;
  newActivitySpotOsmId?: string | null;
  painCheck?: PainCheckInput;
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

  const resolved = await resolveActivitySpotId(params);
  const split = splitResolvedSpot(resolved, { climbLocationId: params.climbLocationId?.trim() || null });

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
      location: params.location?.trim() || null,
      activitySpotId: split.activitySpotId,
      climbLocationId: split.climbLocationId,
      activityTypeId: params.activityTypeId ?? null,
      // Persist the structured interval payload verbatim when present.
      // Prisma's Json scalar accepts the object directly; null clears
      // any prior structured data on this log.
      intervalsConfig: params.intervalsConfig ?? undefined,
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
  await createExerciseZoneActivitiesForLog(prisma, log.id);
  await applyPainCheckToLog(log.id, params.painCheck);

  revalidateRoutineSurfaces(params.routineId);
  return log.id;
}

export async function logRun(params: {
  routineId: string;
  distanceMi: number;
  durationSec: number;
  elevationGainFt?: number | null;
  location?: string;
  notes?: string;
  performedAtLocal?: string;
  activitySlug?: string;
  activityTypeId?: string;
  intervalsConfig?: {
    reps: number | null;
    workDistanceM: number | null;
    workDurationSec: number | null;
    restSec: number | null;
  };
  activitySpotId?: string;
  climbLocationId?: string;
  newActivitySpotName?: string;
  newActivitySpotType?: string | null;
  newActivitySpotRegion?: string | null;
  newActivitySpotLatitude?: number | null;
  newActivitySpotLongitude?: number | null;
  newActivitySpotOsmType?: string | null;
  newActivitySpotOsmId?: string | null;
  painCheck?: PainCheckInput;
}) {
  return logCardio(params);
}

export async function logGuided(params: {
  routineId: string;
  durationSec?: number | null;
  notes?: string;
  performedAtLocal?: string;
  steps?: GuidedStepInput[];
  painCheck?: PainCheckInput;
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
  await createExerciseZoneActivitiesForLog(prisma, log.id);
  await applyPainCheckToLog(log.id, params.painCheck);

  revalidateRoutineSurfaces(params.routineId);
  return log.id;
}

export async function getClimbLocations(): Promise<
  Array<{ id: string; name: string; type: string }>
> {
  return prisma.climbLocation.findMany({
    select: { id: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

/** Resolves a ClimbLocation reference for a log: either the explicit
 *  climbLocationId, or upserts a new one from the supplied draft fields.
 *  Returns the resolved id (or null if nothing supplied). Backfills
 *  region/coords/OSM identity onto existing records when the user supplied
 *  new values, but never clobbers. Mirrors `resolveActivitySpotId`. */
async function resolveClimbLocationId(input: {
  climbLocationId?: string;
  newClimbLocationName?: string;
  newClimbLocationType?: "GYM" | "CRAG";
  newClimbLocationRegion?: string | null;
  newClimbLocationLatitude?: number | null;
  newClimbLocationLongitude?: number | null;
  newClimbLocationOsmType?: string | null;
  newClimbLocationOsmId?: string | null;
}): Promise<string | null> {
  if (input.climbLocationId?.trim()) return input.climbLocationId.trim();
  const name = input.newClimbLocationName?.trim();
  if (!name) return null;
  const type = input.newClimbLocationType ?? "GYM";
  const region = input.newClimbLocationRegion?.trim() || null;
  const latitude = typeof input.newClimbLocationLatitude === "number" && Number.isFinite(input.newClimbLocationLatitude)
    ? input.newClimbLocationLatitude
    : null;
  const longitude = typeof input.newClimbLocationLongitude === "number" && Number.isFinite(input.newClimbLocationLongitude)
    ? input.newClimbLocationLongitude
    : null;
  const osmType = input.newClimbLocationOsmType?.trim() || null;
  const osmId = input.newClimbLocationOsmId?.trim() || null;

  // Dedup on (normalized name, type, osmId-or-null). Same name + same type
  // + same OSM pin (or both null) = same record. Different name = different
  // record even when sharing an OSM pin — keeps custom-named spots distinct
  // from their OSM-default-named counterparts (e.g., "Buttermilks" vs the
  // OSM "Bishop" both pinned to Bishop's OSM id).
  //
  // Name comparison is done in JS after a narrow DB lookup so curly vs
  // straight apostrophes ("Will Warren's Den" vs "Will Warren's Den")
  // fold to the same record — Postgres can't normalize those natively.
  const normalizedTarget = normalizeSpotName(name);
  const climbCandidates = await prisma.climbLocation.findMany({
    where: {
      type,
      ...(osmType && osmId
        ? { osmType, osmId }
        : { osmType: null, osmId: null }),
    },
    select: { id: true, name: true, region: true, latitude: true, longitude: true },
  });
  const existing = climbCandidates.find((c) => normalizeSpotName(c.name) === normalizedTarget) ?? null;
  if (existing) {
    const updates: { region?: string; latitude?: number; longitude?: number } = {};
    if (region && !existing.region) updates.region = region;
    if (latitude !== null && existing.latitude == null) updates.latitude = latitude;
    if (longitude !== null && existing.longitude == null) updates.longitude = longitude;
    if (Object.keys(updates).length > 0) {
      await prisma.climbLocation.update({ where: { id: existing.id }, data: updates });
    }
    return existing.id;
  }
  const created = await prisma.climbLocation.create({
    data: { name, type, region, latitude, longitude, osmType, osmId },
    select: { id: true },
  });
  return created.id;
}

/** Walk a draft list and resolve any `newAreaName` strings into ClimbArea
 *  rows scoped to `locationId`. Mutates `areaId` in place so the caller
 *  can pass the same array straight into the ClimbAttempt createMany.
 *  Areas dedup fuzzily per location — punctuation / whitespace / case /
 *  trailing-s variants reuse the existing row ("Warm-up Wall" typed when
 *  "Warmup Wall" exists links instead of duplicating). An attempt without
 *  a location keeps its free-text `area` value and skips the FK. */
async function resolveAttemptAreas(
  attempts: Array<{
    area?: string | null;
    areaId?: string | null;
    newAreaName?: string | null;
  }>,
  locationId: string | null,
): Promise<void> {
  if (!locationId) return;
  const needsResolution = attempts.some(
    (a) => !a.areaId && (a.newAreaName?.trim() || a.area?.trim())
  );
  if (!needsResolution) return;

  // One fetch for the location's areas; fuzzy-match in memory. Area counts
  // per location are tiny (sectors at a crag), so this beats per-name
  // queries and lets us normalize harder than SQL `mode: insensitive`.
  const { fuzzyDuplicateKey } = await import("@/lib/activity-spots");
  const existingAreas = await prisma.climbArea.findMany({
    where: { locationId },
    select: { id: true, name: true },
  });
  const keyToId = new Map(existingAreas.map((a) => [fuzzyDuplicateKey(a.name), a.id]));

  for (const attempt of attempts) {
    if (attempt.areaId) continue;
    const raw = attempt.newAreaName?.trim() || attempt.area?.trim();
    if (!raw) continue;
    const key = fuzzyDuplicateKey(raw);
    if (!key) continue;
    let areaId = keyToId.get(key);
    if (!areaId) {
      areaId = (await prisma.climbArea.create({
        data: { locationId, name: raw },
        select: { id: true },
      })).id;
      keyToId.set(key, areaId);
    }
    attempt.areaId = areaId;
  }
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
  climbAttempts?: Array<{
    discipline: "BOULDER" | "TOP_ROPE" | "SPORT_LEAD";
    grade: string;
    gradeSystem: "BOULDER_V" | "YOSEMITE";
    outcome: "FLASH" | "ONSIGHT" | "SEND" | "REDPOINT" | "FELL" | "PROJECT";
    area?: string | null;
    areaId?: string | null;
    newAreaName?: string | null;
    movesCompleted?: number;
    totalMoves?: number;
    triesCount?: number | null;
    notes?: string;
    attemptOrder: number;
    problemId?: string | null;
    newProblemName?: string | null;
  }>;
  climbLocationId?: string;
  newClimbLocationName?: string;
  newClimbLocationType?: "GYM" | "CRAG";
  newClimbLocationRegion?: string | null;
  newClimbLocationLatitude?: number | null;
  newClimbLocationLongitude?: number | null;
  newClimbLocationOsmType?: string | null;
  newClimbLocationOsmId?: string | null;
  // Generic ActivitySpot — used by non-climbing sport sessions.
  activitySlug?: string;
  activitySpotId?: string;
  newActivitySpotName?: string;
  newActivitySpotType?: string | null;
  newActivitySpotRegion?: string | null;
  newActivitySpotLatitude?: number | null;
  newActivitySpotLongitude?: number | null;
  newActivitySpotOsmType?: string | null;
  newActivitySpotOsmId?: string | null;
  zoneTags?: ZoneTagInput;
  painCheck?: PainCheckInput;
}) {
  await ensureRoutineKind(params.routineId, "SESSION");
  if (params.durationSec !== null && params.durationSec !== undefined && (!Number.isFinite(params.durationSec) || params.durationSec <= 0)) {
    throw new Error("Duration must be > 0.");
  }

  const resolvedClimbLocationId = await resolveClimbLocationId(params);

  // Resolve or create ClimbProblems for attempts that name a new problem
  const resolvedAttempts = params.climbAttempts ? [...params.climbAttempts] : [];
  const newProblemKey = (name: string, grade: string) => `${name.toLowerCase().trim()}::${grade}`;
  const problemNameToId = new Map<string, string>();
  for (const attempt of resolvedAttempts) {
    if (attempt.problemId || !attempt.newProblemName?.trim()) continue;
    const name = attempt.newProblemName.trim();
    const key = newProblemKey(name, attempt.grade);
    if (problemNameToId.has(key)) {
      attempt.problemId = problemNameToId.get(key)!;
      continue;
    }
    const existing = await prisma.climbProblem.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        grade: attempt.grade,
        gradeSystem: attempt.gradeSystem,
        locationId: resolvedClimbLocationId ?? null,
      },
      select: { id: true },
    });
    const problemId = existing?.id ?? (await prisma.climbProblem.create({
      data: {
        name,
        grade: attempt.grade,
        gradeSystem: attempt.gradeSystem,
        locationId: resolvedClimbLocationId ?? null,
        notes: attempt.notes?.trim() || null,
      },
      select: { id: true },
    })).id;
    problemNameToId.set(key, problemId);
    attempt.problemId = problemId;
  }

  // Resolve / create ClimbArea rows for attempts that named a new area.
  // Areas only exist under a location, so attempts on a location-less log
  // skip the lookup (the free-text `area` field still gets saved on the
  // attempt so the value isn't lost). Areas dedup case-insensitively
  // within a location.
  await resolveAttemptAreas(resolvedAttempts, resolvedClimbLocationId ?? null);

  // Resolve generic ActivitySpot for non-climbing sport sessions. Climbing
  // uses ClimbLocation above and skips this path. If the resolver finds a
  // cross-table climb-location match it returns one instead — splitResolvedSpot
  // routes it to the correct FK column.
  const resolvedSpot = await resolveActivitySpotId(params);
  const split = splitResolvedSpot(resolvedSpot, { climbLocationId: resolvedClimbLocationId });

  const logId = await prisma.$transaction(async (tx) => {
    const log = await tx.routineLog.create({
      data: {
        routineId: params.routineId,
        performedAt: parsePerformedAt(params.performedAtLocal),
        durationSec: params.durationSec ?? null,
        location: params.location?.trim() || null,
        notes: params.notes?.trim() || null,
        climbLocationId: split.climbLocationId,
        activitySpotId: split.activitySpotId,
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
    await tx.routineLog.update({
      where: { id: log.id },
      data: { distanceMi: sessionDistanceMiFromValues(sessionMetricValues) },
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

    // Save individual climb attempts. Discipline is required for new rows
    // (the UI always sets it); the column also has a DB-level default of
    // BOULDER as a safety net for any direct API misuse.
    if (resolvedAttempts.length > 0) {
      await tx.climbAttempt.createMany({
        data: resolvedAttempts.map((attempt) => ({
          sessionLogId: log.id,
          problemId: attempt.problemId ?? null,
          discipline: attempt.discipline,
          grade: attempt.grade,
          gradeSystem: attempt.gradeSystem,
          outcome: attempt.outcome,
          area: attempt.area?.trim() || null,
          areaId: attempt.areaId ?? null,
          movesCompleted: attempt.movesCompleted ?? null,
          totalMoves: attempt.totalMoves ?? null,
          triesCount: attempt.triesCount ?? null,
          notes: attempt.notes?.trim() || null,
          attemptOrder: attempt.attemptOrder,
        })),
      });
    }

    return log.id;
  });
  if (logId) {
    await recalculateRoutineLogStimulus(logId);
    await createExerciseZoneActivitiesForLog(prisma, logId);
    await applyZoneTagsToLog(logId, parsePerformedAt(params.performedAtLocal), params.zoneTags);
    await applyPainCheckToLog(logId, params.painCheck);
  }

  revalidateRoutineSurfaces(params.routineId);
  if (params.preferredClimbingGrades) {
    await updateSessionRoutineTemplateConfig(params.routineId, {
      preferredClimbingGrades: sanitizePreferredClimbingGrades(params.preferredClimbingGrades),
    });
  }
  return logId;
}

export type UpdateCardioLogParams = {
  routineId: string;
  logId: string;
  distanceMi: number;
  durationSec: number;
  elevationGainFt?: number | null;
  notes?: string;
  performedAtLocal?: string;
  metrics?: MetricInput[];
  /** Activity type — pass to switch a mis-categorized log's type. Pass
   *  null to clear the type entirely. Omit to leave unchanged. */
  activityTypeId?: string | null;
  /** Intervals structure for Sprint / Interval Run logs. Pass an object
   *  to overwrite the stored structure; pass null to clear. Omit to
   *  leave unchanged. */
  intervalsConfig?: {
    reps: number | null;
    workDistanceM: number | null;
    workDurationSec: number | null;
    restSec: number | null;
  } | null;
  // Spot wiring — same shape as logCardio. `clearSpot: true` nulls both
  // FKs; omitting all spot params leaves the existing links untouched.
  clearSpot?: boolean;
  activitySlug?: string;
  activitySpotId?: string;
  climbLocationId?: string;
  newActivitySpotName?: string;
  newActivitySpotType?: string | null;
  newActivitySpotRegion?: string | null;
  newActivitySpotLatitude?: number | null;
  newActivitySpotLongitude?: number | null;
  newActivitySpotOsmType?: string | null;
  newActivitySpotOsmId?: string | null;
  newClimbLocationName?: string;
  newClimbLocationType?: "GYM" | "CRAG";
  newClimbLocationRegion?: string | null;
  newClimbLocationLatitude?: number | null;
  newClimbLocationLongitude?: number | null;
  newClimbLocationOsmType?: string | null;
  newClimbLocationOsmId?: string | null;
};

export async function updateCardioLog(params: UpdateCardioLogParams) {
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

  const hasSpotParams =
    params.clearSpot === true ||
    params.climbLocationId != null ||
    params.activitySpotId != null ||
    params.newClimbLocationName != null ||
    params.newActivitySpotName != null;
  let nextClimbLocationId: string | null | undefined = undefined;
  let nextActivitySpotId: string | null | undefined = undefined;
  if (hasSpotParams) {
    if (params.clearSpot) {
      nextClimbLocationId = null;
      nextActivitySpotId = null;
    } else {
      const climbId = await resolveClimbLocationId(params);
      const spotResolved = await resolveActivitySpotId(params);
      const split = splitResolvedSpot(spotResolved, { climbLocationId: climbId });
      nextClimbLocationId = split.climbLocationId;
      nextActivitySpotId = split.activitySpotId;
    }
  }

  await prisma.$transaction(async (tx) => {
    // Activity type + intervals: only touch when the caller passed the
    // field. `undefined` = leave existing data alone; `null` = clear it;
    // an object = overwrite. Lets the edit form switch mis-categorized
    // logs without nuking unrelated state. Built as a separate object
    // so the Prisma narrowed update type accepts the Json field's
    // null-or-object union cleanly.
    const partialUpdate: Record<string, unknown> = {
      performedAt: parsePerformedAt(params.performedAtLocal),
      distanceMi: params.distanceMi,
      durationSec: params.durationSec,
      elevationGainFt:
        params.elevationGainFt !== null && params.elevationGainFt !== undefined
          ? Math.round(params.elevationGainFt)
          : null,
      notes: params.notes?.trim() || null,
    };
    if (params.activityTypeId !== undefined) partialUpdate.activityTypeId = params.activityTypeId;
    if (params.intervalsConfig !== undefined) partialUpdate.intervalsConfig = params.intervalsConfig ?? null;
    if (hasSpotParams) {
      partialUpdate.climbLocationId = nextClimbLocationId;
      partialUpdate.activitySpotId = nextActivitySpotId;
    }
    await tx.routineLog.update({
      where: { id: params.logId },
      data: partialUpdate as Parameters<typeof tx.routineLog.update>[0]["data"],
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
  await createExerciseZoneActivitiesForLog(prisma, params.logId);

  revalidateRoutineSurfaces(params.routineId);
}

export async function updateRunLog(params: UpdateCardioLogParams) {
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
  await createExerciseZoneActivitiesForLog(prisma, params.logId);

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
  await createExerciseZoneActivitiesForLog(prisma, params.logId);

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
  await createExerciseZoneActivitiesForLog(prisma, params.logId);

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
  // Per-climb attempts — same shape as logSession. When provided, the
  // log's existing ClimbAttempt rows are replaced with these. Omit
  // entirely (undefined) to leave attempts untouched (e.g. non-climbing
  // session edits). Pass an empty array to clear all attempts.
  climbAttempts?: Array<{
    discipline: "BOULDER" | "TOP_ROPE" | "SPORT_LEAD";
    grade: string;
    gradeSystem: "BOULDER_V" | "YOSEMITE";
    outcome: "FLASH" | "ONSIGHT" | "SEND" | "REDPOINT" | "FELL" | "PROJECT";
    area?: string | null;
    areaId?: string | null;
    newAreaName?: string | null;
    movesCompleted?: number;
    totalMoves?: number;
    triesCount?: number | null;
    notes?: string;
    attemptOrder: number;
    problemId?: string | null;
    newProblemName?: string | null;
  }>;
  // Spot wiring: same shape as logSession. When `clearSpot` is true,
  // clears both climbLocationId and activitySpotId on the log.
  clearSpot?: boolean;
  climbLocationId?: string;
  newClimbLocationName?: string;
  newClimbLocationType?: "GYM" | "CRAG";
  newClimbLocationRegion?: string | null;
  newClimbLocationLatitude?: number | null;
  newClimbLocationLongitude?: number | null;
  newClimbLocationOsmType?: string | null;
  newClimbLocationOsmId?: string | null;
  activitySlug?: string;
  activitySpotId?: string;
  newActivitySpotName?: string;
  newActivitySpotType?: string | null;
  newActivitySpotRegion?: string | null;
  newActivitySpotLatitude?: number | null;
  newActivitySpotLongitude?: number | null;
  newActivitySpotOsmType?: string | null;
  newActivitySpotOsmId?: string | null;
}) {
  await ensureRoutineKind(params.routineId, "SESSION");
  if (!params.logId) throw new Error("Missing logId.");
  if (params.durationSec !== null && params.durationSec !== undefined && (!Number.isFinite(params.durationSec) || params.durationSec <= 0)) {
    throw new Error("Duration must be > 0.");
  }

  // Pull the existing log's climbLocationId so we can resolve new problem
  // names even when the user didn't change the spot (the saved location is
  // the parent FK for newly-added problems).
  const existing = await prisma.routineLog.findUnique({
    where: { id: params.logId },
    select: { routineId: true, climbLocationId: true },
  });
  if (!existing || existing.routineId !== params.routineId) throw new Error("Log not found for routine.");

  // Resolve spot FKs outside the transaction (same pattern as logSession).
  // Both can be null; "no change" is signaled by omitting all spot params.
  const hasSpotParams =
    params.clearSpot === true ||
    params.climbLocationId != null ||
    params.activitySpotId != null ||
    params.newClimbLocationName != null ||
    params.newActivitySpotName != null;
  let nextClimbLocationId: string | null | undefined = undefined;
  let nextActivitySpotId: string | null | undefined = undefined;
  if (hasSpotParams) {
    if (params.clearSpot) {
      nextClimbLocationId = null;
      nextActivitySpotId = null;
    } else {
      const resolvedClimb = await resolveClimbLocationId(params);
      const resolvedSpot = await resolveActivitySpotId(params);
      const split = splitResolvedSpot(resolvedSpot, { climbLocationId: resolvedClimb });
      nextClimbLocationId = split.climbLocationId;
      nextActivitySpotId = split.activitySpotId;
    }
  }

  // Mirror logSession's problem resolution: any attempt with `newProblemName`
  // gets either matched against an existing ClimbProblem at the same
  // location/grade or one is created. Use the resolved-next location if
  // the user changed the spot; otherwise fall back to whatever was saved on
  // the log so additions still land on the right location.
  const resolvedAttempts = params.climbAttempts ? [...params.climbAttempts] : null;
  if (resolvedAttempts) {
    const problemLocationId =
      hasSpotParams ? nextClimbLocationId ?? null : existing.climbLocationId ?? null;
    const newProblemKey = (name: string, grade: string) => `${name.toLowerCase().trim()}::${grade}`;
    const problemNameToId = new Map<string, string>();
    for (const attempt of resolvedAttempts) {
      if (attempt.problemId || !attempt.newProblemName?.trim()) continue;
      const name = attempt.newProblemName.trim();
      const key = newProblemKey(name, attempt.grade);
      if (problemNameToId.has(key)) {
        attempt.problemId = problemNameToId.get(key)!;
        continue;
      }
      const found = await prisma.climbProblem.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          grade: attempt.grade,
          gradeSystem: attempt.gradeSystem,
          locationId: problemLocationId,
        },
        select: { id: true },
      });
      const problemId = found?.id ?? (await prisma.climbProblem.create({
        data: {
          name,
          grade: attempt.grade,
          gradeSystem: attempt.gradeSystem,
          locationId: problemLocationId,
          notes: attempt.notes?.trim() || null,
        },
        select: { id: true },
      })).id;
      problemNameToId.set(key, problemId);
      attempt.problemId = problemId;
    }
    // Mirror logSession's area resolution against the same location.
    const areaLocationId =
      hasSpotParams ? nextClimbLocationId ?? null : existing.climbLocationId ?? null;
    await resolveAttemptAreas(resolvedAttempts, areaLocationId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.routineLog.update({
      where: { id: params.logId },
      data: {
        performedAt: parsePerformedAt(params.performedAtLocal),
        durationSec: params.durationSec ?? null,
        location: params.location?.trim() || null,
        notes: params.notes?.trim() || null,
        ...(hasSpotParams
          ? {
              climbLocationId: nextClimbLocationId,
              activitySpotId: nextActivitySpotId,
            }
          : {}),
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
    await tx.routineLog.update({
      where: { id: params.logId },
      data: {
        distanceMi: sessionDistanceMiFromValues(sessionMetricValues),
      },
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

    // Replace ClimbAttempt rows when the caller sent them. Omitting the
    // field leaves existing attempts untouched (matches the no-change
    // contract used by the spot params).
    if (resolvedAttempts !== null) {
      await tx.climbAttempt.deleteMany({ where: { sessionLogId: params.logId } });
      if (resolvedAttempts.length > 0) {
        await tx.climbAttempt.createMany({
          data: resolvedAttempts.map((attempt) => ({
            sessionLogId: params.logId,
            problemId: attempt.problemId ?? null,
            discipline: attempt.discipline,
            grade: attempt.grade,
            gradeSystem: attempt.gradeSystem,
            outcome: attempt.outcome,
            area: attempt.area?.trim() || null,
            areaId: attempt.areaId ?? null,
            movesCompleted: attempt.movesCompleted ?? null,
            totalMoves: attempt.totalMoves ?? null,
            triesCount: attempt.triesCount ?? null,
            notes: attempt.notes?.trim() || null,
            attemptOrder: attempt.attemptOrder,
          })),
        });
      }
    }
  });
  await recalculateRoutineLogStimulus(params.logId);
  await createExerciseZoneActivitiesForLog(prisma, params.logId);

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
