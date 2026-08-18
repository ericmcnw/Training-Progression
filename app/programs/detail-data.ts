import { prisma } from "@/lib/prisma";
import { diffYmdDays, todayAppYmd, toAppYmd } from "@/lib/dates";
import { getAppSession } from "@/lib/auth";
import { getActivityEntry } from "@/lib/activity-families";
import { getGoalsOverview, type GoalInsight } from "@/lib/goals";
import { getSyntheticSportRoutineId } from "@/lib/synthetic-sport-routines";

const SENT_OUTCOMES = new Set(["FLASH", "ONSIGHT", "SEND", "REDPOINT"]);

function compactGoalInsight(insight: GoalInsight | null) {
  if (!insight) return null;
  return {
    actualDisplay: insight.actualDisplay,
    targetDisplay: insight.targetDisplay,
    fractionComplete: insight.fractionComplete,
    isAchieved: insight.isAchieved,
    hasData: insight.hasData,
    summaryLabel: insight.summaryLabel,
    timeframeStatusLabel: insight.timeframeStatusLabel,
    detailHref: insight.detailHref ?? null,
  };
}

export type ProgramDetailData = Awaited<ReturnType<typeof getProgramDetailData>>;

export async function getProgramDetailData(id: string) {
  const session = await getAppSession();
  const program = await prisma.focus.findFirst({
    where: { id, profileKey: session.profileKey },
    select: {
      id: true,
      name: true,
      pursuitKey: true,
      linkedInjuryId: true,
      routineLinks: {
        orderBy: { sortOrder: "asc" },
        select: { role: true, routine: { select: { id: true, name: true, kind: true, domain: true } } },
      },
      goalLinks: {
        orderBy: { sortOrder: "asc" },
        select: {
          role: true,
          goal: {
            select: {
              id: true,
              name: true,
              goalType: true,
              metricType: true,
              targetValue: true,
              unit: true,
              isActive: true,
            },
          },
        },
      },
      frequencyGoalLinks: {
        orderBy: { sortOrder: "asc" },
        select: {
          role: true,
          frequencyGoal: {
            select: {
              id: true,
              name: true,
              targetCount: true,
              targetInterval: true,
              targetUnit: true,
              isActive: true,
            },
          },
        },
      },
      stages: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          gateMode: true,
          notBeforeYmd: true,
          targetEndYmd: true,
          gates: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, kind: true, label: true, dateYmd: true, milestoneId: true, goalId: true },
          },
          blocks: { select: { id: true } },
        },
      },
      blocks: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          stageId: true,
          name: true,
          description: true,
          status: true,
          scheduleMode: true,
          lengthWeeks: true,
          startYmd: true,
          endYmd: true,
          items: {
            orderBy: [{ priority: "desc" }, { sortOrder: "asc" }],
            select: {
              id: true,
              kind: true,
              label: true,
              minPerWeek: true,
              targetPerWeek: true,
              maxPerWeek: true,
              notes: true,
              routine: { select: { id: true, name: true } },
              activityType: { select: { id: true, name: true } },
            },
          },
        },
      },
      targetLists: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          kind: true,
          sportSlug: true,
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              label: true,
              description: true,
              status: true,
              completedAt: true,
              climbProblem: {
                select: {
                  id: true,
                  name: true,
                  grade: true,
                  location: { select: { id: true, name: true } },
                  attempts: { select: { outcome: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!program) return null;

  const pursuitSlug = program.pursuitKey?.trim().toLowerCase() || null;
  const pursuit = pursuitSlug ? getActivityEntry(pursuitSlug) : null;
  const sportRoutineId = pursuit?.family === "sports" ? getSyntheticSportRoutineId(pursuitSlug!) : null;
  const hasClimbingList = program.targetLists.some((list) => list.sportSlug?.trim().toLowerCase() === "climbing");

  const [milestones, allGoalInsights, starredClimbs] = await Promise.all([
    prisma.progressionMilestone.findMany({
      where: { ownerKind: "FOCUS", ownerId: id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, scopeKind: true, scopeRef: true, label: true, status: true },
    }),
    getGoalsOverview({ active: "all" }),
    hasClimbingList
      ? prisma.climbProblem.findMany({
          where: { onTickList: true },
          orderBy: [{ grade: "desc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            grade: true,
            location: { select: { id: true, name: true } },
            attempts: { select: { outcome: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  const goalInsightById = new Map(allGoalInsights.map((insight) => [insight.goal.id, insight]));
  const frequencyGoalInsightBySourceId = new Map(
    allGoalInsights.flatMap((insight) => {
      if (insight.goal.id.startsWith("group-frequency:")) {
        return [[insight.goal.id.slice("group-frequency:".length), insight] as const];
      }
      if (insight.goal.id.startsWith("fg_")) return [[insight.goal.id, insight] as const];
      return [];
    })
  );

  const explicitRoutineIds = program.routineLinks.map((link) => link.routine.id);
  const fallbackRoutineIds = milestones
    .filter((m) => m.scopeKind === "ROUTINE" && m.scopeRef)
    .map((m) => m.scopeRef!);
  const routineIds = Array.from(
    new Set([...explicitRoutineIds, ...fallbackRoutineIds, ...(sportRoutineId ? [sportRoutineId] : [])])
  );

  const missingRoutineIds = routineIds.filter((routineId) => !explicitRoutineIds.includes(routineId));
  const fallbackRoutines =
    missingRoutineIds.length
      ? await prisma.routine.findMany({
          where: { id: { in: missingRoutineIds } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, kind: true, domain: true },
        })
      : [];

  const since = new Date(Date.now() - 56 * 86_400_000);
  const activityFilters = [
    ...(routineIds.length ? [{ routineId: { in: routineIds } }] : []),
    ...(pursuitSlug === "climbing" ? [{ climbAttempts: { some: {} } }] : []),
  ];
  const logs = activityFilters.length
    ? await prisma.routineLog.findMany({
        where: { performedAt: { gte: since }, OR: activityFilters },
        orderBy: { performedAt: "desc" },
        select: {
          id: true,
          routineId: true,
          performedAt: true,
          durationSec: true,
          routine: { select: { name: true } },
          _count: { select: { climbAttempts: true } },
        },
      })
    : [];

  const today = todayAppYmd();
  const weeklyCounts = new Array(8).fill(0) as number[];
  const weeklySportCounts = new Array(8).fill(0) as number[];
  const weeklyTrainingCounts = new Array(8).fill(0) as number[];
  for (const log of logs) {
    const daysAgo = diffYmdDays(today, toAppYmd(log.performedAt));
    const bucket = Math.floor(daysAgo / 7);
    if (bucket < 0 || bucket >= 8) continue;
    const index = 7 - bucket;
    const isSportSession = log.routineId === sportRoutineId || (pursuitSlug === "climbing" && log._count.climbAttempts > 0);
    weeklyCounts[index] += 1;
    if (isSportSession) weeklySportCounts[index] += 1;
    else weeklyTrainingCounts[index] += 1;
  }

  const targetLists = program.targetLists.map((list) => {
    if (list.sportSlug?.trim().toLowerCase() === "climbing") {
      return {
        ...list,
        membershipSource: "CLIMB_TICK_LIST" as const,
        items: starredClimbs.map((problem) => ({
          id: `climb:${problem.id}`,
          label: problem.name,
          description: null,
          status: problem.attempts.some((attempt) => SENT_OUTCOMES.has(attempt.outcome))
            ? ("COMPLETED" as const)
            : ("ACTIVE" as const),
          completedAt: null,
          climbProblem: problem,
          completed: problem.attempts.some((attempt) => SENT_OUTCOMES.has(attempt.outcome)),
        })),
      };
    }
    return {
      ...list,
      membershipSource: "PROGRAM" as const,
      items: list.items.map((item) => ({
        ...item,
        completed:
          item.status === "COMPLETED" ||
          Boolean(item.climbProblem?.attempts.some((attempt) => SENT_OUTCOMES.has(attempt.outcome))),
      })),
    };
  });

  return {
    ...program,
    milestones,
    goalLinks: program.goalLinks.map((link) => ({
      ...link,
      progress: compactGoalInsight(goalInsightById.get(link.goal.id) ?? null),
    })),
    frequencyGoalLinks: program.frequencyGoalLinks.map((link) => ({
      ...link,
      progress: compactGoalInsight(frequencyGoalInsightBySourceId.get(link.frequencyGoal.id) ?? null),
    })),
    routines: [
      ...program.routineLinks.map((link) => ({ ...link.routine, role: link.role, source: "LINK" as const })),
      ...fallbackRoutines.map((routine) => ({
        ...routine,
        role: routine.id === sportRoutineId ? ("PRIMARY" as const) : ("SUPPORTING" as const),
        source: routine.id === sportRoutineId ? ("SPORT" as const) : ("MILESTONE" as const),
      })),
    ],
    activity: {
      total8Weeks: logs.length,
      weeklyCounts,
      weeklySportCounts,
      weeklyTrainingCounts,
      sportSessions: weeklySportCounts.reduce((sum, count) => sum + count, 0),
      trainingSessions: weeklyTrainingCounts.reduce((sum, count) => sum + count, 0),
      lastYmd: logs[0] ? toAppYmd(logs[0].performedAt) : null,
      recent: logs.slice(0, 12).map((log) => ({
        id: log.id,
        routineId: log.routineId,
        routineName: log.routine.name,
        ymd: toAppYmd(log.performedAt),
        durationMin: log.durationSec ? Math.round(log.durationSec / 60) : null,
        kind:
          log.routineId === sportRoutineId || (pursuitSlug === "climbing" && log._count.climbAttempts > 0)
            ? ("SPORT" as const)
            : ("TRAINING" as const),
      })),
    },
    targetLists,
  };
}

export async function getProgramEditorOptions(programId: string) {
  const session = await getAppSession();
  const [program, routines, goals, frequencyGoals] = await Promise.all([
    prisma.focus.findFirst({
      where: { id: programId, profileKey: session.profileKey },
      select: {
        id: true,
        routineLinks: { select: { routineId: true, role: true } },
        goalLinks: { select: { goalId: true, role: true } },
        frequencyGoalLinks: { select: { frequencyGoalId: true, role: true } },
      },
    }),
    prisma.routine.findMany({
      where: { isActive: true, isDeleted: false, isPlaceholder: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true, domain: true },
    }),
    prisma.goal.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, goalType: true } }),
    prisma.frequencyGoal.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, targetCount: true, targetInterval: true, targetUnit: true } }),
  ]);
  if (!program) return null;
  return { program, routines, goals, frequencyGoals };
}
