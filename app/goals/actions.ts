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
import { recordBarRaise } from "@/lib/goal-milestones";
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

  if (metricType === "PACE") {
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

  // Rep-PR: PERFORMANCE/MAX_WEIGHT goals targeting an exercise can carry
  // an optional minReps floor — only sets hitting at least minReps reps
  // count toward the peak weight. Blank / 0 / 1 = any rep (legacy
  // behavior). Storing in config keeps the existing Goal schema unchanged.
  if (metricType === "MAX_WEIGHT" && targetType === "EXERCISE") {
    const raw = String(formData.get("minReps") ?? "").trim();
    if (!raw) return undefined;
    const minReps = Math.floor(Number(raw));
    if (!Number.isFinite(minReps) || minReps < 1) return undefined;
    return { minReps };
  }

  return undefined;
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
  revalidatePath("/log");
  revalidatePath("/");
}

// Per-routine FREQUENCY/SESSIONS goals live on FrequencyGoal (deterministic id
// `fg_<routineId>`), not the Goal table — that's the same record the routine
// form's frequency block writes. Route the combo there instead of erroring so
// every creation door lands on the one canonical row. Leaves existing
// substitute links untouched (only the routine form manages those).
function isPerRoutineFrequencyCombo(formData: FormData) {
  return (
    String(formData.get("goalType") ?? "") === "FREQUENCY" &&
    String(formData.get("targetType") ?? "") === "ROUTINE" &&
    String(formData.get("metricType") ?? "") === "SESSIONS"
  );
}

async function upsertPerRoutineFrequencyGoal(formData: FormData) {
  const routineId = parseRequiredString(formData, "targetId", "Routine");
  const timeframe = parseRequiredString(formData, "timeframe", "Timeframe");
  if (!["DAY", "WEEK", "MONTH"].includes(timeframe)) {
    throw new Error("Frequency goals need a daily, weekly, or monthly timeframe.");
  }
  const rawCount = String(formData.get("targetValue") ?? "").trim();
  const targetCount = Math.floor(Number(rawCount));
  if (!Number.isFinite(targetCount) || targetCount < 1) {
    throw new Error("Set how many times per period (1 or more).");
  }

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { id: true, name: true },
  });
  if (!routine) throw new Error("Routine not found.");

  const goalId = `fg_${routineId}`;
  const existing = await prisma.frequencyGoal.findUnique({
    where: { id: goalId },
    select: { targetCount: true },
  });
  const data = {
    name: `${routine.name} frequency goal`,
    targetCount,
    targetInterval: 1,
    targetUnit: timeframe as "DAY" | "WEEK" | "MONTH",
    isActive: true,
  };
  await prisma.frequencyGoal.upsert({
    where: { id: goalId },
    update: data,
    create: { id: goalId, ...data },
  });
  if (existing && existing.targetCount !== targetCount) {
    await recordBarRaise(goalId, targetCount);
  }
  await prisma.frequencyGoalRoutine.upsert({
    where: { goalId_routineId: { goalId, routineId } },
    update: { role: "PRIMARY" },
    create: { goalId, routineId, role: "PRIMARY" },
  });
  return goalId;
}

export async function createGoal(formData: FormData) {
  if (isPerRoutineFrequencyCombo(formData)) {
    const goalId = await upsertPerRoutineFrequencyGoal(formData);
    revalidateGoals();
    if (formData.get("noRedirect") === "1") return;
    redirect(`/goals/${goalId}`);
  }
  const input = await parseGoalInput(formData);
  const goal = await prisma.goal.create({
    data: input,
    select: { id: true },
  });
  revalidateGoals();
  if (formData.get("noRedirect") === "1") return;
  redirect(`/goals/${goal.id}`);
}

