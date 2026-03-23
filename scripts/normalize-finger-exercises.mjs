import "dotenv/config";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const pullCatalog = [
  "Crimp",
  "Half Crimp",
  "Open Hand",
  "3 Finger Drag",
  "2 Finger Drag (Front Two)",
  "2 Finger Drag (Middle Two)",
  "1 Finger Drag",
  "3 Finger Crimp",
  "2 Finger Crimp",
  "1 Finger Crimp",
].map((label) => ({
  name: `${label} Pull`,
  unit: "REPS",
  supportsWeight: true,
  metadata: ["fingers", "forearms", "pull", "strength"],
}));

const timedPullCatalog = [
  "Crimp",
  "Half Crimp",
  "Open Hand",
  "3 Finger Drag",
  "2 Finger Drag (Front Two)",
  "2 Finger Drag (Middle Two)",
  "1 Finger Drag",
  "3 Finger Crimp",
  "2 Finger Crimp",
  "1 Finger Crimp",
].map((label) => ({
  name: `${label} Pull (Time)`,
  unit: "TIME",
  supportsWeight: true,
  metadata: ["fingers", "forearms", "pull", "strength"],
}));

const hangCatalog = [
  "Crimp",
  "Half Crimp",
  "Open Hand",
  "3 Finger Drag",
  "2 Finger Drag (Front Two)",
  "2 Finger Drag (Middle Two)",
  "1 Finger Drag",
  "3 Finger Crimp",
  "2 Finger Crimp",
  "1 Finger Crimp",
].map((label) => ({
  name: `${label} Hang`,
  unit: "TIME",
  supportsWeight: true,
  metadata: ["fingers", "forearms", "pull", "strength", "isometric"],
}));

const legacyPullAliases = new Map([
  ["Half-Crimp 7on3off (Reps)", "Half Crimp Pull"],
  ["Half-Crimp 7on3off (Time)", "Half Crimp Pull (Time)"],
  ["2 Finger Drag (Middle) 7on3off (Reps)", "2 Finger Drag (Middle Two) Pull"],
  ["2 Finger Drag (Middle) 7on3off (Time)", "2 Finger Drag (Middle Two) Pull (Time)"],
]);

const legacyHangAliases = new Map([
  ["7/7 Half Crimp Hangs", "Half Crimp Hang"],
  ["7/7 Open Hand Hangs", "Open Hand Hang"],
  ["7/7 Three Finger Drag Hangs", "3 Finger Drag Hang"],
]);

const legacyDeleteNames = [
  "7/7 Pinch Grip Hangs",
  "7/7 Pocket Hangs",
];

async function getGroupMap(tx) {
  const groups = await tx.metadataGroup.findMany({
    where: {
      slug: {
        in: ["fingers", "forearms", "pull", "strength", "isometric"],
      },
    },
    select: { id: true, slug: true },
  });
  return new Map(groups.map((group) => [group.slug, group.id]));
}

async function syncMetadata(tx, exerciseId, slugs, groupMap) {
  const groupIds = slugs.map((slug) => groupMap.get(slug)).filter(Boolean);
  await tx.exerciseMetadataGroup.deleteMany({ where: { exerciseId } });
  if (groupIds.length === 0) return;
  await tx.exerciseMetadataGroup.createMany({
    data: groupIds.map((groupId) => ({ exerciseId, groupId })),
    skipDuplicates: true,
  });
}

async function ensureExercise(tx, definition, groupMap) {
  const record = await tx.exercise.upsert({
    where: { name: definition.name },
    update: {
      unit: definition.unit,
      supportsWeight: definition.supportsWeight,
    },
    create: {
      name: definition.name,
      unit: definition.unit,
      supportsWeight: definition.supportsWeight,
    },
    select: { id: true, name: true },
  });
  await syncMetadata(tx, record.id, definition.metadata, groupMap);
  return record;
}

