/**
 * One-shot cleanup: delete `fg_*` FrequencyGoal records whose routine is
 * deleted or missing. Going forward, deleteRoutine cascades these.
 *
 * Run: node scripts/cleanup-orphan-frequency-goals.mjs
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const fgRows = await prisma.frequencyGoal.findMany({
  where: { id: { startsWith: "fg_" } },
  include: { routines: { include: { routine: { select: { id: true, isDeleted: true } } } } },
});

const orphans = [];
for (const fg of fgRows) {
  const routineId = fg.id.replace(/^fg_/, "");
  const link = fg.routines.find((r) => r.routineId === routineId);
  const routine = link?.routine ?? null;
  if (!routine || routine.isDeleted) {
    orphans.push({ id: fg.id, name: fg.name, reason: !routine ? "missing routine link" : "routine deleted" });
  }
}

console.log(`Inspected ${fgRows.length} fg_* FrequencyGoal records.`);
console.log(`Found ${orphans.length} orphan(s):`);
for (const o of orphans) console.log(`  - ${o.id} | ${o.name} | ${o.reason}`);

if (orphans.length === 0) {
  await prisma.$disconnect();
  process.exit(0);
}

const ids = orphans.map((o) => o.id);
const result = await prisma.frequencyGoal.deleteMany({ where: { id: { in: ids } } });
console.log(`\nDeleted ${result.count} orphan FrequencyGoal record(s).`);

await prisma.$disconnect();
