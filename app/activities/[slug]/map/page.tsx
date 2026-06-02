// Generic per-activity spots map (Phase 2). Mirrors the climbing map but
// works against the activity-agnostic `ActivitySpot` model. Climbing has
// its own /activities/climbing/map route that wins via more-specific
// segment routing — this page covers everything else.
//
// If the slug isn't a known activity, or the activity opts out via
// activity-spots config, this 404s.

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TargetHeader, SectionLinkButton, SectionBackButton } from "@/app/progress/ui";
import { getActivityEntry } from "@/lib/activity-families";
import { getActivitySpotConfig } from "@/lib/activity-spots";
import SpotMapView, { type MapSpot } from "./SpotMapView";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export default async function ActivitySpotsMapPage(props: {
  params: Promise<Params> | Params;
}) {
  const { slug } = await Promise.resolve(props.params);
  const entry = getActivityEntry(slug);
  const config = getActivitySpotConfig(slug);
  if (!entry || !config?.supportsMap) notFound();

  const rows = await prisma.activitySpot.findMany({
    where: { activitySlug: slug },
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

  const spots: MapSpot[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    latitude: row.latitude,
    longitude: row.longitude,
    visitCount: row._count.routineLogs,
  }));

  const subtitleNoun = config.spotNoun;
  return (
    <>
      <TargetHeader
        section="sports"
        title={`${entry.label} Map`}
        eyebrow={entry.eyebrow}
        subtitle={`Every ${subtitleNoun} you've logged for ${entry.label.toLowerCase()}.`}
        basePath={`/activities/${slug}/map`}
        tab="overview"
        range="all"
        hideTabs
        hideRange
        compact
        actions={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <SectionBackButton fallbackHref={`/activities/${slug}`} label="← Back" />
          </div>
        }
      />

      <SpotMapView activitySlug={slug} config={config} initialSpots={spots} />
    </>
  );
}
