// Idempotent metadata backfill for the Program foundation migration.
//
// This script never updates or deletes logs. It only creates Program* rows
// from relationships already expressed unambiguously by existing milestones
// and the named climbing targets selected during program planning.

import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const programs = await prisma.focus.findMany({ select: { id: true, name: true } });
const byName = new Map(programs.map((program) => [program.name, program.id]));

const routineMilestones = await prisma.progressionMilestone.findMany({
  where: { ownerKind: "FOCUS", scopeKind: "ROUTINE", scopeRef: { not: null } },
  orderBy: { sortOrder: "asc" },
  select: { ownerId: true, scopeRef: true },
});

const seenRoutine = new Set();
const routineRows = [];
for (const milestone of routineMilestones) {
  const key = `${milestone.ownerId}:${milestone.scopeRef}`;
  if (!milestone.scopeRef || seenRoutine.has(key)) continue;
  seenRoutine.add(key);
  routineRows.push({
    programId: milestone.ownerId,
    routineId: milestone.scopeRef,
    role: "SUPPORTING",
    sortOrder: routineRows.filter((row) => row.programId === milestone.ownerId).length,
  });
}
if (routineRows.length) {
  await prisma.programRoutine.createMany({ data: routineRows, skipDuplicates: true });
}

const goalPlan = {
  "Fall climbing prep": ["Outdoor V5", "Indoor V7", "50 lbs Weighted Pull up"],
  "Hamstring rehab": ["185 RDL"],
  "Aerobic base": ["Run 5 mi/week", "Half Marathon"],
};
const frequencyPlan = {
  "Fall climbing prep": ["Finger Strength", "Pull/Climbing Training", "Skin Conditioning"],
  "Hamstring rehab": ["Hamstring PT"],
  "Aerobic base": ["Cardio"],
};

const goals = await prisma.goal.findMany({ where: { isActive: true }, select: { id: true, name: true } });
const goalByName = new Map(goals.map((goal) => [goal.name, goal.id]));
const frequencyGoals = await prisma.frequencyGoal.findMany({
  where: { isActive: true },
  select: { id: true, name: true },
});
const frequencyByName = new Map(frequencyGoals.map((goal) => [goal.name, goal.id]));

for (const [programName, goalNames] of Object.entries(goalPlan)) {
  const programId = byName.get(programName);
  if (!programId) continue;
  for (const [sortOrder, goalName] of goalNames.entries()) {
    const goalId = goalByName.get(goalName);
    if (!goalId) continue;
    await prisma.programGoal.upsert({
      where: { programId_goalId: { programId, goalId } },
      update: {},
      create: { programId, goalId, role: "PRIMARY", sortOrder },
    });
  }
}

for (const [programName, goalNames] of Object.entries(frequencyPlan)) {
  const programId = byName.get(programName);
  if (!programId) continue;
  for (const [sortOrder, goalName] of goalNames.entries()) {
    const frequencyGoalId = frequencyByName.get(goalName);
    if (!frequencyGoalId) continue;
    await prisma.programFrequencyGoal.upsert({
      where: { programId_frequencyGoalId: { programId, frequencyGoalId } },
      update: {},
      create: { programId, frequencyGoalId, role: "SUPPORTING", sortOrder },
    });
  }
}

const climbingProgramId = byName.get("Fall climbing prep");
if (climbingProgramId) {
  let tickList = await prisma.programTargetList.findFirst({
    where: { programId: climbingProgramId, name: "Fall outdoor tick list" },
    select: { id: true },
  });
  if (!tickList) {
    tickList = await prisma.programTargetList.create({
      data: {
        programId: climbingProgramId,
        name: "Fall outdoor tick list",
        description: "Specific local boulders to revisit. The season is successful through mileage and learning, not only sends.",
        kind: "CHECKLIST",
        sportSlug: "climbing",
      },
      select: { id: true },
    });
  }

  const targetNames = [
    "Next to Sheffield Wednesday",
    "Leeward Side",
    "Claw",
    "Sheffield Wednesday",
    "Move Fast Think Slow",
    "Guaranteed Overnight Delivery",
  ];
  const problems = await prisma.climbProblem.findMany({
    where: { name: { in: targetNames } },
    select: { id: true, name: true },
  });
  const problemByName = new Map(problems.map((problem) => [problem.name, problem]));
  const existing = await prisma.programTargetListItem.findMany({
    where: { listId: tickList.id },
    select: { climbProblemId: true },
  });
  const existingIds = new Set(existing.map((item) => item.climbProblemId).filter(Boolean));
  for (const [sortOrder, name] of targetNames.entries()) {
    const problem = problemByName.get(name);
    if (!problem || existingIds.has(problem.id)) continue;
    await prisma.programTargetListItem.create({
      data: { listId: tickList.id, label: problem.name, climbProblemId: problem.id, sortOrder },
    });
  }
}

const counts = await Promise.all([
  prisma.programRoutine.count(),
  prisma.programGoal.count(),
  prisma.programFrequencyGoal.count(),
  prisma.programTargetList.count(),
  prisma.programTargetListItem.count(),
]);
console.log(JSON.stringify({ routineLinks: counts[0], goalLinks: counts[1], frequencyGoalLinks: counts[2], targetLists: counts[3], targetItems: counts[4] }));

await prisma.$disconnect();
