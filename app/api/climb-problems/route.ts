import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");

  const problems = await prisma.climbProblem.findMany({
    where: locationId ? { locationId } : undefined,
    orderBy: [{ grade: "asc" }, { name: "asc" }],
    select: { id: true, name: true, grade: true, gradeSystem: true, notes: true },
  });

  return NextResponse.json(problems);
}
