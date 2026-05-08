"use server";

import { getAppDayRange } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { parseSessionMetricGoalTarget, withSessionMetricConfig } from "@/lib/session-templates";
import {
  isGoalMetricTypeValue,
  isGoalTargetTypeValue,
  isGoalTimeframeValue,
  isGoalTypeValue,
  metricUsesPaceInput,
} from "@/lib/goals-config";
import { getAllowedMetricTypes } from "@/lib/goals-config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function parseRequiredString(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function parseOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function parseBoolean(formData: FormData, key: string) {
  return String(formData.get(key) ?? "") === "on";
}

function parseDateInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error(`${label} is invalid.`);
  return getAppDayRange(trimmed).start;
}

function inferUnit(metricType: string) {
  if (metricType === "DISTANCE") return "mi";
  if (metricType === "DURATION" || metricType === "MAX_DURATION") return "sec";
  if (metricType === "ELEVATION_GAIN") return "ft";
  if (metricType === "PACE") return "sec";
  if (metricType === "MAX_WEIGHT" || metricType === "VOLUME") return "lb";
  if (metricType === "SESSION_METRIC") return null;
  return null;
}

function isRoutineFrequencyGoalInput(input: {
  goalType: string;
  targetType: string;
  metricType: string;
  timeframe: string;
  targetId: string;
}) {
  return (
    input.goalType === "FREQUENCY" &&
    input.targetType === "ROUTINE" &&
    input.metricType === "SESSIONS" &&
    input.timeframe !== "ONE_TIME" &&
    input.targetId.trim().length > 0
  );
}

function isStoredRoutineFrequencyGoalLike(input: {
  goalType: string;
  targetType: string;
  metricType: string;
  targetId: string;
}) {
  return (
    input.goalType === "FREQUENCY" &&
    input.targetType === "ROUTINE" &&
    input.metricType === "SESSIONS" &&
    input.targetId.trim().length > 0
  );
}

// Phase 1 cleanup: the legacy per-routine frequency columns have been dropped.
// The Goal model is the single source of truth for routine-frequency goals; we
// no longer mirror the data into Routine columns. The routine-mirror helpers
// that used to live here (getRoutineFrequencyGoalUpdate, clearRoutineFrequencyGoal,
// syncRoutineFrequencyGoalUpdate) are removed — their callers are now no-ops.

async function getSessionMetricDefinitionForForm(formData: FormData, targetType: string, targetId: string) {
  const definitionId = String(formData.get("sessionMetricDefinitionId") ?? "").trim();
  if (!definitionId) throw new Error("Session metric is required.");

  const definition = await prisma.sessionMetricDefinition.findUnique({
    where: { id: definitionId },
    include: { template: true },
  });
  if (!definition || !definition.showInGoals) throw new Error("Session metric not found.");

  if (targetType === "SESSION_TEMPLATE" && definition.templateId !== targetId) {
    throw new Error("Session metric does not belong to the selected template.");
  }

  if (targetType === "ROUTINE") {
    const routine = await prisma.routine.findUnique({
      where: { id: targetId },
      select: { sessionDetails: { select: { templateId: true } } },
    });
    if (!routine?.sessionDetails?.templateId || routine.sessionDetails.templateId !== definition.templateId) {
      throw new Error("That session metric does not belong to the selected routine.");
    }
  }

  return withSessionMetricConfig(definition);
}

async function parseTargetValue(formData: FormData, metricType: string, targetType: string, targetId: string) {
  if (metricType === "SESSION_METRIC") {
    const definition = await getSessionMetricDefinitionForForm(formData, targetType, targetId);
    const rawTarget = String(formData.get("sessionMetricTarget") ?? "").trim();
    return parseSessionMetricGoalTarget(definition, rawTarget).targetValue;
  }

  const raw = Number(formData.get("targetValue"));
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error("Target value must be greater than 0.");
  }

  if (metricUsesPaceInput(metricType as never)) {
    const benchmarkDistanceMi = Number(formData.get("benchmarkDistanceMi"));
    if (!Number.isFinite(benchmarkDistanceMi) || benchmarkDistanceMi <= 0) {
      throw new Error("Benchmark distance is required for pace goals.");
    }
  }

  return raw;
}

