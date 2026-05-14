import "dotenv/config";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const CURL_PATTERN = /\b(hamstring|leg|nordic|wrist)\s*curl\b/i;
const DAYS_BACK = 30;

async function main() {
  const bicepsGroup = await prisma.metadataGroup.findUnique({
    where: { slug: "biceps" },
    select: { id: true },
  });
  if (!bicepsGroup) {
    console.log("No 'biceps' metadata group found. Nothing to do.");
    return;
  }

  // ── Step 1: Find affected exercises ───────────────────────────────────────
  const allExercises = await prisma.exercise.findMany({
    select: { id: true, name: true },
  });
  const affected = allExercises.filter((e) => CURL_PATTERN.test(e.name));
  if (affected.length === 0) {
    console.log("No hamstring/leg/nordic/wrist curl exercises found. Nothing to do.");
    return;
  }
  console.log(`Found ${affected.length} affected exercise(s):`);
  for (const e of affected) console.log(`  - ${e.name}`);

  // ── Step 2: Strip biceps from those exercises ─────────────────────────────
  const affectedIds = affected.map((e) => e.id);
  const stripResult = await prisma.exerciseMetadataGroup.deleteMany({
    where: { exerciseId: { in: affectedIds }, groupId: bicepsGroup.id },
  });
  console.log(`Removed biceps tag from ${stripResult.count} exercise(s).`);

  // ── Step 3: Strip biceps from routines whose remaining exercises don't tag biceps ──
  const routinesWithAffected = await prisma.routine.findMany({
    where: {
      exercises: { some: { exerciseId: { in: affectedIds } } },
      metadataGroups: { some: { groupId: bicepsGroup.id } },
    },
    select: {
      id: true,
      name: true,
      exercises: {
        select: {
          exercise: {
            select: {
              id: true,
              metadataGroups: {
                where: { groupId: bicepsGroup.id },
                select: { groupId: true },
              },
            },
          },
        },
      },
    },
  });

  const cleanedRoutineIds = [];
  for (const routine of routinesWithAffected) {
    const stillHasBiceps = routine.exercises.some(
      (entry) => entry.exercise.metadataGroups.length > 0
    );
    if (stillHasBiceps) continue;
    await prisma.routineMetadataGroup.deleteMany({
      where: { routineId: routine.id, groupId: bicepsGroup.id },
    });
    console.log(`Removed biceps tag from routine "${routine.name}".`);
    cleanedRoutineIds.push(routine.id);
  }
  console.log(`Cleaned biceps from ${cleanedRoutineIds.length} routine(s).`);

  // ── Step 4: Delete bad biceps zone activity rows ──────────────────────────
  // Two sources of stale rows:
  //   a) exercise-path: logs containing affected curl exercises got biceps rows
  //      written via inference at log time.
  //   b) routine-path: logs of routines we just stripped biceps from had a
  //      routineOnlySlugs write tagging the biceps zone with the routine name.
  // Both bypass the persisted exercise metadata, so we surgically delete the
  // biceps-zone rows for any log that matches either source.
  const bicepsZones = await prisma.bodyZone.findMany({
    where: { metadataGroupSlug: "biceps" },
    select: { id: true },
  });
  const bicepsZoneIds = bicepsZones.map((z) => z.id);
  if (bicepsZoneIds.length === 0) {
    console.log("No biceps body zones found. Done.");
    return;
  }

  const deleted = await prisma.zoneActivity.deleteMany({
    where: {
      zoneId: { in: bicepsZoneIds },
      source: "EXERCISE",
      OR: [
        { routineLog: { exercises: { some: { exerciseId: { in: affectedIds } } } } },
        cleanedRoutineIds.length > 0
          ? { routineLog: { routineId: { in: cleanedRoutineIds } } }
          : null,
      ].filter(Boolean),
    },
  });
  console.log(`Deleted ${deleted.count} bad biceps zone activity row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
