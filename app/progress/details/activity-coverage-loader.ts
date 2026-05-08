import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getRoutineIndex, getRoutineLogs, resolveGroupTarget } from "../data";
import type { VirtualSportCategory } from "../sports";
import { buildWeeklyGrid, type HeatmapWeek, type SessionEventInput, type TrainingEventInput } from "./activity-coverage";

/** Slim per-session shape consumable by pulse builders without dragging the
 *  full RoutineLogWithRelations include into the pulse code. */
export type ActivityPulseLog = {
  performedAt: Date;
  durationSec: number | null;
  distanceMi: number | null;
  elevationGainFt: number | null;
  location: string | null;
};

export type ActivityCoverageData = {
  weeks: HeatmapWeek[];
  trainingRoutines: Array<{
    routineId: string;
    name: string;
    sessions: number;
    lastDate: Date;
  }>;
  trainingMax: number;
  recentTrainingLogs: Array<{
    id: string;
    routineId: string;
    routineName: string;
    performedAt: Date;
    exerciseNames: string[];
    totalSets: number;
  }>;
  totalSessions: number;
  totalTrainingLogs: number;
  /** All-time sport sessions in pulse-ready shape, for buildCardioPulse / buildBoardSportPulse. */
  allTimeSportLogs: ActivityPulseLog[];
};

/**
 * Resolves the metadata-group slug a sport's "supporting training" routines
 * are tagged with. Most sports use their own slug; the virtual board sports
 * roll up under board-sports.
 */
export function trainingTagSlugFor(sportSlug: string, virtualSport: VirtualSportCategory | null) {
  if (virtualSport) return "board-sports";
  return sportSlug;
}

/**
 * Loads everything the Activity Coverage section needs for a given sport,
 * all-time:
 *   - the sport's own session logs
 *   - tagged supporting training logs (with exercise names)
 *   - heatmap weeks combining both
 *   - per-routine training breakdown
 *   - recent training session previews
 *
 * Cached per (sportSlug + virtualSport.subtype) for the lifetime of the
 * request, so repeated calls in the same render don't re-query.
 */
export const loadActivityCoverage = cache(async function loadActivityCoverage(
  sportSlug: string,
  virtualSport: VirtualSportCategory | null
): Promise<ActivityCoverageData> {
  const trainingSlug = trainingTagSlugFor(sportSlug, virtualSport);

  // Sport sessions (all-time) — virtual sports filter by subtype, group sports
  // resolve via the metadata-group target.
  const sportLogsPromise = (async () => {
    if (virtualSport) {
      const [routines, allLogs] = await Promise.all([
        getRoutineIndex(),
        getRoutineLogs("all"),
      ]);
      const ids = new Set(
        routines
          .filter((r) => r.isActive && r.kind === "SESSION" && r.subtype === virtualSport.subtype)
          .map((r) => r.id)
      );
      return allLogs.filter((log) => ids.has(log.routineId));
    }
    const target = await resolveGroupTarget(sportSlug, "all");
    return target?.logs ?? [];
  })();

  // Supporting training (all-time) — workouts/guided/completion routines tagged
  // to this activity. Excludes raw sport sessions and pure cardio so we don't
  // double-count.
  const trainingLogsPromise = prisma.routineLog.findMany({
    where: {
      routine: {
        isDeleted: false,
        kind: { notIn: ["SESSION", "CARDIO"] },
        metadataGroups: { some: { group: { slug: trainingSlug } } },
      },
    },
    orderBy: { performedAt: "desc" },
    select: {
      id: true,
      performedAt: true,
      routineId: true,
      routine: { select: { name: true } },
      exercises: {
        select: {
          exercise: { select: { name: true } },
          sets: { select: { id: true } },
        },
      },
    },
  });

  const [sportLogs, trainingLogs] = await Promise.all([sportLogsPromise, trainingLogsPromise]);

  const sessionEvents: SessionEventInput[] = sportLogs.map((log) => ({
    id: log.id,
    routineId: log.routineId,
    performedAt: log.performedAt,
    routineName: log.routine.name,
    venueLabel: log.location?.trim() || null,
  }));

  const trainingEvents: TrainingEventInput[] = trainingLogs.map((log) => ({
    id: log.id,
    routineId: log.routineId,
    performedAt: log.performedAt,
    routineName: log.routine.name,
  }));

  const byRoutine = new Map<string, { routineId: string; name: string; sessions: number; lastDate: Date }>();
  for (const log of trainingLogs) {
    const entry = byRoutine.get(log.routineId) ?? {
      routineId: log.routineId,
      name: log.routine.name,
      sessions: 0,
      lastDate: log.performedAt,
    };
    entry.sessions += 1;
    if (log.performedAt > entry.lastDate) entry.lastDate = log.performedAt;
    byRoutine.set(log.routineId, entry);
  }
  const trainingRoutines = [...byRoutine.values()].sort((a, b) => b.sessions - a.sessions);

  const recentTrainingLogs = trainingLogs.slice(0, 5).map((log) => {
    const exerciseNames = [...new Set(log.exercises.map((e) => e.exercise.name))];
    const totalSets = log.exercises.reduce((sum, e) => sum + e.sets.length, 0);
    return {
      id: log.id,
      routineId: log.routineId,
      routineName: log.routine.name,
      performedAt: log.performedAt,
      exerciseNames,
      totalSets,
    };
  });

  const allTimeSportLogs: ActivityPulseLog[] = sportLogs.map((log) => ({
    performedAt: log.performedAt,
    durationSec: log.durationSec ?? null,
    distanceMi: log.distanceMi ?? null,
    elevationGainFt: log.elevationGainFt ?? null,
    location: log.location?.trim() || null,
  }));

  return {
    weeks: buildWeeklyGrid(sessionEvents, trainingEvents, new Date()),
    trainingRoutines,
    trainingMax: trainingRoutines[0]?.sessions ?? 1,
    recentTrainingLogs,
    totalSessions: sportLogs.length,
    totalTrainingLogs: trainingLogs.length,
    allTimeSportLogs,
  };
});
