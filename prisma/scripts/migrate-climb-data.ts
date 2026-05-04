/**
 * One-time data migration: converts existing SessionLogMetricValue grade-count
 * rows into individual ClimbAttempt rows, and extracts gym/crag text values
 * into ClimbLocation records linked to RoutineLog.
 *
 * Run once after applying the add_climb_models migration:
 *   npx tsx prisma/scripts/migrate-climb-data.ts
 */

import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

function parseConfig(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

async function main() {
  console.log("Starting climbing data migration...");

  // Load all metric definitions that are climbing grade metrics (have gradeBucket + climbingColumn)
  const allDefs = await prisma.sessionMetricDefinition.findMany({
    select: { id: true, key: true, config: true, templateId: true },
  });

  const gradeDefs = allDefs.filter((def) => {
    const config = parseConfig(def.config);
    return config && typeof config.gradeBucket === "string" && typeof config.climbingColumn === "string";
  });

  const locationDefs = allDefs.filter((def) =>
    def.key === "gym" || def.key === "crag"
  );

  console.log(`Found ${gradeDefs.length} grade metric definitions`);
  console.log(`Found ${locationDefs.length} location metric definitions`);

  // Collect all metric definition IDs we care about
  const gradeDefIds = new Set(gradeDefs.map((d) => d.id));
  const locationDefIds = new Set(locationDefs.map((d) => d.id));
  const allTargetIds = new Set([...gradeDefIds, ...locationDefIds]);

  // Load all relevant metric values with their log IDs
  const metricValues = await prisma.sessionLogMetricValue.findMany({
    where: { metricDefinitionId: { in: Array.from(allTargetIds) } },
    select: {
      routineLogId: true,
      metricDefinitionId: true,
      numberValue: true,
      textValue: true,
    },
  });

  console.log(`Found ${metricValues.length} relevant metric values across logs`);

  // Group by routineLogId
  const byLog = new Map<string, typeof metricValues>();
  for (const mv of metricValues) {
    if (!byLog.has(mv.routineLogId)) byLog.set(mv.routineLogId, []);
    byLog.get(mv.routineLogId)!.push(mv);
  }

  // Check which logs already have attempts (idempotent)
  const logsWithAttempts = new Set(
    (await prisma.climbAttempt.findMany({ select: { sessionLogId: true } })).map(
      (a) => a.sessionLogId
    )
  );

  // Build defId → config lookup
  const defConfigMap = new Map(gradeDefs.map((d) => [d.id, parseConfig(d.config)!]));
  const locationDefKeyMap = new Map(locationDefs.map((d) => [d.id, d.key as "gym" | "crag"]));

  // Location dedup cache: name → id
  const locationCache = new Map<string, string>();

  async function getOrCreateLocation(
    name: string,
    type: "GYM" | "CRAG"
  ): Promise<string> {
    const key = `${type}:${name.toLowerCase().trim()}`;
    if (locationCache.has(key)) return locationCache.get(key)!;
    const existing = await prisma.climbLocation.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" }, type },
      select: { id: true },
    });
    if (existing) {
      locationCache.set(key, existing.id);
      return existing.id;
    }
    const created = await prisma.climbLocation.create({
      data: { name: name.trim(), type },
      select: { id: true },
    });
    locationCache.set(key, created.id);
    return created.id;
  }

  let logsProcessed = 0;
  let attemptsCreated = 0;
  let locationsLinked = 0;

  for (const [logId, values] of byLog) {
    if (logsWithAttempts.has(logId)) {
      console.log(`  Skipping log ${logId} (already has attempts)`);
      continue;
    }

    const attemptRows: Array<{
      sessionLogId: string;
      grade: string;
      gradeSystem: "BOULDER_V" | "YOSEMITE";
      outcome: "FLASH" | "SEND";
      attemptOrder: number;
    }> = [];

    let locationId: string | null = null;

    for (const mv of values) {
      // Handle location
      if (locationDefIds.has(mv.metricDefinitionId) && mv.textValue?.trim()) {
        const locType = locationDefKeyMap.get(mv.metricDefinitionId) === "gym" ? "GYM" : "CRAG";
        locationId = await getOrCreateLocation(mv.textValue.trim(), locType);
        continue;
      }

      // Handle grade counts
      if (!gradeDefIds.has(mv.metricDefinitionId)) continue;
      const count = mv.numberValue ?? 0;
      if (count <= 0) continue;

      const config = defConfigMap.get(mv.metricDefinitionId);
      if (!config) continue;

      const grade = config.gradeBucket as string;
      const column = config.climbingColumn as "DONE" | "FLASHED";
      const gradeSystem =
        config.gradeSystem === "BOULDER_V" ? "BOULDER_V" : "YOSEMITE";
      const outcome: "FLASH" | "SEND" = column === "FLASHED" ? "FLASH" : "SEND";

      for (let i = 0; i < Math.round(count); i++) {
        attemptRows.push({
          sessionLogId: logId,
          grade,
          gradeSystem,
          outcome,
          attemptOrder: attemptRows.length,
        });
      }
    }

    // Write attempts
    if (attemptRows.length > 0) {
      await prisma.climbAttempt.createMany({ data: attemptRows });
      attemptsCreated += attemptRows.length;
    }

    // Link location
    if (locationId) {
      await prisma.routineLog.update({
        where: { id: logId },
        data: { climbLocationId: locationId },
      });
      locationsLinked++;
    }

    logsProcessed++;
    if (logsProcessed % 20 === 0) {
      console.log(`  Processed ${logsProcessed} logs...`);
    }
  }

  console.log(`\nMigration complete:`);
  console.log(`  Logs processed: ${logsProcessed}`);
  console.log(`  Attempts created: ${attemptsCreated}`);
  console.log(`  Locations linked: ${locationsLinked}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