async function moveRoutineExercises(tx, fromExerciseId, toExerciseId) {
  const rows = await tx.routineExercise.findMany({
    where: { exerciseId: fromExerciseId },
    select: { id: true, routineId: true, sortOrder: true, defaultSets: true },
  });

  for (const row of rows) {
    const collision = await tx.routineExercise.findUnique({
      where: {
        routineId_exerciseId: {
          routineId: row.routineId,
          exerciseId: toExerciseId,
        },
      },
      select: { id: true, defaultSets: true },
    });

    if (!collision) {
      await tx.routineExercise.update({
        where: { id: row.id },
        data: { exerciseId: toExerciseId },
      });
      continue;
    }

    if (collision.defaultSets !== row.defaultSets) {
      await tx.routineExercise.update({
        where: { id: collision.id },
        data: { defaultSets: Math.max(collision.defaultSets, row.defaultSets) },
      });
    }
    await tx.routineExercise.delete({ where: { id: row.id } });
  }
}

async function moveSessionExercises(tx, fromExerciseId, toExerciseId) {
  const rows = await tx.sessionExercise.findMany({
    where: { exerciseId: fromExerciseId },
    orderBy: [{ createdAt: "asc" }],
    include: {
      sets: {
        orderBy: [{ setNumber: "asc" }],
        select: { id: true, setNumber: true },
      },
    },
  });

  for (const row of rows) {
    const collision = await tx.sessionExercise.findFirst({
      where: {
        routineLogId: row.routineLogId,
        exerciseId: toExerciseId,
      },
      select: {
        id: true,
        sets: {
          orderBy: [{ setNumber: "desc" }],
          take: 1,
          select: { setNumber: true },
        },
      },
    });

    if (!collision) {
      await tx.sessionExercise.update({
        where: { id: row.id },
        data: { exerciseId: toExerciseId },
      });
      continue;
    }

    let nextSetNumber = (collision.sets[0]?.setNumber ?? 0) + 1;
    for (const set of row.sets) {
      await tx.setEntry.update({
        where: { id: set.id },
        data: {
          sessionExerciseId: collision.id,
          setNumber: nextSetNumber,
        },
      });
      nextSetNumber += 1;
    }

    await tx.sessionExercise.delete({ where: { id: row.id } });
  }
}

async function moveGuidedReferences(tx, fromExerciseId, toExerciseId) {
  await tx.guidedStep.updateMany({
    where: { exerciseId: fromExerciseId },
    data: { exerciseId: toExerciseId },
  });

  await tx.guidedStepLog.updateMany({
    where: { exerciseId: fromExerciseId },
    data: { exerciseId: toExerciseId },
  });
}

async function mergeExercise(tx, fromName, toName) {
  const from = await tx.exercise.findUnique({
    where: { name: fromName },
    select: { id: true, name: true },
  });
  const to = await tx.exercise.findUnique({
    where: { name: toName },
    select: { id: true, name: true },
  });

  if (!from || !to || from.id === to.id) return;

  await moveRoutineExercises(tx, from.id, to.id);
  await moveSessionExercises(tx, from.id, to.id);
  await moveGuidedReferences(tx, from.id, to.id);
  await tx.exerciseMetadataGroup.deleteMany({ where: { exerciseId: from.id } });
  await tx.exercise.delete({ where: { id: from.id } });
}

async function deleteExerciseIfUnused(tx, name) {
  const exercise = await tx.exercise.findUnique({
    where: { name },
    include: {
      routines: { select: { id: true } },
      sessionExercises: { select: { id: true } },
      guidedSteps: { select: { id: true } },
      guidedStepLogs: { select: { id: true } },
    },
  });

  if (!exercise) return;
  const isUsed =
    exercise.routines.length > 0 ||
    exercise.sessionExercises.length > 0 ||
    exercise.guidedSteps.length > 0 ||
    exercise.guidedStepLogs.length > 0;

  if (isUsed) {
    console.log(`Skipped deleting in-use exercise: ${name}`);
    return;
  }

  await tx.exerciseMetadataGroup.deleteMany({ where: { exerciseId: exercise.id } });
  await tx.exercise.delete({ where: { id: exercise.id } });
}

const groupMap = await getGroupMap(prisma);

for (const definition of [...pullCatalog, ...timedPullCatalog, ...hangCatalog]) {
  await ensureExercise(prisma, definition, groupMap);
}

for (const [fromName, toName] of legacyPullAliases.entries()) {
  await mergeExercise(prisma, fromName, toName);
}

for (const [fromName, toName] of legacyHangAliases.entries()) {
  await mergeExercise(prisma, fromName, toName);
}

for (const name of legacyDeleteNames) {
  await deleteExerciseIfUnused(prisma, name);
}

console.log("Finger exercise library normalized.");
await prisma.$disconnect();
