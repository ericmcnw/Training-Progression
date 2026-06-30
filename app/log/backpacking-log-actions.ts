"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { ensureBackpackingRoutine, getSyntheticSportRoutineId } from "@/lib/synthetic-sport-routines";
import { normalizeSpotName } from "@/lib/activity-spots";
import type { SpotPickerValue } from "@/lib/spot-picker-types";
import { clampEffort } from "@/lib/strain";
import { createActivityZoneActivitiesForLog } from "@/lib/zone-activities";
import { stampLogWeather } from "@/lib/weather-stamp";
import { parseAppDateTimeLocal, toAppYmd } from "@/lib/dates";
import { resolveGearPicks } from "@/lib/gear";

// Backpacking trip logging. A trip is a BackpackingTrip parent + one RoutineLog
// per day on the trail, so each day shows natively on the WaG / schedule /
// charts and per-day miles attribute to the right calendar day. Trip-level data
// (trail, gear, pack weight) lives on the parent; per-day miles / elevation /
// campsite live on each day-log.

export type BackpackingDayInput = {
  ymd: string; // YYYY-MM-DD
  miles?: number;
  durationMin?: number; // time hiked that day
  elevGainFt?: number;
  campsite?: string;
  trail?: string; // segment for the day, if different from the overall trail
  notes?: string;
};

export type BackpackingGearInput = {
  gearId?: string | null;
  type?: string;
  name: string;
  weightGrams?: number;
  quantity?: number;
  consumable?: boolean;
};

export type BackpackingLogInput = {
  trail?: string;
  spotValue?: SpotPickerValue;
  days: BackpackingDayInput[];
  gear: BackpackingGearInput[];
  notes?: string;
  effort?: number | null;
};

const SLUG = "backpacking";
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

type CleanDay = Required<Pick<BackpackingDayInput, "ymd">> & {
  miles: number;
  durationSec: number | null;
  elevGainFt: number | null;
  campsite: string | null;
  trail: string | null;
  notes: string | null;
};

type CleanGear = { weightGrams: number | null; quantity: number; consumable: boolean };

function toGearInput(g: BackpackingGearInput) {
  return {
    gearId: g.gearId ?? null,
    type: g.type ?? "",
    name: g.name,
    weightGrams: Number.isFinite(g.weightGrams) ? Number(g.weightGrams) : null,
    quantity: Number.isFinite(g.quantity) ? Number(g.quantity) : 1,
    consumable: Boolean(g.consumable),
  };
}

function cleanDays(days: BackpackingDayInput[]): CleanDay[] {
  return days
    .filter((d) => YMD_RE.test(d.ymd ?? ""))
    .map((d) => ({
      ymd: d.ymd,
      miles: Number.isFinite(d.miles) && (d.miles as number) > 0 ? Number(d.miles) : 0,
      durationSec: Number.isFinite(d.durationMin) && (d.durationMin as number) > 0 ? Math.round(Number(d.durationMin) * 60) : null,
      elevGainFt: Number.isFinite(d.elevGainFt) ? Math.round(Number(d.elevGainFt)) : null,
      campsite: d.campsite?.trim() || null,
      trail: d.trail?.trim() || null,
      notes: d.notes?.trim() || null,
    }))
    // Dedup by ymd (last wins) then sort chronologically.
    .reduce<CleanDay[]>((acc, d) => {
      const existing = acc.findIndex((x) => x.ymd === d.ymd);
      if (existing >= 0) acc[existing] = d;
      else acc.push(d);
      return acc;
    }, [])
    .sort((a, b) => a.ymd.localeCompare(b.ymd));
}

function packWeights(gear: CleanGear[]): { packWeightGrams: number | null; baseWeightGrams: number | null } {
  let total = 0;
  let base = 0;
  let any = false;
  for (const g of gear) {
    if (g.weightGrams == null) continue;
    any = true;
    const w = g.weightGrams * g.quantity;
    total += w;
    if (!g.consumable) base += w;
  }
  return any ? { packWeightGrams: total, baseWeightGrams: base } : { packWeightGrams: null, baseWeightGrams: null };
}

