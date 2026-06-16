import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toAppYmd } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Full-data JSON export. A plain GET so the Profile settings card can link to
// it with `download`. Pulls the user's routines, every log (with exercise
// sets + endurance/sport fields), and the full climbing dataset so the file
// is a real backup, not just a summary.
//
// SECURITY: this is an unauthenticated, unscoped dump of the entire database —
// correct only while the app is single-user. Before multi-user/auth ships,
// gate this behind the session and scope every query by userId, or it becomes
// a full-data leak.
export async function GET() {
  const [routines, logs, goals, climbLocations, climbAreas, climbProblems, climbAttempts, climbMedia] =
    await Promise.all([
      prisma.routine.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          kind: true,
          domain: true,
          subtype: true,
          isActive: true,
          isPlaceholder: true,
          supportsSports: true,
          createdAt: true,
        },
      }),
      prisma.routineLog.findMany({
        orderBy: { performedAt: "desc" },
        select: {
          id: true,
          routineId: true,
          performedAt: true,
          notes: true,
          completionCount: true,
          durationSec: true,
          distanceMi: true,
          elevationGainFt: true,
          location: true,
          activityTypeId: true,
          intervalsConfig: true,
          sportData: true,
          climbLocationId: true,
          exercises: {
            select: {
              exerciseId: true,
              exercise: { select: { name: true } },
              sets: { select: { setNumber: true, reps: true, seconds: true, weightLb: true } },
            },
          },
        },
      }),
      prisma.goal.findMany({
        select: {
          id: true,
          name: true,
          goalType: true,
          targetType: true,
          metricType: true,
          targetValue: true,
          timeframe: true,
          unit: true,
          isActive: true,
        },
      }),
      prisma.climbLocation.findMany({
        select: { id: true, name: true, type: true, region: true, latitude: true, longitude: true },
      }),
      prisma.climbArea.findMany({ select: { id: true, name: true, locationId: true } }),
      prisma.climbProblem.findMany({
        select: { id: true, name: true, grade: true, gradeSystem: true, notes: true, locationId: true },
      }),
      prisma.climbAttempt.findMany({
        select: {
          id: true,
          sessionLogId: true,
          problemId: true,
          areaId: true,
          discipline: true,
          grade: true,
          gradeSystem: true,
          outcome: true,
          movesCompleted: true,
          totalMoves: true,
          triesCount: true,
          notes: true,
        },
      }),
      prisma.climbMedia.findMany({
        select: { id: true, kind: true, url: true, caption: true, locationId: true, areaId: true, problemId: true },
      }),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    counts: {
      routines: routines.length,
      logs: logs.length,
      goals: goals.length,
      climbLocations: climbLocations.length,
      climbAreas: climbAreas.length,
      climbProblems: climbProblems.length,
      climbAttempts: climbAttempts.length,
      climbMedia: climbMedia.length,
    },
    routines,
    logs,
    goals,
    climbing: {
      locations: climbLocations,
      areas: climbAreas,
      problems: climbProblems,
      attempts: climbAttempts,
      media: climbMedia,
    },
  };

  const filename = `progression-tracker-export-${toAppYmd(new Date())}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
