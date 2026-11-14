// Home route entry point. Server component — fetches a flat data bag and
// hands it to HomeShell. HomeShell is purely presentational so the server
// half stays cacheable and the client half has clear inputs.

import HomeShell from "./_home/HomeShell";
import { getHomeData } from "./_home/data";
import { getHomeInjuries } from "@/lib/home-injuries";
import { getHomeOtherGoals } from "@/lib/home-goals";
import { getHomeRotation } from "@/lib/home-rotation";
import { getFocusBandData } from "@/app/focus/data";
import { getReadyRungs } from "@/app/progressions/data";
import { getHomePlanGroups } from "./_home/plan-data";
import { getHomeClients } from "./_home/clients-data";
import { getAggravatingFactorSuggestions } from "@/app/injuries/actions";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getAppSession();
  const profile = await prisma.appProfile.findUnique({
    where: { key: session.profileKey },
    select: { onboardedAt: true },
  });
  if (profile && !profile.onboardedAt) redirect("/welcome");

  const [data, injuries, factorSuggestions, zones, otherGoals, rotation, focuses, readyRungs, planGroups, clients] = await Promise.all([
    getHomeData(),
    getHomeInjuries(),
    getAggravatingFactorSuggestions(),
    prisma.bodyZone.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { slug: true, label: true } }),
    getHomeOtherGoals(),
    getHomeRotation(),
    getFocusBandData(),
    getReadyRungs(),
    getHomePlanGroups(),
    getHomeClients(),
  ]);
  return (
    <HomeShell
      data={data}
      injuries={injuries}
      factorSuggestions={factorSuggestions}
      zones={zones}
      otherGoals={otherGoals}
      rotation={rotation}
      focuses={focuses}
      readyRungs={readyRungs}
      planGroups={planGroups}
      clients={clients}
    />
  );
}
