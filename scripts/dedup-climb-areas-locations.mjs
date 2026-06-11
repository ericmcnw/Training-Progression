/**
 * One-shot cleanup: find + merge duplicate ClimbLocation and ClimbArea rows.
 *
 * Detection:
 *   - Locations: fuzzy key = lowercase, strip punctuation/whitespace,
 *     drop trailing "s" (mirrors lib/activity-spots.ts fuzzyDuplicateKey).
 *     Rows sharing a fuzzy key are a duplicate group regardless of type
 *     (GYM/CRAG mismatch is reported but still grouped — user confirms).
 *   - Areas: same fuzzy key scoped per locationId. Runs AFTER location
 *     merge so areas from merged locations dedup into one pool.
 *
 * Merge (oldest row in each group is canonical):
 *   - Locations: repoint RoutineLog.climbLocationId, ClimbProblem.locationId,
 *     ClimbArea.locationId, ClimbMedia.locationId → canonical; backfill
 *     null region/lat/lng/osm from dups; delete dups.
 *   - Areas: repoint ClimbAttempt.areaId → canonical; delete dups. If the
 *     repoint would violate @@unique([locationId,name]) (same-named area
 *     already at canonical location after location merge), reuse existing.
 *
 * Dry run by default:
 *   node scripts/dedup-climb-areas-locations.mjs
 * Apply:
 *   node scripts/dedup-climb-areas-locations.mjs --apply
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function fuzzyKey(name) {
  return name
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/s$/, "");
}

async function dedupLocations() {
  const locations = await prisma.climbLocation.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, type: true, region: true,
      latitude: true, longitude: true, osmType: true, osmId: true,
      createdAt: true,
      _count: { select: { routineLogs: true, problems: true, areas: true, media: true } },
    },
  });

  const groups = new Map();
  for (const loc of locations) {
    const key = fuzzyKey(loc.name);
    const list = groups.get(key) ?? [];
    list.push(loc);
    groups.set(key, list);
  }

  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  if (dupGroups.length === 0) {
    console.log("LOCATIONS: no duplicates found.");
    return;
  }

  for (const group of dupGroups) {
    const [canonical, ...dups] = group; // oldest first
    console.log(`\nLOCATION GROUP — canonical: "${canonical.name}" (${canonical.type}, id ${canonical.id}, ${canonical._count.routineLogs} logs)`);
    for (const d of dups) {
      const typeWarn = d.type !== canonical.type ? `  ⚠ TYPE MISMATCH (${d.type} vs ${canonical.type})` : "";
      console.log(`  dup: "${d.name}" (${d.type}, id ${d.id}, ${d._count.routineLogs} logs, ${d._count.problems} problems, ${d._count.areas} areas, ${d._count.media} media)${typeWarn}`);
    }
    if (!APPLY) continue;

    for (const d of dups) {
      await prisma.$transaction(async (tx) => {
        await tx.routineLog.updateMany({ where: { climbLocationId: d.id }, data: { climbLocationId: canonical.id } });
        await tx.climbProblem.updateMany({ where: { locationId: d.id }, data: { locationId: canonical.id } });
        await tx.climbMedia.updateMany({ where: { locationId: d.id }, data: { locationId: canonical.id } });
        // Areas: move unless a same-named area already exists at canonical —
        // then repoint that area's attempts and drop the dup area instead.
        const dupAreas = await tx.climbArea.findMany({ where: { locationId: d.id } });
        for (const area of dupAreas) {
          const clash = await tx.climbArea.findFirst({
            where: { locationId: canonical.id, name: { equals: area.name, mode: "insensitive" } },
            select: { id: true },
          });
          if (clash) {
            await tx.climbAttempt.updateMany({ where: { areaId: area.id }, data: { areaId: clash.id } });
            await tx.climbArea.delete({ where: { id: area.id } });
          } else {
            await tx.climbArea.update({ where: { id: area.id }, data: { locationId: canonical.id } });
          }
        }
        // Backfill canonical nulls from the dup before deleting it.
        const fill = {};
        if (!canonical.region && d.region) fill.region = d.region;
        if (canonical.latitude == null && d.latitude != null) fill.latitude = d.latitude;
        if (canonical.longitude == null && d.longitude != null) fill.longitude = d.longitude;
        if (!canonical.osmId && d.osmId) { fill.osmType = d.osmType; fill.osmId = d.osmId; }
        if (Object.keys(fill).length > 0) {
          await tx.climbLocation.update({ where: { id: canonical.id }, data: fill });
        }
        await tx.climbLocation.delete({ where: { id: d.id } });
      });
      console.log(`  ✓ merged "${d.name}" into "${canonical.name}"`);
    }
  }
}

async function dedupAreas() {
  const areas = await prisma.climbArea.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, locationId: true, createdAt: true,
      location: { select: { name: true } },
      _count: { select: { attempts: true } },
    },
  });

  const groups = new Map();
  for (const area of areas) {
    const key = `${area.locationId}::${fuzzyKey(area.name)}`;
    const list = groups.get(key) ?? [];
    list.push(area);
    groups.set(key, list);
  }

  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  if (dupGroups.length === 0) {
    console.log("AREAS: no duplicates found.");
    return;
  }

  for (const group of dupGroups) {
    const [canonical, ...dups] = group;
    console.log(`\nAREA GROUP at "${canonical.location.name}" — canonical: "${canonical.name}" (id ${canonical.id}, ${canonical._count.attempts} attempts)`);
    for (const d of dups) {
      console.log(`  dup: "${d.name}" (id ${d.id}, ${d._count.attempts} attempts)`);
    }
    if (!APPLY) continue;

    for (const d of dups) {
      await prisma.$transaction(async (tx) => {
        await tx.climbAttempt.updateMany({ where: { areaId: d.id }, data: { areaId: canonical.id } });
        await tx.climbArea.delete({ where: { id: d.id } });
      });
      console.log(`  ✓ merged "${d.name}" into "${canonical.name}"`);
    }
  }
}

console.log(APPLY ? "=== APPLY MODE ===" : "=== DRY RUN (pass --apply to merge) ===");
await dedupLocations();
await dedupAreas();
await prisma.$disconnect();
