// Global activities map (Phase 3 of the spots-map build). Read-only view of
// every coord-bearing spot the user has placed across all activities.
//
// Editing happens on the per-activity maps (/activities/[slug]/map and
// /activities/climbing/map). The world view's job is browse + filter +
// drill-down, so creation requires picking an activity first — which the
// per-activity flow already does naturally.

import { TargetHeader, SectionLinkButton } from "@/app/progress/ui";
import { getAllSpots } from "@/lib/all-spots";
import GlobalMapView from "./GlobalMapView";

export const dynamic = "force-dynamic";

export default async function GlobalSpotsMapPage() {
  const spots = await getAllSpots();

  return (
    <>
      <TargetHeader
        section="sports"
        title="World Map"
        eyebrow="All activities"
        subtitle="Every spot you've placed across all activities."
        basePath="/activities/map"
        tab="overview"
        range="all"
        hideTabs
        hideRange
        compact
        actions={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <SectionLinkButton href="/activities" label="All Activities" />
          </div>
        }
      />

      <GlobalMapView initialSpots={spots} />
    </>
  );
}
