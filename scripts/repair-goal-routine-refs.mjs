// Repair FrequencyGoal memberships left dangling by the legacy-routine
// retirement: rows pointing at a now-deleted routine. Each is repointed to
// where that routine's logs moved, so the goal keeps matching:
//   • legacy CARDIO routines  → endurance-synthetic
//   • legacy sport routines   → sports-<slug>-synthetic (by name)
// Duplicates within a goal are merged (PRIMARY wins); a dangling ref with no
// valid target is dropped. Each affected goal's memberships are snapshotted
// for a clean --revert.
//
// Usage:
//   node --env-file=.env scripts/repair-goal-routine-refs.mjs            (dry run)
//   node --env-file=.env scripts/repair-goal-routine-refs.mjs --apply
//   node --env-file=.env scripts/repair-goal-routine-refs.mjs --revert

import { PrismaClient } from "../generated/prisma/index.js";
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.includes("--revert");
const BACKUP = new URL("./_repair-goal-refs-backup.json", import.meta.url);

const ENDURANCE_SYNTHETIC = "endurance-synthetic";
const SPORT_NAME_TO_SLUG = {
  "Indoor Climb": "climbing",
  "Outdoor Bouldering": "climbing",
  "Shoot around": "basketball",
  "Pickup Basketball": "basketball",
  "Golf": "golf",
  "Snowboarding": "snowboarding",
  "Surfing": "surfing",
};

function targetFor(routine) {
  if (!routine) return null;
  if (routine.kind === "CARDIO") return ENDURANCE_SYNTHETIC;
  const slug = SPORT_NAME_TO_SLUG[routine.name];
  return slug ? `sports-${slug}-synthetic` : null;
}

async function revert() {
  if (!existsSync(BACKUP)) throw new Error("No backup to revert from.");
  const snap = JSON.parse(readFileSync(BACKUP, "utf8"));
  for (const goal of snap.goals) {
    await prisma.frequencyGoalRoutine.deleteMany({ where: { goalId: goal.goalId } });
    if (goal.memberships.length) {
      await prisma.frequencyGoalRoutine.createMany({
        data: goal.memberships.map((m) => ({ goalId: goal.goalId, routineId: m.routineId, role: m.role })),
      });
    }
    console.log(`reverted "${goal.name}" → ${goal.memberships.length} memberships`);
  }
  console.log("\nRevert complete.");
}

async function main() {
  if (REVERT) return revert();

  const routines = await prisma.routine.findMany({
    select: { id: true, name: true, kind: true, isDeleted: true },
  });
  const byId = new Map(routines.map((r) => [r.id, r]));
  const isLive = (id) => { const r = byId.get(id); return r && !r.isDeleted; };

  const goals = await prisma.frequencyGoal.findMany({
    select: { id: true, name: true, routines: { select: { routineId: true, role: true } } },
  });

  const snapshot = { generatedAt: new Date().toISOString(), goals: [] };
  let changedGoals = 0;

  for (const goal of goals) {
    const dangling = goal.routines.filter((m) => !isLive(m.routineId));
    if (dangling.length === 0) continue;

    // Build the repaired membership set (routineId → role, PRIMARY wins).
    const result = new Map();
    const setRole = (rid, role) => {
      const prev = result.get(rid);
      result.set(rid, prev === "PRIMARY" || role === "PRIMARY" ? "PRIMARY" : role);
    };
    for (const m of goal.routines) {
      if (isLive(m.routineId)) setRole(m.routineId, m.role);
    }
    const repoints = [];
    const dropped = [];
    for (const m of dangling) {
      const target = targetFor(byId.get(m.routineId));
      if (target && isLive(target)) {
        setRole(target, m.role);
        repoints.push(`${byId.get(m.routineId)?.name ?? m.routineId} → ${target}`);
      } else {
        dropped.push(byId.get(m.routineId)?.name ?? m.routineId);
      }
    }

    snapshot.goals.push({ goalId: goal.id, name: goal.name, memberships: goal.routines });
    changedGoals += 1;

    console.log(`\n"${goal.name}"`);
    repoints.forEach((r) => console.log(`   repoint  ${r}`));
    dropped.forEach((d) => console.log(`   drop     ${d} (no live target)`));
    console.log(`   result: ${Array.from(result.entries()).map(([id, role]) => `${id}[${role}]`).join(", ") || "(none)"}`);

    if (APPLY) {
      await prisma.frequencyGoalRoutine.deleteMany({ where: { goalId: goal.id } });
      if (result.size) {
        await prisma.frequencyGoalRoutine.createMany({
          data: Array.from(result.entries()).map(([routineId, role]) => ({ goalId: goal.id, routineId, role })),
        });
      }
    }
  }

  if (changedGoals === 0) {
    console.log("No goals reference deleted routines. Nothing to do.");
  } else if (APPLY) {
    writeFileSync(BACKUP, JSON.stringify(snapshot, null, 2));
    console.log(`\nAPPLIED to ${changedGoals} goals. Backup: ${BACKUP.pathname}`);
    console.log("Undo: node --env-file=.env scripts/repair-goal-routine-refs.mjs --revert");
  } else {
    console.log(`\nDRY RUN — ${changedGoals} goals would change. Re-run with --apply.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