// Build the day-log rows for a trip. Each is a full RoutineLog so it shows on
// every calendar surface. performedAt is noon app-time on the day so it maps
// back to that day's ymd regardless of timezone.
async function createDayLogs(
  tripId: string,
  routineId: string,
  days: CleanDay[],
  ctx: { location: string | null; activitySpotId: string | null; effort: number | null }
): Promise<void> {
  const total = days.length;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const performedAt = parseAppDateTimeLocal(`${d.ymd}T12:00`);
    const log = await prisma.routineLog.create({
      data: {
        routineId,
        backpackingTripId: tripId,
        performedAt,
        distanceMi: d.miles > 0 ? d.miles : undefined,
        durationSec: d.durationSec ?? undefined,
        elevationGainFt: d.elevGainFt ?? undefined,
        notes: d.notes ?? undefined,
        location: ctx.location ?? undefined,
        activitySpotId: ctx.activitySpotId ?? undefined,
        effort: ctx.effort,
        sportData: {
          sport: "backpacking",
          dayIndex: i + 1,
          totalDays: total,
          campsite: d.campsite ?? undefined,
          trail: d.trail ?? undefined,
        },
      },
      select: { id: true },
    });
    await createActivityZoneActivitiesForLog(prisma, log.id);
    await stampLogWeather(log.id);
  }
}

export async function logBackpackingTrip(input: BackpackingLogInput): Promise<{ tripId: string }> {
  await ensureBackpackingRoutine();
  const routineId = getSyntheticSportRoutineId(SLUG);
  const session = await getAppSession();

  const days = cleanDays(input.days);
  if (days.length === 0) throw new Error("A backpacking trip needs at least one day with a date.");

  const gear = await resolveGearPicks(input.gear.map(toGearInput), SLUG);
  const { packWeightGrams, baseWeightGrams } = packWeights(gear);
  const totalMiles = days.reduce((s, d) => s + d.miles, 0);
  const spot = await resolveBackpackingSpot(input.spotValue);
  const effort = input.effort != null ? clampEffort(input.effort) : null;

  const trip = await prisma.backpackingTrip.create({
    data: {
      profileKey: session.profileKey,
      routineId,
      trail: input.trail?.trim() || null,
      location: spot.displayLocation,
      activitySpotId: spot.activitySpotId,
      startYmd: days[0].ymd,
      endYmd: days[days.length - 1].ymd,
      totalMiles: totalMiles > 0 ? totalMiles : null,
      gear: gear.length > 0 ? gear : undefined,
      packWeightGrams,
      baseWeightGrams,
      notes: input.notes?.trim() || null,
      effort,
    },
    select: { id: true },
  });

  await createDayLogs(trip.id, routineId, days, {
    location: spot.displayLocation,
    activitySpotId: spot.activitySpotId,
    effort,
  });

  revalidatePath("/");
  revalidatePath("/log");
  revalidatePath("/activities/sports");
  return { tripId: trip.id };
}

export async function updateBackpackingTrip(input: { tripId: string } & BackpackingLogInput): Promise<void> {
  const routineId = getSyntheticSportRoutineId(SLUG);
  const days = cleanDays(input.days);
  if (days.length === 0) throw new Error("A backpacking trip needs at least one day with a date.");

  const gear = await resolveGearPicks(input.gear.map(toGearInput), SLUG);
  const { packWeightGrams, baseWeightGrams } = packWeights(gear);
  const totalMiles = days.reduce((s, d) => s + d.miles, 0);
  const spot = await resolveBackpackingSpot(input.spotValue);
  const effort = input.effort != null ? clampEffort(input.effort) : null;

  // Day count/dates can change between edits, so regenerate the child logs
  // wholesale rather than diffing. The cascade FK cleans up the old rows.
  await prisma.routineLog.deleteMany({ where: { backpackingTripId: input.tripId } });
  await prisma.backpackingTrip.update({
    where: { id: input.tripId },
    data: {
      trail: input.trail?.trim() || null,
      location: spot.displayLocation,
      activitySpotId: spot.activitySpotId,
      startYmd: days[0].ymd,
      endYmd: days[days.length - 1].ymd,
      totalMiles: totalMiles > 0 ? totalMiles : null,
      gear: gear.length > 0 ? gear : undefined,
      packWeightGrams,
      baseWeightGrams,
      notes: input.notes?.trim() || null,
      effort,
    },
  });

  await createDayLogs(input.tripId, routineId, days, {
    location: spot.displayLocation,
    activitySpotId: spot.activitySpotId,
    effort,
  });

  revalidatePath("/");
  revalidatePath("/log");
  revalidatePath("/activities/sports");
}

export async function deleteBackpackingTrip(tripId: string): Promise<void> {
  // Cascade removes the child day-logs.
  await prisma.backpackingTrip.delete({ where: { id: tripId } }).catch(() => {});
  revalidatePath("/");
  revalidatePath("/log");
}

export type BackpackingEditData = {
  trail: string;
  spotValue: SpotPickerValue | null;
  days: Array<{ ymd: string; miles: number | null; durationMin: number | null; elevGainFt: number | null; campsite: string | null; notes: string | null }>;
  gear: Array<{ gearId: string | null; type: string; name: string; weightGrams: number | null; quantity: number; consumable: boolean }>;
  notes: string;
  effort: number | null;
};

