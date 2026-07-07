// Helper for goal-detail pages — given a goal id (routine `fg_*`, group
// `group-frequency:<id>`, or a legacy Goal record with FREQUENCY type),
// returns everything needed to render a FrequencyHeatmap: the FrequencyTarget,
// the computed state, the linked routine ids, and the weekday mask.
//
// Returns null when the id doesn't resolve to a frequency-aware target — the
// goal detail page just skips rendering the consistency section in that case.

import { prisma } from "@/lib/prisma";
import { todayAppYmd, toAppYmd as toAppYmdShared } from "@/lib/dates";
import { computeFrequencyState, type FrequencyState, type FrequencyTarget } from "@/lib/frequency-state";
import { effectiveRoutineDomain } from "@/lib/routines";

export type FrequencyContributionLog = {
  logId: string;
  routineId: string;
  routineName: string;
  performedYmd: string;
  performedTimeLabel: string;
  isPrimary: boolean;
};

export type FrequencyConsistency = {
  target: FrequencyTarget;
  state: FrequencyState;
  weekdayMask: number | null;
  routineIds: string[];
  routineNames: string[];
  /** All contributing logs in the heatmap window, oldest → newest. Used by
   *  the goal detail page for interactive heatmap + weekly-bars expansion
   *  (clicking a day/week opens the log report popover, same pattern as
   *  the home page). Empty for missed days. */
  contributingLogs: FrequencyContributionLog[];
};

// Default — 8 weeks of grid + a week of buffer so streak math handles edge
// transitions at the leading edge cleanly. The detail page can override
// with a wider window so users see the full requested range.
const HEATMAP_DAYS_DEFAULT = 8 * 7 + 7;

export async function getFrequencyConsistency(
  rawGoalId: string,
  options?: { windowDays?: number }
): Promise<FrequencyConsistency | null> {
  const goalId = decodeURIComponent(rawGoalId);
  const today = todayAppYmd();
  const windowDays = options?.windowDays && options.windowDays > 0
    ? Math.max(14, Math.floor(options.windowDays))
    : HEATMAP_DAYS_DEFAULT;

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
      windowDays,
      triggerSubtypes: goal.triggerSubtypes,
      triggerExerciseIds: goal.triggerExercises.map((e) => e.exerciseId),
      triggerMinSets: goal.triggerMinSets,
      targetDomain: goal.targetDomain,
      triggerSupportedSports: goal.triggerSupportedSports,
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
      windowDays,
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
    windowDays,
  });
}

