// Climbing aggregate builders — pyramids, hardest grades, project detection.
// Pure functions over shape-typed data; safe to import in server and client
// components. No Prisma dependency here so test/preview rendering doesn't
// drag the whole client in.

import {
  gradeSort,
  pyramidBucket,
  isSendOutcome,
  ORDERED_OUTCOMES,
  SENT_OUTCOMES,
  type ClimbGradeSystem,
  type ClimbingDiscipline,
  type ClimbOutcome,
  type PyramidBucket,
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
  /** Needed only to consult a ProjectArcs resolution; callers without one
   *  can leave it off. */
  id?: string;
};

// ── Project arcs ───────────────────────────────────────────────────────────
// "I worked this for three sessions and then it went" is a different result
// from "I sent it", but no single attempt row can say so — it is a property of
// the climb's history. Resolve it once over the full history, then the pyramid
// consults the answer.
//
// Identity comes from problemId, so this only works for climbs saved as a
// ClimbProblem. An unnamed gym boulder has nothing to link sessions by, so its
// projects and sends stay separate — there is no signal to do better.

export type ArcAttemptInput = {
  id: string;
  problemId?: string | null;
  sessionLogId?: string | null;
  outcome: ClimbOutcome;
  isRepeat?: boolean | null;
  triesCount?: number | null;
  performedAt: Date;
};

export type ProjectHistory = {
  /** Distinct sessions spent on the climb, counting the one it fell on. */
  sessions: number;
  /** Total goes. Unrecorded triesCount counts as 1 — a six-go project session
   *  stores one row, so counting rows alone understates the work. */
  tries: number;
  firstAt: Date;
};

export type ProjectArcs = {
  /** Absorbed project attempt id → the send attempt that absorbed it. Keyed by
   *  send rather than a flat set because a project may only be hidden where
   *  its send is also on screen — see absorbedProjectIdsWithin. */
  sendIdByAbsorbedProjectId: ReadonlyMap<string, string>;
  /** Sends that closed an arc, with the work that went into them. */
  historyBySendId: ReadonlyMap<string, ProjectHistory>;
};

export const EMPTY_PROJECT_ARCS: ProjectArcs = {
  sendIdByAbsorbedProjectId: new Map(),
  historyBySendId: new Map(),
};

// A project is only hidden when the send that absorbed it is in the same view.
// Otherwise a report for a past month would drop the three sessions you spent
// projecting just because the climb went down in a later month — the work
// would vanish with nothing on screen reporting it.
export function absorbedProjectIdsWithin(
  arcs: ProjectArcs,
  attempts: ReadonlyArray<{ id?: string }>,
): Set<string> {
  const present = new Set<string>();
  for (const a of attempts) if (a.id) present.add(a.id);
  const hidden = new Set<string>();
  for (const [projectId, sendId] of arcs.sendIdByAbsorbedProjectId) {
    if (present.has(projectId) && present.has(sendId)) hidden.add(projectId);
  }
  return hidden;
}

export function resolveProjectArcs(attempts: ArcAttemptInput[]): ProjectArcs {
  const byProblem = new Map<string, ArcAttemptInput[]>();
  for (const a of attempts) {
    if (!a.problemId) continue;
    const list = byProblem.get(a.problemId);
    if (list) list.push(a);
    else byProblem.set(a.problemId, [a]);
  }

  const sendIdByAbsorbedProjectId = new Map<string, string>();
  const historyBySendId = new Map<string, ProjectHistory>();

  for (const list of byProblem.values()) {
    const ordered = [...list].sort(
      (a, b) => a.performedAt.getTime() - b.performedAt.getTime() || a.id.localeCompare(b.id),
    );
    let open: ArcAttemptInput[] = [];
    for (const a of ordered) {
      if (a.outcome === "PROJECT") {
        open.push(a);
        continue;
      }
      // A repeat cannot close an arc: the climb was already sent once, so the
      // arc that mattered closed earlier. Falls neither open nor close one.
      if (open.length === 0 || a.isRepeat || !isSendOutcome(a.outcome)) continue;

      const sessions = new Set<string>();
      let tries = 0;
      for (const work of [...open, a]) {
        if (work.sessionLogId) sessions.add(work.sessionLogId);
        tries += Math.max(1, work.triesCount ?? 1);
      }
      historyBySendId.set(a.id, {
        sessions: sessions.size || open.length + 1,
        tries,
        firstAt: open[0].performedAt,
      });
      for (const work of open) sendIdByAbsorbedProjectId.set(work.id, a.id);
      // Projects logged after this send start a fresh arc rather than folding
      // into the one already closed.
      open = [];
    }
  }

  return { sendIdByAbsorbedProjectId, historyBySendId };
}

export type PyramidRow = {
  grade: string;
  system: ClimbGradeSystem;
  counts: Partial<Record<PyramidBucket, number>>;
  total: number;
};

export type PyramidRows = {
  boulderRows: PyramidRow[];
  yosemiteRows: PyramidRow[];
  allRows: PyramidRow[];
};

export function buildPyramidRows(
  attempts: PyramidAttemptInput[],
  arcs: ProjectArcs = EMPTY_PROJECT_ARCS,
): PyramidRows {
  const map = new Map<string, PyramidRow>();
  const absorbed = absorbedProjectIdsWithin(arcs, attempts);
  for (const a of attempts) {
    // Falls don't get pyramid bars — pyramid celebrates clean climbs.
    if (a.outcome === "FELL") continue;
    // An absorbed project is reported on the send that closed it, not twice.
    if (a.id && absorbed.has(a.id)) continue;
    const bucket = pyramidBucket(
      a.outcome,
      a.isRepeat,
      a.discipline,
      a.id ? arcs.historyBySendId.has(a.id) : false,
    );
    const key = `${a.gradeSystem}::${a.grade}`;
    const row = map.get(key) ?? {
      grade: a.grade,
      system: a.gradeSystem,
      counts: {},
      total: 0,
    };
    row.counts[bucket] = (row.counts[bucket] ?? 0) + 1;
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
  // A repeat lives in its own pyramid bucket, but it still means the grade
  // has been sent — otherwise an ascent whose first send predates the window
  // would drop out of "hardest sent" entirely.
  const countsAsSend = filter.has("SEND") || filter.has("REDPOINT");
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (countsAsSend && (rows[i].counts.REPEAT ?? 0) > 0) return rows[i].grade;
    if (countsAsSend && (rows[i].counts.SENT_PROJECT ?? 0) > 0) return rows[i].grade;
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
