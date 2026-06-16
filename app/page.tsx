// Home route entry point. Server component — fetches a flat data bag and
// hands it to HomeShell. HomeShell is purely presentational so the server
// half stays cacheable and the client half has clear inputs.

import HomeShell from "./_home/HomeShell";
import { getHomeData } from "./_home/data";
import { getHomeInjuries } from "@/lib/home-injuries";
import { getHomeOtherGoals } from "@/lib/home-goals";
import { getAggravatingFactorSuggestions } from "@/app/injuries/actions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [data, injuries, factorSuggestions, zones, otherGoals] = await Promise.all([
    getHomeData(),
    getHomeInjuries(),
    getAggravatingFactorSuggestions(),
    prisma.bodyZone.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { slug: true, label: true } }),
    getHomeOtherGoals(),
  ]);
  return (
    <HomeShell
      data={data}
      injuries={injuries}
      factorSuggestions={factorSuggestions}
      zones={zones}
      otherGoals={otherGoals}
    />
  );
}
