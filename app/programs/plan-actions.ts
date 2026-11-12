"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { addDaysYmd, todayAppYmd } from "@/lib/dates";
import { getActivityEntry } from "@/lib/activity-families";
import { exerciseParamKeys, normalizeExerciseParamInput, readExerciseParams } from "@/lib/exercise-params";
import {
  evaluatePlan,
  loadItemSessions,
  mondayOfYmd,
  readAdjustments,
  targetAt,
  type PlanKind,
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

const TARGET_SELECT = {
  week: true, sets: true, reps: true, seconds: true, weightLb: true,
  distanceMi: true, durationSec: true, sessions: true, note: true, params: true,
} as const;

async function loadItem(itemId: string) {
  const item = await prisma.programPlanItem.findFirst({
    where: { id: itemId, isActive: true },
    select: {
      id: true,
      kind: true,
      programId: true,
      exerciseId: true,
      activityTypeId: true,
      enduranceFamilyId: true,
      sportSlug: true,
      startYmd: true,
      adjustments: true,
      exercise: { select: { unit: true, paramKeys: true } },
      targets: { select: TARGET_SELECT },
    },
  });
  if (!item) throw new PlanError("This plan is no longer active.");
  await requireOwnedProgram(item.programId);
  return item;
}

type LoadedItem = Awaited<ReturnType<typeof loadItem>>;

async function currentWeekOf(item: LoadedItem) {
  const sessions = await loadItemSessions([item], mondayOfYmd(item.startYmd));
  return evaluatePlan({
    kind: item.kind,
    startYmd: item.startYmd,
    todayYmd: todayAppYmd(),
    targets: item.targets,
    sessions: sessions.get(item.id) ?? [],
    adjustments: readAdjustments(item.adjustments),
  }).week;
}

function revalidateProgram(programId: string) {
  revalidatePath(`/programs/${programId}`);
  revalidatePath("/");
}

function cleanInt(value: unknown, max: number, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > max) throw new PlanError(`Enter a sensible ${label}.`);
  return n === 0 ? null : n;
}

function cleanDecimal(value: unknown, max: number, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new PlanError(`Enter a sensible ${label}.`);
  return n === 0 ? null : Math.round(n * 10) / 10;
}

export type PlanTargetInput = Partial<Record<Exclude<keyof PlanTarget, "params">, string | number | null>> & {
  durationMin?: string | number | null;
  params?: Record<string, string | number | null>;
};

function cleanTarget(item: Pick<LoadedItem, "kind" | "exercise">, input: PlanTargetInput): PlanTarget {
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 140) : null;
  const durationMin = cleanDecimal(input.durationMin, 1440, "duration");
  const target: PlanTarget = {
    sets: null,
    reps: null,
    seconds: null,
    weightLb: null,
    distanceMi: null,
    durationSec: null,
    sessions: null,
    note,
    params: null,
  };
  if (item.kind === "EXERCISE") {
    target.sets = cleanInt(input.sets, 20, "set count");
    target.reps = cleanInt(input.reps, 200, "rep count");
    target.seconds = cleanInt(input.seconds, 3600, "hold time");
    target.weightLb = cleanDecimal(input.weightLb, 2000, "weight");
    target.params = normalizeExerciseParamInput(exerciseParamKeys(item.exercise?.paramKeys), input.params ?? {});
    if (target.reps == null && target.seconds == null) throw new PlanError("A target needs reps or seconds.");
  } else if (item.kind === "ACTIVITY") {
    target.distanceMi = cleanDecimal(input.distanceMi, 500, "distance");
    target.durationSec = durationMin != null ? Math.round(durationMin * 60) : null;
    target.sessions = cleanInt(input.sessions, 14, "session count");
    if (target.distanceMi == null && target.durationSec == null && target.sessions == null) {
      throw new PlanError("Give it a distance, a duration, or a number of sessions.");
    }
  } else {
    target.sessions = cleanInt(input.sessions, 14, "session count");
    if (target.sessions == null) throw new PlanError("How many sessions a week?");
  }
  return target;
}

function targetData(target: PlanTarget) {
  return { ...target, params: (target.params ?? undefined) as Prisma.InputJsonValue | undefined };
}

