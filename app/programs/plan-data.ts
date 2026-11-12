import { prisma } from "@/lib/prisma";
import { addDaysYmd, todayAppYmd } from "@/lib/dates";
import {
  compareTargets,
  evaluatePlan,
  formatPlanTarget,
  loadPlanSessions,
  mondayOfYmd,
  readAdjustments,
  targetAt,
  type PlanChange,
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

export type PlanBoardItem = {
  id: string;
  exerciseId: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  week: number;
  status: string;
  statusTone: "up" | "held" | "same" | "done" | "away";
  cells: PlanCell[];
  /** Weeks that hold an explicit target row (only those can be cleared). */
  explicitWeeks: number[];
};

export type PlanBoardCandidate = {
  exerciseId: string;
  name: string;
  lastLabel: string;
  plannedElsewhere: string | null;
};

export type PlanBoardGroup = {
  routineId: string | null;
  routineName: string;
  items: PlanBoardItem[];
  candidates: PlanBoardCandidate[];
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

export async function getProgramPlanBoard(programId: string): Promise<PlanBoardGroup[] | null> {
  const today = todayAppYmd();
  const currentWeekStart = mondayOfYmd(today);
  const program = await prisma.focus.findFirst({
    where: { id: programId },
    select: {
      id: true,
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
                select: { exercise: { select: { id: true, name: true, unit: true, supportsWeight: true } } },
              },
            },
          },
        },
      },
      planItems: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          exerciseId: true,
          routineId: true,
          startYmd: true,
          adjustments: true,
          exercise: { select: { name: true, unit: true, supportsWeight: true } },
          targets: { orderBy: { week: "asc" }, select: { week: true, sets: true, reps: true, seconds: true, weightLb: true } },
        },
      },
    },
  });
  if (!program) return null;

  const routines = program.routineLinks.map((link) => link.routine).filter((r) => r.isActive);
  const routineExerciseIds = routines.flatMap((r) => r.exercises.map((e) => e.exercise.id));
  const itemExerciseIds = program.planItems.map((item) => item.exerciseId);
  const allExerciseIds = [...new Set([...routineExerciseIds, ...itemExerciseIds])];

  const earliest = program.planItems.reduce(
    (min, item) => (item.startYmd < min ? item.startYmd : min),
    addDaysYmd(today, -LOOKBACK_DAYS),
  );
  const [sessions, elsewhere] = await Promise.all([
    loadPlanSessions(allExerciseIds, mondayOfYmd(earliest)),
    prisma.programPlanItem.findMany({
      where: {
        exerciseId: { in: routineExerciseIds },
        isActive: true,
        programId: { not: programId },
        program: { status: "ACTIVE" },
      },
      select: { exerciseId: true, program: { select: { name: true } } },
    }),
  ]);
  const plannedElsewhere = new Map(elsewhere.map((row) => [row.exerciseId, row.program.name]));

  const items = program.planItems.map((item): PlanBoardItem & { routineId: string | null } => {
    const evaluation = evaluatePlan({
      startYmd: item.startYmd,
      todayYmd: today,
      targets: item.targets,
      sessions: sessions.get(item.exerciseId) ?? [],
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
      value: formatPlanTarget(evaluation.target),
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
        value: formatPlanTarget(target),
        tone: change === "up" ? "up" : change === "down" ? "down" : "same",
        tag: changeTag(change),
        week,
        target,
      };
    });

    const targetText = formatPlanTarget(evaluation.target);
    let status: string;
    let statusTone: PlanBoardItem["statusTone"];
    if (evaluation.doneThisWeek) {
      status = `Done this week · target ${targetText}`;
      statusTone = "done";
    } else if (evaluation.suggestRepeat) {
      status = `${evaluation.daysSinceLast} days since you last did it. The log will offer last week's numbers first.`;
      statusTone = "away";
    } else if (evaluation.heldBy) {
      status = `Held: last time ${evaluation.heldBy.best ?? "logged"}, short of ${formatPlanTarget(evaluation.heldBy.target)}`;
      statusTone = "held";
    } else if (evaluation.change === "up") {
      status = `This week: ${targetText}, up from ${formatPlanTarget(evaluation.previousTarget)}`;
      statusTone = "up";
    } else {
      status = `This week: ${targetText}`;
      statusTone = "same";
    }

    return {
      id: item.id,
      routineId: item.routineId,
      exerciseId: item.exerciseId,
      name: item.exercise.name,
      unit: item.exercise.unit === "TIME" ? "TIME" : "REPS",
      supportsWeight: item.exercise.supportsWeight,
      week: evaluation.week,
      status,
      statusTone,
      cells: [...past, now, ...future],
      explicitWeeks: item.targets.map((t) => t.week),
    };
  });

  const plannedHere = new Set(itemExerciseIds);
  const lastLabel = (exerciseId: string) => {
    const last = (sessions.get(exerciseId) ?? []).map((s) => s.ymd).sort().at(-1);
    return last ? `last ${dateLabel(last)}` : `not in the last ${LOOKBACK_DAYS} days`;
  };

  const groups: PlanBoardGroup[] = routines.map((routine) => ({
    routineId: routine.id,
    routineName: routine.name,
    items: items.filter((item) => item.routineId === routine.id),
    candidates: routine.exercises
      .map((e) => e.exercise)
      .filter((exercise) => !plannedHere.has(exercise.id))
      .map((exercise) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        lastLabel: lastLabel(exercise.id),
        plannedElsewhere: plannedElsewhere.get(exercise.id) ?? null,
      })),
  }));

  const linked = new Set(routines.map((r) => r.id));
  const loose = items.filter((item) => !item.routineId || !linked.has(item.routineId));
  if (loose.length > 0) groups.push({ routineId: null, routineName: "Other", items: loose, candidates: [] });

  return groups;
}

