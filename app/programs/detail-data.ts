import { prisma } from "@/lib/prisma";
import { diffYmdDays, todayAppYmd, toAppYmd } from "@/lib/dates";
import { getAppSession } from "@/lib/auth";
import { getActivityEntry } from "@/lib/activity-families";
import { getGoalsOverview, type GoalInsight } from "@/lib/goals";
import { getSyntheticSportRoutineId } from "@/lib/synthetic-sport-routines";
import { getProgramAssessmentSuggestions } from "@/app/programs/assessment-suggestions";

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
      description: true,
      status: true,
      color: true,
      icon: true,
      pursuitKey: true,
      linkedInjuryId: true,
      objectiveKind: true,
      timelineMode: true,
      startYmd: true,
      endYmd: true,
      reviewYmd: true,
      continuedFromId: true,
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
      assessments: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          metricKind: true,
          metricKey: true,
          unit: true,
          direction: true,
          targetNumberValue: true,
          targetNumerator: true,
          targetDenominator: true,
          targetTextValue: true,
          checkpointIntervalWeeks: true,
          results: {
            orderBy: { measuredAt: "asc" },
            select: { id: true, measuredAt: true, numberValue: true, numerator: true, denominator: true, textValue: true, source: true, sourceRefId: true, isBaseline: true, confirmedAt: true, notes: true },
          },
        },
      },
      plannedSessions: {
        orderBy: [{ currentYmd: "asc" }, { sortOrder: "asc" }],
        select: { id: true, label: true, currentYmd: true, originalYmd: true, status: true, pinned: true, routineId: true, sportSlug: true, activityTypeId: true },
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
      select: { id: true, stageId: true, scopeKind: true, scopeRef: true, label: true, targetText: true, status: true, estDurationDays: true, gateKind: true, gateNote: true },
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
  const completedPlannedIds = new Set(
    program.plannedSessions
      .filter((planned) => planned.routineId && logs.some((log) => log.routineId === planned.routineId && toAppYmd(log.performedAt) === planned.currentYmd))
      .map((planned) => planned.id)
  );

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
    activityLink: programActivityLink(pursuitSlug, pursuit?.family ?? null, program.objectiveKind),
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
    schedule: {
      next: program.plannedSessions.filter((session) => session.status === "PLANNED" && !completedPlannedIds.has(session.id) && session.currentYmd >= today),
      missed: program.plannedSessions.filter((session) => session.status === "PLANNED" && !completedPlannedIds.has(session.id) && session.currentYmd < today),
    },
  };
}

function programActivityLink(
  pursuitSlug: string | null,
  family: "endurance" | "sports" | "strength" | "body-work" | "mobility" | "lifestyle" | null,
  objectiveKind: string
) {
  if (objectiveKind === "BODY_COMPOSITION") return { href: "/profile/measurements", label: "Measurements" };
  if (objectiveKind === "RECOVERY") return { href: "/profile/health", label: "Health" };
  if (pursuitSlug === "strength" || objectiveKind === "STRENGTH") return { href: "/activities/strength", label: "Strength" };
  if (family === "endurance" || pursuitSlug === "endurance") return { href: pursuitSlug && pursuitSlug !== "endurance" ? `/activities/${pursuitSlug}` : "/activities/endurance", label: pursuitSlug ? pursuitSlug.replaceAll("-", " ") : "Endurance" };
  if (pursuitSlug) return { href: `/activities/${pursuitSlug}`, label: pursuitSlug.replaceAll("-", " ") };
  return { href: "/activities", label: "Activities" };
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

export async function getProgramDefinitionEditorData(programId: string) {
  const session = await getAppSession();
  const [program, milestones, routines, exercises, injuries, stages, metricDefinitions, assessmentSuggestions] = await Promise.all([
    prisma.focus.findFirst({
      where: { id: programId, profileKey: session.profileKey },
      select: {
        id: true, name: true, description: true, icon: true, color: true, status: true,
        targetDate: true, targetKind: true, season: true, phase: true, handoffNote: true,
        pursuitKey: true, linkedInjuryId: true, objectiveKind: true, timelineMode: true,
        startYmd: true, endYmd: true, reviewYmd: true,
      },
    }),
    prisma.progressionMilestone.findMany({
      where: { ownerKind: "FOCUS", ownerId: programId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true, stageId: true, scopeKind: true, scopeRef: true, label: true,
        targetText: true, estDurationDays: true, gateKind: true, gateNote: true,
        gatePainThreshold: true, gatePainDays: true, gateFreqPerWeek: true, gateFreqWeeks: true,
      },
    }),
    prisma.routine.findMany({ where: { isActive: true, isDeleted: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, supportsWeight: true, supportsSports: true },
    }),
    prisma.activeInjury.findMany({ where: { status: { in: ["ACTIVE", "FLARED"] } }, orderBy: { startedAt: "desc" }, select: { id: true, name: true } }),
    prisma.programStage.findMany({ where: { programId }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.sessionMetricDefinition.findMany({
      // Baselines should offer durable progress measures, not every narrow
      // goal bucket (for example V0/V1 per-grade counters).
      where: { showInProgress: true },
      orderBy: [{ template: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      select: {
        id: true,
        label: true,
        unit: true,
        valueType: true,
        template: {
          select: {
            key: true,
            name: true,
            metadataGroups: { select: { group: { select: { slug: true } } } },
          },
        },
      },
    }),
    getProgramAssessmentSuggestions(),
  ]);
  if (!program) return null;
  const pursuitKey = program.pursuitKey?.trim().toLowerCase() ?? "";
  const sessionMetrics = metricDefinitions
    .filter((metric) => {
      if (!pursuitKey) return true;
      const slugs = metric.template.metadataGroups.map((assignment) => assignment.group.slug.toLowerCase());
      return slugs.includes(pursuitKey) || metric.template.key.toLowerCase().includes(pursuitKey);
    })
    .map((metric) => ({
      id: metric.id,
      label: metric.label,
      unit: metric.unit,
      valueType: metric.valueType,
      templateName: metric.template.name,
    }));
  return {
    initial: {
      id: program.id,
      name: program.name,
      description: program.description ?? "",
      icon: program.icon ?? "",
      color: program.color ?? "#84cc78",
      status: program.status,
      targetDate: program.targetDate ? program.targetDate.toISOString().slice(0, 10) : "",
      targetKind: program.targetKind,
      season: program.season ?? "",
      phase: ((["BUILD", "PEAK", "OFFSEASON", "MAINTAIN"] as const).includes(
        program.phase as "BUILD" | "PEAK" | "OFFSEASON" | "MAINTAIN"
      )
        ? (program.phase as "BUILD" | "PEAK" | "OFFSEASON" | "MAINTAIN")
        : "") as "" | "BUILD" | "PEAK" | "OFFSEASON" | "MAINTAIN",
      handoffNote: program.handoffNote ?? "",
      pursuitKey: program.pursuitKey ?? "",
      linkedInjuryId: program.linkedInjuryId ?? "",
      objectiveKind: program.objectiveKind,
      timelineMode: program.timelineMode,
      startYmd: program.startYmd ?? "",
      endYmd: program.endYmd ?? "",
      reviewYmd: program.reviewYmd ?? "",
      milestones,
    },
    routines,
    exercises,
    injuries,
    stages,
    sessionMetrics,
    assessmentSuggestions,
  };
}
