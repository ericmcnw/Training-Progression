import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SENT_OUTCOMES } from "@/lib/climb-types";

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
      // Tag each problem with the count of prior clean sends so the live
      // logger can render a ↻ repeat indicator on chips you've already done.
      attempts: { select: { outcome: true } },
    },
  });

  return NextResponse.json(
    problems.map(({ attempts, ...rest }) => ({
      ...rest,
      priorSendCount: attempts.filter((a) => SENT_OUTCOMES.has(a.outcome)).length,
    }))
  );
}
