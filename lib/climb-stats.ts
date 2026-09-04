// Climbing aggregate builders — pyramids, hardest grades, project detection.
// Pure functions over shape-typed data; safe to import in server and client
// components. No Prisma dependency here so test/preview rendering doesn't
// drag the whole client in.

import {
  effectiveOutcome,
  gradeSort,
  isSendOutcome,
  ORDERED_OUTCOMES,
  SENT_OUTCOMES,
  type ClimbGradeSystem,
  type ClimbingDiscipline,
  type ClimbOutcome,
} from "./climb-types";

// Minimum data needed to build a pyramid row. Callers can pass any object
// shape with these fields — typically a Prisma ClimbAttempt projection.
export type PyramidAttemptInput = {
  grade: string;
  gradeSystem: ClimbGradeSystem;
  outcome: ClimbOutcome;
  /** Repeats are counted as sends, never flashes. Optional so older callers
   *  that don't select it keep their existing behaviour. */
  isRepeat?: boolean | null;
  discipline?: ClimbingDiscipline | null;
};

export type PyramidRow = {
  grade: string;
  system: ClimbGradeSystem;
  counts: Partial<Record<ClimbOutcome, number>>;
  total: number;
};

export type PyramidRows = {
  boulderRows: PyramidRow[];
  yosemiteRows: PyramidRow[];
  allRows: PyramidRow[];
};

export function buildPyramidRows(attempts: PyramidAttemptInput[]): PyramidRows {
  const map = new Map<string, PyramidRow>();
  for (const a of attempts) {
    // Falls don't get pyramid bars — pyramid celebrates clean climbs.
    if (a.outcome === "FELL") continue;
    const outcome = effectiveOutcome(a.outcome, a.isRepeat, a.discipline);
    const key = `${a.gradeSystem}::${a.grade}`;
    const row = map.get(key) ?? {
      grade: a.grade,
      system: a.gradeSystem,
      counts: {},
      total: 0,
    };
    row.counts[outcome] = (row.counts[outcome] ?? 0) + 1;
    row.total += 1;
    map.set(key, row);
  }

  const boulderRows = [...map.values()]
    .filter((r) => r.system === "BOULDER_V")
    .sort((a, b) => gradeSort(a.grade, "BOULDER_V") - gradeSort(b.grade, "BOULDER_V"));
  const yosemiteRows = [...map.values()]
    .filter((r) => r.system === "YOSEMITE")
    .sort((a, b) => gradeSort(a.grade, "YOSEMITE") - gradeSort(b.grade, "YOSEMITE"));

  return { boulderRows, yosemiteRows, allRows: [...boulderRows, ...yosemiteRows] };
}

// Return the hardest grade in `rows` where at least one of `filter` outcomes
// has a non-zero count. Rows are already ascending, so we scan from the top.
export function hardestGrade(
  rows: PyramidRow[],
  filter: ReadonlySet<ClimbOutcome>
): string | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    for (const outcome of ORDERED_OUTCOMES) {
      if (filter.has(outcome) && (rows[i].counts[outcome] ?? 0) > 0) {
        return rows[i].grade;
      }
    }
  }
  return null;
}

export type AttemptSummaryInput = PyramidAttemptInput & {
  sessionLogId?: string;
};

export type AttemptSummary = {
  totalAttempts: number;
  totalSessions: number;
  sentCount: number;
  projectCount: number;
  fallCount: number;
};

export function summarizeAttempts(attempts: AttemptSummaryInput[]): AttemptSummary {
  const sessionIds = new Set<string>();
  let sent = 0;
  let projects = 0;
  let falls = 0;
  for (const a of attempts) {
    if (a.sessionLogId) sessionIds.add(a.sessionLogId);
    if (SENT_OUTCOMES.has(a.outcome)) sent += 1;
    else if (a.outcome === "PROJECT") projects += 1;
    else if (a.outcome === "FELL") falls += 1;
  }
  return {
    totalAttempts: attempts.length,
    totalSessions: sessionIds.size,
    sentCount: sent,
    projectCount: projects,
    fallCount: falls,
  };
}

