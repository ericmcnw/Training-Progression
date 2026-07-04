// Resolves "what frequency goals does this routine contribute to?" — used by
// the log page's Contributes-to strip so the user can see in advance what
// their log will satisfy.
//
// For each goal the routine is linked to, we compute the current window's
// progress (e.g. 3 of 4 this week) and flag whether this routine participates
// as a PRIMARY (real completion) or SUBSTITUTE (covers a slot).

import { prisma } from "@/lib/prisma";
import { computeFrequencyState, type FrequencyTarget } from "@/lib/frequency-state";
import { buildFrequencyGoalMembership, classifyLogAgainstFrequencyGoal } from "@/lib/frequency-goals";
import { effectiveRoutineDomain } from "@/lib/routines";

export type RoutineGoalContribution = {
  goalId: string;
  goalName: string;
  /** Whether this routine is a PRIMARY contributor or a SUBSTITUTE on the goal. */
  role: "PRIMARY" | "SUBSTITUTE";
  /** True when the goal is a group (more than one PRIMARY routine). */
  isGroup: boolean;
  /** "1× / day", "3× / week", etc. */
  cadenceLabel: string;
  /** Current window progress / target. */
  progress: number;
  target: number;
  /** Whether today's log is *already* counted for this goal (any primary or
   *  substitute routine on the goal logged today). Lets the strip distinguish
   *  "you'll hit X" vs "X already hit today, this is bonus." */
  hitToday: boolean;
};

const WINDOW_DAYS = 35; // enough for monthly windows to compute current progress

