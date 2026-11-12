// Per-domain drill-down aggregations for a report window. Lean, report-specific
// queries (the buildPyramidRows pattern) rather than the activity-world 12-week
// chart loaders — those return week-series shapes tuned for their own bar
// charts, not a calendar-period breakdown. Each section only runs when its
// domain actually appears in the window.

import { prisma } from "@/lib/prisma";
import { buildPyramidRows, hardestGrade, resolveProjectArcs, type PyramidRows } from "@/lib/climb-stats";
import { SENT_OUTCOMES, type ClimbGradeSystem, type ClimbOutcome } from "@/lib/climb-types";
import type { ReportLog } from "./load";

export type ClimbDrill = {
  pyramid: PyramidRows;
  sends: number;
  sessions: number;
  hardestBoulder: string | null;
  hardestRope: string | null;
};

export type EnduranceFamilyRow = { slug: string; name: string; sessions: number; miles: number; sec: number };
export type StrengthExerciseRow = { name: string; volume: number; sets: number };
export type SportRow = { name: string; count: number };

export type Drilldowns = {
  climb?: ClimbDrill;
  endurance?: { families: EnduranceFamilyRow[] };
  strength?: { topExercises: StrengthExerciseRow[] };
  sport?: { sports: SportRow[] };
};

export async function loadDrilldowns(
  window: { start: Date; end: Date },
  logs: ReportLog[]
): Promise<Drilldowns> {
  const logIds = logs.map((l) => l.id);
  if (logIds.length === 0) return {};
  const active = new Set(logs.map((l) => l.domain));
  const out: Drilldowns = {};
  const tasks: Promise<void>[] = [];

  if (active.has("sport")) {
    tasks.push(
      (async () => {
        const attempts = await prisma.climbAttempt.findMany({
          where: { sessionLogId: { in: logIds } },
          select: { id: true, grade: true, gradeSystem: true, outcome: true, isRepeat: true, discipline: true, sessionLogId: true, problemId: true },
        });
        if (attempts.length > 0) {
          // Arcs need the whole life of each problem, not just this window —
          // the projecting sessions usually sit in earlier reports. Projects
          // whose send falls outside this window stay visible; that is handled
          // inside buildPyramidRows.
          const problemIds = [...new Set(attempts.map((a) => a.problemId).filter((v): v is string => !!v))];
          const arcAttempts = problemIds.length > 0
            ? await prisma.climbAttempt.findMany({
                where: { problemId: { in: problemIds } },
                select: {
                  id: true, problemId: true, sessionLogId: true, outcome: true,
                  isRepeat: true, triesCount: true,
                  sessionLog: { select: { performedAt: true } },
                },
              })
            : [];
          const arcs = resolveProjectArcs(
            arcAttempts.map((a) => ({
              id: a.id,
              problemId: a.problemId,
              sessionLogId: a.sessionLogId,
              outcome: a.outcome as ClimbOutcome,
              isRepeat: a.isRepeat,
              triesCount: a.triesCount,
              performedAt: a.sessionLog.performedAt,
            })),
          );
          const pyramid = buildPyramidRows(
            attempts.map((a) => ({
              id: a.id,
              grade: a.grade,
              gradeSystem: a.gradeSystem as ClimbGradeSystem,
              outcome: a.outcome as ClimbOutcome,
              isRepeat: a.isRepeat,
              discipline: a.discipline,
            })),
            arcs,
          );
          out.climb = {
            pyramid,
            sends: attempts.filter((a) => SENT_OUTCOMES.has(a.outcome)).length,
            sessions: new Set(attempts.map((a) => a.sessionLogId)).size,
            hardestBoulder: hardestGrade(pyramid.boulderRows, SENT_OUTCOMES),
            hardestRope: hardestGrade(pyramid.yosemiteRows, SENT_OUTCOMES),
          };
        }

        // Non-climbing sport sessions → counts by name (synthetic sport routine).
        const byName = new Map<string, number>();
        for (const l of logs) {
          if (l.domain !== "sport") continue;
          byName.set(l.routine.name, (byName.get(l.routine.name) ?? 0) + 1);
        }
        const sports = [...byName.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        if (sports.length > 0) out.sport = { sports };
      })()
    );
  }

  if (active.has("cardio")) {
    tasks.push(
      (async () => {
        const rows = await prisma.routineLog.findMany({
          where: { performedAt: { gte: window.start, lt: window.end }, activityTypeId: { not: null } },
          select: {
            distanceMi: true,
            durationSec: true,
            activityType: { select: { family: { select: { slug: true, name: true, sortOrder: true } } } },
          },
        });
        const fam = new Map<string, EnduranceFamilyRow & { sort: number }>();
        for (const r of rows) {
          const f = r.activityType?.family;
          if (!f) continue;
          const e = fam.get(f.slug) ?? { slug: f.slug, name: f.name, sessions: 0, miles: 0, sec: 0, sort: f.sortOrder };
          e.sessions += 1;
          e.miles += r.distanceMi ?? 0;
          e.sec += r.durationSec ?? 0;
          fam.set(f.slug, e);
        }
        const families = [...fam.values()]
          .sort((a, b) => a.sort - b.sort)
          .map(({ sort, ...r }) => r);
        if (families.length > 0) out.endurance = { families };
      })()
    );
  }

  if (active.has("strength")) {
    tasks.push(
      (async () => {
        const sets = await prisma.setEntry.findMany({
          where: { sessionExercise: { routineLogId: { in: logIds } } },
          select: { reps: true, weightLb: true, sessionExercise: { select: { exercise: { select: { name: true } } } } },
        });
        const ex = new Map<string, StrengthExerciseRow>();
        for (const s of sets) {
          const name = s.sessionExercise.exercise.name;
          const e = ex.get(name) ?? { name, volume: 0, sets: 0 };
          e.sets += 1;
          if (s.weightLb && s.reps) e.volume += s.weightLb * s.reps;
          ex.set(name, e);
        }
        const topExercises = [...ex.values()].sort((a, b) => b.volume - a.volume).slice(0, 6);
        if (topExercises.length > 0) out.strength = { topExercises };
      })()
    );
  }

  await Promise.all(tasks);
  return out;
}