// A problem is an "active project" when it has at least one PROJECT or FELL
// attempt and no clean send. Optional `recentSinceMs` narrows to recently
// attempted projects (e.g. last 60d) for "what to revisit" views.
//
// Takes only outcome + performedAt so callers can pass attempt arrays that
// are already grouped by problem (problemId is implicit in the grouping).
export type ProjectDetectionInput = {
  outcome: ClimbOutcome;
  performedAt?: Date | null;
};

export function isActiveProject(
  attempts: ProjectDetectionInput[],
  options: { recentSinceMs?: number; now?: Date } = {}
): boolean {
  if (attempts.length === 0) return false;
  const { recentSinceMs, now = new Date() } = options;

  let hasProjectOrFall = false;
  let hasRecentTouch = recentSinceMs === undefined; // when no recency filter, default true
  for (const a of attempts) {
    if (isSendOutcome(a.outcome)) return false; // any clean send disqualifies
    if (a.outcome === "PROJECT" || a.outcome === "FELL") {
      hasProjectOrFall = true;
      if (recentSinceMs !== undefined && a.performedAt) {
        if (now.getTime() - a.performedAt.getTime() <= recentSinceMs) hasRecentTouch = true;
      }
    }
  }
  return hasProjectOrFall && hasRecentTouch;
}

// Group attempts by problemId and surface those that qualify as active
// projects. Returned rows include enough metadata to render a project card
// (latest attempt date, attempt count, move progress, last notes).
export type ProjectRollupInput = {
  id: string;
  problemId: string | null;
  outcome: ClimbOutcome;
  grade: string;
  gradeSystem: ClimbGradeSystem;
  movesCompleted?: number | null;
  totalMoves?: number | null;
  notes?: string | null;
  performedAt: Date;
};

export type ProjectRollupRow = {
  problemId: string;
  grade: string;
  gradeSystem: ClimbGradeSystem;
  attemptCount: number;
  lastAttempt: Date;
  bestMoves: { completed: number; total: number } | null;
  lastNotes: string | null;
};

export function buildProjectRollup(
  attempts: ProjectRollupInput[],
  options: { recentSinceMs?: number; now?: Date } = {}
): ProjectRollupRow[] {
  const byProblem = new Map<string, ProjectRollupInput[]>();
  for (const a of attempts) {
    if (!a.problemId) continue; // un-named climbs can't be project rolled-up
    const list = byProblem.get(a.problemId) ?? [];
    list.push(a);
    byProblem.set(a.problemId, list);
  }

  const rows: ProjectRollupRow[] = [];
  for (const [problemId, list] of byProblem) {
    if (!isActiveProject(list, options)) continue;
    // Sort newest first to compute lastAttempt and lastNotes
    list.sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime());
    let bestCompleted = -1;
    let bestTotal = 0;
    let lastNotes: string | null = null;
    for (const a of list) {
      if (a.movesCompleted != null && a.totalMoves != null && a.totalMoves > 0) {
        if (a.movesCompleted > bestCompleted) {
          bestCompleted = a.movesCompleted;
          bestTotal = a.totalMoves;
        }
      }
      if (lastNotes === null && a.notes?.trim()) lastNotes = a.notes.trim();
    }
    rows.push({
      problemId,
      grade: list[0].grade,
      gradeSystem: list[0].gradeSystem,
      attemptCount: list.length,
      lastAttempt: list[0].performedAt,
      bestMoves: bestCompleted >= 0 ? { completed: bestCompleted, total: bestTotal } : null,
      lastNotes,
    });
  }

  // Most recently touched first.
  rows.sort((a, b) => b.lastAttempt.getTime() - a.lastAttempt.getTime());
  return rows;
}
