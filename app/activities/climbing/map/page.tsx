// Climbing map page — Phase 1 of the spots-map feature.
//
// Shows every ClimbLocation with coordinates as a pin on a 3D globe (MapLibre +
// raw OSM tiles, no API keys). Locations without coords appear in the sidebar
// with a "place on map" affordance so the user can fill them in over time.
//
// Spot creation has four entry paths (see project_global_map.md): Nominatim
// search, click empty map, drag existing pin, manual lat/lng paste — all
// implemented inside ClimbingMapView (client).

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { gradeSort, SENT_OUTCOMES } from "@/lib/climb-types";
import { sportAccent } from "@/lib/sport-accent";
import ClimbingMapView, { type MapLocation } from "./ClimbingMapView";

export const dynamic = "force-dynamic";

export default async function ClimbingMapPage() {
  // Pull every location with its visit count + the data we need to surface
  // last-visit, hardest-send, and project count in the pin selection footer.
  // Two queries because Prisma's _count doesn't accept where-filtered counts
  // for related models without a raw aggregate — easier to do the rollup
  // in-memory.
  const [rows, recentAttempts] = await Promise.all([
    prisma.climbLocation.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        latitude: true,
        longitude: true,
        _count: { select: { routineLogs: true } },
      },
    }),
    // Last visit, hardest send, sent/project counts per location. Skipping
    // ungrouped attempts (no location) and FELL outcomes (only need sends +
    // projects for the chip). One query, in-memory grouping is fine for
    // single-user scale.
    prisma.climbAttempt.findMany({
      where: { sessionLog: { climbLocationId: { not: null } } },
      select: {
        grade: true,
        gradeSystem: true,
        outcome: true,
        sessionLog: {
          select: { climbLocationId: true, performedAt: true },
        },
      },
    }),
  ]);

  type Rollup = {
    lastVisit: Date | null;
    hardestSendGrade: string | null;
    hardestSendSystem: "BOULDER_V" | "YOSEMITE" | null;
    sentCount: number;
    projectCount: number;
  };
  const rollup = new Map<string, Rollup>();
  for (const a of recentAttempts) {
    const locId = a.sessionLog.climbLocationId;
    if (!locId) continue;
    const cur = rollup.get(locId) ?? {
      lastVisit: null,
      hardestSendGrade: null,
      hardestSendSystem: null,
      sentCount: 0,
      projectCount: 0,
    };
    if (!cur.lastVisit || a.sessionLog.performedAt > cur.lastVisit) cur.lastVisit = a.sessionLog.performedAt;
    if (SENT_OUTCOMES.has(a.outcome)) {
      cur.sentCount += 1;
      // Prefer Yosemite over V when mixed; otherwise compare within system.
      if (cur.hardestSendGrade === null) {
        cur.hardestSendGrade = a.grade;
        cur.hardestSendSystem = a.gradeSystem;
      } else if (cur.hardestSendSystem === a.gradeSystem) {
        if (gradeSort(a.grade, a.gradeSystem) > gradeSort(cur.hardestSendGrade, cur.hardestSendSystem)) {
          cur.hardestSendGrade = a.grade;
        }
      } else if (a.gradeSystem === "YOSEMITE" && cur.hardestSendSystem === "BOULDER_V") {
        cur.hardestSendGrade = a.grade;
        cur.hardestSendSystem = a.gradeSystem;
      }
    } else if (a.outcome === "PROJECT") {
      cur.projectCount += 1;
    }
    rollup.set(locId, cur);
  }

  const locations: MapLocation[] = rows.map((row) => {
    const r = rollup.get(row.id);
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      latitude: row.latitude,
      longitude: row.longitude,
      visitCount: row._count.routineLogs,
      lastVisit: r?.lastVisit ?? null,
      hardestSendGrade: r?.hardestSendGrade ?? null,
      sentCount: r?.sentCount ?? 0,
      projectCount: r?.projectCount ?? 0,
    };
  });

  return (
    <div style={pageStyle}>
      {/* One-line header — every vertical pixel saved here is map. */}
      <div style={headerRowStyle}>
        <Link href="/activities/climbing" style={backLinkStyle}>← Climbing</Link>
        <h1 style={titleStyle}>🗺 Map</h1>
        <Link href="/activities/climbing/climbs" style={siblingPillStyle}>📋 Climbs</Link>
      </div>

      <ClimbingMapView initialLocations={locations} />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: "var(--app-width-wide)",
  margin: "0 auto",
  padding: "10px 14px 12px",
  display: "grid",
  gap: 10,
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 34,
};

const backLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.65,
  textDecoration: "none",
  color: "inherit",
  whiteSpace: "nowrap",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 900,
  letterSpacing: -0.2,
  flex: 1,
  color: sportAccent("climbing"),
};

const siblingPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 11px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  textDecoration: "none",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};
