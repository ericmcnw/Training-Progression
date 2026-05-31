/**
 * One-shot cleanup: merge duplicate ActivitySpot + ClimbLocation rows that
 * were created before the resolvers dedup'd across compatible activity
 * slugs / curly-vs-straight apostrophes.
 *
 * Two passes:
 *   1. ActivitySpot — merge rows that share normalized name + same OSM pin
 *      (or both null) within the same compat closure (e.g. trail-running /
 *      hiking / walking / mountain-biking all share a pool).
 *   2. ClimbLocation — merge rows that share normalized name + type + same
 *      OSM pin. Catches the "Will Warren's Den" curly-apostrophe variants.
 *
 * The oldest row in each group becomes canonical. All RoutineLog references
 * (activitySpotId / climbLocationId) get repointed at the canonical, then
 * the dupes are deleted. Null region/lat/lng on the canonical are
 * backfilled from any dup that has them.
 *
 * Dry run by default:
 *   node scripts/dedup-activity-spots.mjs
 * Apply changes:
 *   node scripts/dedup-activity-spots.mjs --apply
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Mirror of lib/activity-spots.ts COMPATIBLE_ACTIVITY_SPOTS_RAW. If that
// map changes, update here too — this is a one-shot script, not a runtime
// helper, so duplicating is cheaper than wiring TS imports into a node
// .mjs runner.
const COMPATIBLE_RAW = {
  "trail-running":       ["hiking", "climbing", "mountain-biking", "gravel-cycling"],
  "hiking":              ["climbing", "trail-running", "mountain-biking"],
  "running":             ["trail-running", "walking", "road-running"],
  "road-running":        ["running", "walking"],
  "walking":             ["running", "trail-running", "hiking", "road-running"],
  "mountain-biking":     ["trail-running", "hiking", "gravel-cycling"],
  "gravel-cycling":      ["mountain-biking", "trail-running", "biking", "road-cycling"],
  "biking":              ["road-cycling", "gravel-cycling"],
  "road-cycling":        ["biking", "gravel-cycling"],
  "open-water-swimming": ["surfing", "swimming"],
  "swimming":            ["pool-swimming", "open-water-swimming"],
  "pool-swimming":       ["swimming"],
  "climbing":            ["hiking", "trail-running"],
  "snowboarding":        ["skiing"],
  "skiing":              ["snowboarding"],
  "surfing":             ["open-water-swimming"],
  "rowing":              [],
  "skateboarding":       [],
  "basketball":          [],
  "tennis":              [],
  "golf":                [],
};

const compatSets = (() => {
  const sets = new Map();
  const ensure = (slug) => {
    if (!sets.has(slug)) sets.set(slug, new Set([slug]));
    return sets.get(slug);
  };
  for (const [a, others] of Object.entries(COMPATIBLE_RAW)) {
    const aSet = ensure(a);
    for (const b of others) {
      aSet.add(b);
      ensure(b).add(a);
    }
  }
  return sets;
})();

function compatGroupKey(slug) {
  const set = compatSets.get(slug);
  if (!set || set.size === 0) return slug;
  return [...set].sort().join("|");
}

function osmKey(osmType, osmId) {
  return osmType && osmId ? `${osmType}:${osmId}` : "__no_osm__";
}

// Mirror of lib/activity-spots.ts normalizeSpotName. Folds curly quotes
// and collapses whitespace so apostrophe-variant rows merge cleanly.
function normName(name) {
  return name
    .replace(/[‘’ʼʹ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ── Pass 1: ActivitySpot dedup ───────────────────────────────────────

const allSpots = await prisma.activitySpot.findMany({
  orderBy: { createdAt: "asc" },
  select: {
    id: true,
    activitySlug: true,
    name: true,
    region: true,
    latitude: true,
    longitude: true,
    osmType: true,
    osmId: true,
    createdAt: true,
  },
});

const spotGroups = new Map();
for (const spot of allSpots) {
  const key = `${compatGroupKey(spot.activitySlug)}::${osmKey(spot.osmType, spot.osmId)}::${normName(spot.name)}`;
  if (!spotGroups.has(key)) spotGroups.set(key, []);
  spotGroups.get(key).push(spot);
}

const spotDupGroups = [];
for (const [, spots] of spotGroups) {
  if (spots.length > 1) spotDupGroups.push(spots);
}

// ── Pass 2: ClimbLocation dedup ──────────────────────────────────────

const allClimbs = await prisma.climbLocation.findMany({
  orderBy: { createdAt: "asc" },
  select: {
    id: true,
    name: true,
    type: true,
    region: true,
    latitude: true,
    longitude: true,
    osmType: true,
    osmId: true,
    createdAt: true,
  },
});

const climbGroups = new Map();
for (const loc of allClimbs) {
  const key = `${loc.type}::${osmKey(loc.osmType, loc.osmId)}::${normName(loc.name)}`;
  if (!climbGroups.has(key)) climbGroups.set(key, []);
  climbGroups.get(key).push(loc);
}

const climbDupGroups = [];
for (const [, locs] of climbGroups) {
  if (locs.length > 1) climbDupGroups.push(locs);
}

// ── Build plan ───────────────────────────────────────────────────────

console.log(`Inspected ${allSpots.length} ActivitySpot row(s), ${allClimbs.length} ClimbLocation row(s).`);
console.log(`Found ${spotDupGroups.length} ActivitySpot duplicate group(s), ${climbDupGroups.length} ClimbLocation duplicate group(s).`);

if (spotDupGroups.length === 0 && climbDupGroups.length === 0) {
  await prisma.$disconnect();
  process.exit(0);
}

const plan = { spots: [], climbs: [] };

for (const group of spotDupGroups) {
  const [canonical, ...dups] = group;
  const dupIds = dups.map((d) => d.id);
  const logCount = await prisma.routineLog.count({ where: { activitySpotId: { in: dupIds } } });

  const backfill = {};
  if (!canonical.region) {
    const fromDup = dups.find((d) => d.region);
    if (fromDup) backfill.region = fromDup.region;
  }
  if (canonical.latitude == null) {
    const fromDup = dups.find((d) => d.latitude != null);
    if (fromDup) backfill.latitude = fromDup.latitude;
  }
  if (canonical.longitude == null) {
    const fromDup = dups.find((d) => d.longitude != null);
    if (fromDup) backfill.longitude = fromDup.longitude;
  }

  plan.spots.push({ canonical, dups, logCount, backfill });
}

for (const group of climbDupGroups) {
  const [canonical, ...dups] = group;
  const dupIds = dups.map((d) => d.id);
  const logCount = await prisma.routineLog.count({ where: { climbLocationId: { in: dupIds } } });

  const backfill = {};
  if (!canonical.region) {
    const fromDup = dups.find((d) => d.region);
    if (fromDup) backfill.region = fromDup.region;
  }
  if (canonical.latitude == null) {
    const fromDup = dups.find((d) => d.latitude != null);
    if (fromDup) backfill.latitude = fromDup.latitude;
  }
  if (canonical.longitude == null) {
    const fromDup = dups.find((d) => d.longitude != null);
    if (fromDup) backfill.longitude = fromDup.longitude;
  }
  // ClimbLocation also owns ClimbProblem and ClimbMedia. Surface those
  // counts so the operator can sanity-check before applying.
  const problemCount = await prisma.climbProblem.count({ where: { locationId: { in: dupIds } } });
  const mediaCount = await prisma.climbMedia.count({ where: { locationId: { in: dupIds } } });

  plan.climbs.push({ canonical, dups, logCount, problemCount, mediaCount, backfill });
}

const totalSpotDups = plan.spots.reduce((sum, p) => sum + p.dups.length, 0);
const totalSpotLogs = plan.spots.reduce((sum, p) => sum + p.logCount, 0);
const totalClimbDups = plan.climbs.reduce((sum, p) => sum + p.dups.length, 0);
const totalClimbLogs = plan.climbs.reduce((sum, p) => sum + p.logCount, 0);
const totalProblems = plan.climbs.reduce((sum, p) => sum + p.problemCount, 0);
const totalMedia = plan.climbs.reduce((sum, p) => sum + p.mediaCount, 0);

console.log("");
console.log("Plan:");
if (plan.spots.length > 0) {
  console.log(`  ActivitySpot:  merge ${totalSpotDups} dup row(s), repoint ${totalSpotLogs} log(s).`);
}
if (plan.climbs.length > 0) {
  console.log(`  ClimbLocation: merge ${totalClimbDups} dup row(s), repoint ${totalClimbLogs} log(s), ${totalProblems} problem(s), ${totalMedia} media item(s).`);
}
console.log("");

for (const { canonical, dups, logCount, backfill } of plan.spots) {
  console.log(`  [spot] "${canonical.name}" (${canonical.activitySlug}, osm=${osmKey(canonical.osmType, canonical.osmId)})`);
  console.log(`    canonical id=${canonical.id} created=${canonical.createdAt.toISOString()}`);
  for (const d of dups) console.log(`    dup       id=${d.id} slug=${d.activitySlug} name="${d.name}" created=${d.createdAt.toISOString()}`);
  if (logCount > 0) console.log(`    repoint ${logCount} log(s)`);
  if (Object.keys(backfill).length > 0) console.log(`    backfill: ${Object.entries(backfill).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log("");
}

for (const { canonical, dups, logCount, problemCount, mediaCount, backfill } of plan.climbs) {
  console.log(`  [climb] "${canonical.name}" (${canonical.type}, osm=${osmKey(canonical.osmType, canonical.osmId)})`);
  console.log(`    canonical id=${canonical.id} created=${canonical.createdAt.toISOString()}`);
  for (const d of dups) console.log(`    dup       id=${d.id} name="${d.name}" created=${d.createdAt.toISOString()}`);
  if (logCount > 0) console.log(`    repoint ${logCount} log(s)`);
  if (problemCount > 0) console.log(`    repoint ${problemCount} problem(s)`);
  if (mediaCount > 0) console.log(`    repoint ${mediaCount} media item(s)`);
  if (Object.keys(backfill).length > 0) console.log(`    backfill: ${Object.entries(backfill).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log("");
}

if (!APPLY) {
  console.log("Dry run only. Re-run with --apply to commit these changes.");
  await prisma.$disconnect();
  process.exit(0);
}

console.log("Applying changes...");
let appliedSpotLogs = 0, appliedSpotDeletes = 0;
let appliedClimbLogs = 0, appliedClimbProblems = 0, appliedClimbMedia = 0, appliedClimbDeletes = 0;

for (const { canonical, dups, backfill } of plan.spots) {
  await prisma.$transaction(async (tx) => {
    const dupIds = dups.map((d) => d.id);
    const repoint = await tx.routineLog.updateMany({
      where: { activitySpotId: { in: dupIds } },
      data: { activitySpotId: canonical.id },
    });
    appliedSpotLogs += repoint.count;
    if (Object.keys(backfill).length > 0) {
      await tx.activitySpot.update({ where: { id: canonical.id }, data: backfill });
    }
    const del = await tx.activitySpot.deleteMany({ where: { id: { in: dupIds } } });
    appliedSpotDeletes += del.count;
  });
}

for (const { canonical, dups, backfill } of plan.climbs) {
  await prisma.$transaction(async (tx) => {
    const dupIds = dups.map((d) => d.id);
    const logRepoint = await tx.routineLog.updateMany({
      where: { climbLocationId: { in: dupIds } },
      data: { climbLocationId: canonical.id },
    });
    appliedClimbLogs += logRepoint.count;
    const problemRepoint = await tx.climbProblem.updateMany({
      where: { locationId: { in: dupIds } },
      data: { locationId: canonical.id },
    });
    appliedClimbProblems += problemRepoint.count;
    const mediaRepoint = await tx.climbMedia.updateMany({
      where: { locationId: { in: dupIds } },
      data: { locationId: canonical.id },
    });
    appliedClimbMedia += mediaRepoint.count;
    if (Object.keys(backfill).length > 0) {
      await tx.climbLocation.update({ where: { id: canonical.id }, data: backfill });
    }
    const del = await tx.climbLocation.deleteMany({ where: { id: { in: dupIds } } });
    appliedClimbDeletes += del.count;
  });
}

console.log("");
console.log("Applied:");
if (plan.spots.length > 0) {
  console.log(`  ActivitySpot:  repointed ${appliedSpotLogs} log(s), deleted ${appliedSpotDeletes} dup row(s).`);
}
if (plan.climbs.length > 0) {
  console.log(`  ClimbLocation: repointed ${appliedClimbLogs} log(s), ${appliedClimbProblems} problem(s), ${appliedClimbMedia} media item(s); deleted ${appliedClimbDeletes} dup row(s).`);
}

await prisma.$disconnect();
