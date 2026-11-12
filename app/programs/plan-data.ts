import { prisma } from "@/lib/prisma";
import { isWorkoutKind } from "@/lib/routines";
import { addDaysYmd, toAppYmd, todayAppYmd } from "@/lib/dates";
import { activitiesByFamily, getActivityEntry } from "@/lib/activity-families";
import { getSyntheticSportRoutineId } from "@/lib/synthetic-sport-routines";
import { exerciseParamDef, exerciseParamKeys, type ExerciseParamKey } from "@/lib/exercise-params";
import {
  compareTargets,
  evaluatePlan,
  formatPlanTarget,
  loadItemSessions,
  loadPlanSessions,
  lookbackStart,
  mondayOfYmd,
  planItemName,
  readAdjustments,
  targetAt,
  PLAN_ITEM_SELECT,
  type PlanChange,
  type PlanKind,
  type PlanTarget,
} from "@/lib/program-plan";

const PAST_WEEKS_SHOWN = 3;
const FUTURE_WEEKS_SHOWN = 5;
const LOOKBACK_DAYS = 120;

export type PlanCell = {
  key: string;
  label: string;
  value: string;
  tone: "met" | "held" | "now" | "up" | "down" | "same" | "new";
  tag: string | null;
  /** Editable cells carry the plan week they edit. */
  week: number | null;
  target: PlanTarget | null;
};

export type PlanParamField = { key: ExerciseParamKey; label: string; unit: string };

export type PlanBoardItem = {
  id: string;
  kind: PlanKind;
  name: string;
  hasCustomLabel: boolean;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  paramFields: PlanParamField[];
  phaseEnd: "ASK" | "KEEP" | "DROP";
  serves: string | null;
  week: number;
  status: string;
  statusTone: "up" | "held" | "same" | "done" | "away";
  cells: PlanCell[];
  /** Weeks that hold an explicit target row (only those can be cleared). */
  explicitWeeks: number[];
};

export type PlanBoardCandidate =
  | { kind: "EXERCISE"; key: string; exerciseId: string; name: string; lastLabel: string; plannedElsewhere: string | null }
  | { kind: "ACTIVITY"; key: string; activityTypeId: string | null; enduranceFamilyId: string | null; name: string; lastLabel: string; plannedElsewhere: null }
  | { kind: "SPORT"; key: string; sportSlug: string; name: string; lastLabel: string; plannedElsewhere: string | null };

export type PlanBoardGroup = {
  key: string;
  kind: PlanKind;
  routineId: string | null;
  title: string;
  items: PlanBoardItem[];
  candidates: PlanBoardCandidate[];
};

export type PlanBoard = {
  groups: PlanBoardGroup[];
  /** Strength routines not yet linked to this program. */
  linkableRoutines: Array<{ id: string; name: string }>;
  /** The exercise library, for adding something new to a routine. */
  library: Array<{ id: string; name: string }>;
};

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function dateLabel(ymd: string) {
  return shortDate.format(new Date(`${ymd}T00:00:00.000Z`));
}

function changeTag(change: PlanChange): string | null {
  if (change === "up") return "↑";
  if (change === "down") return "↓";
  if (change === "new") return "start";
  return null;
}

function lastLabelOf(ymds: string[]) {
  const last = [...ymds].sort().at(-1);
  return last ? `last ${dateLabel(last)}` : `not in the last ${LOOKBACK_DAYS} days`;
}

