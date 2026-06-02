import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { effectiveRoutineDomain } from "@/lib/routines";
import { buildWeeklyGrid, type HeatmapWeek } from "./activity-coverage";

// ── Types ────────────────────────────────────────────────────────────────────

export type StrengthSetMetrics = {
  weightLb: number;
  reps: number;
  volume: number; // weight * reps
};

export type StrengthExerciseSession = {
  date: Date;
  topWeightSet: StrengthSetMetrics | null;
  topRepsSet: StrengthSetMetrics | null;
  totalSets: number;
  totalVolume: number;
};

export type StrengthExerciseSummary = {
  exerciseId: string;
  name: string;
  routineLink: string; // /progress/exercises/[id]
  totalSessions: number;
  totalSets: number;
  /** Heaviest single set ever logged. */
  allTimePR: StrengthSetMetrics | null;
  /** Most recent session date. */
  lastDate: Date | null;
  /** True if a new weight PR was hit in the last 30 days. */
  recentPR: boolean;
  /** Per-session top weight, last 8 sessions, oldest-first. */
  recentTopWeights: Array<{ date: Date; weight: number; reps: number }>;
};

export type StrengthRoutineSummary = {
  routineId: string;
  name: string;
  subtype: string | null;
  domain: string;
  totalSessions: number;
  lastDate: Date | null;
  totalSets: number;
  totalVolume: number;
};

export type StrengthRecentSession = {
  id: string;
  routineId: string;
  routineName: string;
  date: Date;
  totalSets: number;
  totalVolume: number;
  topSet: { exerciseName: string; weight: number; reps: number } | null;
};

export type StrengthSessionStat = {
  date: Date;
  sets: number;
  /** Total lb lifted in the session (sum of weight × reps over every set). */
  volume: number;
};

export type StrengthWorldData = {
  totalSessions: number;
  totalSets: number;
  totalVolume: number;
  /** Per-week session counts, all-time, for pulse + heatmap. */
  sessionDates: Date[];
  heatmapWeeks: HeatmapWeek[];
  topExercises: StrengthExerciseSummary[];
  routines: StrengthRoutineSummary[];
  recentSessions: StrengthRecentSession[];
  /** All exercise summaries, used to compute "Recent PR" and other aggregates. */
  allExercises: StrengthExerciseSummary[];
  /** Per-session set totals across the entire history — for accurate
   *  week-over-week aggregates without a slice cap. */
  sessionStats: StrengthSessionStat[];
};

// ── Loader ──────────────────────────────────────────────────────────────────

/**
 * All-time strength data for the strength world. A routine is included when
 * its effective domain resolves to "strength" (driven by domain override or
 * derived from kind=WORKOUT + non-rehab subtype).
 *
 * Cached per request so the strength world page can hit it from multiple
 * server components without refetching.
 */