export async function updateGoal(formData: FormData) {
  const goalId = parseRequiredString(formData, "goalId", "Goal");
  if (isPerRoutineFrequencyCombo(formData)) {
    // No Goal-table row can hold this combo (Phase 4 cleaned them) — an
    // update reaching here means the client sent a stale/invalid shape.
    throw new Error(
      "Per-routine frequency goals are edited on the routine itself or via their goal page."
    );
  }
  const input = await parseGoalInput(formData);
  const existingGoal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: {
      id: true,
      goalType: true,
      targetType: true,
      targetId: true,
      metricType: true,
      targetValue: true,
    },
  });
  if (!existingGoal) throw new Error("Goal not found.");

  await prisma.goal.update({
    where: { id: goalId },
    data: input,
  });
  if (input.targetValue !== existingGoal.targetValue) {
    await recordBarRaise(goalId, input.targetValue);
  }
  revalidateGoals();
  if (formData.get("noRedirect") === "1") return;
  redirect(`/goals/${goalId}`);
}

// Promote-on-hit: raise an achieved milestone goal's bar in place. The goal
// keeps its id (the lineage stays intact — the ACHIEVED row for the old bar
// is already latched) and recordBarRaise stamps the new rung. Quick-promote
// covers numeric metrics only; SESSION_METRIC (grade) goals keep their
// target in config text, so those edit through the full form instead.
export async function promoteGoal(formData: FormData) {
  const goalId = parseRequiredString(formData, "goalId", "Goal");
  const raw = parseRequiredString(formData, "newTarget", "New target");
  const newTarget = Number(raw);
  if (!Number.isFinite(newTarget) || newTarget <= 0) throw new Error("New target must be greater than 0.");

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { targetValue: true, metricType: true },
  });
  if (!goal) throw new Error("Goal not found.");
  if (goal.metricType === "SESSION_METRIC") {
    throw new Error("Grade goals promote through Edit Goal (the target is a grade, not a number).");
  }
  if (newTarget <= goal.targetValue) {
    throw new Error("The new bar should be higher than the one you just hit.");
  }

  await prisma.goal.update({ where: { id: goalId }, data: { targetValue: newTarget } });
  await recordBarRaise(goalId, newTarget);
  revalidateGoals();
  revalidatePath(`/plan/goals/${goalId}`);
  redirect(`/plan/goals/${encodeURIComponent(goalId)}`);
}

// Recurring-goal promotion: "2×/week held for a month → make it 3". Same
// lineage mechanics as milestone promotion — the goal keeps its id, the
// raise stamps a BAR_RAISED rung. Accepts the display id (`fg_<routineId>`
// or `group-frequency:<id>`) and resolves to the FrequencyGoal row.
export async function promoteFrequencyGoal(formData: FormData) {
  const displayId = parseRequiredString(formData, "goalId", "Goal");
  const raw = parseRequiredString(formData, "newTarget", "New target");
  const newTarget = Math.floor(Number(raw));
  if (!Number.isFinite(newTarget) || newTarget < 1) throw new Error("New target must be at least 1.");

  const id = displayId.startsWith("group-frequency:")
    ? displayId.slice("group-frequency:".length)
    : displayId;
  const goal = await prisma.frequencyGoal.findUnique({
    where: { id },
    select: { targetCount: true },
  });
  if (!goal) throw new Error("Goal not found.");
  if (newTarget <= goal.targetCount) {
    throw new Error("The new target should be higher than the current one.");
  }

  await prisma.frequencyGoal.update({ where: { id }, data: { targetCount: newTarget } });
  await recordBarRaise(id, newTarget);
  revalidateGoals();
  revalidatePath(`/plan/goals/${displayId}`);
  redirect(`/plan/goals/${encodeURIComponent(displayId)}`);
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

  if (goalId.startsWith("fg_")) {
    // Per-routine FrequencyGoal — delete the goal row directly. Cascade
    // takes care of the FrequencyGoalRoutine join rows.
    await prisma.frequencyGoal.deleteMany({ where: { id: goalId } });
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
    !goalId.startsWith("fg_") &&
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
