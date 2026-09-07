// Eric logged Romanian Deadlift working sets from plate math that omitted
// the 45lb bar's contribution incorrectly. Confirmed 2026-09-07:
//   empty bar        = 45   (logged correctly)
//   bar + 25/side    = 95   (logged as 90)
//   bar + 35/side    = 115  (logged as 110)
// The 9/5 session was already logged as 115 and is correct, so 9/2 and 9/5
// were the same weight. Warm-up sets at 45 are untouched.
//
// Writes a full backup before changing anything.

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const CORRECTIONS = new Map([[90, 95], [110, 115]]);
const BACKUP = "scripts/_rdl-load-correction-backup.json";

async function main() {
  const sets = await prisma.setEntry.findMany({
    where: {
      sessionExercise: { exercise: { name: "Romanian Deadlift" } },
      weightLb: { in: [...CORRECTIONS.keys()] },
    },
    select: {
      id: true,
      setNumber: true,
      reps: true,
      weightLb: true,
      sessionExercise: { select: { routineLog: { select: { performedAt: true } } } },
    },
  });

  writeFileSync(
    BACKUP,
    JSON.stringify(
      sets.map((s) => ({
        id: s.id,
        weightLb: s.weightLb,
        reps: s.reps,
        performedAt: s.sessionExercise.routineLog.performedAt,
      })),
      null,
      2
    )
  );
  console.log(`backed up ${sets.length} set rows -> ${BACKUP}`);

  // Guard: these loads should exist nowhere else, or the same mistake would
  // need correcting there too.
  const elsewhere = await prisma.setEntry.count({
    where: {
      weightLb: { in: [...CORRECTIONS.keys()] },
      sessionExercise: { exercise: { name: { not: "Romanian Deadlift" } } },
    },
  });
  console.log(`same loads on other exercises (left alone): ${elsewhere}`);

  for (const [from, to] of CORRECTIONS) {
    const { count } = await prisma.setEntry.updateMany({
      where: {
        sessionExercise: { exercise: { name: "Romanian Deadlift" } },
        weightLb: from,
      },
      data: { weightLb: to },
    });
    console.log(`  ${from} -> ${to}:  ${count} sets`);
  }

  console.log("\n=== corrected series ===");
  for (const se of await prisma.sessionExercise.findMany({
    where: { exercise: { name: "Romanian Deadlift" } },
    orderBy: { routineLog: { performedAt: "asc" } },
    select: {
      routineLog: { select: { performedAt: true } },
      sets: { orderBy: { setNumber: "asc" }, select: { reps: true, weightLb: true } },
    },
  })) {
    const d = se.routineLog.performedAt.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
    console.log(`  ${d.padEnd(14)} ${se.sets.map((s) => `${s.reps}@${s.weightLb}`).join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
