import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SENT_OUTCOMES, type ClimbOutcome } from "@/lib/climb-types";

// Classify a problem's standing from its attempt history:
//   flashed → any FLASH/ONSIGHT
//   sent    → clean send but never flashed
//   project → attempted, never cleanly sent
// Returned as the single best outcome so the logger can color-code chips.
function bestOutcomeOf(outcomes: ClimbOutcome[]): ClimbOutcome | null {
  if (outcomes.length === 0) return null;
  if (outcomes.includes("FLASH")) return "FLASH";
  if (outcomes.includes("ONSIGHT")) return "ONSIGHT";
  if (outcomes.includes("SEND")) return "SEND";
  if (outcomes.includes("REDPOINT")) return "REDPOINT";
  return "PROJECT";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");

  const problems = await prisma.climbProblem.findMany({
    where: locationId ? { locationId } : undefined,
    orderBy: [{ grade: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      grade: true,
      gradeSystem: true,
      notes: true,
      // Attempt history feeds three chip affordances in the live logger:
      // the ↻ repeat badge (send count), the outcome color (best outcome),
      // and the area tag (latest attempt's area). Ordered newest-first so
      // the first row with an area is the most recent area.
      attempts: {
        orderBy: { createdAt: "desc" },
        select: {
          outcome: true,
          areaId: true,
          area: true,
          climbArea: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json(
    problems.map(({ attempts, ...rest }) => {
      const outcomes = attempts.map((a) => a.outcome);
      // Most recent attempt that carries area info — structured FK first,
      // legacy free-text fallback for rows that predate the migration.
      const latestWithArea = attempts.find((a) => a.areaId || a.area?.trim());
      return {
        ...rest,
        priorSendCount: outcomes.filter((o) => SENT_OUTCOMES.has(o)).length,
        priorAttemptCount: attempts.length,
        bestOutcome: bestOutcomeOf(outcomes),
        areaId: latestWithArea?.areaId ?? null,
        areaName: latestWithArea?.climbArea?.name ?? latestWithArea?.area?.trim() ?? null,
      };
    })
  );
}
