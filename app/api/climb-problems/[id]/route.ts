import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(params);

  const problem = await prisma.climbProblem.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      grade: true,
      gradeSystem: true,
      notes: true,
      attempts: {
        orderBy: { sessionLog: { performedAt: "desc" } },
        take: 20,
        select: {
          id: true,
          outcome: true,
          movesCompleted: true,
          totalMoves: true,
          notes: true,
          sessionLog: {
            select: { performedAt: true },
          },
        },
      },
    },
  });

  if (!problem) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(problem);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await Promise.resolve(params);
  const body = await req.json();
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : undefined;

  if (notes === undefined) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await prisma.climbProblem.update({
    where: { id },
    data: { notes },
    select: { id: true, name: true, grade: true, gradeSystem: true, notes: true },
  });

  return NextResponse.json(updated);
}
