import { prisma } from "@/lib/prisma";
import { addDaysYmd, diffYmdDays, toAppYmd } from "@/lib/dates";
import type { PrescriptionShape } from "@/lib/prescription";

export type PlanTarget = {
  sets: number | null;
  reps: number | null;
  seconds: number | null;
  weightLb: number | null;
};

export type PlanSet = { reps: number | null; seconds: number | null; weightLb: number | null };
export type PlanSession = { ymd: string; sets: PlanSet[] };
export type PlanAdjustment = { ymd: string; delta: number };
export type PlanChange = "new" | "up" | "down" | "same";

export type PlanWeekRecord = {
  weekStartYmd: string;
  week: number;
  target: PlanTarget | null;
  met: boolean;
  best: string | null;
};

export type PlanEvaluation = {
  week: number;
  target: PlanTarget | null;
  previousTarget: PlanTarget | null;
  change: PlanChange;
  history: PlanWeekRecord[];
  lastYmd: string | null;
  daysSinceLast: number | null;
  doneThisWeek: boolean;
  /** The most recent trained week, when its target was missed (the plan held). */
  heldBy: PlanWeekRecord | null;
  /** Long enough away that this week's increase is worth deferring. */
  suggestRepeat: boolean;
};

/** What the log form shows for a planned exercise. */
export type PlanNote = {
  text: string;
  tone: "up" | "held" | "same";
  /** Offered when it has been long enough away to defer this week's increase. */
  repeat?: { prescription: PrescriptionShape; text: string; reason: string };
  /** The plan's own target, restored when the repeat is undone. */
  planned?: PrescriptionShape;
};

export const REPEAT_AFTER_DAYS = 10;
const HISTORY_LOOKBACK_DAYS = 120;

export function mondayOfYmd(ymd: string): string {
  const day = new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
  return addDaysYmd(ymd, day === 0 ? -6 : 1 - day);
}

export function targetAt(targets: Array<PlanTarget & { week: number }>, week: number): PlanTarget | null {
  let found: (PlanTarget & { week: number }) | null = null;
  for (const t of targets) {
    if (t.week <= week && (!found || t.week > found.week)) found = t;
  }
  return found ? { sets: found.sets, reps: found.reps, seconds: found.seconds, weightLb: found.weightLb } : null;
}

export function readAdjustments(value: unknown): PlanAdjustment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const { ymd, delta } = row as Record<string, unknown>;
    if (typeof ymd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return [];
    if (typeof delta !== "number" || !Number.isInteger(delta) || delta === 0) return [];
    return [{ ymd, delta }];
  });
}

function setMeets(target: PlanTarget, set: PlanSet) {
  if (set.reps == null && set.seconds == null) return false;
  if (target.reps != null && (set.reps ?? 0) < target.reps) return false;
  if (target.seconds != null && (set.seconds ?? 0) < target.seconds) return false;
  if (target.weightLb != null && (set.weightLb ?? 0) < target.weightLb - 0.01) return false;
  return true;
}

export function sessionMeets(target: PlanTarget, session: PlanSession) {
  return session.sets.filter((set) => setMeets(target, set)).length >= (target.sets ?? 1);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}

export function formatPlanTarget(target: PlanTarget | null): string {
  if (!target) return "—";
  const metric = target.reps != null ? String(target.reps) : target.seconds != null ? `${target.seconds}s` : null;
  const volume = target.sets != null && metric ? `${target.sets}×${metric}` : target.sets != null ? `${target.sets} sets` : metric;
  const load = target.weightLb != null && target.weightLb > 0 ? `${formatNumber(target.weightLb)} lb` : null;
  return [load, volume].filter(Boolean).join(" · ") || "—";
}

