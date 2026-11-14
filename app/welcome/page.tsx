import { prisma } from "@/lib/prisma";
import { activitiesByFamily } from "@/lib/activity-families";
import { getHomeLocation } from "@/lib/home-location";
import { getProfileIdentity } from "@/lib/profile-identity";
import { listSelectedSports } from "@/lib/synthetic-sport-routines";
import { getAggravatingFactorSuggestions } from "@/app/injuries/actions";
import WelcomeWizard from "./WelcomeWizard";

export const dynamic = "force-dynamic";

const ENDURANCE_ICONS: Record<string, string> = {
  running: "🏃",
  walking: "🥾",
  cycling: "🚴",
  swimming: "🏊",
  rowing: "🚣",
};

export default async function WelcomePage() {
  const [identity, homeLocation, selectedSports, families, prefs, zones, factorSuggestions] = await Promise.all([
    getProfileIdentity(),
    getHomeLocation(),
    listSelectedSports(),
    prisma.enduranceFamily.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true, types: { select: { id: true } } },
    }),
    prisma.userActivityTypePreference.findMany({ select: { activityTypeId: true, enabled: true } }),
    prisma.bodyZone.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { slug: true, label: true } }),
    getAggravatingFactorSuggestions(),
  ]);

  // With no saved preferences every type is on by default, which says nothing
  // about what this person actually does — start those tiles unpicked.
  const enabledTypeIds = new Set(prefs.filter((p) => p.enabled).map((p) => p.activityTypeId));
  const pickedEndurance = prefs.length === 0
    ? []
    : families.filter((f) => f.types.some((t) => enabledTypeIds.has(t.id))).map((f) => f.slug);

  return (
    <WelcomeWizard
      identity={identity}
      homeLocation={homeLocation}
      endurance={families.map((f) => ({
        slug: f.slug,
        label: f.slug === "walking" ? "Walking · hiking" : f.name,
        icon: ENDURANCE_ICONS[f.slug] ?? "🏃",
      }))}
      sports={activitiesByFamily("sports").map((s) => ({ slug: s.slug, label: s.label, icon: s.icon }))}
      initialEndurance={pickedEndurance}
      initialSports={selectedSports.map((s) => s.slug)}
      zones={zones}
      factorSuggestions={factorSuggestions}
    />
  );
}
