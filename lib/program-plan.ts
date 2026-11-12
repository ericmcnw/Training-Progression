import { prisma } from "@/lib/prisma";
import { addDaysYmd, diffYmdDays, toAppYmd } from "@/lib/dates";
import type { PrescriptionShape } from "@/lib/prescription";
import { getActivityEntry } from "@/lib/activity-families";
import { getSyntheticSportRoutineId } from "@/lib/synthetic-sport-routines";
import {
  EXERCISE_PARAM_KEYS,
  exerciseParamDef,
  formatExerciseParams,
  readExerciseParams,
  type ExerciseParamValues,
} from "@/lib/exercise-params";

export type PlanKind = "EXERCISE" | "ACTIVITY" | "SPORT";

export type PlanTarget = {
  sets: number | null;
  reps: number | null;
  seconds: number | null;
  weightLb: number | null;
  distanceMi: number | null;
  durationSec: number | null;
  sessions: number | null;
  note: string | null;
  params: ExerciseParamValues | null;
};

export type PlanTargetRow = Omit<PlanTarget, "params"> & { week: number; params: unknown };

export type PlanSet = { reps: number | null; seconds: number | null; weightLb: number | null };
export type PlanSession = {
  ymd: string;
  sets: PlanSet[];
  params: ExerciseParamValues;
  distanceMi: number | null;
  durationSec: number | null;
};
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
  /** Qualifying sessions so far this week (activity and sport lanes). */
  sessionsThisWeek: number;
  /** The most recent trained week, when its target was missed (the plan held). */
  heldBy: PlanWeekRecord | null;
  /** Long enough away that this week's increase is worth deferring. */
  suggestRepeat: boolean;
};

/** What a log form shows for a planned item. */
export type PlanNote = {
  text: string;
  tone: "up" | "held" | "same";
  /** Offered when it has been long enough away to defer this week's increase. */
  repeat?: { prescription: PrescriptionShape; text: string; reason: string };
  /** The plan's own target, restored when the repeat is undone. */
  planned?: PrescriptionShape;
  /** Setup the plan asks for, prefilled into the exercise's setup fields. */
  params?: ExerciseParamValues;
};

export const REPEAT_AFTER_DAYS = 10;
const HISTORY_LOOKBACK_DAYS = 120;

export function mondayOfYmd(ymd: string): string {
  const day = new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
  return addDaysYmd(ymd, day === 0 ? -6 : 1 - day);
}

function readParams(raw: unknown): ExerciseParamValues | null {
  const params = readExerciseParams(raw);
  return Object.keys(params).length > 0 ? params : null;
}

export function toPlanTarget(row: PlanTargetRow): PlanTarget {
  return {
    sets: row.sets,
    reps: row.reps,
    seconds: row.seconds,
    weightLb: row.weightLb,
    distanceMi: row.distanceMi,
    durationSec: row.durationSec,
    sessions: row.sessions,
    note: row.note,
    params: readParams(row.params),
  };
}

