"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logSession } from "@/app/routines/actions";
import { getSyntheticSportRoutineId, ensureSportSelected } from "@/lib/synthetic-sport-routines";
import type { ClimbingDiscipline, ClimbGradeSystem, ClimbOutcome } from "@/lib/climb-types";

// Surfaces the user's most-recently-used climb locations for the
// quick-pick chips in ClimbLogSheet. Keeps the picker zero-effort
// for the 95% case (same gym, same crag) while still allowing a
// fresh location to be typed inline.
// Loads the saved sub-areas for a climb location so the area picker
// can offer them as quick-pick chips before falling back to a fresh
// name. Lets the user re-attribute a session to "Cave Wall" without
// re-typing it every time.
export async function listAreasForClimbLocation(
  locationId: string | null
): Promise<Array<{ id: string; name: string }>> {
  if (!locationId) return [];
  const rows = await prisma.climbArea.findMany({
    where: { locationId },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }],
  });
  return rows;
}

export async function listRecentClimbLocations(): Promise<
  Array<{ id: string; name: string; type: "GYM" | "CRAG"; region: string | null }>
> {
  const recent = await prisma.routineLog.findMany({
    where: {
      climbLocationId: { not: null },
      performedAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
    },
    select: { climbLocationId: true, performedAt: true },
    orderBy: { performedAt: "desc" },
    take: 100,
  });
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  for (const row of recent) {
    if (!row.climbLocationId || seen.has(row.climbLocationId)) continue;
    seen.add(row.climbLocationId);
    orderedIds.push(row.climbLocationId);
    if (orderedIds.length >= 5) break;
  }
  if (orderedIds.length === 0) return [];

  const locations = await prisma.climbLocation.findMany({
    where: { id: { in: orderedIds } },
    select: { id: true, name: true, type: true, region: true },
  });
  // Preserve the recency-ranked order.
  const byId = new Map(locations.map((l) => [l.id, l]));
  return orderedIds.flatMap((id) => {
    const l = byId.get(id);
    return l ? [l] : [];
  });
}

export type ClimbLogInput = {
  performedAtIso: string;
  durationMinutes?: number;
  notes?: string;
  /** Either pick an existing location… */
  climbLocationId?: string;
  /** …or create a new one inline. Both name and type required for new. */
  newLocationName?: string;
  newLocationType?: "GYM" | "CRAG";
  attempts: Array<{
    discipline: ClimbingDiscipline;
    grade: string;
    gradeSystem: ClimbGradeSystem;
    outcome: ClimbOutcome;
    /** Optional climb/route name. Resolved server-side: if a problem
     *  with this name+grade already exists at this location, link by
     *  id; otherwise create a new ClimbProblem row. */
    name?: string;
    /** Pick from a saved area at the location. */
    areaId?: string;
    /** OR type a fresh area name; server dedupes against ClimbArea
     *  by name within the location and creates as needed. */
    area?: string;
    /** Only meaningful for SEND/REDPOINT — how many tries to send.
     *  Implicitly 1 for FLASH/ONSIGHT, irrelevant for PROJECT. */
    triesCount?: number;
    notes?: string;
  }>;
};

// Routes a climb log through the existing logSession server action so
// the rich per-attempt machinery (problem/area resolution, transaction
// handling, metric synthesis) is unchanged. Auto-creates the synthetic
// climbing routine if the user hasn't added climbing yet — same
// opt-in-on-first-log behavior as logSportAction.
export async function logClimbAction(input: ClimbLogInput): Promise<{ logId: string }> {
  await ensureSportSelected("climbing");
  const routineId = getSyntheticSportRoutineId("climbing");

  const performedAt = new Date(input.performedAtIso);
  if (Number.isNaN(performedAt.getTime())) {
    throw new Error("Invalid performedAt timestamp");
  }
  if (input.attempts.length === 0) {
    throw new Error("Log at least one climb attempt.");
  }

  const logId = await logSession({
    routineId,
    // logSession expects a local-time YYYY-MM-DDTHH:mm string. Hand it
    // the same shape the form uses — no offset math needed.
    performedAtLocal: toLocalDateTimeString(performedAt),
    durationSec: input.durationMinutes ? Math.round(input.durationMinutes * 60) : null,
    notes: input.notes?.trim() || undefined,
    climbLocationId: input.climbLocationId,
    newClimbLocationName: input.newLocationName?.trim() || undefined,
    newClimbLocationType: input.newLocationType,
    climbAttempts: input.attempts.map((a, idx) => ({
      discipline: a.discipline,
      grade: a.grade.trim(),
      gradeSystem: a.gradeSystem,
      outcome: a.outcome,
      newProblemName: a.name?.trim() || undefined,
      // Prefer an existing area pick over a typed name — the picker
      // returns areaId when the user tapped a saved chip.
      areaId: a.areaId || undefined,
      newAreaName: a.areaId ? undefined : a.area?.trim() || undefined,
      triesCount: a.triesCount,
      notes: a.notes?.trim() || undefined,
      attemptOrder: idx,
    })),
  });

  revalidatePath("/log");
  revalidatePath("/activities/sports");
  revalidatePath("/activities/climbing");
  revalidatePath("/activities/climbing/climbs");

  return { logId: logId ?? "" };
}

function toLocalDateTimeString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
