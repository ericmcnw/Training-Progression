"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { todayAppYmd } from "@/lib/dates";
import {
  evaluatePlan,
  loadPlanSessions,
  mondayOfYmd,
  readAdjustments,
  targetAt,
  type PlanTarget,
} from "@/lib/program-plan";

const MAX_WEEK = 104;

export type PlanActionResult = { error: string | null };

// Production builds replace thrown server-action messages with a generic one,
// so messages meant for the user travel back as a value instead.
class PlanError extends Error {}

async function guard(fn: () => Promise<void>): Promise<PlanActionResult> {
  try {
    await fn();
    return { error: null };
  } catch (error) {
    if (error instanceof PlanError) return { error: error.message };
    throw error;
  }
}

async function requireOwnedProgram(programId: string) {
  const session = await getAppSession();
  const program = await prisma.focus.findFirst({
    where: { id: programId, profileKey: session.profileKey },
    select: { id: true },
  });
  if (!program) throw new PlanError("Program not found.");
  return program;
}

async function loadItem(itemId: string) {
  const item = await prisma.programPlanItem.findFirst({
    where: { id: itemId, isActive: true },
    select: {
      id: true,
      programId: true,
      exerciseId: true,
      startYmd: true,
      adjustments: true,
      targets: { select: { week: true, sets: true, reps: true, seconds: true, weightLb: true } },
    },
  });
  if (!item) throw new PlanError("This plan is no longer active.");
  await requireOwnedProgram(item.programId);
  return item;
}

async function currentWeekOf(item: Awaited<ReturnType<typeof loadItem>>) {
  const today = todayAppYmd();
  const sessions = await loadPlanSessions([item.exerciseId], mondayOfYmd(item.startYmd));
  return evaluatePlan({
    startYmd: item.startYmd,
    todayYmd: today,
    targets: item.targets,
    sessions: sessions.get(item.exerciseId) ?? [],
    adjustments: readAdjustments(item.adjustments),
  }).week;
}

function revalidateProgram(programId: string) {
  revalidatePath(`/programs/${programId}`);
}

function cleanInt(value: unknown, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > max) throw new PlanError("Enter a sensible number.");
  return n;
}

function cleanWeight(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 2000) throw new PlanError("Enter a sensible weight.");
  return n === 0 ? null : Math.round(n * 10) / 10;
}

function cleanTarget(values: Partial<Record<keyof PlanTarget, unknown>>): PlanTarget {
  const target = {
    sets: cleanInt(values.sets, 20),
    reps: cleanInt(values.reps, 200),
    seconds: cleanInt(values.seconds, 3600),
    weightLb: cleanWeight(values.weightLb),
  };
  if (target.reps == null && target.seconds == null) throw new PlanError("A target needs reps or seconds.");
  return target;
}

async function lastLoggedTarget(exerciseId: string, unit: string): Promise<PlanTarget> {
  const last = await prisma.sessionExercise.findFirst({
    where: {
      exerciseId,
      sets: { some: { OR: [{ reps: { not: null } }, { seconds: { not: null } }] } },
    },
    orderBy: { routineLog: { performedAt: "desc" } },
    select: { sets: { select: { reps: true, seconds: true, weightLb: true } } },
  });
  const sets = (last?.sets ?? []).filter((s) => s.reps != null || s.seconds != null);
  let top: (typeof sets)[number] | null = null;
  for (const set of sets) {
    const weight = set.weightLb ?? 0;
    const metric = set.reps ?? set.seconds ?? 0;
    const topWeight = top?.weightLb ?? 0;
    const topMetric = top ? top.reps ?? top.seconds ?? 0 : 0;
    if (!top || weight > topWeight || (weight === topWeight && metric > topMetric)) top = set;
  }
  return {
    sets: sets.length || 3,
    reps: top ? top.reps : unit === "TIME" ? null : 8,
    seconds: top ? (top.reps == null ? top.seconds : null) : unit === "TIME" ? 30 : null,
    weightLb: top?.weightLb && top.weightLb > 0 ? top.weightLb : null,
  };
}

