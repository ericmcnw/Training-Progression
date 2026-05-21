// Resolves "what frequency goals does this routine contribute to?" — used by
// the log page's Contributes-to strip so the user can see in advance what
// their log will satisfy.
//
// For each goal the routine is linked to, we compute the current window's
// progress (e.g. 3 of 4 this week) and flag whether this routine participates
// as a PRIMARY (real completion) or SUBSTITUTE (covers a slot).

import { prisma } from "@/lib/prisma";
import { computeFrequencyState, type FrequencyTarget } from "@/lib/frequency-state";
import { classifyLogAgainstFrequencyGoal } from "@/lib/frequency-goals";

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
      subtype: true,
      exercises: { select: { exerciseId: true } },
    },
  });
  const routineSubtype = routine?.subtype ? routine.subtype.toUpperCase() : null;
  const routineExerciseIds = routine?.exercises.map((e) => e.exerciseId) ?? [];

  const orClauses: Array<Record<string, unknown>> = [
    { routines: { some: { routineId } } },
  ];
  if (routineSubtype) {
    orClauses.push({ triggerSubtypes: { has: routineSubtype } });
  }
  if (routineExerciseIds.length > 0) {
    orClauses.push({ triggerExercises: { some: { exerciseId: { in: routineExerciseIds } } } });
  }

  const goals = await prisma.frequencyGoal.findMany({
    where: { isActive: true, OR: orClauses },
    include: {
      routines: {
        include: {
          routine: { select: { id: true, name: true, isActive: true, isDeleted: true } },
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
  const allTriggerExerciseIds = Array.from(
    new Set(goals.flatMap((g) => g.triggerExercises.map((e) => e.exerciseId)))
  );
  const hasAnyTriggers = allTriggerSubtypes.length > 0 || allTriggerExerciseIds.length > 0;

  const sinceMs = new Date(`${today}T00:00:00.000Z`).getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const since = new Date(sinceMs);
  const logs = await prisma.routineLog.findMany({
    where: hasAnyTriggers
      ? {
          performedAt: { gte: since },
          OR: [
            { routineId: { in: allMemberRoutineIds } },
            ...(allTriggerSubtypes.length > 0
              ? [{ routine: { subtype: { in: allTriggerSubtypes } } }]
              : []),
            ...(allTriggerExerciseIds.length > 0
              ? [{ exercises: { some: { exerciseId: { in: allTriggerExerciseIds } } } }]
              : []),
          ],
        }
      : { routineId: { in: allMemberRoutineIds }, performedAt: { gte: since } },
    select: {
      id: true,
      performedAt: true,
      routineId: true,
      routine: { select: { subtype: true } },
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

      const membership = {
        primaryRoutineIds: new Set(primaryLinks.map((rel) => rel.routineId)),
        substituteRoutineIds: new Set(
          liveLinks.filter((rel) => rel.role === "SUBSTITUTE").map((rel) => rel.routineId)
        ),
        triggerSubtypes: new Set((goal.triggerSubtypes ?? []).map((s) => s.toUpperCase())),
        triggerExerciseIds: new Set(goal.triggerExercises.map((e) => e.exerciseId)),
        triggerMinSets: Math.max(1, goal.triggerMinSets ?? 1),
      };

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
            exerciseSets: log.exercises.map((ex) => ({ exerciseId: ex.exerciseId, setCount: ex._count.sets })),
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
