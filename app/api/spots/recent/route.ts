import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compatibleActivitySlugs } from "@/lib/activity-spots";

// Recent-spots feed for the SpotPicker chip row.
//
// Returns up to `limit` most-recently-used spots (ActivitySpot or
// ClimbLocation) across the activities compatible with `slug`. Each entry
// is a denormalized {ref, name, region} tuple — enough for the picker to
// render a one-tap chip and emit a "saved" selection when clicked.
//
// Climbing is included as a compatible source when the requesting slug
// pairs with climbing (e.g. trail-running), matching the picker's saved
// list. The two sources merge by most-recent performedAt, then the result
// dedups by spot identity so a crag used 3 times in a row only shows once.

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 12;
// Recent chips reflect what the user has been doing lately, not their
// all-time history. 180 days is wide enough to span a full off-season
// but tight enough that an old gym they haven't visited in 2 years
// doesn't show up as a quick-pick.
const RECENT_WINDOW_DAYS = 180;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug")?.trim() || "";
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT));

  if (!slug) {
    return NextResponse.json({ recent: [] });
  }

  const compatible = compatibleActivitySlugs(slug);
  const includesClimbing = compatible.includes("climbing");

  const windowStart = new Date(Date.now() - RECENT_WINDOW_DAYS * 86_400_000);

  // Pull more than `limit` from each source — dedup may collapse rows.
  // 3x is a safe ceiling: even if every spot is unique, we'll only ship
  // back `limit` in the response.
  const sourceLimit = limit * 3;

  const [activitySpotLogs, climbLocationLogs] = await Promise.all([
    prisma.routineLog.findMany({
      where: {
        activitySpotId: { not: null },
        activitySpot: { activitySlug: { in: compatible } },
        performedAt: { gte: windowStart },
      },
      orderBy: { performedAt: "desc" },
      take: sourceLimit,
      select: {
        performedAt: true,
        activitySpot: {
          select: { id: true, name: true, region: true },
        },
      },
    }),
    includesClimbing
      ? prisma.routineLog.findMany({
          where: {
            climbLocationId: { not: null },
            performedAt: { gte: windowStart },
          },
          orderBy: { performedAt: "desc" },
          take: sourceLimit,
          select: {
            performedAt: true,
            climbLocation: {
              select: { id: true, name: true, region: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  type Recent = {
    ref: { kind: "activitySpot" | "climbLocation"; id: string };
    name: string;
    region: string | null;
    at: Date;
  };

  const merged: Recent[] = [];
  for (const log of activitySpotLogs) {
    if (!log.activitySpot) continue;
    merged.push({
      ref: { kind: "activitySpot", id: log.activitySpot.id },
      name: log.activitySpot.name,
      region: log.activitySpot.region,
      at: log.performedAt,
    });
  }
  for (const log of climbLocationLogs) {
    if (!log.climbLocation) continue;
    merged.push({
      ref: { kind: "climbLocation", id: log.climbLocation.id },
      name: log.climbLocation.name,
      region: log.climbLocation.region,
      at: log.performedAt,
    });
  }

  merged.sort((a, b) => b.at.getTime() - a.at.getTime());

  const seen = new Set<string>();
  const deduped: Array<Omit<Recent, "at">> = [];
  for (const entry of merged) {
    const key = `${entry.ref.kind}:${entry.ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ref: entry.ref, name: entry.name, region: entry.region });
    if (deduped.length >= limit) break;
  }

  return NextResponse.json({ recent: deduped });
}