export async function addPlanItem(programId: string, exerciseId: string, routineId: string | null): Promise<PlanActionResult> {
  return guard(async () => {
    await requireOwnedProgram(programId);
    const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId }, select: { id: true, unit: true } });
    if (!exercise) throw new PlanError("Exercise not found.");
    if (routineId) {
      const routine = await prisma.routine.findFirst({ where: { id: routineId }, select: { id: true } });
      if (!routine) throw new PlanError("Routine not found.");
    }

    const existing = await prisma.programPlanItem.findFirst({
      where: { exerciseId, isActive: true, program: { status: "ACTIVE" } },
      select: { programId: true, program: { select: { name: true } } },
    });
    if (existing?.programId === programId) return;
    if (existing) throw new PlanError(`Already planned in ${existing.program.name}.`);

    const [start, last] = await Promise.all([
      lastLoggedTarget(exerciseId, exercise.unit),
      prisma.programPlanItem.aggregate({ where: { programId }, _max: { sortOrder: true } }),
    ]);
    await prisma.programPlanItem.create({
      data: {
        programId,
        exerciseId,
        routineId,
        startYmd: todayAppYmd(),
        sortOrder: (last._max.sortOrder ?? -1) + 1,
        targets: { create: [{ week: 1, ...start }] },
      },
    });
    revalidateProgram(programId);
  });
}

export async function setPlanTarget(
  itemId: string,
  week: number,
  values: Partial<Record<keyof PlanTarget, unknown>>,
): Promise<PlanActionResult> {
  return guard(async () => {
    const item = await loadItem(itemId);
    if (!Number.isInteger(week) || week < 1 || week > MAX_WEEK) throw new PlanError("Pick a week.");
    if (week < (await currentWeekOf(item))) throw new PlanError("Past weeks are locked.");
    const target = cleanTarget(values);
    await prisma.programPlanTarget.upsert({
      where: { itemId_week: { itemId, week } },
      create: { itemId, week, ...target },
      update: target,
    });
    revalidateProgram(item.programId);
  });
}

export async function clearPlanTarget(itemId: string, week: number): Promise<PlanActionResult> {
  return guard(async () => {
    const item = await loadItem(itemId);
    if (week <= 1) throw new PlanError("Week 1 is where the plan starts.");
    if (week < (await currentWeekOf(item))) throw new PlanError("Past weeks are locked.");
    await prisma.programPlanTarget.deleteMany({ where: { itemId, week } });
    revalidateProgram(item.programId);
  });
}

export type PlanFillKind = "weightLb" | "reps" | "seconds";

export async function fillPlan(itemId: string, kind: PlanFillKind, step: number, weeks: number): Promise<PlanActionResult> {
  return guard(async () => {
    const item = await loadItem(itemId);
    if (!["weightLb", "reps", "seconds"].includes(kind)) throw new PlanError("Unknown fill.");
    if (!Number.isFinite(step) || step === 0 || Math.abs(step) > 100) throw new PlanError("Pick a step.");
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) throw new PlanError("Pick 1–12 weeks.");
    const current = await currentWeekOf(item);
    const base = targetAt(item.targets, current);
    if (!base) throw new PlanError("Set this week's target first.");
    const baseValue = base[kind] ?? 0;
    if (kind !== "weightLb" && base[kind] == null) throw new PlanError("This target has no such number to raise.");

    await prisma.$transaction(
      Array.from({ length: weeks }, (_, i) => {
        const week = current + i + 1;
        const next = { ...(targetAt(item.targets, week) ?? base), [kind]: Math.max(0, baseValue + step * (i + 1)) };
        const target = cleanTarget(next);
        return prisma.programPlanTarget.upsert({
          where: { itemId_week: { itemId, week } },
          create: { itemId, week, ...target },
          update: target,
        });
      }),
    );
    revalidateProgram(item.programId);
  });
}

export async function nudgePlanWeek(itemId: string, delta: 1 | -1): Promise<PlanActionResult> {
  return guard(async () => {
    const item = await loadItem(itemId);
    if (delta !== 1 && delta !== -1) throw new PlanError("Move one week at a time.");
    if (delta === -1 && (await currentWeekOf(item)) <= 1) throw new PlanError("Already at week 1.");
    const adjustments = [...readAdjustments(item.adjustments), { ymd: todayAppYmd(), delta }];
    await prisma.programPlanItem.update({ where: { id: itemId }, data: { adjustments } });
    revalidateProgram(item.programId);
  });
}

export async function endPlanItem(itemId: string): Promise<PlanActionResult> {
  return guard(async () => {
    const item = await loadItem(itemId);
    await prisma.programPlanItem.update({ where: { id: itemId }, data: { isActive: false } });
    revalidateProgram(item.programId);
  });
}