function bestOf(sessions: PlanSession[]): string | null {
  let best: { weight: number; metric: number; unit: string; sets: number } | null = null;
  for (const session of sessions) {
    const logged = session.sets.filter((s) => s.reps != null || s.seconds != null);
    for (const set of logged) {
      const weight = set.weightLb ?? 0;
      const metric = set.reps ?? set.seconds ?? 0;
      if (!best || weight > best.weight || (weight === best.weight && metric > best.metric)) {
        best = { weight, metric, unit: set.reps != null ? "" : "s", sets: logged.length };
      }
    }
  }
  if (!best) return null;
  const head = best.weight > 0 ? `${formatNumber(best.weight)} × ${best.metric}${best.unit}` : `${best.metric}${best.unit}`;
  return `${head} · ${best.sets} set${best.sets === 1 ? "" : "s"}`;
}

export function compareTargets(next: PlanTarget | null, prev: PlanTarget | null): PlanChange {
  if (!next) return "same";
  if (!prev) return "new";
  const keys: Array<keyof PlanTarget> = ["weightLb", "reps", "seconds", "sets"];
  let up = false;
  let down = false;
  for (const key of keys) {
    const a = next[key];
    const b = prev[key];
    if (a == null || b == null || a === b) continue;
    if (a > b) up = true;
    else down = true;
  }
  if (up) return "up";
  if (down) return "down";
  return "same";
}

/**
 * Walk the trained weeks since the plan started: a week whose target was met
 * moves the plan on, any other trained week holds it, untrained weeks don't
 * exist. Manual adjustments apply to the week they were made in.
 */
export function evaluatePlan(input: {
  startYmd: string;
  todayYmd: string;
  targets: Array<PlanTarget & { week: number }>;
  sessions: PlanSession[];
  adjustments: PlanAdjustment[];
}): PlanEvaluation {
  const startWeek = mondayOfYmd(input.startYmd);
  const currentWeek = mondayOfYmd(input.todayYmd);
  const sessions = [...input.sessions].sort((a, b) => a.ymd.localeCompare(b.ymd));
  const adjustments = [...input.adjustments].sort((a, b) => a.ymd.localeCompare(b.ymd));

  const byWeek = new Map<string, PlanSession[]>();
  for (const session of sessions) {
    if (session.ymd < startWeek || session.ymd > input.todayYmd) continue;
    const key = mondayOfYmd(session.ymd);
    byWeek.set(key, [...(byWeek.get(key) ?? []), session]);
  }

  let week = 1;
  let adjIdx = 0;
  const applyThrough = (weekStart: string) => {
    while (adjIdx < adjustments.length && mondayOfYmd(adjustments[adjIdx].ymd) <= weekStart) {
      week = Math.max(1, week + adjustments[adjIdx].delta);
      adjIdx += 1;
    }
  };

  const history: PlanWeekRecord[] = [];
  for (const weekStart of [...byWeek.keys()].sort()) {
    if (weekStart >= currentWeek) continue;
    applyThrough(weekStart);
    const target = targetAt(input.targets, week);
    const weekSessions = byWeek.get(weekStart) ?? [];
    const met = target ? weekSessions.some((session) => sessionMeets(target, session)) : true;
    history.push({ weekStartYmd: weekStart, week, target, met, best: bestOf(weekSessions) });
    if (met) week += 1;
  }
  applyThrough(currentWeek);

  const target = targetAt(input.targets, week);
  const previousTarget = week > 1 ? targetAt(input.targets, week - 1) : null;
  const lastYmd = sessions.filter((s) => s.ymd <= input.todayYmd).at(-1)?.ymd ?? null;
  const daysSinceLast = lastYmd ? diffYmdDays(input.todayYmd, lastYmd) : null;
  const doneThisWeek = (byWeek.get(currentWeek)?.length ?? 0) > 0;
  const change = compareTargets(target, previousTarget);
  const lastRecord = history.at(-1) ?? null;

  return {
    week,
    target,
    previousTarget,
    change,
    history,
    lastYmd,
    daysSinceLast,
    doneThisWeek,
    heldBy: lastRecord && !lastRecord.met ? lastRecord : null,
    suggestRepeat:
      change === "up" && !doneThisWeek && daysSinceLast != null && daysSinceLast > REPEAT_AFTER_DAYS,
  };
}