export async function getProgramPlanBoard(programId: string): Promise<PlanBoard | null> {
  const today = todayAppYmd();
  const currentWeekStart = mondayOfYmd(today);
  const program = await prisma.focus.findFirst({
    where: { id: programId },
    select: {
      id: true,
      pursuitKey: true,
      routineLinks: {
        orderBy: { sortOrder: "asc" },
        select: {
          routine: {
            select: {
              id: true,
              name: true,
              isActive: true,
              exercises: {
                orderBy: { sortOrder: "asc" },
                select: { exercise: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
      planItems: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: PLAN_ITEM_SELECT },
    },
  });
  if (!program) return null;

  const routines = program.routineLinks.map((link) => link.routine).filter((r) => r.isActive);
  const routineExerciseIds = routines.flatMap((r) => r.exercises.map((e) => e.exercise.id));
  const since = addDaysYmd(today, -LOOKBACK_DAYS);

  const [itemSessions, routineSessions, elsewhere, library, activityTypes, families, sportLogs, stepRows, allRoutines] = await Promise.all([
    loadItemSessions(program.planItems, lookbackStart(program.planItems, today)),
    loadPlanSessions(routineExerciseIds, since),
    prisma.programPlanItem.findMany({
      where: { isActive: true, programId: { not: programId }, program: { status: "ACTIVE" } },
      select: { exerciseId: true, sportSlug: true, program: { select: { name: true } } },
    }),
    prisma.exercise.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.activityType.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, familyId: true, routineLogs: { where: { performedAt: { gte: new Date(`${since}T00:00:00.000Z`) } }, select: { performedAt: true } } },
    }),
    prisma.enduranceFamily.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.routineLog.findMany({
      where: { performedAt: { gte: new Date(`${since}T00:00:00.000Z`) }, routineId: { startsWith: "sports-", endsWith: "-synthetic" } },
      select: { routineId: true, performedAt: true },
    }),
    prisma.progressionMilestone.findMany({
      where: { status: "ACTIVE", scopeKind: "EXERCISE", scopeRef: { in: program.planItems.map((i) => i.exerciseId).filter((id): id is string => Boolean(id)) } },
      orderBy: { sortOrder: "asc" },
      select: { scopeRef: true, label: true },
    }),
    prisma.routine.findMany({
      where: { isActive: true, isDeleted: false, isPlaceholder: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true },
    }),
  ]);
  const exerciseElsewhere = new Map(elsewhere.filter((r) => r.exerciseId).map((r) => [r.exerciseId!, r.program.name]));
  const sportElsewhere = new Map(elsewhere.filter((r) => r.sportSlug).map((r) => [r.sportSlug!, r.program.name]));
  const servesByExercise = new Map<string, string>();
  for (const row of stepRows) if (row.scopeRef && !servesByExercise.has(row.scopeRef)) servesByExercise.set(row.scopeRef, row.label);

  const items = program.planItems.map((item) => {
    const kind = item.kind;
    const evaluation = evaluatePlan({
      kind,
      startYmd: item.startYmd,
      todayYmd: today,
      targets: item.targets,
      sessions: itemSessions.get(item.id) ?? [],
      adjustments: readAdjustments(item.adjustments),
    });

    const past: PlanCell[] = evaluation.history.slice(-PAST_WEEKS_SHOWN).map((record) => ({
      key: `past-${record.weekStartYmd}`,
      label: dateLabel(record.weekStartYmd),
      value: record.best ?? "logged",
      tone: record.met ? "met" : "held",
      tag: record.met ? "✓ met" : "held",
      week: null,
      target: record.target,
    }));
    const now: PlanCell = {
      key: "now",
      label: "This week",
      value: formatPlanTarget(evaluation.target, kind),
      tone: "now",
      tag: changeTag(evaluation.change),
      week: evaluation.week,
      target: evaluation.target,
    };
    const future: PlanCell[] = Array.from({ length: FUTURE_WEEKS_SHOWN }, (_, i) => {
      const week = evaluation.week + i + 1;
      const target = targetAt(item.targets, week);
      const change = compareTargets(target, targetAt(item.targets, week - 1));
      return {
        key: `future-${week}`,
        label: dateLabel(addDaysYmd(currentWeekStart, 7 * (i + 1))),
        value: formatPlanTarget(target, kind),
        tone: change === "up" ? "up" : change === "down" ? "down" : "same",
        tag: changeTag(change),
        week,
        target,
      };
    });

    const targetText = formatPlanTarget(evaluation.target, kind);
    const need = kind === "EXERCISE" ? 1 : evaluation.target?.sessions ?? 1;
    let status: string;
    let statusTone: PlanBoardItem["statusTone"];
    if (evaluation.doneThisWeek) {
      status = kind === "EXERCISE" ? `Done this week · target ${targetText}` : `Done this week · ${evaluation.sessionsThisWeek} of ${need}`;
      statusTone = "done";
    } else if (evaluation.suggestRepeat) {
      status = `${evaluation.daysSinceLast} days since you last did it. The log will offer last week's numbers first.`;
      statusTone = "away";
    } else if (evaluation.heldBy) {
      status = `Held: last time ${evaluation.heldBy.best ?? "logged"}, short of ${formatPlanTarget(evaluation.heldBy.target, kind)}`;
      statusTone = "held";
    } else {
      const progress = kind === "EXERCISE" ? "" : ` · ${evaluation.sessionsThisWeek} of ${need} so far`;
      status = evaluation.change === "up"
        ? `This week: ${targetText}, up from ${formatPlanTarget(evaluation.previousTarget, kind)}${progress}`
        : `This week: ${targetText}${progress}`;
      statusTone = evaluation.change === "up" ? "up" : "same";
    }

    return {
      routineId: item.routineId,
      board: {
        id: item.id,
        kind,
        name: planItemName(item),
        hasCustomLabel: Boolean(item.label?.trim()),
        unit: item.exercise?.unit === "TIME" ? "TIME" : "REPS",
        supportsWeight: item.exercise?.supportsWeight ?? false,
        paramFields: exerciseParamKeys(item.exercise?.paramKeys).flatMap((key) => {
          const def = exerciseParamDef(key);
          return def ? [{ key, label: def.label, unit: def.unit }] : [];
        }),
        phaseEnd: item.phaseEnd,
        serves: item.exerciseId ? servesByExercise.get(item.exerciseId) ?? null : null,
        week: evaluation.week,
        status,
        statusTone,
        cells: [...past, now, ...future],
        explicitWeeks: item.targets.map((t) => t.week),
      } satisfies PlanBoardItem,
    };
  });

  const plannedExercises = new Set(program.planItems.map((i) => i.exerciseId).filter(Boolean));
  const groups: PlanBoardGroup[] = routines.map((routine) => ({
    key: `routine-${routine.id}`,
    kind: "EXERCISE",
    routineId: routine.id,
    title: routine.name,
    items: items.filter((i) => i.board.kind === "EXERCISE" && i.routineId === routine.id).map((i) => i.board),
    candidates: routine.exercises
      .map((e) => e.exercise)
      .filter((exercise) => !plannedExercises.has(exercise.id))
      .map((exercise) => ({
        kind: "EXERCISE" as const,
        key: exercise.id,
        exerciseId: exercise.id,
        name: exercise.name,
        lastLabel: lastLabelOf((routineSessions.get(exercise.id) ?? []).map((s) => s.ymd)),
        plannedElsewhere: exerciseElsewhere.get(exercise.id) ?? null,
      })),
  }));

  const linked = new Set(routines.map((r) => r.id));
  const looseExercises = items.filter((i) => i.board.kind === "EXERCISE" && (!i.routineId || !linked.has(i.routineId)));
  if (looseExercises.length) {
    groups.push({ key: "routine-other", kind: "EXERCISE", routineId: null, title: "Other exercises", items: looseExercises.map((i) => i.board), candidates: [] });
  }

  const typeCandidates = activityTypes
    .filter((t) => t.routineLogs.length > 0)
    .map((t) => ({ type: t, ymds: t.routineLogs.map((l) => toAppYmd(l.performedAt)) }));
  const familyCandidates = families
    .map((family) => ({ family, ymds: typeCandidates.filter((c) => c.type.familyId === family.id).flatMap((c) => c.ymds) }))
    .filter((c) => c.ymds.length > 0);
  const activityItems = items.filter((i) => i.board.kind === "ACTIVITY").map((i) => i.board);
  const activityCandidates: PlanBoardCandidate[] = [
    ...familyCandidates.map((c) => ({
      kind: "ACTIVITY" as const,
      key: `family-${c.family.id}`,
      activityTypeId: null,
      enduranceFamilyId: c.family.id,
      name: `Any ${c.family.name.toLowerCase()}`,
      lastLabel: lastLabelOf(c.ymds),
      plannedElsewhere: null,
    })),
    ...typeCandidates.map((c) => ({
      kind: "ACTIVITY" as const,
      key: `type-${c.type.id}`,
      activityTypeId: c.type.id,
      enduranceFamilyId: null,
      name: c.type.name,
      lastLabel: lastLabelOf(c.ymds),
      plannedElsewhere: null,
    })),
  ];
  if (activityItems.length || activityCandidates.length) {
    groups.push({ key: "activity", kind: "ACTIVITY", routineId: null, title: "Endurance", items: activityItems, candidates: activityCandidates });
  }

  const sportYmds = new Map<string, string[]>();
  for (const log of sportLogs) {
    const slug = log.routineId.replace(/^sports-/, "").replace(/-synthetic$/, "");
    sportYmds.set(slug, [...(sportYmds.get(slug) ?? []), toAppYmd(log.performedAt)]);
  }
  const plannedSports = new Set(program.planItems.map((i) => i.sportSlug).filter(Boolean));
  const sportSlugs = activitiesByFamily("sports")
    .map((entry) => entry.slug)
    .filter((slug) => slug === program.pursuitKey || sportYmds.has(slug));
  const sportItems = items.filter((i) => i.board.kind === "SPORT").map((i) => i.board);
  const sportCandidates: PlanBoardCandidate[] = sportSlugs
    .filter((slug) => !plannedSports.has(slug) && getSyntheticSportRoutineId(slug))
    .map((slug) => ({
      kind: "SPORT" as const,
      key: `sport-${slug}`,
      sportSlug: slug,
      name: getActivityEntry(slug)?.label ?? slug,
      lastLabel: lastLabelOf(sportYmds.get(slug) ?? []),
      plannedElsewhere: sportElsewhere.get(slug) ?? null,
    }));
  if (sportItems.length || sportCandidates.length) {
    groups.push({ key: "sport", kind: "SPORT", routineId: null, title: "Sports", items: sportItems, candidates: sportCandidates });
  }

  const linkedIds = new Set(routines.map((r) => r.id));
  const linkableRoutines = allRoutines
    .filter((r) => isWorkoutKind(r.kind) && !linkedIds.has(r.id))
    .map((r) => ({ id: r.id, name: r.name }));

  return { groups, library, linkableRoutines };
}