// Load a trip back into the sheet's editable shape. Days come from the child
// logs; the saved trailhead is reconstructed into a SpotPickerValue so editing
// + re-saving preserves the location instead of wiping it.
export async function getBackpackingTripForEdit(tripId: string): Promise<BackpackingEditData | null> {
  const trip = await prisma.backpackingTrip.findUnique({
    where: { id: tripId },
    select: {
      trail: true,
      activitySpotId: true,
      notes: true,
      effort: true,
      gear: true,
      dayLogs: {
        orderBy: { performedAt: "asc" },
        select: { performedAt: true, distanceMi: true, durationSec: true, elevationGainFt: true, notes: true, sportData: true },
      },
    },
  });
  if (!trip) return null;

  let spotValue: SpotPickerValue | null = null;
  if (trip.activitySpotId) {
    const spot = await prisma.activitySpot.findUnique({
      where: { id: trip.activitySpotId },
      select: { id: true, name: true, region: true },
    });
    if (spot) {
      spotValue = { kind: "saved", ref: { kind: "activitySpot", id: spot.id }, display: { name: spot.name, region: spot.region } };
    }
  }

  const days = trip.dayLogs.map((d) => {
    const sd = (d.sportData && typeof d.sportData === "object" ? d.sportData : {}) as Record<string, unknown>;
    return {
      ymd: toAppYmd(d.performedAt),
      miles: d.distanceMi ?? null,
      durationMin: d.durationSec != null ? Math.round(d.durationSec / 60) : null,
      elevGainFt: d.elevationGainFt ?? null,
      campsite: typeof sd.campsite === "string" ? sd.campsite : null,
      notes: d.notes ?? null,
    };
  });

  const gearRaw = Array.isArray(trip.gear) ? (trip.gear as Array<Record<string, unknown>>) : [];
  const gear = gearRaw
    .filter((g) => typeof g.name === "string")
    .map((g) => ({
      gearId: typeof g.gearId === "string" ? g.gearId : null,
      type: typeof g.type === "string" ? g.type : "",
      name: g.name as string,
      weightGrams: typeof g.weightGrams === "number" ? g.weightGrams : null,
      quantity: typeof g.quantity === "number" && g.quantity > 0 ? g.quantity : 1,
      consumable: Boolean(g.consumable),
    }));

  return { trail: trip.trail ?? "", spotValue, days, gear, notes: trip.notes ?? "", effort: trip.effort ?? null };
}

// Resolve a SpotPicker value into an ActivitySpot FK + display string, scoped
// to backpacking spots. Mirrors resolveGolfSpot.
async function resolveBackpackingSpot(
  value: SpotPickerValue | undefined
): Promise<{ activitySpotId: string | null; displayLocation: string | null }> {
  if (!value) return { activitySpotId: null, displayLocation: null };

  if (value.kind === "saved") {
    if (value.ref.kind !== "activitySpot") {
      return { activitySpotId: null, displayLocation: value.display.name ?? null };
    }
    const spot = await prisma.activitySpot.findFirst({
      where: { id: value.ref.id, activitySlug: SLUG },
      select: { id: true, name: true },
    });
    return { activitySpotId: spot?.id ?? null, displayLocation: spot?.name ?? value.display.name ?? null };
  }

  const draft = value.draft;
  const cleanName = draft.name.trim();
  if (!cleanName) return { activitySpotId: null, displayLocation: null };

  if (draft.osmType && draft.osmId) {
    const existing = await prisma.activitySpot.findFirst({
      where: { osmType: draft.osmType, osmId: draft.osmId },
      select: { id: true, name: true },
    });
    if (existing) return { activitySpotId: existing.id, displayLocation: existing.name };
  }

  const normalized = normalizeSpotName(cleanName);
  const candidates = await prisma.activitySpot.findMany({
    where: { activitySlug: SLUG },
    select: { id: true, name: true },
  });
  const sameName = candidates.find((c) => normalizeSpotName(c.name) === normalized);
  if (sameName) return { activitySpotId: sameName.id, displayLocation: sameName.name };

  const created = await prisma.activitySpot.create({
    data: {
      activitySlug: SLUG,
      name: cleanName,
      type: draft.type,
      region: draft.region,
      latitude: draft.latitude,
      longitude: draft.longitude,
      osmType: draft.osmType,
      osmId: draft.osmId,
    },
    select: { id: true, name: true },
  });
  return { activitySpotId: created.id, displayLocation: created.name };
}