export const loadStrengthWorld = cache(async function loadStrengthWorld(): Promise<StrengthWorldData> {
  // Fetch all WORKOUT routine logs with exercises + sets. Filter to strength
  // domain in JS since domain resolution is multi-step (override -> derive).
  const rawLogs = await prisma.routineLog.findMany({
    where: {
      routine: {
        isDeleted: false,
        kind: "WORKOUT",
      },
    },
    orderBy: { performedAt: "desc" },
    select: {
      id: true,
      performedAt: true,
      routineId: true,
      routine: {
        select: { id: true, name: true, kind: true, subtype: true, domain: true },
      },
      exercises: {
        select: {
          exerciseId: true,
          exercise: { select: { id: true, name: true } },
          sets: { select: { reps: true, weightLb: true } },
        },
      },
    },
  });

  const strengthLogs = rawLogs.filter(
    (log) => effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype) === "strength"
  );

  // ── Aggregate ────────────────────────────────────────────────────────────

  const exerciseMap = new Map<string, {
    exerciseId: string;
    name: string;
    sessions: Map<string, { date: Date; sets: Array<{ weightLb: number; reps: number }> }>;
  }>();
  const routineMap = new Map<string, StrengthRoutineSummary>();
  const recentSessionList: StrengthRecentSession[] = [];

  let totalSessions = 0;
  let totalSets = 0;
  let totalVolume = 0;
  const sessionDates: Date[] = [];

  for (const log of strengthLogs) {
    totalSessions += 1;
    sessionDates.push(log.performedAt);

    let logSets = 0;
    let logVolume = 0;
    let topSetInLog: { exerciseName: string; weight: number; reps: number } | null = null;

    for (const ex of log.exercises) {
      const exId = ex.exerciseId;
      const entry = exerciseMap.get(exId) ?? {
        exerciseId: exId,
        name: ex.exercise.name,
        sessions: new Map(),
      };
      const sessionKey = log.id;
      const session = entry.sessions.get(sessionKey) ?? { date: log.performedAt, sets: [] };
      for (const set of ex.sets) {
        const weight = set.weightLb ?? 0;
        const reps = set.reps ?? 0;
        if (weight <= 0 && reps <= 0) continue;
        session.sets.push({ weightLb: weight, reps });
        logSets += 1;
        logVolume += weight * reps;
        if (weight > 0 && (!topSetInLog || weight > topSetInLog.weight)) {
          topSetInLog = { exerciseName: ex.exercise.name, weight, reps };
        }
      }
      entry.sessions.set(sessionKey, session);
      exerciseMap.set(exId, entry);
    }

    totalSets += logSets;
    totalVolume += logVolume;

    // Routine rollup
    const routineEntry = routineMap.get(log.routineId) ?? {
      routineId: log.routineId,
      name: log.routine.name,
      subtype: log.routine.subtype,
      domain: log.routine.domain,
      totalSessions: 0,
      lastDate: null,
      totalSets: 0,
      totalVolume: 0,
    };
    routineEntry.totalSessions += 1;
    routineEntry.totalSets += logSets;
    routineEntry.totalVolume += logVolume;
    if (!routineEntry.lastDate || log.performedAt > routineEntry.lastDate) {
      routineEntry.lastDate = log.performedAt;
    }
    routineMap.set(log.routineId, routineEntry);

    recentSessionList.push({
      id: log.id,
      routineId: log.routineId,
      routineName: log.routine.name,
      date: log.performedAt,
      totalSets: logSets,
      totalVolume: logVolume,
      topSet: topSetInLog,
    });
  }

  // ── Build per-exercise summaries ─────────────────────────────────────────

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const allExercises: StrengthExerciseSummary[] = [];
  for (const entry of exerciseMap.values()) {
    const sessions = [...entry.sessions.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
    if (sessions.length === 0) continue;

    let totalSetCount = 0;
    let allTimePR: StrengthSetMetrics | null = null;
    let priorMaxWeightAt30dCutoff = 0;
    let recentMaxWeight = 0;

    for (const session of sessions) {
      totalSetCount += session.sets.length;
      const sessionTopWeight = session.sets.reduce((max, s) => Math.max(max, s.weightLb), 0);
      const sessionTopWeightSet = session.sets.find((s) => s.weightLb === sessionTopWeight && s.weightLb > 0);
      if (sessionTopWeightSet && sessionTopWeightSet.weightLb > 0) {
        const candidate: StrengthSetMetrics = {
          weightLb: sessionTopWeightSet.weightLb,
          reps: sessionTopWeightSet.reps,
          volume: sessionTopWeightSet.weightLb * sessionTopWeightSet.reps,
        };
        if (!allTimePR || candidate.weightLb > allTimePR.weightLb) {
          allTimePR = candidate;
        }
      }

      if (session.date < thirtyDaysAgo) {
        priorMaxWeightAt30dCutoff = Math.max(priorMaxWeightAt30dCutoff, sessionTopWeight);
      } else {
        recentMaxWeight = Math.max(recentMaxWeight, sessionTopWeight);
      }
    }

    const recentPR = recentMaxWeight > 0 && recentMaxWeight > priorMaxWeightAt30dCutoff;

    const recentTopWeights = sessions.slice(-8).map((s) => {
      const top = s.sets.reduce(
        (best, curr) => (curr.weightLb > best.weightLb ? curr : best),
        { weightLb: 0, reps: 0 }
      );
      return { date: s.date, weight: top.weightLb, reps: top.reps };
    });

    allExercises.push({
      exerciseId: entry.exerciseId,
      name: entry.name,
      routineLink: `/progress/exercises/${entry.exerciseId}`,
      totalSessions: sessions.length,
      totalSets: totalSetCount,
      allTimePR,
      lastDate: sessions[sessions.length - 1]?.date ?? null,
      recentPR,
      recentTopWeights,
    });
  }

  // Top exercises by sessions logged (most-trained first)
  const topExercises = [...allExercises].sort(
    (a, b) => b.totalSessions - a.totalSessions || (b.allTimePR?.weightLb ?? 0) - (a.allTimePR?.weightLb ?? 0)
  );

  const routines = [...routineMap.values()].sort(
    (a, b) => b.totalSessions - a.totalSessions || (b.lastDate?.getTime() ?? 0) - (a.lastDate?.getTime() ?? 0)
  );

  const sessionStats: StrengthSessionStat[] = recentSessionList.map((s) => ({
    date: s.date,
    sets: s.totalSets,
    volume: s.totalVolume,
  }));

  const recentSessions = recentSessionList
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);

  // ── Heatmap: single-row strength sessions over the last 52 weeks ──────────
  const heatmapSessionEvents = strengthLogs.map((log) => ({
    id: log.id,
    routineId: log.routineId,
    performedAt: log.performedAt,
    routineName: log.routine.name,
  }));
  const heatmapWeeks = buildWeeklyGrid(heatmapSessionEvents, [], new Date());

  return {
    totalSessions,
    totalSets,
    totalVolume,
    sessionDates,
    heatmapWeeks,
    topExercises,
    routines,
    recentSessions,
    allExercises,
    sessionStats,
  };
});
