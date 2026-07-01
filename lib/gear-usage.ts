import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { toAppYmd, addDaysYmd, diffYmdDays } from "@/lib/dates";
import { gearTypeMeta, type GearUnit } from "@/lib/gear-types";

// Per-gear lifetime usage, computed on demand from the two link sources:
// RoutineLogGear (cardio + sport logs) and BackpackingTrip.gear snapshots
// (miles + nights). The `unit`/`value` reflect the gear type's natural metric;
// the sub-metrics are all returned so callers can show more if they want.
// Best-effort — returns an empty map on any failure.

export type GearUsage = {
  unit: GearUnit;
  value: number;
  sessions: number;
  miles: number;
  nights: number;
  days: number;
  firstUsed: string | null;
  lastUsed: string | null;
};

type Acc = { miles: number; nights: number; days: Set<string>; sessions: number; first: string | null; last: string | null };

export async function getGearUsage(gearIds: string[]): Promise<Map<string, GearUsage>> {
  const out = new Map<string, GearUsage>();
  if (gearIds.length === 0) return out;
  try {
    const gears = await prisma.gear.findMany({ where: { id: { in: gearIds } }, select: { id: true, type: true } });
    const typeById = new Map(gears.map((g) => [g.id, g.type]));

    const acc = new Map<string, Acc>();
    for (const id of gearIds) acc.set(id, { miles: 0, nights: 0, days: new Set(), sessions: 0, first: null, last: null });
    const mark = (id: string, ymd: string) => {
      const a = acc.get(id);
      if (!a) return;
      a.days.add(ymd);
      if (!a.first || ymd < a.first) a.first = ymd;
      if (!a.last || ymd > a.last) a.last = ymd;
    };

    // Cardio + sport logs.
    const links = await prisma.routineLogGear.findMany({
      where: { gearId: { in: gearIds } },
      select: { gearId: true, routineLog: { select: { distanceMi: true, performedAt: true } } },
    });
    for (const l of links) {
      const a = acc.get(l.gearId);
      if (!a) continue;
      a.miles += l.routineLog.distanceMi ?? 0;
      a.sessions += 1;
      mark(l.gearId, toAppYmd(l.routineLog.performedAt));
    }

    // Backpacking trips — matched by gearId inside the trip's gear snapshot.
    const session = await getAppSession();
    const trips = await prisma.backpackingTrip.findMany({
      where: { profileKey: session.profileKey },
      select: { gear: true, totalMiles: true, startYmd: true, endYmd: true },
    });
    for (const t of trips) {
      if (!Array.isArray(t.gear)) continue;
      const nights = Math.max(0, diffYmdDays(t.endYmd, t.startYmd));
      const tripIds = new Set(
        (t.gear as Array<Record<string, unknown>>)
          .map((g) => (g && typeof g.gearId === "string" ? g.gearId : null))
          .filter((x): x is string => Boolean(x))
      );
      for (const id of tripIds) {
        const a = acc.get(id);
        if (!a) continue;
        a.miles += t.totalMiles ?? 0;
        a.nights += nights;
        a.sessions += 1;
        for (let d = 0; d <= nights; d++) mark(id, addDaysYmd(t.startYmd, d));
      }
    }

    for (const id of gearIds) {
      const a = acc.get(id)!;
      const unit = gearTypeMeta(typeById.get(id) ?? "other").unit;
      const miles = Math.round(a.miles * 10) / 10;
      const value = unit === "miles" ? miles : unit === "nights" ? a.nights : unit === "days" ? a.days.size : a.sessions;
      out.set(id, {
        unit,
        value,
        sessions: a.sessions,
        miles,
        nights: a.nights,
        days: a.days.size,
        firstUsed: a.first,
        lastUsed: a.last,
      });
    }
  } catch {
    // best-effort
  }
  return out;
}
