// Windowed per-domain "in numbers" — the meaningful per-discipline totals that
// make a month/year review worth reading: climbing sends + hardest grade,
// strength volume + sets. Scoped by the window's log ids (gathered by
// loadReportLogs) so no relation-name traversal or redundant date query is
// needed. Heavier per-sport charts (mileage/pace/grade pyramids) come in
// Phase 4; these are the cheap scalar headlines.

import { prisma } from "@/lib/prisma";
import { gradeSort, SENT_OUTCOMES, type ClimbGradeSystem } from "@/lib/climb-types";

export type ReportTotals = {
  climbSends: number;
  hardestBoulder: string | null;
  hardestRope: string | null;
  strengthVolumeLb: number;
  strengthSets: number;
};

const EMPTY: ReportTotals = {
  climbSends: 0,
  hardestBoulder: null,
  hardestRope: null,
  strengthVolumeLb: 0,
  strengthSets: 0,
};

export async function loadReportTotals(logIds: string[]): Promise<ReportTotals> {
  if (logIds.length === 0) return EMPTY;

  const [attempts, sets] = await Promise.all([
    prisma.climbAttempt.findMany({
      where: { sessionLogId: { in: logIds } },
      select: { grade: true, gradeSystem: true, outcome: true },
    }),
    prisma.setEntry.findMany({
      where: { sessionExercise: { routineLogId: { in: logIds } } },
      select: { reps: true, weightLb: true },
    }),
  ]);

  let climbSends = 0;
  let hardestBoulder: string | null = null;
  let hardestBoulderSort = -1;
  let hardestRope: string | null = null;
  let hardestRopeSort = -1;
  for (const a of attempts) {
    if (!SENT_OUTCOMES.has(a.outcome)) continue;
    climbSends += 1;
    const sort = gradeSort(a.grade, a.gradeSystem as ClimbGradeSystem);
    if (a.gradeSystem === "BOULDER_V") {
      if (sort > hardestBoulderSort) {
        hardestBoulderSort = sort;
        hardestBoulder = a.grade;
      }
    } else if (sort > hardestRopeSort) {
      hardestRopeSort = sort;
      hardestRope = a.grade;
    }
  }

  let strengthVolumeLb = 0;
  for (const s of sets) {
    if (s.weightLb && s.reps) strengthVolumeLb += s.weightLb * s.reps;
  }

  return {
    climbSends,
    hardestBoulder,
    hardestRope,
    strengthVolumeLb,
    strengthSets: sets.length,
  };
}
