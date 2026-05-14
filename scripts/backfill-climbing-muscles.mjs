import "dotenv/config";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

// Muscle groups that climbing trains. Match the seeded climbing template.
const CLIMBING_MUSCLE_SLUGS = ["back", "shoulders", "biceps", "forearms", "fingers", "abs"];
const DAYS_BACK = 30;

async function main() {
  const muscleGroups = await prisma.metadataGroup.findMany({
    where: { slug: { in: CLIMBING_MUSCLE_SLUGS }, kind: "MUSCLE_GROUP" },
    select: { id: true, slug: true },
  });
  if (muscleGroups.length === 0) {
    console.log("No climbing muscle groups found in metadataGroup table. Aborting.");
    return;
  }
  console.log(`Resolved ${muscleGroups.length} muscle groups: ${muscleGroups.map((g) => g.slug).join(", ")}`);

  // ── Step 1: Find climbing routines ────────────────────────────────────────
  const climbingRoutines = await prisma.routine.findMany({
    where: { subtype: "CLIMBING" },
    select: {
      id: true,
      name: true,
      metadataGroups: { select: { groupId: true } },
    },
  });
  if (climbingRoutines.length === 0) {
    console.log("No climbing routines found.");
    return;
  }
  console.log(`Found ${climbingRoutines.length} climbing routine(s).`);

  // ── Step 2: Add missing muscle group metadata to each routine ─────────────
  let routineUpdateCount = 0;
  for (const routine of climbingRoutines) {
    const existing = new Set(routine.metadataGroups.map((entry) => entry.groupId));
    const missing = muscleGroups.filter((g) => !existing.has(g.id));
    if (missing.length === 0) continue;
    await prisma.routineMetadataGroup.createMany({
      data: missing.map((g) => ({ routineId: routine.id, groupId: g.id })),
      skipDuplicates: true,
    });
    console.log(`Tagged "${routine.name}" with: ${missing.map((g) => g.slug).join(", ")}`);
    routineUpdateCount += 1;
  }
  console.log(`Updated metadata on ${routineUpdateCount} routine(s).`);

  // ── Step 3: Backfill zone activity for recent climbing logs ───────────────
  const since = new Date(Date.now() - DAYS_BACK * 86_400_000);
  const climbingRoutineIds = climbingRoutines.map((r) => r.id);
  const logs = await prisma.routineLog.findMany({
    where: {
      routineId: { in: climbingRoutineIds },
      performedAt: { gte: since },
    },
    select: { id: true, performedAt: true, routine: { select: { name: true } } },
  });
  if (logs.length === 0) {
    console.log("No recent climbing logs to backfill.");
    return;
  }
  console.log(`Backfilling zone activity for ${logs.length} climbing log(s)...`);

  const zones = await prisma.bodyZone.findMany({
    where: { metadataGroupSlug: { in: CLIMBING_MUSCLE_SLUGS } },
    select: { id: true, metadataGroupSlug: true },
  });
  if (zones.length === 0) {
    console.log("No body zones for climbing muscle slugs. Done.");
    return;
  }

  let createCount = 0;
  for (const log of logs) {
    const data = zones.map((zone) => ({
      zoneId: zone.id,
      routineLogId: log.id,
      performedAt: log.performedAt,
      source: "EXERCISE",
      label: log.routine.name,
      intensity: null,
    }));
    const result = await prisma.zoneActivity.createMany({ data, skipDuplicates: true });
    createCount += result.count;
  }
  console.log(`Created ${createCount} new zone activity row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
