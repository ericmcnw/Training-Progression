import { prisma } from "@/lib/prisma";
import { diffYmdDays, todayAppYmd, toAppYmd } from "@/lib/dates";
import { getAppSession } from "@/lib/auth";

const SENT_OUTCOMES = new Set(["FLASH", "ONSIGHT", "SEND", "REDPOINT"]);

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

  const milestones = await prisma.progressionMilestone.findMany({
    where: { ownerKind: "FOCUS", ownerId: id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, scopeKind: true, scopeRef: true, label: true, status: true },
  });

  const explicitRoutineIds = program.routineLinks.map((link) => link.routine.id);
  const fallbackRoutineIds = milestones
    .filter((m) => m.scopeKind === "ROUTINE" && m.scopeRef)
    .map((m) => m.scopeRef!);
  const routineIds = Array.from(new Set(explicitRoutineIds.length ? explicitRoutineIds : fallbackRoutineIds));

  const fallbackRoutines =
    program.routineLinks.length === 0 && routineIds.length
      ? await prisma.routine.findMany({
          where: { id: { in: routineIds } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, kind: true, domain: true },
        })
      : [];

  const since = new Date(Date.now() - 56 * 86_400_000);
  const logs = routineIds.length
    ? await prisma.routineLog.findMany({
        where: { routineId: { in: routineIds }, performedAt: { gte: since } },
        orderBy: { performedAt: "desc" },
        select: { id: true, routineId: true, performedAt: true, durationSec: true, routine: { select: { name: true } } },
      })
    : [];

  const today = todayAppYmd();
  const weeklyCounts = new Array(8).fill(0) as number[];
  for (const log of logs) {
    const daysAgo = diffYmdDays(today, toAppYmd(log.performedAt));
    const bucket = Math.floor(daysAgo / 7);
    if (bucket >= 0 && bucket < 8) weeklyCounts[7 - bucket] += 1;
  }

  return {
    ...program,
    milestones,
    routines: program.routineLinks.length
      ? program.routineLinks.map((link) => ({ ...link.routine, role: link.role, source: "LINK" as const }))
      : fallbackRoutines.map((routine) => ({ ...routine, role: "SUPPORTING" as const, source: "MILESTONE" as const })),
    activity: {
      total8Weeks: logs.length,
      weeklyCounts,
      lastYmd: logs[0] ? toAppYmd(logs[0].performedAt) : null,
      recent: logs.slice(0, 12).map((log) => ({
        id: log.id,
        routineId: log.routineId,
        routineName: log.routine.name,
        ymd: toAppYmd(log.performedAt),
        durationMin: log.durationSec ? Math.round(log.durationSec / 60) : null,
      })),
    },
    targetLists: program.targetLists.map((list) => ({
      ...list,
      items: list.items.map((item) => ({
        ...item,
        completed:
          item.status === "COMPLETED" ||
          Boolean(item.climbProblem?.attempts.some((attempt) => SENT_OUTCOMES.has(attempt.outcome))),
      })),
    })),
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
