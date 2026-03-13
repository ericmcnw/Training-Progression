"use server";

import { prisma } from "@/lib/prisma";
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
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} is invalid.`);
  return parsed;
}

function inferUnit(metricType: string) {
  if (metricType === "DISTANCE") return "mi";
  if (metricType === "DURATION" || metricType === "MAX_DURATION") return "sec";
  if (metricType === "PACE") return "sec";
  if (metricType === "MAX_WEIGHT" || metricType === "VOLUME") return "lb";
  return null;
}

function parseTargetValue(formData: FormData, metricType: string) {
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

function parseConfig(formData: FormData, metricType: string) {
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

function parseGoalInput(formData: FormData) {
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
    targetValue: parseTargetValue(formData, metricType),
    timeframe,
    unit: inferUnit(metricType),
    startDate,
    endDate,
    isActive: parseBoolean(formData, "isActive"),
    notes: parseOptionalString(formData, "notes"),
    config: parseConfig(formData, metricType),
  };
}

function revalidateGoals() {
  revalidatePath("/goals");
  revalidatePath("/goals/new");
  revalidatePath("/progress");
}

export async function createGoal(formData: FormData) {
  const input = parseGoalInput(formData);
  const goal = await prisma.goal.create({
    data: input,
    select: { id: true },
  });
  revalidateGoals();
  redirect(`/goals/${goal.id}`);
}

export async function updateGoal(formData: FormData) {
  const goalId = parseRequiredString(formData, "goalId", "Goal");
  const input = parseGoalInput(formData);
  await prisma.goal.update({
    where: { id: goalId },
    data: input,
  });
  revalidateGoals();
  redirect(`/goals/${goalId}`);
}

export async function deleteGoal(input: { goalId: string }) {
  const goalId = input.goalId?.trim();
  if (!goalId) {
    throw new Error("Goal id is required.");
  }

  await prisma.goal.delete({ where: { id: goalId } });
  revalidateGoals();
  redirect("/goals");
}
