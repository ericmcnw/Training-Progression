// Climbing map page — Phase 1 of the spots-map feature.
//
// Shows every ClimbLocation with coordinates as a pin on a 3D globe (MapLibre +
// raw OSM tiles, no API keys). Locations without coords appear in the sidebar
// with a "place on map" affordance so the user can fill them in over time.
//
// Spot creation has four entry paths (see project_global_map.md): Nominatim
// search, click empty map, drag existing pin, manual lat/lng paste — all
// implemented inside ClimbingMapView (client).

import { prisma } from "@/lib/prisma";
import { TargetHeader, SectionLinkButton } from "@/app/progress/ui";
import ClimbingMapView, { type MapLocation } from "./ClimbingMapView";

export const dynamic = "force-dynamic";

export default async function ClimbingMapPage() {
  // Pull every location with its visit count so the sidebar can show "12
  // visits" alongside each pin. Unlike the climbs browse page we don't need
  // attempt-level data — name + type + coords + count is enough.
  const rows = await prisma.climbLocation.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      latitude: true,
      longitude: true,
      _count: { select: { routineLogs: true } },
    },
  });

  const locations: MapLocation[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    latitude: row.latitude,
    longitude: row.longitude,
    visitCount: row._count.routineLogs,
  }));

  return (
    <>
      <TargetHeader
        section="sports"
        title="Climbing Map"
        eyebrow="Climbing"
        subtitle="Every gym and crag you've logged. Click the map to add, drag pins to adjust, or search OpenStreetMap."
        basePath="/activities/climbing/map"
        tab="overview"
        range="all"
        hideTabs
        hideRange
        compact
        actions={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <SectionLinkButton href="/activities/climbing/climbs" label="📋 Browse climbs" />
            <SectionLinkButton href="/activities/climbing" label="Back to climbing" />
          </div>
        }
      />

      <ClimbingMapView initialLocations={locations} />
    </>
  );
}
