import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/auth";
import { effectiveOutcome, gradeSort, venueOf, type ClimbGradeSystem } from "@/lib/climb-types";
import { toAppYmd } from "@/lib/dates";

export type ProgramAssessmentSuggestion = {
  metricKey: string;
  numberValue: number | null;
  numerator: number | null;
  denominator: number | null;
  textValue: string | null;
  measuredYmd: string;
  source: "ROUTINE_LOG" | "BODY_MEASUREMENT" | "PAIN_LOG" | "CLIMB_ATTEMPT" | "DERIVED";
  sourceRefId: string;
  sourceLabel: string;
  sourceHref: string | null;
};

type ClimbRow = Awaited<ReturnType<typeof loadClimbAttempts>>[number];

export async function getProgramAssessmentSuggestions(): Promise<ProgramAssessmentSuggestion[]> {
  const session = await getAppSession();
  const [attempts, sessionMetrics, sessionExercises, bodyMeasurements, injuries] = await Promise.all([
    loadClimbAttempts(),
    prisma.sessionLogMetricValue.findMany({
      orderBy: { routineLog: { performedAt: "desc" } },
      select: {
        id: true,
        numberValue: true,
        textValue: true,
        booleanValue: true,
        metricDefinition: { select: { id: true, label: true } },
        routineLog: {
          select: {
            id: true,
            routineId: true,
            performedAt: true,
            routine: { select: { name: true } },
          },
        },
      },
    }),
    prisma.sessionExercise.findMany({
      orderBy: { routineLog: { performedAt: "desc" } },
      select: {
        exerciseId: true,
        exercise: { select: { name: true } },
        sets: { select: { reps: true, seconds: true, weightLb: true } },
        routineLog: { select: { id: true, routineId: true, performedAt: true, routine: { select: { name: true } } } },
      },
    }),
    prisma.bodyMeasurement.findMany({
      where: { profileKey: session.profileKey },
      orderBy: { measuredAt: "desc" },
      select: { id: true, measuredAt: true, weightKg: true, bodyFatPct: true, waistCm: true },
    }),
    prisma.activeInjury.findMany({
      select: {
        id: true,
        name: true,
        zones: {
          select: {
            zone: {
              select: {
                painLogs: {
                  orderBy: { loggedAt: "desc" },
                  take: 1,
                  select: { id: true, level: true, loggedAt: true, routineLogId: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const suggestions: ProgramAssessmentSuggestion[] = [];
  addClimbingSuggestions(suggestions, attempts);

  const seenSessionMetrics = new Set<string>();
  for (const value of sessionMetrics) {
    const metricKey = `session_metric:${value.metricDefinition.id}`;
    if (seenSessionMetrics.has(metricKey)) continue;
    const hasValue = value.numberValue != null || value.textValue != null || value.booleanValue != null;
    if (!hasValue) continue;
    seenSessionMetrics.add(metricKey);
    suggestions.push({
      metricKey,
      numberValue: value.numberValue,
      numerator: null,
      denominator: null,
      textValue: value.textValue ?? (value.booleanValue == null ? null : value.booleanValue ? "Yes" : "No"),
      measuredYmd: toAppYmd(value.routineLog.performedAt),
      source: "ROUTINE_LOG",
      sourceRefId: value.routineLog.id,
      sourceLabel: `${value.metricDefinition.label} in ${value.routineLog.routine.name}`,
      sourceHref: logHref(value.routineLog.routineId, value.routineLog.id),
    });
  }

  addExerciseSuggestions(suggestions, sessionExercises);

  const latestWeight = bodyMeasurements.find((row) => row.weightKg != null);
  if (latestWeight?.weightKg != null) {
    suggestions.push(bodySuggestion("body:body_weight", latestWeight.id, latestWeight.measuredAt, latestWeight.weightKg * 2.2046226218, "Latest recorded bodyweight"));
  }
  const latestWaist = bodyMeasurements.find((row) => row.waistCm != null);
  if (latestWaist?.waistCm != null) {
    suggestions.push(bodySuggestion("body:waist", latestWaist.id, latestWaist.measuredAt, latestWaist.waistCm / 2.54, "Latest recorded waist measurement"));
  }
  const latestBodyFat = bodyMeasurements.find((row) => row.bodyFatPct != null);
  if (latestBodyFat?.bodyFatPct != null) {
    suggestions.push(bodySuggestion("body:body_fat", latestBodyFat.id, latestBodyFat.measuredAt, latestBodyFat.bodyFatPct, "Latest recorded body-fat estimate"));
  }

  for (const injury of injuries) {
    const latest = injury.zones
      .flatMap((zone) => zone.zone.painLogs)
      .sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime())[0];
    if (!latest) continue;
    suggestions.push({
      metricKey: `injury:${injury.id}:pain`,
      numberValue: latest.level,
      numerator: null,
      denominator: null,
      textValue: null,
      measuredYmd: toAppYmd(latest.loggedAt),
      source: "PAIN_LOG",
      sourceRefId: latest.id,
      sourceLabel: `${injury.name} pain reading`,
      sourceHref: `/injuries/${injury.id}`,
    });
  }

  return suggestions;
}

async function loadClimbAttempts() {
  return prisma.climbAttempt.findMany({
    select: {
      id: true,
      discipline: true,
      grade: true,
      gradeSystem: true,
      outcome: true,
      isRepeat: true,
      movesCompleted: true,
      totalMoves: true,
      triesCount: true,
      problem: { select: { name: true } },
      sessionLog: {
        select: {
          id: true,
          routineId: true,
          performedAt: true,
          climbLocation: { select: { name: true, type: true } },
          routine: { select: { sessionDetails: { select: { template: { select: { key: true } } } } } },
        },
      },
    },
  });
}

function addClimbingSuggestions(target: ProgramAssessmentSuggestion[], attempts: ClimbRow[]) {
  const venue = (row: ClimbRow) => venueOf(row.sessionLog.routine.sessionDetails?.template?.key, row.sessionLog.climbLocation?.type);
  const isRope = (row: ClimbRow) => row.discipline !== "BOULDER";
  // A repeat counts as a send, never a flash or onsight — otherwise a lap on
  // something already climbed would set a "hardest flash" assessment.
  const oc = (row: ClimbRow) => effectiveOutcome(row.outcome, row.isRepeat, row.discipline);
  const cleanBoulder = new Set(["FLASH", "SEND"]);
  const cleanRope = new Set(["FLASH", "ONSIGHT", "SEND", "REDPOINT"]);

  addBestGrade(target, "sport:climbing:outdoor_boulder_send", attempts.filter((row) => venue(row) === "CRAG" && !isRope(row) && cleanBoulder.has(oc(row))));
  addBestGrade(target, "sport:climbing:outdoor_boulder_flash", attempts.filter((row) => venue(row) === "CRAG" && !isRope(row) && oc(row) === "FLASH"));
  addBestGrade(target, "sport:climbing:indoor_boulder_send", attempts.filter((row) => venue(row) === "GYM" && !isRope(row) && cleanBoulder.has(oc(row))));
  addBestGrade(target, "sport:climbing:indoor_boulder_flash", attempts.filter((row) => venue(row) === "GYM" && !isRope(row) && oc(row) === "FLASH"));
  addBestGrade(target, "sport:climbing:outdoor_rope_redpoint", attempts.filter((row) => venue(row) === "CRAG" && isRope(row) && oc(row) === "REDPOINT"));
  addBestGrade(target, "sport:climbing:outdoor_rope_onsight", attempts.filter((row) => venue(row) === "CRAG" && isRope(row) && oc(row) === "ONSIGHT"));
  addBestGrade(target, "sport:climbing:indoor_rope_redpoint", attempts.filter((row) => venue(row) === "GYM" && isRope(row) && cleanRope.has(oc(row))));
  addBestGrade(target, "sport:climbing:indoor_rope_onsight", attempts.filter((row) => venue(row) === "GYM" && isRope(row) && oc(row) === "ONSIGHT"));

  const latestMoves = [...attempts]
    .filter((row) => row.movesCompleted != null && row.totalMoves != null && row.totalMoves > 0)
    .sort((a, b) => b.sessionLog.performedAt.getTime() - a.sessionLog.performedAt.getTime())[0];
  if (latestMoves?.movesCompleted != null && latestMoves.totalMoves != null) {
    target.push(climbSuggestion("sport:climbing:project_moves", latestMoves, null, latestMoves.movesCompleted, latestMoves.totalMoves));
  }

  const latestSendWithTries = [...attempts]
    .filter((row) => cleanRope.has(oc(row)) && (row.triesCount != null || oc(row) === "FLASH" || oc(row) === "ONSIGHT"))
    .sort((a, b) => b.sessionLog.performedAt.getTime() - a.sessionLog.performedAt.getTime())[0];
  if (latestSendWithTries) {
    const tries = latestSendWithTries.triesCount ?? 1;
    target.push(climbSuggestion("sport:climbing:project_attempts", latestSendWithTries, tries, null, null));
  }
}

function addBestGrade(target: ProgramAssessmentSuggestion[], metricKey: string, rows: ClimbRow[]) {
  const best = [...rows].sort((a, b) => {
    const gradeDifference = gradeSort(b.grade, b.gradeSystem as ClimbGradeSystem) - gradeSort(a.grade, a.gradeSystem as ClimbGradeSystem);
    return gradeDifference || b.sessionLog.performedAt.getTime() - a.sessionLog.performedAt.getTime();
  })[0];
  if (best) target.push(climbSuggestion(metricKey, best, null, null, null, best.grade));
}

function climbSuggestion(metricKey: string, row: ClimbRow, numberValue: number | null, numerator: number | null, denominator: number | null, textValue: string | null = null): ProgramAssessmentSuggestion {
  const venueName = row.sessionLog.climbLocation?.name ?? "Climbing log";
  const climbName = row.problem?.name ? ` - ${row.problem.name}` : "";
  return {
    metricKey,
    numberValue,
    numerator,
    denominator,
    textValue,
    measuredYmd: toAppYmd(row.sessionLog.performedAt),
    source: "CLIMB_ATTEMPT",
    sourceRefId: row.id,
    sourceLabel: `${row.grade} at ${venueName}${climbName}`,
    sourceHref: logHref(row.sessionLog.routineId, row.sessionLog.id),
  };
}

function addExerciseSuggestions(target: ProgramAssessmentSuggestion[], rows: Array<{
  exerciseId: string;
  exercise: { name: string };
  sets: Array<{ reps: number | null; seconds: number | null; weightLb: number | null }>;
  routineLog: { id: string; routineId: string; performedAt: Date; routine: { name: string } };
}>) {
  const byExercise = new Map<string, typeof rows>();
  for (const row of rows) byExercise.set(row.exerciseId, [...(byExercise.get(row.exerciseId) ?? []), row]);

  for (const [exerciseId, logs] of byExercise) {
    const candidates = logs.flatMap((log) => log.sets.map((set) => ({ log, set })));
    const maxLoad = candidates.filter((item) => item.set.weightLb != null).sort((a, b) => (b.set.weightLb ?? 0) - (a.set.weightLb ?? 0))[0];
    if (maxLoad?.set.weightLb != null) target.push(exerciseSuggestion(exerciseId, "max_load", maxLoad.log, maxLoad.set.weightLb, "Heaviest logged set"));

    const latestWeighted = candidates.filter((item) => item.set.weightLb != null).sort((a, b) => b.log.routineLog.performedAt.getTime() - a.log.routineLog.performedAt.getTime())[0];
    if (latestWeighted?.set.weightLb != null) target.push(exerciseSuggestion(exerciseId, "working_load", latestWeighted.log, latestWeighted.set.weightLb, "Most recent working load"));

    const maxReps = candidates.filter((item) => item.set.reps != null).sort((a, b) => (b.set.reps ?? 0) - (a.set.reps ?? 0))[0];
    if (maxReps?.set.reps != null) target.push(exerciseSuggestion(exerciseId, "max_reps", maxReps.log, maxReps.set.reps, "Best logged set"));

    const maxDuration = candidates.filter((item) => item.set.seconds != null).sort((a, b) => (b.set.seconds ?? 0) - (a.set.seconds ?? 0))[0];
    if (maxDuration?.set.seconds != null) target.push(exerciseSuggestion(exerciseId, "duration", maxDuration.log, maxDuration.set.seconds, "Longest logged set"));

    const latestVolumeLog = logs.find((log) => log.sets.some((set) => set.weightLb != null && set.reps != null));
    if (latestVolumeLog) {
      const volume = latestVolumeLog.sets.reduce((sum, set) => sum + (set.weightLb ?? 0) * (set.reps ?? 0), 0);
      if (volume > 0) target.push(exerciseSuggestion(exerciseId, "volume", latestVolumeLog, volume, "Most recent session volume"));
    }
  }
}

function exerciseSuggestion(exerciseId: string, measure: string, log: {
  exercise: { name: string };
  routineLog: { id: string; routineId: string; performedAt: Date; routine: { name: string } };
}, numberValue: number, prefix: string): ProgramAssessmentSuggestion {
  return {
    metricKey: `exercise:${exerciseId}:${measure}`,
    numberValue,
    numerator: null,
    denominator: null,
    textValue: null,
    measuredYmd: toAppYmd(log.routineLog.performedAt),
    source: "ROUTINE_LOG",
    sourceRefId: log.routineLog.id,
    sourceLabel: `${prefix} - ${log.exercise.name} in ${log.routineLog.routine.name}`,
    sourceHref: logHref(log.routineLog.routineId, log.routineLog.id),
  };
}

function bodySuggestion(metricKey: string, id: string, measuredAt: Date, value: number, sourceLabel: string): ProgramAssessmentSuggestion {
  return {
    metricKey,
    numberValue: Math.round(value * 10) / 10,
    numerator: null,
    denominator: null,
    textValue: null,
    measuredYmd: toAppYmd(measuredAt),
    source: "BODY_MEASUREMENT",
    sourceRefId: id,
    sourceLabel,
    sourceHref: "/profile/measurements",
  };
}

function logHref(routineId: string, logId: string) {
  return `/routines/${routineId}/logs/${logId}/details`;
}
