"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureSportSelected, getSyntheticSportRoutineId } from "@/lib/synthetic-sport-routines";

// Server action for golf logging. Persists session-level fields on
// RoutineLog (performedAt, durationSec, notes) + the round detail as
// a discriminated-shape JSON blob on the new RoutineLog.sportData
// column. Two modes today: COURSE (per-hole detail) and RANGE
// (per-club shot detail).

export type GolfCourseHole = {
  number: number;
  par?: number;
  score?: number;
  club?: string;
  notes?: string;
};

export type GolfRangeShot = {
  club: string;
  distanceYards?: number;
  ballCount?: number;
  notes?: string;
};

export type GolfLogInput = {
  performedAtIso: string;
  durationMinutes?: number;
  notes?: string;
} & (
  | {
      mode: "COURSE";
      courseName?: string;
      holes: GolfCourseHole[];
    }
  | {
      mode: "RANGE";
      ballCount?: number;
      shots: GolfRangeShot[];
    }
);

export async function logGolfAction(input: GolfLogInput): Promise<{ logId: string }> {
  await ensureSportSelected("golf");
  const routineId = getSyntheticSportRoutineId("golf");

  const performedAt = new Date(input.performedAtIso);
  if (Number.isNaN(performedAt.getTime())) {
    throw new Error("Invalid performedAt timestamp");
  }
  const durationSec =
    input.durationMinutes && input.durationMinutes > 0
      ? Math.round(input.durationMinutes * 60)
      : null;

  // Build the discriminated sportData JSON payload. Filter out empty
  // detail rows so a saved log doesn't carry meaningless blanks.
  const sportData =
    input.mode === "COURSE"
      ? {
          sport: "golf" as const,
          mode: "COURSE" as const,
          course: {
            location: input.courseName?.trim() || undefined,
            holes: input.holes
              .filter((h) => h.par !== undefined || h.score !== undefined || h.club || h.notes)
              .map((h) => ({
                number: h.number,
                par: h.par,
                score: h.score,
                club: h.club?.trim() || undefined,
                notes: h.notes?.trim() || undefined,
              })),
          },
        }
      : {
          sport: "golf" as const,
          mode: "RANGE" as const,
          range: {
            ballCount: input.ballCount,
            shots: input.shots
              .filter((s) => s.club.trim().length > 0)
              .map((s) => ({
                club: s.club.trim(),
                distanceYards: s.distanceYards,
                ballCount: s.ballCount,
                notes: s.notes?.trim() || undefined,
              })),
          },
        };

  const log = await prisma.routineLog.create({
    data: {
      routineId,
      performedAt,
      durationSec: durationSec ?? undefined,
      notes: input.notes?.trim() || undefined,
      sportData,
    },
    select: { id: true },
  });

  revalidatePath("/log");
  revalidatePath("/activities/sports");
  revalidatePath("/activities/golf");

  return { logId: log.id };
}
