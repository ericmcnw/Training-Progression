// Retire the legacy per-type endurance routines and the legacy sport
// routines now that logging goes through the synthetic endurance routine
// (+ activityType) and the per-sport synthetic routines.
//
//   • Endurance (6 legacy CARDIO routines): soft-delete (isDeleted=true).
//     Their logs are already typed (activityTypeId), so the endurance charts
//     keep counting them by type — nothing is lost, the routines just leave
//     /log. Reversible.
//   • Sport (7 legacy SESSION routines): RE-PARENT their logs onto the
//     matching `sports-{slug}-synthetic` routine, then soft-delete the legacy
//     routine. ClimbAttempts reference the log id (not routineId), so they
//     stay attached and the climbing world is untouched.
//
// Writes a reversal backup to scripts/_retire-legacy-backup.json.
//
// Usage:
//   node --env-file=.env scripts/retire-legacy-sport-endurance.mjs            (dry run)
//   node --env-file=.env scripts/retire-legacy-sport-endurance.mjs --apply
//   node --env-file=.env scripts/retire-legacy-sport-endurance.mjs --revert   (undo from backup)

import { PrismaClient } from "../generated/prisma/index.js";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.includes("--revert");
const BACKUP = new URL("./_retire-legacy-backup.json", import.meta.url);

// Legacy sport routine name -> sport slug (target synthetic = sports-<slug>-synthetic).
const SPORT_NAME_TO_SLUG = {
  "Indoor Climb": "climbing",
  "Outdoor Bouldering": "climbing",
  "Shoot around": "basketball",
  "Pickup Basketball": "basketball",
  "Golf": "golf",
  "Snowboarding": "snowboarding",
  "Surfing": "surfing",
};

async function revert() {
  if (!existsSync(BACKUP)) throw new Error("No backup file to revert from.");
  const data = JSON.parse(readFileSync(BACKUP, "utf8"));
  for (const e of data.endurance) {
    await prisma.routine.update({ where: { id: e.id }, data: { isDeleted: false } });
    console.log(`restored endurance routine ${e.name}`);
  }
  for (const s of data.sport) {
    if (s.movedLogIds.length) {
      await prisma.routineLog.updateMany({
        where: { id: { in: s.movedLogIds } },
        data: { routineId: s.legacyId },
      });
    }
    await prisma.routine.update({ where: { id: s.legacyId }, data: { isDeleted: false } });
    console.log(`reverted ${s.movedLogIds.length} logs back to "${s.legacyName}" and restored it`);
  }
  console.log("\nRevert complete.");
}

async function main() {
  if (REVERT) return revert();

  const backup = { generatedAt: new Date().toISOString(), endurance: [], sport: [] };

  // ── Step 1: endurance ────────────────────────────────────────────────────
  const endurance = await prisma.routine.findMany({
    where: { kind: "CARDIO", isPlaceholder: false, isDeleted: false },
    select: { id: true, name: true, _count: { select: { logs: true } } },
  });
  console.log(`\n[Endurance] soft-deleting ${endurance.length} legacy CARDIO routines:`);
  for (const r of endurance) {
    console.log(`  ${r.name} (logs=${r._count.logs})`);
    backup.endurance.push({ id: r.id, name: r.name });
    if (APPLY) await prisma.routine.update({ where: { id: r.id }, data: { isDeleted: true } });
  }

  // ── Step 2: sport re-parent ────────────────────────────────────────────────
  const legacyNames = Object.keys(SPORT_NAME_TO_SLUG);
  const sportRoutines = await prisma.routine.findMany({
    where: { kind: "SESSION", isPlaceholder: false, isDeleted: false, name: { in: legacyNames } },
    select: { id: true, name: true, _count: { select: { logs: true } } },
  });
  console.log(`\n[Sport] re-parenting ${sportRoutines.length} legacy SESSION routines:`);
  for (const r of sportRoutines) {
    const slug = SPORT_NAME_TO_SLUG[r.name];
    const targetId = `sports-${slug}-synthetic`;
    const target = await prisma.routine.findUnique({ where: { id: targetId }, select: { id: true, isActive: true } });
    if (!target) {
      console.log(`  ⚠ SKIP "${r.name}" — target ${targetId} does not exist`);
      continue;
    }
    const logs = await prisma.routineLog.findMany({ where: { routineId: r.id }, select: { id: true } });
    const movedLogIds = logs.map((l) => l.id);
    console.log(`  "${r.name}" → ${targetId}  (move ${movedLogIds.length} logs, then soft-delete)`);
    backup.sport.push({ legacyId: r.id, legacyName: r.name, targetId, movedLogIds });
    if (APPLY) {
      if (movedLogIds.length) {
        await prisma.routineLog.updateMany({ where: { id: { in: movedLogIds } }, data: { routineId: targetId } });
      }
      if (!target.isActive) {
        await prisma.routine.update({ where: { id: targetId }, data: { isActive: true, isDeleted: false } });
      }
      await prisma.routine.update({ where: { id: r.id }, data: { isDeleted: true } });
    }
  }

  if (APPLY) {
    writeFileSync(BACKUP, JSON.stringify(backup, null, 2));
    console.log(`\nAPPLIED. Reversal backup written to ${BACKUP.pathname}`);
    console.log("Undo with: node --env-file=.env scripts/retire-legacy-sport-endurance.mjs --revert");
  } else {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to perform it.");
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