async function loadAndCompute(params: {
  target: FrequencyTarget;
  routines: Array<{ id: string; name: string; role: "PRIMARY" | "SUBSTITUTE"; activityTypeId?: string | null }>;
  today: string;
  /** Heatmap window in days. The detail-page time-range filter passes this
   *  in to widen / narrow the consistency view; falls back to the default
   *  (~9 weeks) when omitted. */
  windowDays: number;
  /** Activity-type subtypes that broaden matching beyond the routine roster
   *  (group frequency goals only — per-routine goals don't expose triggers). */
  triggerSubtypes?: string[];
  /** Exercise ids that broaden matching beyond the routine roster — catches
   *  quick-log sessions whose placeholder routine isn't in the goal's list. */
  triggerExerciseIds?: string[];
  /** Minimum trigger-exercise set count required for an exercise-trigger
   *  match. Defaults to 1 (any set counts). */
  triggerMinSets?: number;
  /** Domain-wide targeting — see FrequencyGoal.targetDomain. */
  targetDomain?: string | null;
  /** Sport-tag targeting — lowercase sport slugs. */
  triggerSupportedSports?: string[];
}): Promise<FrequencyConsistency | null> {
  const { target, routines, today, windowDays } = params;
  const targetDomain = params.targetDomain ?? null;
  const triggerSupportedSports = (params.triggerSupportedSports ?? []).map((s) => s.toLowerCase());
  const isTagTargeted =
    Boolean(targetDomain) ||
    triggerSupportedSports.length > 0 ||
    // Trigger-exercise goals are rosterless — membership is the exercise.
    (params.triggerExerciseIds ?? []).length > 0;
  if (routines.length === 0 && !isTagTargeted) return null;

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
    triggerActivityTypeIds.length > 0 ||
    triggerSupportedSports.length > 0;

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  // Widen the query when triggers are present so trigger-matched logs are
  // included in the in-memory matcher below. Without this, the heatmap
  // shows trigger-matched days as missed. Domain goals match on the
  // routine's EFFECTIVE domain (stored ?? derived) — not expressible as a
  // where-clause, so fetch the whole window.
  const where: import("@/generated/prisma").Prisma.RoutineLogWhereInput = targetDomain
    ? { performedAt: { gte: since } }
    : hasTriggers
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
          ...(triggerSupportedSports.length > 0
            ? [{ routine: { supportsSports: { hasSome: triggerSupportedSports } } }]
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
      activityTypeId: true,
      // routine.name + subtype: name powers the contributingLogs surface
      // (week-expansion popovers, day-cell click), subtype is used by the
      // trigger matcher below. kind/domain/supportsSports feed the domain
      // and sport-tag matchers.
      routine: { select: { name: true, subtype: true, kind: true, domain: true, supportsSports: true } },
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
  // Each matched log carries enough data both for state computation and
  // for the interactive popover surfaces (week expansion, day-cell click).
  type EnrichedLog = {
    logId: string;
    routineId: string;
    routineName: string;
    performedAt: Date;
    isPrimary: boolean;
  };
  const matched: EnrichedLog[] = [];
  const seen = new Set<string>();
  const enrich = (raw: typeof logs[number], isPrimary: boolean): EnrichedLog => ({
    logId: raw.id,
    routineId: raw.routineId,
    routineName: raw.routine?.name ?? "Session",
    performedAt: raw.performedAt,
    isPrimary,
  });
  const supportedSportsSet = new Set(triggerSupportedSports);
  for (const log of logs) {
    if (seen.has(log.id)) continue;
    if (routineIdSet.has(log.routineId)) {
      seen.add(log.id);
      matched.push(enrich(log, primaryRoutineIds.has(log.routineId)));
      continue;
    }
    // Domain-wide match — any log whose routine's effective domain matches
    // ("any" counts every training log). Claims primary.
    if (targetDomain) {
      const logDomain = effectiveRoutineDomain(
        log.routine?.domain,
        log.routine?.kind,
        log.routine?.subtype
      );
      if (targetDomain === "any" || logDomain === targetDomain) {
        seen.add(log.id);
        matched.push(enrich(log, true));
        continue;
      }
    }
    // Sport-tag match — routine trains FOR one of the goal's sports.
    if (
      supportedSportsSet.size > 0 &&
      (log.routine?.supportsSports ?? []).some((s) => supportedSportsSet.has(s.toLowerCase()))
    ) {
      seen.add(log.id);
      matched.push(enrich(log, true));
      continue;
    }
    if (!hasTriggers) continue;
    const subtype = log.routine?.subtype ? log.routine.subtype.toUpperCase() : null;
    if (subtype && triggerSubtypeSet.has(subtype)) {
      seen.add(log.id);
      matched.push(enrich(log, true));
      continue;
    }
    if (log.activityTypeId && triggerActivityTypeIdSet.has(log.activityTypeId)) {
      seen.add(log.id);
      matched.push(enrich(log, true));
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
        matched.push(enrich(log, true));
      }
    }
  }

  const state = computeFrequencyState({
    target,
    logs: matched.map((m) => ({ performedAt: m.performedAt, isPrimary: m.isPrimary })),
    today,
    trailingDays: Math.max(8 * 7, windowDays - 7),
  });

  const contributingLogs: FrequencyContributionLog[] = matched.map((m) => ({
    logId: m.logId,
    routineId: m.routineId,
    routineName: m.routineName,
    performedYmd: toAppYmd(m.performedAt),
    performedTimeLabel: timeLabel(m.performedAt),
    isPrimary: m.isPrimary,
  }));

  return {
    target,
    state,
    weekdayMask: target.weekdayMask ?? null,
    routineIds: primaryRoutines.map((r) => r.id),
    routineNames: primaryRoutines.map((r) => r.name),
    contributingLogs,
  };
}

function toAppYmd(d: Date): string {
  return toAppYmdShared(d);
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