export function targetAt(targets: PlanTargetRow[], week: number): PlanTarget | null {
  let found: PlanTargetRow | null = null;
  for (const t of targets) {
    if (t.week <= week && (!found || t.week > found.week)) found = t;
  }
  return found ? toPlanTarget(found) : null;
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

function paramsMeet(target: ExerciseParamValues | null, actual: ExerciseParamValues) {
  if (!target) return true;
  for (const key of EXERCISE_PARAM_KEYS) {
    const want = target[key];
    if (want === undefined) continue;
    const got = actual[key];
    if (got === undefined) return false;
    const harder = exerciseParamDef(key)?.harder;
    if (harder === "lower" ? got > want : harder === "higher" ? got < want : got !== want) return false;
  }
  return true;
}

function setMeets(target: PlanTarget, set: PlanSet) {
  if (set.reps == null && set.seconds == null) return false;
  if (target.reps != null && (set.reps ?? 0) < target.reps) return false;
  if (target.seconds != null && (set.seconds ?? 0) < target.seconds) return false;
  if (target.weightLb != null && (set.weightLb ?? 0) < target.weightLb - 0.01) return false;
  return true;
}

function sessionQualifies(kind: PlanKind, target: PlanTarget, session: PlanSession) {
  if (kind === "EXERCISE") {
    return paramsMeet(target.params, session.params) && session.sets.filter((set) => setMeets(target, set)).length >= (target.sets ?? 1);
  }
  if (kind === "ACTIVITY") {
    if (target.distanceMi != null && (session.distanceMi ?? 0) < target.distanceMi - 0.005) return false;
    if (target.durationSec != null && (session.durationSec ?? 0) < target.durationSec) return false;
    return true;
  }
  return true;
}

function weekMet(kind: PlanKind, target: PlanTarget, sessions: PlanSession[]) {
  const qualifying = sessions.filter((s) => sessionQualifies(kind, target, s)).length;
  return kind === "EXERCISE" ? qualifying >= 1 : qualifying >= (target.sessions ?? 1);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}

export function formatDuration(sec: number) {
  const min = Math.round(sec / 60);
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ""}`.trim() : `${min} min`;
}

export function formatPlanTarget(target: PlanTarget | null, kind: PlanKind = "EXERCISE"): string {
  if (!target) return "—";
  if (kind === "SPORT") {
    const count = target.sessions != null ? `${target.sessions}× a week` : null;
    return [count, target.note].filter(Boolean).join(" · ") || "—";
  }
  if (kind === "ACTIVITY") {
    const each = [
      target.distanceMi != null ? `${formatNumber(target.distanceMi)} mi` : null,
      target.durationSec != null ? formatDuration(target.durationSec) : null,
    ].filter(Boolean).join(" · ");
    const count = target.sessions != null && target.sessions > 1 ? `${target.sessions}×` : null;
    return [count && each ? `${count} ${each}` : count ?? each, target.note].filter(Boolean).join(" · ") || "—";
  }
  const metric = target.reps != null ? String(target.reps) : target.seconds != null ? `${target.seconds}s` : null;
  const volume = target.sets != null && metric ? `${target.sets}×${metric}` : target.sets != null ? `${target.sets} sets` : metric;
  const load = target.weightLb != null && target.weightLb > 0 ? `${formatNumber(target.weightLb)} lb` : null;
  const setup = target.params ? formatExerciseParams(target.params) : null;
  return [load, setup, volume].filter(Boolean).join(" · ") || "—";
}

function bestOf(kind: PlanKind, sessions: PlanSession[]): string | null {
  if (sessions.length === 0) return null;
  if (kind === "SPORT") return `${sessions.length} session${sessions.length === 1 ? "" : "s"}`;
  if (kind === "ACTIVITY") {
    const longest = sessions.reduce((a, b) => ((b.distanceMi ?? 0) > (a.distanceMi ?? 0) ? b : a));
    const head = longest.distanceMi ? `${formatNumber(longest.distanceMi)} mi` : longest.durationSec ? formatDuration(longest.durationSec) : "logged";
    return sessions.length > 1 ? `${head} · ${sessions.length} sessions` : head;
  }
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
  if (!best) return "logged";
  const head = best.weight > 0 ? `${formatNumber(best.weight)} × ${best.metric}${best.unit}` : `${best.metric}${best.unit}`;
  return `${head} · ${best.sets} set${best.sets === 1 ? "" : "s"}`;
}

const NUMERIC_KEYS = ["weightLb", "reps", "seconds", "sets", "distanceMi", "durationSec", "sessions"] as const;

export function compareTargets(next: PlanTarget | null, prev: PlanTarget | null): PlanChange {
  if (!next) return "same";
  if (!prev) return "new";
  let up = false;
  let down = false;
  for (const key of NUMERIC_KEYS) {
    const a = next[key];
    const b = prev[key];
    if (a == null || b == null || a === b) continue;
    if (a > b) up = true;
    else down = true;
  }
  for (const key of EXERCISE_PARAM_KEYS) {
    const a = next.params?.[key];
    const b = prev.params?.[key];
    if (a === undefined || b === undefined || a === b) continue;
    const harder = exerciseParamDef(key)?.harder;
    if (!harder) continue;
    if ((harder === "lower") === (a < b)) up = true;
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
  kind?: PlanKind;
  startYmd: string;
  todayYmd: string;
  targets: PlanTargetRow[];
  sessions: PlanSession[];
  adjustments: PlanAdjustment[];
}): PlanEvaluation {
  const kind = input.kind ?? "EXERCISE";
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
    const met = target ? weekMet(kind, target, weekSessions) : true;
    history.push({ weekStartYmd: weekStart, week, target, met, best: bestOf(kind, weekSessions) });
    if (met) week += 1;
  }
  applyThrough(currentWeek);

  const target = targetAt(input.targets, week);
  const previousTarget = week > 1 ? targetAt(input.targets, week - 1) : null;
  const lastYmd = sessions.filter((s) => s.ymd <= input.todayYmd).at(-1)?.ymd ?? null;
  const daysSinceLast = lastYmd ? diffYmdDays(input.todayYmd, lastYmd) : null;
  const thisWeek = byWeek.get(currentWeek) ?? [];
  const sessionsThisWeek = target ? thisWeek.filter((s) => sessionQualifies(kind, target, s)).length : thisWeek.length;
  const doneThisWeek = kind === "EXERCISE" ? thisWeek.length > 0 : target ? weekMet(kind, target, thisWeek) : thisWeek.length > 0;
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
    sessionsThisWeek,
    heldBy: lastRecord && !lastRecord.met ? lastRecord : null,
    suggestRepeat:
      change === "up" && thisWeek.length === 0 && daysSinceLast != null && daysSinceLast > REPEAT_AFTER_DAYS,
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
    cue: target.note,
  };
}

// ── Loading the sessions each kind of item is judged on ─────────────────────

export type PlanItemRef = {
  id: string;
  kind: PlanKind;
  exerciseId: string | null;
  activityTypeId: string | null;
  enduranceFamilyId: string | null;
  sportSlug: string | null;
};

export const PLAN_TARGET_SELECT = {
  week: true,
  sets: true,
  reps: true,
  seconds: true,
  weightLb: true,
  distanceMi: true,
  durationSec: true,
  sessions: true,
  note: true,
  params: true,
} as const;

export const PLAN_ITEM_SELECT = {
  id: true,
  kind: true,
  exerciseId: true,
  activityTypeId: true,
  enduranceFamilyId: true,
  sportSlug: true,
  label: true,
  phaseEnd: true,
  routineId: true,
  startYmd: true,
  adjustments: true,
  exercise: { select: { name: true, unit: true, supportsWeight: true, paramKeys: true } },
  activityType: { select: { name: true } },
  enduranceFamily: { select: { name: true } },
  targets: { orderBy: { week: "asc" as const }, select: PLAN_TARGET_SELECT },
} as const;

export function planItemName(item: {
  kind: PlanKind;
  label: string | null;
  sportSlug: string | null;
  exercise: { name: string } | null;
  activityType: { name: string } | null;
  enduranceFamily: { name: string } | null;
}) {
  if (item.label?.trim()) return item.label.trim();
  if (item.kind === "EXERCISE") return item.exercise?.name ?? "Exercise";
  if (item.kind === "ACTIVITY") return item.activityType?.name ?? (item.enduranceFamily ? `Any ${item.enduranceFamily.name.toLowerCase()}` : "Activity");
  return getActivityEntry(item.sportSlug ?? "")?.label ?? item.sportSlug ?? "Sport";
}

function sinceDate(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export async function loadPlanSessions(exerciseIds: string[], sinceYmd: string) {
  const rows = exerciseIds.length
    ? await prisma.sessionExercise.findMany({
        where: {
          exerciseId: { in: exerciseIds },
          routineLog: { performedAt: { gte: sinceDate(sinceYmd) } },
        },
        select: {
          exerciseId: true,
          params: true,
          routineLog: { select: { performedAt: true } },
          sets: { select: { reps: true, seconds: true, weightLb: true } },
        },
      })
    : [];
  const byExercise = new Map<string, PlanSession[]>();
  for (const row of rows) {
    const list = byExercise.get(row.exerciseId) ?? [];
    list.push({
      ymd: toAppYmd(row.routineLog.performedAt),
      sets: row.sets,
      params: readExerciseParams(row.params),
      distanceMi: null,
      durationSec: null,
    });
    byExercise.set(row.exerciseId, list);
  }
  return byExercise;
}

/** Endurance logs carry an activity type directly; older ones only through their routine. */
async function loadActivityLogs(items: PlanItemRef[], sinceYmd: string) {
  const typeIds = [...new Set(items.map((i) => i.activityTypeId).filter((id): id is string => Boolean(id)))];
  const familyIds = [...new Set(items.map((i) => i.enduranceFamilyId).filter((id): id is string => Boolean(id)))];
  if (typeIds.length === 0 && familyIds.length === 0) return [];
  const rows = await prisma.routineLog.findMany({
    where: {
      performedAt: { gte: sinceDate(sinceYmd) },
      OR: [
        ...(typeIds.length ? [{ activityTypeId: { in: typeIds } }, { activityTypeId: null, routine: { activityTypeId: { in: typeIds } } }] : []),
        ...(familyIds.length
          ? [{ activityType: { familyId: { in: familyIds } } }, { activityTypeId: null, routine: { activityType: { familyId: { in: familyIds } } } }]
          : []),
      ],
    },
    select: {
      performedAt: true,
      distanceMi: true,
      durationSec: true,
      activityTypeId: true,
      activityType: { select: { familyId: true } },
      routine: { select: { activityTypeId: true, activityType: { select: { familyId: true } } } },
    },
  });
  return rows.map((row) => ({
    ymd: toAppYmd(row.performedAt),
    distanceMi: row.distanceMi,
    durationSec: row.durationSec,
    typeId: row.activityTypeId ?? row.routine.activityTypeId,
    familyId: row.activityType?.familyId ?? row.routine.activityType?.familyId ?? null,
  }));
}

/** Sport sessions: the per-sport synthetic routine plus older routines tagged with the sport. */
async function loadSportLogs(slugs: string[], sinceYmd: string) {
  if (slugs.length === 0) return new Map<string, string[]>();
  const tagged = await prisma.routine.findMany({
    where: { isPlaceholder: false, metadataGroups: { some: { group: { slug: { in: slugs } } } } },
    select: { id: true, metadataGroups: { select: { group: { select: { slug: true } } } } },
  });
  const slugByRoutine = new Map<string, string>();
  for (const slug of slugs) slugByRoutine.set(getSyntheticSportRoutineId(slug), slug);
  for (const routine of tagged) {
    const slug = routine.metadataGroups.map((m) => m.group?.slug).find((s): s is string => Boolean(s && slugs.includes(s)));
    if (slug && !slugByRoutine.has(routine.id)) slugByRoutine.set(routine.id, slug);
  }
  const rows = await prisma.routineLog.findMany({
    where: { performedAt: { gte: sinceDate(sinceYmd) }, routineId: { in: [...slugByRoutine.keys()] } },
    select: { routineId: true, performedAt: true },
  });
  const bySlug = new Map<string, string[]>();
  for (const row of rows) {
    const slug = slugByRoutine.get(row.routineId);
    if (!slug) continue;
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), toAppYmd(row.performedAt)]);
  }
  return bySlug;
}

/** The sessions each item is judged on, keyed by item id. */
export async function loadItemSessions(items: PlanItemRef[], sinceYmd: string) {
  const exerciseItems = items.filter((i) => i.kind === "EXERCISE" && i.exerciseId);
  const activityItems = items.filter((i) => i.kind === "ACTIVITY");
  const sportItems = items.filter((i) => i.kind === "SPORT" && i.sportSlug);
  const [exerciseSessions, activityLogs, sportLogs] = await Promise.all([
    loadPlanSessions([...new Set(exerciseItems.map((i) => i.exerciseId!))], sinceYmd),
    loadActivityLogs(activityItems, sinceYmd),
    loadSportLogs([...new Set(sportItems.map((i) => i.sportSlug!))], sinceYmd),
  ]);

  const result = new Map<string, PlanSession[]>();
  for (const item of exerciseItems) result.set(item.id, exerciseSessions.get(item.exerciseId!) ?? []);
  for (const item of activityItems) {
    result.set(
      item.id,
      activityLogs
        .filter((log) => (item.activityTypeId ? log.typeId === item.activityTypeId : log.familyId === item.enduranceFamilyId))
        .map((log) => ({ ymd: log.ymd, sets: [], params: {}, distanceMi: log.distanceMi, durationSec: log.durationSec })),
    );
  }
  for (const item of sportItems) {
    result.set(
      item.id,
      (sportLogs.get(item.sportSlug!) ?? []).map((ymd) => ({ ymd, sets: [], params: {}, distanceMi: null, durationSec: null })),
    );
  }
  return result;
}

export function lookbackStart(items: Array<{ startYmd: string }>, todayYmd: string) {
  const since = addDaysYmd(todayYmd, -HISTORY_LOOKBACK_DAYS);
  return mondayOfYmd(items.reduce((min, item) => (item.startYmd < min ? item.startYmd : min), since));
}

// ── What the log forms read ─────────────────────────────────────────────────

export type PlanForLog = {
  itemId: string;
  kind: PlanKind;
  exerciseId: string | null;
  activityTypeId: string | null;
  enduranceFamilyId: string | null;
  sportSlug: string | null;
  name: string;
  programName: string;
  evaluation: PlanEvaluation;
};

type LogItemFilter =
  | { kind: "EXERCISE"; exerciseIds: string[] }
  | { kind: "ACTIVITY" }
  | { kind: "SPORT"; sportSlugs: string[] };

/** Active plan items of one kind from any active program, evaluated for today. */
export async function loadPlansForLog(filter: LogItemFilter, todayYmd: string): Promise<PlanForLog[]> {
  if (filter.kind === "EXERCISE" && filter.exerciseIds.length === 0) return [];
  if (filter.kind === "SPORT" && filter.sportSlugs.length === 0) return [];
  const items = await prisma.programPlanItem.findMany({
    where: {
      isActive: true,
      kind: filter.kind,
      program: { status: "ACTIVE" },
      ...(filter.kind === "EXERCISE" ? { exerciseId: { in: filter.exerciseIds } } : {}),
      ...(filter.kind === "SPORT" ? { sportSlug: { in: filter.sportSlugs } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { ...PLAN_ITEM_SELECT, program: { select: { name: true } } },
  });
  if (items.length === 0) return [];
  const sessions = await loadItemSessions(items, lookbackStart(items, todayYmd));
  return items.map((item) => ({
    itemId: item.id,
    kind: item.kind,
    exerciseId: item.exerciseId,
    activityTypeId: item.activityTypeId,
    enduranceFamilyId: item.enduranceFamilyId,
    sportSlug: item.sportSlug,
    name: planItemName(item),
    programName: item.program.name,
    evaluation: evaluatePlan({
      kind: item.kind,
      startYmd: item.startYmd,
      todayYmd,
      targets: item.targets,
      sessions: sessions.get(item.id) ?? [],
      adjustments: readAdjustments(item.adjustments),
    }),
  }));
}

/** Exercise plans keyed by exercise; the first active program to plan it owns it. */
export async function loadPlansForExercises(exerciseIds: string[], todayYmd: string) {
  const plans = await loadPlansForLog({ kind: "EXERCISE", exerciseIds }, todayYmd);
  const result = new Map<string, PlanForLog>();
  for (const plan of plans) {
    if (plan.exerciseId && !result.has(plan.exerciseId)) result.set(plan.exerciseId, plan);
  }
  return result;
}

export function planNoteFor(plan: PlanForLog): PlanNote | undefined {
  const { evaluation, programName } = plan;
  if (!evaluation.target) return undefined;
  const head = `${programName} · plan wk ${evaluation.week}`;
  const planned = planTargetToPrescription(evaluation.target);
  const params = evaluation.target.params ?? undefined;
  const repeat =
    evaluation.suggestRepeat && evaluation.previousTarget
      ? {
          prescription: planTargetToPrescription(evaluation.previousTarget),
          text: formatPlanTarget(evaluation.previousTarget, plan.kind),
          reason: `${evaluation.daysSinceLast} days since you last did this. Repeat last week before moving up?`,
        }
      : undefined;
  if (evaluation.change === "up") {
    return { text: `${head} · ↑ from ${formatPlanTarget(evaluation.previousTarget, plan.kind)}`, tone: "up", planned, repeat, params };
  }
  if (evaluation.heldBy) {
    return { text: `${head} · held, last time ${evaluation.heldBy.best ?? "short"}`, tone: "held", planned, params };
  }
  return { text: head, tone: "same", planned, params };
}

/** One line for an activity or sport log form: what this week asks for. */
export function planLineFor(plan: PlanForLog): { text: string; tone: "up" | "held" | "same" | "done" } | null {
  const { evaluation } = plan;
  if (!evaluation.target) return null;
  const target = formatPlanTarget(evaluation.target, plan.kind);
  const need = plan.kind === "EXERCISE" ? 1 : evaluation.target.sessions ?? 1;
  const progress = plan.kind === "EXERCISE" ? "" : ` · ${evaluation.sessionsThisWeek} of ${need} this week`;
  const tone = evaluation.doneThisWeek ? "done" : evaluation.change === "up" ? "up" : evaluation.heldBy ? "held" : "same";
  const repeat = evaluation.suggestRepeat && evaluation.previousTarget
    ? ` · ${evaluation.daysSinceLast} days away, last week was ${formatPlanTarget(evaluation.previousTarget, plan.kind)}`
    : "";
  return { text: `${plan.name}: ${target}${tone === "up" ? " ↑" : ""}${progress}${repeat}`, tone };
}

// ── This week, across items ──────────────────────────────────────────────────

export type WeekPlanLine = {
  itemId: string;
  kind: PlanKind;
  name: string;
  routineId: string | null;
  target: string;
  change: PlanChange;
  /** "1 of 2" for activity and sport lanes; null for exercises. */
  progress: string | null;
  tone: "up" | "held" | "same" | "done" | "away";
};

type WeekItem = PlanItemRef & {
  label: string | null;
  routineId: string | null;
  startYmd: string;
  adjustments: unknown;
  targets: PlanTargetRow[];
  exercise: { name: string } | null;
  activityType: { name: string } | null;
  enduranceFamily: { name: string } | null;
};

export async function weekPlanLines(items: WeekItem[], todayYmd: string): Promise<WeekPlanLine[]> {
  if (items.length === 0) return [];
  const sessions = await loadItemSessions(items, lookbackStart(items, todayYmd));
  return items.map((item) => {
    const evaluation = evaluatePlan({
      kind: item.kind,
      startYmd: item.startYmd,
      todayYmd,
      targets: item.targets,
      sessions: sessions.get(item.id) ?? [],
      adjustments: readAdjustments(item.adjustments),
    });
    const need = evaluation.target?.sessions ?? 1;
    return {
      itemId: item.id,
      kind: item.kind,
      name: planItemName(item),
      routineId: item.routineId,
      target: formatPlanTarget(evaluation.target, item.kind),
      change: evaluation.change,
      progress: item.kind === "EXERCISE" ? null : `${Math.min(evaluation.sessionsThisWeek, need)} of ${need}`,
      tone: evaluation.doneThisWeek
        ? "done"
        : evaluation.suggestRepeat
          ? "away"
          : evaluation.change === "up"
            ? "up"
            : evaluation.heldBy
              ? "held"
              : "same",
    };
  });
}

export type LogPlanLine = {
  activityTypeId: string | null;
  enduranceFamilyId: string | null;
  sportSlug: string | null;
  text: string;
  tone: "up" | "held" | "same" | "done";
};

export function logPlanLines(plans: PlanForLog[]): LogPlanLine[] {
  return plans.flatMap((plan) => {
    const line = planLineFor(plan);
    return line
      ? [{ activityTypeId: plan.activityTypeId, enduranceFamilyId: plan.enduranceFamilyId, sportSlug: plan.sportSlug, ...line }]
      : [];
  });
}

