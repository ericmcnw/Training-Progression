/**
 * Backfill routine domains: updates routines where domain is "general"
 * to the derived value from kind + subtype.
 *
 * Run with: node scripts/backfill-routine-domains.mjs
 * Add --dry-run to preview without writing.
 */

import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

// Mirror of deriveRoutineDomain from lib/routines.ts
function normalizeKind(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "CHECK") return "COMPLETION";
  if (raw === "RUN") return "CARDIO";
  if (["WORKOUT", "CARDIO", "GUIDED", "SESSION", "COMPLETION"].includes(raw)) return raw;
  return "COMPLETION";
}

function deriveDomain(kind, subtype) {
  const k = normalizeKind(kind);
  const s = String(subtype ?? "").trim().toUpperCase();

  if (k === "CARDIO") return "cardio";

  if (k === "WORKOUT") {
    if (s === "SKILL") return "skill";
    if (s === "REHAB") return "recovery";
    return "strength";
  }

  if (k === "GUIDED") {
    if (s === "REHAB" || s === "BREATHWORK" || s === "COOLDOWN") return "recovery";
    if (s === "EXERCISE") return "strength";
    return "mobility";
  }

  if (k === "SESSION") {
    if (s === "SKILL_PRACTICE") return "skill";
    return "sport";
  }

  // COMPLETION
  if (s === "RECOVERY") return "recovery";
  return "lifestyle";
}

async function main() {
  const routines = await prisma.routine.findMany({
    where: { OR: [{ domain: "general" }, { domain: null }, { domain: "" }] },
    select: { id: true, name: true, kind: true, subtype: true, domain: true },
  });

  if (routines.length === 0) {
    console.log("No routines need backfilling.");
    return;
  }

  console.log(`Found ${routines.length} routine(s) to backfill${isDryRun ? " (dry run)" : ""}:\n`);

  let updated = 0;
  for (const routine of routines) {
    const derived = deriveDomain(routine.kind, routine.subtype);
    console.log(
      `  ${routine.name.padEnd(40)} ${String(routine.domain ?? "null").padEnd(10)} → ${derived}  (${routine.kind}/${routine.subtype ?? "null"})`
    );
    if (!isDryRun) {
      await prisma.routine.update({
        where: { id: routine.id },
        data: { domain: derived },
      });
      updated++;
    }
  }

  if (!isDryRun) {
    console.log(`\nUpdated ${updated} routine(s).`);
  } else {
    console.log(`\nDry run complete — ${routines.length} routine(s) would be updated.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