export async function getRoutineGoalContributions(
  routineId: string,
  today: string
): Promise<RoutineGoalContribution[]> {
  // Resolve the routine's own subtype + exercise ids — used to discover
  // goals this routine contributes to via trigger paths (subtype match or
  // exercise match) in addition to direct membership. Has no other
  // dependencies, so we fetch it first then issue a single combined
  // goals query that ORs all three membership paths together (direct
  // link, subtype trigger, exercise trigger). Previously this took 4
  // sequential roundtrips — now 2 (plus the logs query below).
  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      kind: true,
      domain: true,
      subtype: true,
      supportsSports: true,
      exercises: { select: { exerciseId: true } },
    },
  });
  const routineSubtype = routine?.subtype ? routine.subtype.toUpperCase() : null;
  const routineExerciseIds = routine?.exercises.map((e) => e.exerciseId) ?? [];
  const routineDomain = routine
    ? effectiveRoutineDomain(routine.domain, routine.kind, routine.subtype)
    : null;
  const routineSupportsSports = routine?.supportsSports ?? [];

  // Endurance-specific lookup: load the routine's activityType so a typed
  // endurance routine can match goals targeting its type or family. Non-
  // endurance routines just get null here, which short-circuits the
  // OR-clause additions below.
  const routineActivityType = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { activityType: { select: { id: true, familyId: true } } },
  });
  const routineActivityTypeId = routineActivityType?.activityType?.id ?? null;
  const routineActivityFamilyId = routineActivityType?.activityType?.familyId ?? null;

  const orClauses: Array<Record<string, unknown>> = [
    { routines: { some: { routineId } } },
  ];
  if (routineSubtype) {
    orClauses.push({ triggerSubtypes: { has: routineSubtype } });
  }
  if (routineActivityTypeId) {
    orClauses.push({ triggerActivityTypeIds: { has: routineActivityTypeId } });
  }
  if (routineActivityFamilyId) {
    orClauses.push({ triggerActivityFamilyIds: { has: routineActivityFamilyId } });
  }
  if (routineExerciseIds.length > 0) {
    orClauses.push({ triggerExercises: { some: { exerciseId: { in: routineExerciseIds } } } });
  }
  // Domain / sport-tag goals: any log from this routine counts when the
  // goal targets the routine's effective domain ("any" targets everything)
  // or one of the sports this routine trains for.
  if (routineDomain) {
    orClauses.push({ targetDomain: { in: [routineDomain, "any"] } });
  }
  if (routineSupportsSports.length > 0) {
    orClauses.push({ triggerSupportedSports: { hasSome: routineSupportsSports } });
  }

  const goals = await prisma.frequencyGoal.findMany({
    where: { isActive: true, OR: orClauses },
    include: {
      routines: {
        include: {
          // activityTypeId is required for the bilingual matcher fix —
          // PRIMARY routines that carry one propagate it into the
          // trigger set so logs against the synthetic Endurance routine
          // (which carry activityTypeId but don't appear in the goal's
          // routine roster) also match.
          routine: { select: { id: true, name: true, isActive: true, isDeleted: true, activityTypeId: true } },
        },
      },
      triggerExercises: { select: { exerciseId: true } },
    },
  });
  if (goals.length === 0) return [];

  // Derive direct-membership roles from the included `routines` join — no
  // separate frequencyGoalRoutine query needed.
  const ownRoleByGoalId = new Map<string, "PRIMARY" | "SUBSTITUTE">();
  for (const goal of goals) {
    const link = goal.routines.find((r) => r.routineId === routineId);
    if (link) ownRoleByGoalId.set(goal.id, link.role);
  }

  // Pull recent logs across every routine that COULD contribute to any of
  // these goals — including trigger paths. We over-fetch a bit (each log
  // is filtered per-goal below) to avoid N queries.
  const allMemberRoutineIds = Array.from(
    new Set(goals.flatMap((g) => g.routines.map((r) => r.routineId)))
  );
  const allTriggerSubtypes = Array.from(
    new Set(goals.flatMap((g) => (g.triggerSubtypes ?? []).map((s) => s.toUpperCase())))
  );
  const allTriggerActivityTypeIds = Array.from(
    new Set([
      ...goals.flatMap((g) => g.triggerActivityTypeIds ?? []),
      // Bilingual fix: propagate activityTypeIds of every PRIMARY routine
      // member so the log query catches synthetic-Endurance logs of the
      // same type. Without this, the OR clause below would miss them
      // even though the matcher (via buildFrequencyGoalMembership) is
      // expecting to claim them.
      ...goals.flatMap((g) =>
        g.routines
          .filter((rel) => rel.role !== "SUBSTITUTE" && rel.routine?.activityTypeId)
          .map((rel) => rel.routine!.activityTypeId!)
      ),
    ])
  );
  const allTriggerActivityFamilyIds = Array.from(
    new Set(goals.flatMap((g) => g.triggerActivityFamilyIds ?? []))
  );
  const allTriggerExerciseIds = Array.from(
    new Set(goals.flatMap((g) => g.triggerExercises.map((e) => e.exerciseId)))
  );
  const allSupportedSports = Array.from(
    new Set(goals.flatMap((g) => g.triggerSupportedSports ?? []))
  );
  // Domain goals match on the routine's EFFECTIVE domain (stored ?? derived)
  // — not expressible as a where-clause, so fetch the whole window and let
  // the in-memory matcher decide.
  const anyDomainGoal = goals.some((g) => Boolean(g.targetDomain));
  const hasAnyTriggers =
    allTriggerSubtypes.length > 0 ||
    allTriggerActivityTypeIds.length > 0 ||
    allTriggerActivityFamilyIds.length > 0 ||
    allTriggerExerciseIds.length > 0 ||
    allSupportedSports.length > 0;

  const sinceMs = new Date(`${today}T00:00:00.000Z`).getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const since = new Date(sinceMs);
  const logs = await prisma.routineLog.findMany({
    where: anyDomainGoal
      ? { performedAt: { gte: since } }
      : hasAnyTriggers
      ? {
          performedAt: { gte: since },
          OR: [
            { routineId: { in: allMemberRoutineIds } },
            ...(allTriggerSubtypes.length > 0
              ? [{ routine: { subtype: { in: allTriggerSubtypes } } }]
              : []),
            ...(allTriggerActivityTypeIds.length > 0
              ? [{ activityTypeId: { in: allTriggerActivityTypeIds } }]
              : []),
            ...(allTriggerActivityFamilyIds.length > 0
              ? [{ activityType: { familyId: { in: allTriggerActivityFamilyIds } } }]
              : []),
            ...(allTriggerExerciseIds.length > 0
              ? [{ exercises: { some: { exerciseId: { in: allTriggerExerciseIds } } } }]
              : []),
            ...(allSupportedSports.length > 0
              ? [{ routine: { supportsSports: { hasSome: allSupportedSports } } }]
              : []),
          ],
        }
      : { routineId: { in: allMemberRoutineIds }, performedAt: { gte: since } },
    select: {
      id: true,
      performedAt: true,
      routineId: true,
      activityTypeId: true,
      activityType: { select: { familyId: true } },
      routine: { select: { kind: true, domain: true, subtype: true, supportsSports: true } },
      // Per-exercise set counts so the min-sets gate works for exercise
      // triggers (e.g. a goal with triggerMinSets=2 ignores a single
      // warmup rep of a trigger exercise).
      exercises: {
        select: {
          exerciseId: true,
          _count: { select: { sets: true } },
        },
      },
    },
  });

  const contributions: RoutineGoalContribution[] = goals
    .map((goal): RoutineGoalContribution | null => {
      // Effective role: explicit PRIMARY/SUBSTITUTE link wins; otherwise we
      // got here via a trigger path, treated as a PRIMARY contributor.
      const ownRole: "PRIMARY" | "SUBSTITUTE" = ownRoleByGoalId.get(goal.id) ?? "PRIMARY";
      const liveLinks = goal.routines.filter(
        (rel) => rel.routine && rel.routine.isActive && !rel.routine.isDeleted
      );
      const primaryLinks = liveLinks.filter((rel) => rel.role !== "SUBSTITUTE");
      // Trigger-only goals may have no member routines yet — that's still
      // a valid contribution shape, render with the goal name only.

      const membership = buildFrequencyGoalMembership({
        primaryRoutines: primaryLinks.map((rel) => ({
          id: rel.routineId,
          activityTypeId: rel.routine?.activityTypeId ?? null,
        })),
        substituteRoutineIds: liveLinks
          .filter((rel) => rel.role === "SUBSTITUTE")
          .map((rel) => rel.routineId),
        explicit: {
          triggerSubtypes: goal.triggerSubtypes,
          triggerActivityTypeIds: goal.triggerActivityTypeIds,
          triggerActivityFamilyIds: goal.triggerActivityFamilyIds,
          triggerExerciseIds: goal.triggerExercises.map((e) => e.exerciseId),
          triggerMinSets: goal.triggerMinSets,
          targetDomain: goal.targetDomain,
          triggerSupportedSports: goal.triggerSupportedSports,
        },
      });

      // Dedupe by log id and classify each match as primary/covered so the
      // streak/window-progress numbers stay correct when a log qualifies
      // via more than one rule.
      const stateMatched = new Map<string, { performedAt: Date; isPrimary: boolean }>();
      for (const log of logs) {
        if (stateMatched.has(log.id)) continue;
        const result = classifyLogAgainstFrequencyGoal(
          {
            id: log.id,
            routineId: log.routineId,
            performedAt: log.performedAt,
            routineSubtype: log.routine?.subtype ?? null,
            activityTypeId: log.activityTypeId ?? null,
            activityFamilyId: log.activityType?.familyId ?? null,
            exerciseSets: log.exercises.map((ex) => ({ exerciseId: ex.exerciseId, setCount: ex._count.sets })),
            routineDomain: log.routine
              ? effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype)
              : null,
            routineSupportsSports: log.routine?.supportsSports ?? [],
          },
          membership
        );
        if (!result) continue;
        stateMatched.set(log.id, { performedAt: log.performedAt, isPrimary: result.isPrimary });
      }
      const stateLogs = Array.from(stateMatched.values());

      const target: FrequencyTarget = {
        targetCount: goal.targetCount,
        targetInterval: goal.targetInterval,
        targetUnit: goal.targetUnit,
        weekdayMask: goal.weekdayMask ?? null,
      };
      const state = computeFrequencyState({
        target,
        logs: stateLogs,
        today,
        trailingDays: WINDOW_DAYS,
      });

      const isGroup = primaryLinks.length > 1;
      const isPerRoutine = goal.id.startsWith("fg_");
      const displayName = isPerRoutine && primaryLinks[0]
        ? primaryLinks[0].routine!.name
        : goal.name;

      return {
        goalId: goal.id,
        goalName: displayName,
        role: ownRole,
        isGroup,
        cadenceLabel: formatCadence(target),
        progress: state.currentWindow.progress,
        target: state.currentWindow.target,
        hitToday: state.dailyState[today] === "done" || state.dailyState[today] === "covered",
      };
    })
    .filter((c): c is RoutineGoalContribution => c !== null);

  // Sort: in-progress (not yet hit) before complete; primaries before substitutes.
  contributions.sort((a, b) => {
    if (a.progress < a.target && b.progress >= b.target) return -1;
    if (a.progress >= a.target && b.progress < b.target) return 1;
    if (a.role !== b.role) return a.role === "PRIMARY" ? -1 : 1;
    return a.goalName.localeCompare(b.goalName);
  });

  return contributions;
}

function formatCadence(target: FrequencyTarget): string {
  const unitWord = target.targetUnit === "DAY" ? "day" : target.targetUnit === "WEEK" ? "week" : "month";
  if (target.targetInterval === 1) return `${target.targetCount}× / ${unitWord}`;
  return `${target.targetCount}× / ${target.targetInterval} ${unitWord}s`;
}