async function parseConfig(formData: FormData, metricType: string, targetType: string, targetId: string) {
  if (metricType === "SESSION_METRIC") {
    const definition = await getSessionMetricDefinitionForForm(formData, targetType, targetId);
    const rawTarget = String(formData.get("sessionMetricTarget") ?? "").trim();
    return {
      sessionMetricDefinitionId: definition.id,
      sessionMetricDefinitionLabel: definition.label,
      ...(rawTarget ? { sessionMetricTargetText: rawTarget } : {}),
    };
  }

  if (metricType !== "PACE") return undefined;
  const benchmarkDistanceMi = Number(formData.get("benchmarkDistanceMi"));
  if (!Number.isFinite(benchmarkDistanceMi) || benchmarkDistanceMi <= 0) {
    throw new Error("Benchmark distance is required for pace goals.");
  }
  const benchmarkLabel = String(formData.get("benchmarkLabel") ?? "").trim();
  return {
    benchmarkDistanceMi,
    ...(benchmarkLabel ? { benchmarkLabel } : {}),
  };
}

async function parseGoalInput(formData: FormData) {
  const name = parseRequiredString(formData, "name", "Goal name");
  const goalType = parseRequiredString(formData, "goalType", "Goal type");
  const targetType = parseRequiredString(formData, "targetType", "Target type");
  const targetId = parseRequiredString(formData, "targetId", "Target");
  const metricType = parseRequiredString(formData, "metricType", "Metric");
  const timeframe = parseRequiredString(formData, "timeframe", "Timeframe");
  const startDateRaw = parseRequiredString(formData, "startDate", "Start date");
  const endDateRaw = parseOptionalString(formData, "endDate");

  if (!isGoalTypeValue(goalType)) throw new Error("Unsupported goal type.");
  if (!isGoalTargetTypeValue(targetType)) throw new Error("Unsupported target type.");
  if (!isGoalMetricTypeValue(metricType)) throw new Error("Unsupported metric.");
  if (!isGoalTimeframeValue(timeframe)) throw new Error("Unsupported timeframe.");

  const allowedMetrics = getAllowedMetricTypes(goalType, targetType);
  if (!allowedMetrics.includes(metricType)) {
    throw new Error("That metric is not supported for the selected goal.");
  }

  const startDate = parseDateInput(startDateRaw, "Start date");
  const endDate = endDateRaw ? parseDateInput(endDateRaw, "End date") : null;
  if (endDate && endDate.getTime() < startDate.getTime()) {
    throw new Error("End date must be on or after the start date.");
  }

  return {
    name,
    goalType,
    targetType,
    targetId,
    metricType,
    targetValue: await parseTargetValue(formData, metricType, targetType, targetId),
    timeframe,
    unit: inferUnit(metricType),
    startDate,
    endDate,
    isActive: parseBoolean(formData, "isActive"),
    notes: parseOptionalString(formData, "notes"),
    config: await parseConfig(formData, metricType, targetType, targetId),
  };
}

function revalidateGoals() {
  revalidatePath("/goals");
  revalidatePath("/progress");
  revalidatePath("/routines");
  revalidatePath("/");
}

export async function createGoal(formData: FormData) {
  const input = await parseGoalInput(formData);
  const goal = await prisma.goal.create({
    data: input,
    select: { id: true },
  });
  revalidateGoals();
  redirect(`/goals/${goal.id}`);
}

export async function updateGoal(formData: FormData) {
  const goalId = parseRequiredString(formData, "goalId", "Goal");
  const input = await parseGoalInput(formData);
  const existingGoal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: {
      id: true,
      goalType: true,
      targetType: true,
      targetId: true,
      metricType: true,
    },
  });
  if (!existingGoal) throw new Error("Goal not found.");

  await prisma.goal.update({
    where: { id: goalId },
    data: input,
  });
  revalidateGoals();
  redirect(`/goals/${goalId}`);
}

