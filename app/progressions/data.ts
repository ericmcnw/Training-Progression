// Read models for the /progressions surfaces. A progression's rungs are
// ProgressionMilestone rows owned via ownerKind = PROGRESSION.
//
// "Current" is derived, never stored: the first ACTIVE rung by sortOrder.
// Same rule the Focus roadmap uses, so a ladder reads identically wherever
// it appears.

import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import type { ProgressionStatus, MilestoneStatus, RungMetric } from "@/generated/prisma";

export type ExerciseOption = { id: string; name: string };

export type RungView = {
  id: string;
  label: string;
  modifier: string | null;
  targetText: string | null;
  status: MilestoneStatus;
  sortOrder: number;
  metric: RungMetric | null;
  value: number | null;
  exerciseId: string | null;
  exerciseName: string | null;
  // Your best logged result for this rung's exercise, in the rung's metric.
  best: number | null;
  autoTick: boolean;
};

export type ProgressionListItem = {
  id: string;
  name: string;
  status: ProgressionStatus;
  total: number;
  done: number;
  // The rung you're on now — null once every rung is done or skipped.
  current: { label: string; modifier: string | null; targetText: string | null } | null;
};

export type ProgressionDetail = {
  id: string;
  name: string;
  status: ProgressionStatus;
  notes: string | null;
  createdYmd: string;
  rungs: RungView[];
  total: number;
  done: number;
  currentId: string | null;
};

export async function getProgressions(): Promise<ProgressionListItem[]> {
  const session = await getAppSession();
  const rows = await prisma.progression.findMany({
    where: { profileKey: session.profileKey, status: { not: "ARCHIVED" } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, status: true },
  });
  if (rows.length === 0) return [];

  const rungs = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "PROGRESSION", ownerId: { in: rows.map((r) => r.id) } },
    orderBy: { sortOrder: "asc" },
    select: {
      ownerId: true,
      label: true,
      modifier: true,
      targetText: true,
      status: true,
    },
  });

  const byOwner = new Map<string, typeof rungs>();
  for (const r of rungs) {
    const list = byOwner.get(r.ownerId);
    if (list) list.push(r);
    else byOwner.set(r.ownerId, [r]);
  }

  return rows.map((row) => {
    const own = byOwner.get(row.id) ?? [];
    const done = own.filter((r) => r.status === "ACHIEVED").length;
    const current = own.find((r) => r.status === "ACTIVE") ?? null;
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      total: own.length,
      done,
      current: current
        ? { label: current.label, modifier: current.modifier, targetText: current.targetText }
        : null,
    };
  });
}

// Best logged result per exercise, in every metric SetEntry records. One
// aggregate per exercise — a ladder links a handful at most.
async function bestByExercise(exerciseIds: string[]) {
  const best = new Map<string, { WEIGHT: number | null; REPS: number | null; SECONDS: number | null }>();
  await Promise.all(
    exerciseIds.map(async (id) => {
      const agg = await prisma.setEntry.aggregate({
        where: { sessionExercise: { exerciseId: id } },
        _max: { weightLb: true, reps: true, seconds: true },
      });
      best.set(id, {
        WEIGHT: agg._max.weightLb,
        REPS: agg._max.reps,
        SECONDS: agg._max.seconds,
      });
    })
  );
  return best;
}

