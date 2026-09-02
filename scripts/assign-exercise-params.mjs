// Sets up the exercise-params layer (see lib/exercise-params.ts):
//   1. Renames the auto-generated finger "X Pull" catalog to "X Lift".
//      Eric confirmed 2026-09-01 that every logged rep-based finger set was
//      an edge lift (weight hung off an edge, lifted), not a board pull-down.
//      Renaming in place keeps the existing series continuous.
//   2. Declares which setup parameters each exercise records.
//   3. Backfills 20mm on the finger sessions logged before the field existed.
//
// Idempotent — safe to re-run.

import "dotenv/config";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const GRIPS = [
  "Crimp",
  "Half Crimp",
  "Open Hand",
  "3 Finger Drag",
  "2 Finger Drag (Front Two)",
  "2 Finger Drag (Middle Two)",
  "1 Finger Drag",
  "3 Finger Crimp",
  "2 Finger Crimp",
  "1 Finger Crimp",
];

const RENAMES = [
  ...GRIPS.flatMap((grip) => [
    [`${grip} Pull`, `${grip} Lift`],
    [`${grip} Pull (Time)`, `${grip} Lift (Time)`],
  ]),
  // Bent knee slackens the gastroc, so this is the soleus raise — named for
  // the muscle Eric asks for it by. The slant-board version is the same
  // exercise at a non-zero angleDeg, not a second row.
  ["Bent-Knee Calf Raise", "Soleus Calf Raise"],
];

const PARAM_ASSIGNMENTS = [
  {
    keys: ["edgeMm"],
    names: [
      ...GRIPS.map((g) => `${g} Lift`),
      ...GRIPS.map((g) => `${g} Lift (Time)`),
      ...GRIPS.map((g) => `${g} Hang`),
      "One-Arm Dead Hang",
    ],
  },
  { keys: ["pinchWidthMm"], names: ["Pinch Hold"] },
  {
    keys: ["angleDeg"],
    names: [
      "Calf Raise",
      "Single-Leg Calf Raise",
      "Seated Calf Raise",
      "Soleus Calf Raise",
      "Goblet Squat",
      "Goblet Squat (Reps)",
      "Goblet Cossack Squat",
    ],
  },
  { keys: ["angleDeg", "boxHeightIn"], names: ["Step-Down"] },
  {
    keys: ["boxHeightIn"],
    names: [
      "Step-Up",
      "Dumbbell Step-Up",
      "Barbell Step-Up",
      "Box Jump",
      "Box Jump Over",
      "Lateral Box Jump",
      "Single-Leg Box Jump",
    ],
  },
];

// Everything logged on a finger exercise so far was on a 20mm edge.
const EDGE_BACKFILL_MM = 20;

async function main() {
  console.log("--- renaming Pull -> Lift ---");
  for (const [from, to] of RENAMES) {
    const existing = await prisma.exercise.findUnique({ where: { name: from }, select: { id: true } });
    if (!existing) continue;
    const collision = await prisma.exercise.findUnique({ where: { name: to }, select: { id: true } });
    if (collision) {
      console.log(`  SKIP  ${from}  (target "${to}" already exists)`);
      continue;
    }
    await prisma.exercise.update({ where: { id: existing.id }, data: { name: to } });
    console.log(`  ok    ${from}  ->  ${to}`);
  }

  console.log("\n--- declaring setup parameters ---");
  for (const { keys, names } of PARAM_ASSIGNMENTS) {
    for (const name of names) {
      const exercise = await prisma.exercise.findUnique({ where: { name }, select: { id: true, paramKeys: true } });
      if (!exercise) {
        console.log(`  MISS  ${name}`);
        continue;
      }
      const merged = [...new Set([...exercise.paramKeys, ...keys])];
      if (merged.length === exercise.paramKeys.length) {
        console.log(`  same  ${name.padEnd(32)} [${merged.join(", ")}]`);
        continue;
      }
      await prisma.exercise.update({ where: { id: exercise.id }, data: { paramKeys: merged } });
      console.log(`  ok    ${name.padEnd(32)} [${merged.join(", ")}]`);
    }
  }

  console.log("\n--- backfilling 20mm on existing finger sessions ---");
  const fingerNames = [...GRIPS.map((g) => `${g} Lift`), ...GRIPS.map((g) => `${g} Lift (Time)`), ...GRIPS.map((g) => `${g} Hang`)];
  const sessions = await prisma.sessionExercise.findMany({
    where: { exercise: { name: { in: fingerNames } } },
    select: {
      id: true,
      params: true,
      exercise: { select: { name: true } },
      routineLog: { select: { performedAt: true } },
    },
    orderBy: { routineLog: { performedAt: "asc" } },
  });
  for (const session of sessions) {
    const day = session.routineLog.performedAt.toISOString().slice(0, 10);
    if (session.params && typeof session.params === "object" && "edgeMm" in session.params) {
      console.log(`  same  ${day}  ${session.exercise.name}`);
      continue;
    }
    await prisma.sessionExercise.update({
      where: { id: session.id },
      data: { params: { ...(session.params ?? {}), edgeMm: EDGE_BACKFILL_MM } },
    });
    console.log(`  ok    ${day}  ${session.exercise.name.padEnd(32)} edgeMm=${EDGE_BACKFILL_MM}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
