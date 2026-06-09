// Helper for goal-detail pages — given a goal id (routine `fg_*`, group
// `group-frequency:<id>`, or a legacy Goal record with FREQUENCY type),
// returns everything needed to render a FrequencyHeatmap: the FrequencyTarget,
// the computed state, the linked routine ids, and the weekday mask.
//
// Returns null when the id doesn't resolve to a frequency-aware target — the
// goal detail page just skips rendering the consistency section in that case.

import { prisma } from "@/lib/prisma";
import { todayAppYmd } from "@/lib/dates";
import { computeFrequencyState, type FrequencyState, type FrequencyTarget } from "@/lib/frequency-state";

export type FrequencyConsistency = {
  target: FrequencyTarget;
  state: FrequencyState;
  weekdayMask: number | null;
  routineIds: string[];
  routineNames: string[];
};

const HEATMAP_DAYS = 8 * 7 + 7; // 8 weeks of grid + a week of buffer for streak math

export async function getFrequencyConsistency(rawGoalId: string): Promise<FrequencyConsistency | null> {
  const goalId = decodeURIComponent(rawGoalId);
  const today = todayAppYmd();

  // Group-frequency goals carry a `group-frequency:<id>` URL prefix.
  if (goalId.startsWith("group-frequency:")) {
    const id = goalId.slice("group-frequency:".length);
    const goal = await prisma.frequencyGoal.findUnique({
      where: { id },
      include: {
        routines: {
          include: { routine: { select: { id: true, name: true, isDeleted: true, activityTypeId: true } } },
        },
        triggerExercises: { select: { exerciseId: true } },
      },
    });
    if (!goal) return null;
    return loadAndCompute({
      target: {
        targetCount: goal.targetCount,
        targetInterval: goal.targetInterval,
        targetUnit: goal.targetUnit,
        weekdayMask: goal.weekdayMask,
      },
      routines: goal.routines
        .filter((rel) => Boolean(rel.routine) && !rel.routine!.isDeleted)
        .map((rel) => ({ ...rel.routine!, role: rel.role })),
      today,
      triggerSubtypes: goal.triggerSubtypes,
      triggerExerciseIds: goal.triggerExercises.map((e) => e.exerciseId),
      triggerMinSets: goal.triggerMinSets,
    });
  }

  // Per-routine `fg_*` ids resolve directly to a FrequencyGoal.
  if (goalId.startsWith("fg_")) {
    const goal = await prisma.frequencyGoal.findUnique({
      where: { id: goalId },
      include: {
        routines: {
          include: { routine: { select: { id: true, name: true, isDeleted: true, activityTypeId: true } } },
        },
      },
    });
    if (!goal) return null;
    return loadAndCompute({
      target: {
        targetCount: goal.targetCount,
        targetInterval: goal.targetInterval,
        targetUnit: goal.targetUnit,
        weekdayMask: goal.weekdayMask,
      },
      routines: goal.routines
        .filter((rel) => Boolean(rel.routine) && !rel.routine!.isDeleted)
        .map((rel) => ({ ...rel.routine!, role: rel.role })),
      today,
    });
  }

  // Legacy Goal records with FREQUENCY/ROUTINE — fetch the routine and its
  // companion FrequencyGoal (`fg_<routineId>`) for cadence + mask.
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { id: true, goalType: true, targetType: true, targetId: true },
  });
  if (!goal || goal.goalType !== "FREQUENCY" || goal.targetType !== "ROUTINE") return null;

  const [routine, fg] = await Promise.all([
    prisma.routine.findUnique({
      where: { id: goal.targetId },
      select: { id: true, name: true, isDeleted: true },
    }),
    prisma.frequencyGoal.findUnique({
      where: { id: `fg_${goal.targetId}` },
      select: {
        targetCount: true,
        targetInterval: true,
        targetUnit: true,
        weekdayMask: true,
        routines: {
          include: { routine: { select: { id: true, name: true, isDeleted: true, activityTypeId: true } } },
        },
      },
    }),
  ]);
  if (!routine || routine.isDeleted || !fg) return null;
  return loadAndCompute({
    target: {
      targetCount: fg.targetCount,
      targetInterval: fg.targetInterval,
      targetUnit: fg.targetUnit,
      weekdayMask: fg.weekdayMask,
    },
    // Pull all linked routines (primary + substitutes) so the day classifier
    // can mark substitute-only days as "covered."
    routines: fg.routines
      .filter((rel) => Boolean(rel.routine) && !rel.routine!.isDeleted)
      .map((rel) => ({ ...rel.routine!, role: rel.role })),
    today,
  });
}