export async function getProgressionDetail(id: string): Promise<ProgressionDetail | null> {
  const session = await getAppSession();
  const row = await prisma.progression.findFirst({
    where: { id, profileKey: session.profileKey },
    select: { id: true, name: true, status: true, notes: true, createdAt: true },
  });
  if (!row) return null;

  const rungs = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "PROGRESSION", ownerId: id },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      label: true,
      modifier: true,
      targetText: true,
      status: true,
      sortOrder: true,
      gateMetric: true,
      gateValue: true,
      autoTick: true,
      scopeKind: true,
      scopeRef: true,
    },
  });

  const exerciseIds = Array.from(
    new Set(rungs.filter((r) => r.scopeKind === "EXERCISE" && r.scopeRef).map((r) => r.scopeRef!))
  );
  const [names, best] = await Promise.all([
    exerciseIds.length
      ? prisma.exercise.findMany({
          where: { id: { in: exerciseIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    exerciseIds.length ? bestByExercise(exerciseIds) : Promise.resolve(new Map()),
  ]);
  const nameById = new Map(names.map((e) => [e.id, e.name]));

  const views: RungView[] = rungs.map((r) => {
    const exerciseId = r.scopeKind === "EXERCISE" ? r.scopeRef : null;
    return {
      id: r.id,
      label: r.label,
      modifier: r.modifier,
      targetText: r.targetText,
      status: r.status,
      sortOrder: r.sortOrder,
      metric: r.gateMetric,
      value: r.gateValue,
      exerciseId,
      exerciseName: exerciseId ? (nameById.get(exerciseId) ?? null) : null,
      best: exerciseId && r.gateMetric ? (best.get(exerciseId)?.[r.gateMetric] ?? null) : null,
      autoTick: r.autoTick,
    };
  });

  const done = views.filter((r) => r.status === "ACHIEVED").length;
  const current = views.find((r) => r.status === "ACTIVE") ?? null;

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    notes: row.notes,
    createdYmd: row.createdAt.toISOString().slice(0, 10),
    rungs: views,
    total: views.length,
    done,
    currentId: current?.id ?? null,
  };
}

// Every exercise, for the "done when" picker. ~300 rows of id+name is small
// enough to hand the client outright rather than standing up a search endpoint.
export async function getExerciseOptions(): Promise<ExerciseOption[]> {
  return prisma.exercise.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export type ReadyRung = {
  id: string;
  label: string;
  progressionId: string;
  progressionName: string;
  metric: RungMetric;
  value: number;
  best: number;
  exerciseName: string;
};

// Steps you have already earned but not marked. Auto-ticking ones are excluded
// — those mark themselves, so surfacing them here would be asking twice.
//
// This is the answer to the real failure mode: a ladder you have to remember to
// visit goes stale. The tick has to come to you.
export async function getReadyRungs(): Promise<ReadyRung[]> {
  const session = await getAppSession();
  const progressions = await prisma.progression.findMany({
    where: { profileKey: session.profileKey, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  if (progressions.length === 0) return [];

  const rungs = await prisma.progressionMilestone.findMany({
    where: {
      ownerKind: "PROGRESSION",
      ownerId: { in: progressions.map((p) => p.id) },
      status: "ACTIVE",
      autoTick: false,
      scopeKind: "EXERCISE",
      scopeRef: { not: null },
      gateMetric: { not: null },
      gateValue: { not: null },
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, label: true, ownerId: true,
      gateMetric: true, gateValue: true, scopeRef: true,
    },
  });
  if (rungs.length === 0) return [];

  const exerciseIds = Array.from(new Set(rungs.map((r) => r.scopeRef!)));
  const [best, names] = await Promise.all([
    bestByExercise(exerciseIds),
    prisma.exercise.findMany({
      where: { id: { in: exerciseIds } },
      select: { id: true, name: true },
    }),
  ]);
  const nameById = new Map(names.map((e) => [e.id, e.name]));
  const progressionById = new Map(progressions.map((p) => [p.id, p.name]));

  const ready: ReadyRung[] = [];
  for (const rung of rungs) {
    const reached = best.get(rung.scopeRef!)?.[rung.gateMetric!];
    if (reached == null || rung.gateValue == null || reached < rung.gateValue) continue;
    ready.push({
      id: rung.id,
      label: rung.label,
      progressionId: rung.ownerId,
      progressionName: progressionById.get(rung.ownerId) ?? "",
      metric: rung.gateMetric!,
      value: rung.gateValue,
      best: reached,
      exerciseName: nameById.get(rung.scopeRef!) ?? "",
    });
  }
  return ready;
}