export function planTargetToPrescription(target: PlanTarget): PrescriptionShape {
  return {
    sets: target.sets,
    repsMin: target.reps,
    repsMax: target.reps,
    seconds: target.seconds,
    load: target.weightLb,
    loadUnit: "LB",
    tempo: null,
    restSec: null,
    cue: null,
  };
}

export async function loadPlanSessions(exerciseIds: string[], sinceYmd: string) {
  const rows = exerciseIds.length
    ? await prisma.sessionExercise.findMany({
        where: {
          exerciseId: { in: exerciseIds },
          routineLog: { performedAt: { gte: new Date(`${sinceYmd}T00:00:00.000Z`) } },
        },
        select: {
          exerciseId: true,
          routineLog: { select: { performedAt: true } },
          sets: { select: { reps: true, seconds: true, weightLb: true } },
        },
      })
    : [];
  const byExercise = new Map<string, PlanSession[]>();
  for (const row of rows) {
    const list = byExercise.get(row.exerciseId) ?? [];
    list.push({ ymd: toAppYmd(row.routineLog.performedAt), sets: row.sets });
    byExercise.set(row.exerciseId, list);
  }
  return byExercise;
}

export type PlanForLog = {
  itemId: string;
  programName: string;
  evaluation: PlanEvaluation;
};

/** Active plan targets for the given exercises, from any active program. */
export async function loadPlansForExercises(exerciseIds: string[], todayYmd: string) {
  const items = exerciseIds.length
    ? await prisma.programPlanItem.findMany({
        where: { exerciseId: { in: exerciseIds }, isActive: true, program: { status: "ACTIVE" } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          exerciseId: true,
          startYmd: true,
          adjustments: true,
          program: { select: { name: true } },
          targets: { select: { week: true, sets: true, reps: true, seconds: true, weightLb: true } },
        },
      })
    : [];
  const result = new Map<string, PlanForLog>();
  if (items.length === 0) return result;

  const since = addDaysYmd(todayYmd, -HISTORY_LOOKBACK_DAYS);
  const earliestStart = items.reduce((min, item) => (item.startYmd < min ? item.startYmd : min), since);
  const sessions = await loadPlanSessions([...new Set(items.map((i) => i.exerciseId))], mondayOfYmd(earliestStart));

  for (const item of items) {
    if (result.has(item.exerciseId)) continue;
    result.set(item.exerciseId, {
      itemId: item.id,
      programName: item.program.name,
      evaluation: evaluatePlan({
        startYmd: item.startYmd,
        todayYmd,
        targets: item.targets,
        sessions: sessions.get(item.exerciseId) ?? [],
        adjustments: readAdjustments(item.adjustments),
      }),
    });
  }
  return result;
}

export function planNoteFor(plan: PlanForLog): PlanNote | undefined {
  const { evaluation, programName } = plan;
  if (!evaluation.target) return undefined;
  const head = `${programName} · plan wk ${evaluation.week}`;
  const planned = planTargetToPrescription(evaluation.target);
  const repeat =
    evaluation.suggestRepeat && evaluation.previousTarget
      ? {
          prescription: planTargetToPrescription(evaluation.previousTarget),
          text: formatPlanTarget(evaluation.previousTarget),
          reason: `${evaluation.daysSinceLast} days since you last did this. Repeat last week before moving up?`,
        }
      : undefined;
  if (evaluation.change === "up") {
    return { text: `${head} · ↑ from ${formatPlanTarget(evaluation.previousTarget)}`, tone: "up", planned, repeat };
  }
  if (evaluation.heldBy) {
    return { text: `${head} · held, last time ${evaluation.heldBy.best ?? "short"}`, tone: "held", planned };
  }
  return { text: head, tone: "same", planned };
}
