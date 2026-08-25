"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { ACTIVITY_TYPE_SLUGS } from "@/lib/activity-types";
import { parsePoolSwimData, type PoolUnit } from "@/lib/pool-swim";

/** Pool geometry from the most recent Pool Swim log, so the form defaults to
 *  whatever pool the user actually swims in instead of always 25 yd. Null
 *  before the first pool swim. */
export async function loadLastPoolGeometry(): Promise<{
  poolLength: number;
  poolUnit: PoolUnit;
} | null> {
  const logs = await prisma.routineLog.findMany({
    where: {
      activityType: { slug: ACTIVITY_TYPE_SLUGS.POOL_SWIM },
      sportData: { not: Prisma.DbNull },
    },
    orderBy: { performedAt: "desc" },
    take: 5,
    select: { sportData: true },
  });

  for (const log of logs) {
    const data = parsePoolSwimData(log.sportData);
    if (data) return { poolLength: data.poolLength, poolUnit: data.poolUnit };
  }
  return null;
}
