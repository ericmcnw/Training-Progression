import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const protectedCounts = Object.fromEntries(
  await Promise.all(
    [
      ["routineLogs", prisma.routineLog.count()],
      ["setEntries", prisma.setEntry.count()],
      ["climbAttempts", prisma.climbAttempt.count()],
      ["painLogs", prisma.painLog.count()],
      ["bodyMeasurements", prisma.bodyMeasurement.count()],
    ].map(async ([label, promise]) => [label, await promise])
  )
);

const [programs, milestoneGroups, stageCount, blockCount, checkpointCount, plannedCount] = await Promise.all([
  prisma.focus.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      pursuitKey: true,
      objectiveKind: true,
      timelineMode: true,
      startYmd: true,
      endYmd: true,
      reviewYmd: true,
      _count: {
        select: {
          routineLinks: true,
          goalLinks: true,
          frequencyGoalLinks: true,
          stages: true,
          blocks: true,
          targetLists: true,
          plannedSessions: true,
          continuations: true,
        },
      },
    },
  }),
  prisma.progressionMilestone.groupBy({ by: ["ownerId"], where: { ownerKind: "FOCUS" }, _count: { _all: true } }),
  prisma.programStage.count(),
  prisma.programBlock.count(),
  prisma.goalCheckpoint.count(),
  prisma.plannedSession.count(),
]);

const milestoneCountByProgram = new Map(milestoneGroups.map((row) => [row.ownerId, row._count._all]));
const invalidStageMilestones = await prisma.$queryRaw`
  SELECT count(*)::int AS count
  FROM "ProgressionMilestone" milestone
  JOIN "ProgramStage" stage ON stage.id = milestone."stageId"
  WHERE milestone."stageId" IS NOT NULL
    AND (milestone."ownerKind" <> 'FOCUS' OR milestone."ownerId" <> stage."programId")
`;
const invalidBlockItems = await prisma.$queryRaw`
  SELECT count(*)::int AS count
  FROM "ProgramBlockItem" item
  JOIN "ProgramBlock" block ON block.id = item."blockId"
  WHERE item."routineId" IS NULL AND item."activityTypeId" IS NULL AND item."sportSlug" IS NULL
`;

console.log(JSON.stringify({
  auditedAt: new Date().toISOString(),
  protectedCounts,
  programLayer: {
    programs: programs.length,
    milestones: milestoneGroups.reduce((sum, row) => sum + row._count._all, 0),
    stages: stageCount,
    blocks: blockCount,
    goalCheckpoints: checkpointCount,
    plannedSessions: plannedCount,
  },
  integrity: {
    milestonesAssignedToAnotherProgramsStage: invalidStageMilestones[0]?.count ?? 0,
    blockItemsWithoutAnyTarget: invalidBlockItems[0]?.count ?? 0,
  },
  programs: programs.map((program) => ({
    ...program,
    milestones: milestoneCountByProgram.get(program.id) ?? 0,
  })),
}, null, 2));

await prisma.$disconnect();
