// One-time migration: map legacy endurance routines + logs to activity
// types. Run this AFTER the schema migration in
// 20260601150000_add_endurance_types has applied (which seeds the type
// table) but BEFORE shipping any UI that requires activityTypeId on every
// endurance log.
//
// Heuristic priority (highest first):
//   1. Name keyword match — most specific (catches "Long Run" over plain
//      RUN subtype). Whitelist of substrings; longest matching wins.
//   2. Subtype enum match — falls back to family-generic (RUN→run,
//      WALK→walk, HIKE→hike, BIKE→bike, SWIM→swim, ROW→row).
//   3. Family-generic default by domain — if all else fails and the
//      routine is clearly endurance, default to the RUNNING-family
//      generic with a "review" flag.
//
// Idempotent: only updates routines/logs where activityTypeId is null.
// Safe to re-run after fixing keyword whitelist or adding new types.
//
// Usage:
//   node scripts/migrate_endurance_to_types.mjs [--dry-run]
//   node scripts/migrate_endurance_to_types.mjs --apply
//
// Default: dry run (reports what would change without writing).

import { PrismaClient } from "../generated/prisma/index.js";
import { writeFileSync } from "node:fs";

const DRY_RUN = !process.argv.includes("--apply");

// Name keyword → activity type slug. Longest match wins, so put more
// specific phrases first when they share prefixes.
const NAME_KEYWORDS = [
  // Running (specific phrases first)
  ["trail run", "trail-run"],
  ["long run", "long-run"],
  ["tempo run", "tempo-run"],
  ["easy run", "easy-run"],
  ["interval run", "interval-run"],
  ["intervals", "interval-run"],
  ["fartlek", "interval-run"],
  // Walking
  ["hike", "hike"],
  ["hiking", "hike"],
  // Cycling specific
  ["mountain bike", "mtb"],
  ["road bike", "road-bike"],
  ["gravel", "gravel-bike"],
  ["mtb", "mtb"],
  // Swimming specific
  ["open water", "open-water-swim"],
  // Rowing specific
  ["erg", "erg-row"],
  // Generics (least specific, checked last)
  ["run", "run"],
  ["walk", "walk"],
  ["stroll", "walk"],
  ["bike", "bike"],
  ["cycling", "bike"],
  ["ride", "bike"],
  ["swim", "swim"],
  ["pool", "swim"],
  ["row", "row"],
];

const SUBTYPE_FALLBACKS = {
  RUN: "run",
  WALK: "walk",
  HIKE: "hike",
  BIKE: "bike",
  CYCLING: "bike",
  SWIM: "swim",
  ROW: "row",
  ROWING: "row",
};

function resolveTypeSlug(routine) {
  const name = (routine.name ?? "").toLowerCase();
  // Sort keywords by descending length so "long run" beats "run".
  const sorted = [...NAME_KEYWORDS].sort((a, b) => b[0].length - a[0].length);
  for (const [kw, slug] of sorted) {
    if (name.includes(kw)) return { slug, confidence: "high", reason: `name contains "${kw}"` };
  }
  const sub = routine.subtype ?? "";
  if (sub && SUBTYPE_FALLBACKS[sub]) {
    return { slug: SUBTYPE_FALLBACKS[sub], confidence: "medium", reason: `subtype=${sub}` };
  }
  return { slug: "run", confidence: "low", reason: "no match — defaulted to run (review)" };
}

async function main() {
  const prisma = new PrismaClient();
  console.log(DRY_RUN ? "DRY RUN — no writes\n" : "APPLY MODE — writing changes\n");

  // Load every activity type so we can resolve slug → id.
  const types = await prisma.activityType.findMany({
    select: { id: true, slug: true },
  });
  const typeIdBySlug = new Map(types.map((t) => [t.slug, t.id]));

  // Skip the synthetic routine — it intentionally has no type (every
  // typed log uses its own activityTypeId, the synthetic just hosts the FK).
  const routines = await prisma.routine.findMany({
    where: {
      OR: [{ kind: "CARDIO" }, { domain: "endurance" }],
      isDeleted: false,
      activityTypeId: null,
      NOT: { id: "endurance-synthetic" },
    },
    select: {
      id: true,
      name: true,
      subtype: true,
      domain: true,
      kind: true,
      _count: { select: { logs: true } },
    },
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: DRY_RUN ? "dry-run" : "apply",
    routineCount: routines.length,
    high: 0,
    medium: 0,
    low: 0,
    mappings: [],
  };

  for (const r of routines) {
    const decision = resolveTypeSlug(r);
    const typeId = typeIdBySlug.get(decision.slug);
    if (!typeId) {
      console.error(`  ! ${r.name} — unknown type slug ${decision.slug}`);
      continue;
    }
    report[decision.confidence] += 1;
    report.mappings.push({
      routineId: r.id,
      routineName: r.name,
      subtype: r.subtype,
      domain: r.domain,
      logCount: r._count.logs,
      resolvedSlug: decision.slug,
      confidence: decision.confidence,
      reason: decision.reason,
    });
    const flag = decision.confidence === "low" ? " ⚠ REVIEW" : "";
    console.log(`  ${decision.confidence.padEnd(6)} ${r.name.padEnd(28)} → ${decision.slug.padEnd(16)} (${decision.reason})${flag}`);

    if (!DRY_RUN) {
      // Update the routine itself.
      await prisma.routine.update({
        where: { id: r.id },
        data: { activityTypeId: typeId },
      });
      // Propagate to all logs of this routine that don't already have a type.
      const updated = await prisma.routineLog.updateMany({
        where: { routineId: r.id, activityTypeId: null },
        data: { activityTypeId: typeId },
      });
      console.log(`         → ${updated.count} log${updated.count === 1 ? "" : "s"} updated`);
    }
  }

  console.log(`\nSummary: ${report.high} high · ${report.medium} medium · ${report.low} low confidence`);

  const reportPath = "scripts/_endurance-migration-report.json";
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
