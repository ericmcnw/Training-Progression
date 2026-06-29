import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";

// Spans rendered as a bar across the Week-at-a-glance, from two sources:
// backpacking trips (derived from BackpackingTrip — activity that spans days)
// and manual DaySpan annotations (vacation / travel / away — explaining a dip).
// Best-effort: returns [] on any DB hiccup so the dashboard never blocks on it.

export type WagSpan = {
  id: string;
  source: "backpacking" | "dayspan";
  kind: string;
  label: string;
  startYmd: string;
  endYmd: string;
};

export async function getWagSpans(wagStart: string, wagEnd: string): Promise<WagSpan[]> {
  try {
    const session = await getAppSession();
    // Overlap test on YYYY-MM-DD strings (lexicographic === chronological).
    const overlap = { startYmd: { lte: wagEnd }, endYmd: { gte: wagStart } };
    const [trips, spans] = await Promise.all([
      prisma.backpackingTrip.findMany({
        where: { profileKey: session.profileKey, ...overlap },
        select: { id: true, trail: true, location: true, startYmd: true, endYmd: true },
      }),
      prisma.daySpan.findMany({
        where: { profileKey: session.profileKey, ...overlap },
        select: { id: true, kind: true, label: true, startYmd: true, endYmd: true },
      }),
    ]);
    return [
      ...spans.map((s) => ({
        id: s.id,
        source: "dayspan" as const,
        kind: s.kind,
        label: s.label,
        startYmd: s.startYmd,
        endYmd: s.endYmd,
      })),
      // Backpacking last so a trip inside a vacation wins the day's bar.
      ...trips.map((t) => ({
        id: t.id,
        source: "backpacking" as const,
        kind: "backpacking",
        label: t.trail || t.location || "Backpacking trip",
        startYmd: t.startYmd,
        endYmd: t.endYmd,
      })),
    ];
  } catch {
    return [];
  }
}