async function lastLoggedTarget(exerciseId: string, unit: string): Promise<PlanTarget> {
  const last = await prisma.sessionExercise.findFirst({
    where: {
      exerciseId,
      sets: { some: { OR: [{ reps: { not: null } }, { seconds: { not: null } }] } },
    },
    orderBy: { routineLog: { performedAt: "desc" } },
    select: { params: true, sets: { select: { reps: true, seconds: true, weightLb: true } } },
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
  const params = readExerciseParams(last?.params);
  return {
    sets: sets.length || 3,
    reps: top ? top.reps : unit === "TIME" ? null : 8,
    seconds: top ? (top.reps == null ? top.seconds : null) : unit === "TIME" ? 30 : null,
    weightLb: top?.weightLb && top.weightLb > 0 ? top.weightLb : null,
    distanceMi: null,
    durationSec: null,
    sessions: null,
    note: null,
    params: Object.keys(params).length ? params : null,
  };
}

const EMPTY_TARGET: PlanTarget = {
  sets: null, reps: null, seconds: null, weightLb: null,
  distanceMi: null, durationSec: null, sessions: null, note: null, params: null,
};

async function recentActivityTarget(ref: { activityTypeId: string | null; enduranceFamilyId: string | null; sportSlug: string | null; kind: PlanKind }) {
  const today = todayAppYmd();
  const since = addDaysYmd(today, -27);
  const sessions = await loadItemSessions([{ id: "probe", ...ref, exerciseId: null }], since);
  const recent = sessions.get("probe") ?? [];
  const perWeek = Math.max(1, Math.round(recent.length / 4));
  if (ref.kind === "SPORT") return { ...EMPTY_TARGET, sessions: perWeek };
  const longest = recent.reduce((max, s) => Math.max(max, s.distanceMi ?? 0), 0);
  return {
    ...EMPTY_TARGET,
    distanceMi: longest > 0 ? Math.max(0.5, Math.round(longest * 2) / 2) : null,
    durationSec: longest > 0 ? null : 20 * 60,
    sessions: 1,
  };
}

async function nextSortOrder(programId: string) {
  const last = await prisma.programPlanItem.aggregate({ where: { programId }, _max: { sortOrder: true } });
  return (last._max.sortOrder ?? -1) + 1;
}

export type AddPlanItemInput =
  | { kind: "EXERCISE"; exerciseId: string; routineId: string | null }
  | { kind: "ACTIVITY"; activityTypeId?: string | null; enduranceFamilyId?: string | null; label?: string | null }
  | { kind: "SPORT"; sportSlug: string; label?: string | null };

export async function addPlanItem(programId: string, input: AddPlanItemInput): Promise<PlanActionResult> {
  return guard(async () => {
    await requireOwnedProgram(programId);
    const startYmd = todayAppYmd();
    const sortOrder = await nextSortOrder(programId);

    if (input.kind === "EXERCISE") {
      const exercise = await prisma.exercise.findUnique({ where: { id: input.exerciseId }, select: { id: true, unit: true } });
      if (!exercise) throw new PlanError("Exercise not found.");
      if (input.routineId) {
        const routine = await prisma.routine.findFirst({ where: { id: input.routineId }, select: { id: true } });
        if (!routine) throw new PlanError("Routine not found.");
      }
      const existing = await prisma.programPlanItem.findFirst({
        where: { exerciseId: input.exerciseId, isActive: true, program: { status: "ACTIVE" } },
        select: { programId: true, program: { select: { name: true } } },
      });
      if (existing?.programId === programId) return;
      if (existing) throw new PlanError(`Already planned in ${existing.program.name}.`);
      const start = await lastLoggedTarget(input.exerciseId, exercise.unit);
      await prisma.programPlanItem.create({
        data: {
          programId, kind: "EXERCISE", exerciseId: input.exerciseId, routineId: input.routineId, startYmd, sortOrder,
          targets: { create: [{ week: 1, ...targetData(start) }] },
        },
      });
    } else if (input.kind === "ACTIVITY") {
      const activityTypeId = input.activityTypeId || null;
      const enduranceFamilyId = activityTypeId ? null : input.enduranceFamilyId || null;
      if (!activityTypeId && !enduranceFamilyId) throw new PlanError("Pick an activity.");
      if (activityTypeId && !(await prisma.activityType.findUnique({ where: { id: activityTypeId }, select: { id: true } }))) {
        throw new PlanError("Activity not found.");
      }
      if (enduranceFamilyId && !(await prisma.enduranceFamily.findUnique({ where: { id: enduranceFamilyId }, select: { id: true } }))) {
        throw new PlanError("Activity not found.");
      }
      const start = await recentActivityTarget({ kind: "ACTIVITY", activityTypeId, enduranceFamilyId, sportSlug: null });
      await prisma.programPlanItem.create({
        data: {
          programId, kind: "ACTIVITY", activityTypeId, enduranceFamilyId, label: input.label?.trim() || null, startYmd, sortOrder,
          targets: { create: [{ week: 1, ...targetData(start) }] },
        },
      });
    } else {
      const entry = getActivityEntry(input.sportSlug);
      if (!entry || entry.family !== "sports") throw new PlanError("Pick a sport.");
      const existing = await prisma.programPlanItem.findFirst({
        where: { kind: "SPORT", sportSlug: input.sportSlug, isActive: true, program: { status: "ACTIVE" } },
        select: { programId: true, program: { select: { name: true } } },
      });
      if (existing?.programId === programId) return;
      if (existing) throw new PlanError(`${entry.label} is already planned in ${existing.program.name}.`);
      const start = await recentActivityTarget({ kind: "SPORT", activityTypeId: null, enduranceFamilyId: null, sportSlug: input.sportSlug });
      await prisma.programPlanItem.create({
        data: {
          programId, kind: "SPORT", sportSlug: input.sportSlug, label: input.label?.trim() || null, startYmd, sortOrder,
          targets: { create: [{ week: 1, ...targetData(start) }] },
        },
      });
    }
    revalidateProgram(programId);
  });
}

/** A library exercise joins the routine (where it can be logged) and the plan in one step. */
export async function addExerciseToRoutineAndPlan(programId: string, routineId: string, exerciseId: string): Promise<PlanActionResult> {
  return guard(async () => {
    await requireOwnedProgram(programId);
    const routine = await prisma.routine.findFirst({ where: { id: routineId }, select: { id: true } });
    if (!routine) throw new PlanError("Routine not found.");
    const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId }, select: { id: true } });
    if (!exercise) throw new PlanError("Exercise not found.");
    const present = await prisma.routineExercise.findFirst({ where: { routineId, exerciseId }, select: { id: true } });
    if (!present) {
      const last = await prisma.routineExercise.aggregate({ where: { routineId }, _max: { sortOrder: true } });
      await prisma.routineExercise.create({ data: { routineId, exerciseId, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
      revalidatePath(`/routines/${routineId}`);
    }
  }).then(async (result) => (result.error ? result : addPlanItem(programId, { kind: "EXERCISE", exerciseId, routineId })));
}

export async function setPlanTarget(itemId: string, week: number, values: PlanTargetInput): Promise<PlanActionResult> {
  return guard(async () => {
    const item = await loadItem(itemId);
    if (!Number.isInteger(week) || week < 1 || week > MAX_WEEK) throw new PlanError("Pick a week.");
    if (week < (await currentWeekOf(item))) throw new PlanError("Past weeks are locked.");
    const target = targetData(cleanTarget(item, values));
    await prisma.programPlanTarget.upsert({
      where: { itemId_week: { itemId, week } },
      create: { itemId, week, ...target },
      update: { ...target, params: target.params ?? Prisma.DbNull },
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

export type PlanFillKind = "weightLb" | "reps" | "seconds" | "distanceMi" | "durationSec" | "sessions";
const FILL_KINDS: PlanFillKind[] = ["weightLb", "reps", "seconds", "distanceMi", "durationSec", "sessions"];

export async function fillPlan(itemId: string, kind: PlanFillKind, step: number, weeks: number): Promise<PlanActionResult> {
  return guard(async () => {
    const item = await loadItem(itemId);
    if (!FILL_KINDS.includes(kind)) throw new PlanError("Unknown fill.");
    if (!Number.isFinite(step) || step === 0 || Math.abs(step) > 600) throw new PlanError("Pick a step.");
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) throw new PlanError("Pick 1–12 weeks.");
    const current = await currentWeekOf(item);
    const base = targetAt(item.targets, current);
    if (!base) throw new PlanError("Set this week's target first.");
    if (kind !== "weightLb" && base[kind] == null) throw new PlanError("This target has no such number to raise.");
    const baseValue = base[kind] ?? 0;

    await prisma.$transaction(
      Array.from({ length: weeks }, (_, i) => {
        const week = current + i + 1;
        const next: PlanTarget = { ...(targetAt(item.targets, week) ?? base), [kind]: Math.max(0, Math.round((baseValue + step * (i + 1)) * 10) / 10) };
        const data = targetData(next);
        return prisma.programPlanTarget.upsert({
          where: { itemId_week: { itemId, week } },
          create: { itemId, week, ...data },
          update: data,
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

export async function updatePlanItem(
  itemId: string,
  changes: { label?: string | null; phaseEnd?: "ASK" | "KEEP" | "DROP" },
): Promise<PlanActionResult> {
  return guard(async () => {
    const item = await loadItem(itemId);
    const data: { label?: string | null; phaseEnd?: "ASK" | "KEEP" | "DROP" } = {};
    if (changes.label !== undefined) data.label = changes.label?.trim().slice(0, 60) || null;
    if (changes.phaseEnd !== undefined) {
      if (!["ASK", "KEEP", "DROP"].includes(changes.phaseEnd)) throw new PlanError("Pick keep, drop or ask.");
      data.phaseEnd = changes.phaseEnd;
    }
    await prisma.programPlanItem.update({ where: { id: itemId }, data });
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
