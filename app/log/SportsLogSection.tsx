import { listSelectedSports, listUnselectedSports } from "@/lib/synthetic-sport-routines";
import { getActivityEntry } from "@/lib/activity-families";
import SportsLogSectionClient from "./SportsLogSectionClient";

// Server component — loads selection state, hands a flat list to the
// client component that owns the open/close state of the log form
// and the add-sport picker. Keeping data loading on the server side
// lets revalidatePath in the actions refresh the tile grid without
// a manual refetch.

export default async function SportsLogSection() {
  const [selected, available] = await Promise.all([
    listSelectedSports(),
    listUnselectedSports(),
  ]);

  const selectedWithMeta = selected.map((s) => {
    const entry = getActivityEntry(s.slug);
    return {
      slug: s.slug,
      label: s.label,
      eyebrow: entry?.eyebrow ?? "Sport",
      color: SPORT_TILE_COLOR[s.slug] ?? SPORT_TILE_COLOR.default,
    };
  });

  return (
    <SportsLogSectionClient
      selected={selectedWithMeta}
      available={available}
    />
  );
}

// Tile background tint per sport. Kept in sync with the chart palette
// in lib/activities/sports-chart.ts so the visual identity is stable
// across logging and stats views.
const SPORT_TILE_COLOR: Record<string, string> = {
  climbing: "rgba(251,146,60,0.18)",
  surfing: "rgba(56,189,248,0.18)",
  snowboarding: "rgba(168,85,247,0.18)",
  skiing: "rgba(99,102,241,0.18)",
  skateboarding: "rgba(244,114,182,0.18)",
  basketball: "rgba(220,38,38,0.18)",
  tennis: "rgba(132,204,22,0.20)",
  golf: "rgba(40,212,160,0.18)",
  default: "rgba(255,255,255,0.05)",
};