async function loadAndCompute(params: {
  target: FrequencyTarget;
  routines: Array<{ id: string; name: string; role: "PRIMARY" | "SUBSTITUTE"; activityTypeId?: string | null }>;
  today: string;
  /** Activity-type subtypes that broaden matching beyond the routine roster
   *  (group frequency goals only — per-routine goals don't expose triggers). */
  triggerSubtypes?: string[];
  /** Exercise ids that broaden matching beyond the routine roster — catches
   *  quick-log sessions whose placeholder routine isn't in the goal's list. */
  triggerExerciseIds?: string[];
  /** Minimum trigger-exercise set count required for an exercise-trigger
   *  match. Defaults to 1 (any set counts). */
  triggerMinSets?: number;
}): Promise<FrequencyConsistency | null> {
  const { target, routines, today } = params;
  if (routines.length === 0) return null;

  // Only PRIMARY routines count for the visible "this is what the goal tracks"
  // surfaces (back-date links, recent-sessions list). Substitutes are silent
  // partners — they color the day but don't claim ownership of the goal.
  const primaryRoutines = routines.filter((r) => r.role === "PRIMARY");
  const primaryRoutineIds = new Set(primaryRoutines.map((r) => r.id));
  const allRoutineIds = routines.map((r) => r.id);
  const triggerSubtypes = (params.triggerSubtypes ?? []).map((s) => s.toUpperCase());
  const triggerExerciseIds = params.triggerExerciseIds ?? [];
  const triggerMinSets = Math.max(1, params.triggerMinSets ?? 1);
  // Bilingual fix: PRIMARY routines that carry an activityTypeId (legacy
  // per-type endurance routines like "Easy Run") propagate it into the
  // trigger set, so synthetic-Endurance logs carrying the same activityType
  // also count. Same logic as buildFrequencyGoalMembership but inlined
  // because this file does its own lighter-weight match loop instead of
  // going through classifyLogAgainstFrequencyGoal.
  const triggerActivityTypeIds = Array.from(
    new Set(
      primaryRoutines
        .map((r) => r.activityTypeId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const triggerActivityTypeIdSet = new Set(triggerActivityTypeIds);
  const hasTriggers =
    triggerSubtypes.length > 0 ||
    triggerExerciseIds.length > 0 ||
    triggerActivityTypeIds.length > 0;

  const since = new Date(Date.now() - HEATMAP_DAYS * 24 * 60 * 60 * 1000);
  // Widen the query when triggers are present so trigger-matched logs are
  // included in the in-memory matcher below. Without this, the heatmap
  // shows trigger-matched days as missed.
  const where: import("@/generated/prisma").Prisma.RoutineLogWhereInput = hasTriggers
    ? {
        performedAt: { gte: since },
        OR: [
          { routineId: { in: allRoutineIds } },
          ...(triggerSubtypes.length > 0
            ? [{ routine: { subtype: { in: triggerSubtypes } } }]
            : []),
          ...(triggerExerciseIds.length > 0
            ? [{ exercises: { some: { exerciseId: { in: triggerExerciseIds } } } }]
            : []),
          ...(triggerActivityTypeIds.length > 0
            ? [{ activityTypeId: { in: triggerActivityTypeIds } }]
            : []),
        ],
      }
    : {
        routineId: { in: allRoutineIds },
        performedAt: { gte: since },
      };

  const logs = await prisma.routineLog.findMany({
    where,
    select: {
      id: true,
      performedAt: true,
      routineId: true,
      // activityTypeId carries through so synthetic-Endurance logs can be
      // matched to the trigger set built from primary-routine
      // activityTypeIds (the bilingual matcher fix).
      activityTypeId: true,
      routine: { select: { subtype: true } },
      // Always include the per-exercise set counts — small payload (one int
      // per exercise row) and keeps the typed shape stable regardless of
      // whether `hasTriggers` is true at runtime.
      exercises: {
        select: {
          exerciseId: true,
          _count: { select: { sets: true } },
        },
      },
    },
    orderBy: { performedAt: "asc" },
  });

  const triggerSubtypeSet = new Set(triggerSubtypes);
  const triggerExerciseIdSet = new Set(triggerExerciseIds);
  const routineIdSet = new Set(allRoutineIds);
  // Tag each log as primary / substitute / trigger so the day classifier
  // can decide between "done" (primary or trigger) vs "covered" (substitute
  // only). Dedupe by log id so the same log can't claim two roles.
  type StateLog = { performedAt: Date; isPrimary: boolean };
  const stateLogs: StateLog[] = [];
  const seen = new Set<string>();
  for (const log of logs) {
    if (seen.has(log.id)) continue;
    if (routineIdSet.has(log.routineId)) {
      seen.add(log.id);
      stateLogs.push({
        performedAt: log.performedAt,
        isPrimary: primaryRoutineIds.has(log.routineId),
      });
      continue;
    }
    if (!hasTriggers) continue;
    const subtype = log.routine?.subtype ? log.routine.subtype.toUpperCase() : null;
    if (subtype && triggerSubtypeSet.has(subtype)) {
      seen.add(log.id);
      stateLogs.push({ performedAt: log.performedAt, isPrimary: true });
      continue;
    }
    // ActivityType trigger — catches synthetic-Endurance logs that didn't
    // match a roster routineId but carry one of the primary routines'
    // activityTypeIds.
    if (log.activityTypeId && triggerActivityTypeIdSet.has(log.activityTypeId)) {
      seen.add(log.id);
      stateLogs.push({ performedAt: log.performedAt, isPrimary: true });
      continue;
    }
    if (triggerExerciseIdSet.size > 0 && log.exercises) {
      let matchingSets = 0;
      for (const ex of log.exercises) {
        if (triggerExerciseIdSet.has(ex.exerciseId)) matchingSets += ex._count.sets;
        if (matchingSets >= triggerMinSets) break;
      }
      if (matchingSets >= triggerMinSets) {
        seen.add(log.id);
        stateLogs.push({ performedAt: log.performedAt, isPrimary: true });
      }
    }
  }

  const state = computeFrequencyState({
    target,
    logs: stateLogs,
    today,
    trailingDays: 8 * 7,
  });

  return {
    target,
    state,
    weekdayMask: target.weekdayMask ?? null,
    routineIds: primaryRoutines.map((r) => r.id),
    routineNames: primaryRoutines.map((r) => r.name),
  };
}
