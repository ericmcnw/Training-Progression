import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Saved sub-regions (sectors / walls / boulders) for a single climb
// location. Drives the area dropdown in the per-climb logger and the
// area filter pills on the My Climbs page. Sorted by name for stable
// dropdown ordering — the count of attempts isn't included here because
// it changes constantly and the picker doesn't need it.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  if (!locationId) return NextResponse.json([]);

  const areas = await prisma.climbArea.findMany({
    where: { locationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(areas);
}