export async function deleteGoalEntry(input: { goalId: string }) {
  const goalId = input.goalId?.trim();
  if (!goalId) throw new Error("Goal id is required.");

  if (goalId.startsWith("group-frequency:")) {
    const id = goalId.slice("group-frequency:".length);
    await prisma.frequencyGoal.delete({ where: { id } });
    revalidateGoals();
    redirect("/goals");
  }

  if (goalId.startsWith("routine-frequency:")) {
    // Synthetic id from lib/goals.ts pointing at a routine's "primary" goal.
    // After Phase 1, that's a real FrequencyGoal row with id `fg_<routineId>`.
    const routineId = goalId.slice("routine-frequency:".length);
    await prisma.frequencyGoal.deleteMany({ where: { id: `fg_${routineId}` } });
    revalidateGoals();
    redirect("/goals");
  }

  return deleteGoal(input);
}

export async function deleteGoal(input: { goalId: string }) {
  const goalId = input.goalId?.trim();
  if (!goalId) {
    throw new Error("Goal id is required.");
  }

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: {
      id: true,
      goalType: true,
      targetType: true,
      targetId: true,
      metricType: true,
    },
  });
  if (!goal) {
    throw new Error("Goal not found.");
  }

  await prisma.goal.delete({ where: { id: goalId } });
  revalidateGoals();
  redirect("/goals");
}

export async function toggleRoutineFrequencyGoal(formData: FormData) {
  const routineId = parseRequiredString(formData, "routineId", "Routine");
  const goalId = String(formData.get("goalId") ?? "").trim();
  const nextEnabled = String(formData.get("enabled") ?? "") !== "0";
  const returnTo = String(formData.get("returnTo") ?? "").trim() || "/goals";
  const shouldSyncGoalRecord =
    goalId.length > 0 &&
    !goalId.startsWith("routine-frequency:") &&
    !goalId.startsWith("group-frequency:");

  // Phase 1: routine-mirror columns are gone. The routine's primary FrequencyGoal
  // is `fg_<routineId>`; toggling that goal's isActive is the canonical action.
  await prisma.$transaction(async (tx) => {
    await tx.frequencyGoal.updateMany({
      where: { id: `fg_${routineId}` },
      data: { isActive: nextEnabled },
    });
    if (shouldSyncGoalRecord) {
      await tx.goal.update({
        where: { id: goalId },
        data: { isActive: nextEnabled },
      });
    }
  });

  revalidateGoals();
  redirect(returnTo);
}

export async function toggleGoalActive(formData: FormData) {
  const goalId = parseRequiredString(formData, "goalId", "Goal");
  const nextEnabled = String(formData.get("enabled") ?? "") !== "0";
  const returnTo = String(formData.get("returnTo") ?? "").trim() || "/goals";

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: {
      id: true,
      goalType: true,
      targetType: true,
      targetId: true,
      metricType: true,
    },
  });
  if (!goal) throw new Error("Goal not found.");

  await prisma.$transaction(async (tx) => {
    await tx.goal.update({
      where: { id: goalId },
      data: { isActive: nextEnabled },
    });
    if (isStoredRoutineFrequencyGoalLike(goal)) {
      // Mirror to the primary FrequencyGoal so habit tracking stays in sync.
      await tx.frequencyGoal.updateMany({
        where: { id: `fg_${goal.targetId}` },
        data: { isActive: nextEnabled },
      });
    }
  });

  revalidateGoals();
  redirect(returnTo);
}

export async function toggleGroupFrequencyGoal(formData: FormData) {
  const rawGoalId = parseRequiredString(formData, "goalId", "Goal");
  const goalId = rawGoalId.startsWith("group-frequency:")
    ? rawGoalId.slice("group-frequency:".length)
    : rawGoalId;
  const nextEnabled = String(formData.get("enabled") ?? "") !== "0";
  const returnTo = String(formData.get("returnTo") ?? "").trim() || "/goals";

  await prisma.frequencyGoal.update({
    where: { id: goalId },
    data: { isActive: nextEnabled },
  });

  revalidateGoals();
  redirect(returnTo);
}
