import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { revalidatePath } from "next/cache";
import DeleteGoalButton from "./DeleteGoalButton";
import {
  cardioGoalScopeAllCardio,
  cardioGoalScopeCardioType,
  cardioGoalScopeRoutine,
  GOAL_TYPE,
  goalTypeExerciseAvgRepsPerSet,
  goalTypeExerciseRepsAtWeight,
  goalTypeExerciseWeight,
  goalTypeRoutinePlannedPerWeek,
  goalTypeRoutineCompletion,
  goalTypeRoutineStreak,
  goalTypeRunLongest,
  goalTypeRunWeeklyMileage,
  parseCardioGoalScope,
  parseExerciseRepsAtWeightGoalType,
  parseRunLongestGoalType,
  parseRunWeeklyMileageGoalType,
} from "@/lib/progress";
import { formatRoutineSubtype } from "@/lib/routines";
import { getWeekBoundsSunday } from "@/lib/week";

export const dynamic = "force-dynamic";

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function upsertGoal(type: string, targetValue: number) {
  if (!Number.isFinite(targetValue) || targetValue < 0) {
    throw new Error("Target value must be >= 0.");
  }

  const existing = await prisma.goal.findFirst({
    where: { type, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.goal.update({
      where: { id: existing.id },
      data: { targetValue, isActive: true },
    });
    return;
  }

  await prisma.goal.create({
    data: { type, targetValue, isActive: true },
  });
}

async function createGoal(type: string, targetValue: number) {
  if (!Number.isFinite(targetValue) || targetValue < 0) {
    throw new Error("Target value must be >= 0.");
  }
  await prisma.goal.create({
    data: { type, targetValue, isActive: true },
  });
}

async function editActiveGoal(formData: FormData) {
  "use server";
  const goalId = String(formData.get("goalId") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const target = Number(formData.get("target"));
  if (goalId) {
    await prisma.goal.update({
      where: { id: goalId },
      data: { targetValue: target, isActive: true },
    });
  } else {
    if (!type) throw new Error("Goal type is required.");
    await upsertGoal(type, target);
  }
  revalidatePath("/goals");
  revalidatePath("/progress");
  revalidatePath("/schedule");
}

async function saveRoutineCompletionGoal(formData: FormData) {
  "use server";
  const routineId = String(formData.get("routineId") ?? "").trim();
  const target = Number(formData.get("target"));
  if (!routineId) throw new Error("Routine is required.");
  await upsertGoal(goalTypeRoutineCompletion(routineId), target);
  revalidatePath("/goals");
  revalidatePath("/progress");
}

async function saveRoutinePlannedPerWeekGoal(formData: FormData) {
  "use server";
  const routineId = String(formData.get("routineId") ?? "").trim();
  const target = Number(formData.get("target"));
  if (!routineId) throw new Error("Routine is required.");
  await upsertGoal(goalTypeRoutinePlannedPerWeek(routineId), target);
  revalidatePath("/goals");
  revalidatePath("/progress");
  revalidatePath("/schedule");
}

async function saveRoutineStreakGoal(formData: FormData) {
  "use server";
  const routineId = String(formData.get("routineId") ?? "").trim();
  const target = Number(formData.get("target"));
  if (!routineId) throw new Error("Routine is required.");
  await upsertGoal(goalTypeRoutineStreak(routineId), target);
  revalidatePath("/goals");
  revalidatePath("/progress");
}

async function saveRunWeeklyMileageGoal(formData: FormData) {
  "use server";
  const scopeRaw = String(formData.get("scope") ?? formData.get("routineId") ?? "").trim();
  const target = Number(formData.get("target"));
  if (!parseCardioGoalScope(scopeRaw)) throw new Error("Cardio scope is required.");
  await createGoal(goalTypeRunWeeklyMileage(scopeRaw), target);
  revalidatePath("/goals");
  revalidatePath("/progress");
}

async function saveRunLongestGoal(formData: FormData) {
  "use server";
  const scopeRaw = String(formData.get("scope") ?? formData.get("routineId") ?? "").trim();
  const target = Number(formData.get("target"));
  if (!parseCardioGoalScope(scopeRaw)) throw new Error("Cardio scope is required.");
  await createGoal(goalTypeRunLongest(scopeRaw), target);
  revalidatePath("/goals");
  revalidatePath("/progress");
}

async function saveExerciseWeightGoal(formData: FormData) {
  "use server";
  const exerciseId = String(formData.get("exerciseId") ?? "").trim();
  const target = Number(formData.get("target"));
  if (!exerciseId) throw new Error("Exercise is required.");
  await createGoal(goalTypeExerciseWeight(exerciseId), target);
  revalidatePath("/goals");
  revalidatePath("/progress");
}

async function saveExerciseAvgRepsGoal(formData: FormData) {
  "use server";
  const exerciseId = String(formData.get("exerciseId") ?? "").trim();
  const target = Number(formData.get("target"));
  if (!exerciseId) throw new Error("Exercise is required.");
  await createGoal(goalTypeExerciseAvgRepsPerSet(exerciseId), target);
  revalidatePath("/goals");
  revalidatePath("/progress");
}

async function saveExerciseRepsAtWeightGoal(formData: FormData) {
  "use server";
  const exerciseId = String(formData.get("exerciseId") ?? "").trim();
  const weightLb = Number(formData.get("weightLb"));
  const repsTarget = Number(formData.get("repsTarget"));
  if (!exerciseId) throw new Error("Exercise is required.");
  if (!Number.isFinite(weightLb) || weightLb < 0) throw new Error("Weight must be >= 0");
  await createGoal(goalTypeExerciseRepsAtWeight(exerciseId, weightLb), repsTarget);
  revalidatePath("/goals");
  revalidatePath("/progress");
}

function goalCategory(type: string) {
  const [prefix] = type.split(":");
  if (prefix === GOAL_TYPE.routinePlannedPerWeek) return "Routine Planning";
  if (prefix === GOAL_TYPE.routineCompletion || prefix === GOAL_TYPE.routineStreak) return "Routine";
  if (prefix === GOAL_TYPE.runWeeklyMileage || prefix === GOAL_TYPE.runLongest) return "Cardio";
  if (
    prefix === GOAL_TYPE.exerciseWeight ||
    prefix === GOAL_TYPE.exerciseAvgRepsPerSet ||
    prefix === GOAL_TYPE.exerciseRepsAtWeight
  ) {
    return "Exercise";
  }
  return "Other";
}

function categoryRank(category: string) {
  if (category === "Routine Planning") return 0;
  if (category === "Routine") return 1;
  if (category === "Cardio") return 2;
  if (category === "Exercise") return 3;
  return 4;
}

function formatNumber(value: number, decimals = 0) {
  return value.toFixed(decimals);
}

function findClosest(values: number[], target: number) {
  if (values.length === 0) return null;
  let best = values[0];
  let bestDiff = Math.abs(values[0] - target);
  for (let i = 1; i < values.length; i += 1) {
    const diff = Math.abs(values[i] - target);
    if (diff < bestDiff) {
      best = values[i];
      bestDiff = diff;
    }
  }
  return best;
}

function computeWeeklyStreak(performedAts: Date[]) {
  if (performedAts.length === 0) return 0;
  const weekKeys = new Set(
    performedAts.map((date) => getWeekBoundsSunday(date).start.toISOString().slice(0, 10))
  );

  let streak = 0;
  const cursor = getWeekBoundsSunday(new Date()).start;
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!weekKeys.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

function ProgressRing({
  current,
  target,
  fraction,
}: {
  current: string;
  target: string;
  fraction: number;
}) {
  const size = 92;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));
  const dashOffset = circumference * (1 - clamped);

  return (
    <div style={{ width: size, height: size, position: "relative", display: "grid", placeItems: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(128,128,128,0.28)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(34,197,94,0.92)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center", lineHeight: 1.1 }}>
        <div style={{ fontWeight: 900, fontSize: 17 }}>{current}</div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>/ {target}</div>
      </div>
    </div>
  );
}

type ActiveGoal = {
  id: string;
  type: string;
  targetValue: number;
  createdAt: Date;
  isVirtual: boolean;
};

type GoalCard = {
  goal: ActiveGoal;
  category: string;
  scope: "routine" | "run" | "exercise" | "other";
  routineId?: string;
  exerciseId?: string;
  title: string;
  goalLabel: string;
  valueLabel: string;
  currentValue: number;
  targetValue: number;
  currentDisplay: string;
  targetDisplay: string;
};

export default async function GoalsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const rawMode = getParam(params?.mode);
  const mode = rawMode === "create" || rawMode === "edit" ? rawMode : "active";
  const selectedGoalId = getParam(params?.goalId) ?? "";
  const selectedGoalType = getParam(params?.type) ?? "";
  const filterCategory = getParam(params?.category) ?? "all";
  const filterScope = getParam(params?.scope) ?? "all";
  const filterRoutineId = getParam(params?.routineId) ?? "all";
  const filterExerciseId = getParam(params?.exerciseId) ?? "all";

  const [routines, exercises, goals] = await Promise.all([
    prisma.routine.findMany({
      where: { isDeleted: false },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true, category: true, subtype: true, timesPerWeek: true },
    }),
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, supportsWeight: true },
    }),
    prisma.goal.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, type: true, targetValue: true, createdAt: true },
    }),
  ]);

  const routineNameMap = new Map(routines.map((r) => [r.id, r.name]));
  const exerciseMap = new Map(exercises.map((e) => [e.id, { name: e.name, unit: e.unit }]));
  const goalValueByType = new Map(goals.map((goal) => [goal.type, goal.targetValue]));

  const activeGoals: ActiveGoal[] = [
    ...goals.map((goal) => ({ ...goal, isVirtual: false })),
    ...routines
      .filter((r) => (r.timesPerWeek ?? 0) > 0 && !goalValueByType.has(goalTypeRoutinePlannedPerWeek(r.id)))
      .map((r) => ({
        id: `virtual-planned-${r.id}`,
        type: goalTypeRoutinePlannedPerWeek(r.id),
        targetValue: Number(r.timesPerWeek ?? 0),
        createdAt: new Date(),
        isVirtual: true,
      })),
  ];

  const { start, end } = getWeekBoundsSunday(new Date());
  const weeklyCounts = await prisma.routineLog.groupBy({
    by: ["routineId"],
    where: { performedAt: { gte: start, lt: end } },
    _count: { _all: true },
    _sum: { distanceMi: true },
  });
  const weeklyCountMap = new Map(weeklyCounts.map((x) => [x.routineId, x._count._all]));
  const weeklyMileageMap = new Map(weeklyCounts.map((x) => [x.routineId, x._sum.distanceMi ?? 0]));

  const longestRuns = await prisma.routineLog.groupBy({
    by: ["routineId"],
    where: { distanceMi: { not: null } },
    _max: { distanceMi: true },
  });
  const longestRunMap = new Map(longestRuns.map((x) => [x.routineId, x._max.distanceMi ?? 0]));
  const cardioRoutines = routines.filter((routine) => routine.kind === "CARDIO");
  const weeklyMileageByCardioType = new Map<string, number>();
  const longestByCardioType = new Map<string, number>();
  let weeklyMileageAllCardio = 0;
  let longestAllCardio = 0;
  for (const routine of cardioRoutines) {
    const cardioType = formatRoutineSubtype(routine.subtype) || "Cardio";
    const weeklyMileage = weeklyMileageMap.get(routine.id) ?? 0;
    const longest = longestRunMap.get(routine.id) ?? 0;

    weeklyMileageByCardioType.set(
      cardioType,
      (weeklyMileageByCardioType.get(cardioType) ?? 0) + weeklyMileage
    );
    longestByCardioType.set(cardioType, Math.max(longestByCardioType.get(cardioType) ?? 0, longest));
    weeklyMileageAllCardio += weeklyMileage;
    longestAllCardio = Math.max(longestAllCardio, longest);
  }

  const streakGoalRoutineIds = Array.from(
    new Set(
      activeGoals
        .map((g) => g.type)
        .filter((type) => type.startsWith(`${GOAL_TYPE.routineStreak}:`))
        .map((type) => type.split(":")[1])
    )
  );
  const streakLogs =
    streakGoalRoutineIds.length > 0
      ? await prisma.routineLog.findMany({
          where: { routineId: { in: streakGoalRoutineIds } },
          select: { routineId: true, performedAt: true },
          orderBy: { performedAt: "desc" },
        })
      : [];
  const streakMap = new Map<string, number>();
  for (const routineId of streakGoalRoutineIds) {
    const routineDates = streakLogs.filter((log) => log.routineId === routineId).map((log) => log.performedAt);
    streakMap.set(routineId, computeWeeklyStreak(routineDates));
  }

  const exerciseGoalIds = Array.from(
    new Set(
      activeGoals
        .map((goal) => {
          const parsed = parseExerciseRepsAtWeightGoalType(goal.type);
          if (parsed) return parsed.exerciseId;
          const [prefix, id] = goal.type.split(":");
          if (prefix === GOAL_TYPE.exerciseWeight || prefix === GOAL_TYPE.exerciseAvgRepsPerSet) return id;
          return null;
        })
        .filter((id): id is string => Boolean(id))
    )
  );

  const exerciseSessions =
    exerciseGoalIds.length > 0
      ? await prisma.sessionExercise.findMany({
          where: { exerciseId: { in: exerciseGoalIds } },
          select: {
            exerciseId: true,
            sets: { select: { reps: true, seconds: true, weightLb: true } },
          },
        })
      : [];

  const goalCards: GoalCard[] = activeGoals.map((goal) => {
    const [prefix, id] = goal.type.split(":");
    const target = goal.targetValue;

    if (prefix === GOAL_TYPE.routinePlannedPerWeek) {
      const current = weeklyCountMap.get(id) ?? 0;
      return {
        goal,
        category: goalCategory(goal.type),
        scope: "routine",
        routineId: id,
        title: routineNameMap.get(id) ?? id,
        goalLabel: `Goal: ${target} sessions/week`,
        valueLabel: "Current",
        currentValue: current,
        targetValue: target,
        currentDisplay: formatNumber(current, 0),
        targetDisplay: formatNumber(target, 0),
      };
    }

    if (prefix === GOAL_TYPE.routineCompletion) {
      const current = weeklyCountMap.get(id) ?? 0;
      return {
        goal,
        category: goalCategory(goal.type),
        scope: "routine",
        routineId: id,
        title: routineNameMap.get(id) ?? id,
        goalLabel: `Goal: ${target} sessions`,
        valueLabel: "Current",
        currentValue: current,
        targetValue: target,
        currentDisplay: formatNumber(current, 0),
        targetDisplay: formatNumber(target, 0),
      };
    }

    if (prefix === GOAL_TYPE.routineStreak) {
      const current = streakMap.get(id) ?? 0;
      return {
        goal,
        category: goalCategory(goal.type),
        scope: "routine",
        routineId: id,
        title: routineNameMap.get(id) ?? id,
        goalLabel: `Goal: ${target} week streak`,
        valueLabel: "Current",
        currentValue: current,
        targetValue: target,
        currentDisplay: formatNumber(current, 0),
        targetDisplay: formatNumber(target, 0),
      };
    }

    if (prefix === GOAL_TYPE.runWeeklyMileage) {
      const cardioScope = parseRunWeeklyMileageGoalType(goal.type);
      const current =
        cardioScope?.kind === "allCardio"
          ? weeklyMileageAllCardio
          : cardioScope?.kind === "cardioType"
          ? weeklyMileageByCardioType.get(cardioScope.cardioType) ?? 0
          : weeklyMileageMap.get(cardioScope?.routineId ?? id) ?? 0;
      const title =
        cardioScope?.kind === "allCardio"
          ? "All Cardio"
          : cardioScope?.kind === "cardioType"
          ? `${cardioScope.cardioType} Cardio`
          : routineNameMap.get(cardioScope?.routineId ?? id) ?? (cardioScope?.routineId ?? id);
      return {
        goal,
        category: goalCategory(goal.type),
        scope: "run",
        routineId: cardioScope?.kind === "routine" ? cardioScope.routineId : undefined,
        title,
        goalLabel: `Goal: ${formatNumber(target, 1)} mi/week`,
        valueLabel: "Current",
        currentValue: current,
        targetValue: target,
        currentDisplay: formatNumber(current, 1),
        targetDisplay: formatNumber(target, 1),
      };
    }

    if (prefix === GOAL_TYPE.runLongest) {
      const cardioScope = parseRunLongestGoalType(goal.type);
      const closest =
        cardioScope?.kind === "allCardio"
          ? longestAllCardio
          : cardioScope?.kind === "cardioType"
          ? longestByCardioType.get(cardioScope.cardioType) ?? 0
          : longestRunMap.get(cardioScope?.routineId ?? id) ?? 0;
      const title =
        cardioScope?.kind === "allCardio"
          ? "All Cardio"
          : cardioScope?.kind === "cardioType"
          ? `${cardioScope.cardioType} Cardio`
          : routineNameMap.get(cardioScope?.routineId ?? id) ?? (cardioScope?.routineId ?? id);
      return {
        goal,
        category: goalCategory(goal.type),
        scope: "run",
        routineId: cardioScope?.kind === "routine" ? cardioScope.routineId : undefined,
        title,
        goalLabel: `Goal: ${formatNumber(target, 1)} mi`,
        valueLabel: "Closest",
        currentValue: closest,
        targetValue: target,
        currentDisplay: formatNumber(closest, 1),
        targetDisplay: formatNumber(target, 1),
      };
    }

    if (prefix === GOAL_TYPE.exerciseWeight) {
      const exercise = exerciseMap.get(id);
      const isTime = exercise?.unit === "TIME";
      const values = exerciseSessions
        .filter((session) => session.exerciseId === id)
        .flatMap((session) =>
          session.sets
            .map((set) => (isTime ? set.seconds : set.weightLb))
            .filter((value): value is number => Number.isFinite(value))
        );
      const closest = findClosest(values, target) ?? 0;
      return {
        goal,
        category: goalCategory(goal.type),
        scope: "exercise",
        exerciseId: id,
        title: exercise?.name ?? id,
        goalLabel: `Goal: ${formatNumber(target, isTime ? 0 : 1)} ${isTime ? "sec" : "lb"}`,
        valueLabel: "Closest",
        currentValue: closest,
        targetValue: target,
        currentDisplay: formatNumber(closest, isTime ? 0 : 1),
        targetDisplay: formatNumber(target, isTime ? 0 : 1),
      };
    }

    if (prefix === GOAL_TYPE.exerciseAvgRepsPerSet) {
      const exercise = exerciseMap.get(id);
      const values = exerciseSessions
        .filter((session) => session.exerciseId === id)
        .map((session) => {
          const reps = session.sets.map((set) => set.reps).filter((rep): rep is number => Number.isFinite(rep));
          if (reps.length === 0) return null;
          return reps.reduce((sum, rep) => sum + rep, 0) / reps.length;
        })
        .filter((value): value is number => value !== null);
      const closest = findClosest(values, target) ?? 0;
      return {
        goal,
        category: goalCategory(goal.type),
        scope: "exercise",
        exerciseId: id,
        title: exercise?.name ?? id,
        goalLabel: `Goal: ${formatNumber(target, 1)} reps/set`,
        valueLabel: "Closest",
        currentValue: closest,
        targetValue: target,
        currentDisplay: formatNumber(closest, 1),
        targetDisplay: formatNumber(target, 1),
      };
    }

    if (prefix === GOAL_TYPE.exerciseRepsAtWeight) {
      const parsed = parseExerciseRepsAtWeightGoalType(goal.type);
      const exId = parsed?.exerciseId ?? id;
      const targetWeight = parsed?.weightLb ?? 0;
      const exercise = exerciseMap.get(exId);
      const values = exerciseSessions
        .filter((session) => session.exerciseId === exId)
        .flatMap((session) =>
          session.sets
            .filter((set) => set.weightLb !== null && Math.abs((set.weightLb ?? 0) - targetWeight) < 0.0001)
            .map((set) => set.reps)
            .filter((rep): rep is number => Number.isFinite(rep))
        );
      const closest = findClosest(values, target) ?? 0;
      return {
        goal,
        category: goalCategory(goal.type),
        scope: "exercise",
        exerciseId: exId,
        title: exercise?.name ?? exId,
        goalLabel: `Goal: ${formatNumber(target, 0)} reps @ ${formatNumber(targetWeight, 1)} lb`,
        valueLabel: "Closest",
        currentValue: closest,
        targetValue: target,
        currentDisplay: formatNumber(closest, 0),
        targetDisplay: formatNumber(target, 0),
      };
    }

    return {
      goal,
      category: goalCategory(goal.type),
      scope: "other",
      title: goal.type,
      goalLabel: `Goal: ${target}`,
      valueLabel: "Current",
      currentValue: 0,
      targetValue: target,
      currentDisplay: "0",
      targetDisplay: formatNumber(target, 0),
    };
  });

  const filteredGoalCards = goalCards.filter((card) => {
    if (filterCategory !== "all" && card.category !== filterCategory) return false;
    if (filterScope !== "all" && card.scope !== filterScope) return false;
    if (filterRoutineId !== "all" && card.routineId !== filterRoutineId) return false;
    if (filterExerciseId !== "all" && card.exerciseId !== filterExerciseId) return false;
    return true;
  });

  const cardsByCategory = new Map<string, GoalCard[]>();
  for (const card of filteredGoalCards) {
    if (!cardsByCategory.has(card.category)) cardsByCategory.set(card.category, []);
    cardsByCategory.get(card.category)!.push(card);
  }
  const orderedCategories = Array.from(cardsByCategory.keys()).sort(
    (a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b)
  );

  const completedGoalCards = filteredGoalCards.filter(
    (card) => card.targetValue > 0 && card.currentValue >= card.targetValue
  );
  const inProgressGoalCards = filteredGoalCards.filter(
    (card) => !(card.targetValue > 0 && card.currentValue >= card.targetValue)
  );
  const inProgressByCategory = new Map<string, GoalCard[]>();
  for (const card of inProgressGoalCards) {
    if (!inProgressByCategory.has(card.category)) inProgressByCategory.set(card.category, []);
    inProgressByCategory.get(card.category)!.push(card);
  }
  const completedByCategory = new Map<string, GoalCard[]>();
  for (const card of completedGoalCards) {
    if (!completedByCategory.has(card.category)) completedByCategory.set(card.category, []);
    completedByCategory.get(card.category)!.push(card);
  }

  const selectedEditCard =
    goalCards.find((card) => (selectedGoalId ? card.goal.id === selectedGoalId : false)) ??
    goalCards.find((card) => (!selectedGoalId && selectedGoalType ? card.goal.type === selectedGoalType : false)) ??
    null;

  const runRoutines = cardioRoutines;
  const cardioTypeOptions = Array.from(
    new Set(
      runRoutines
        .map((routine) => formatRoutineSubtype(routine.subtype).trim())
        .filter((cardioType) => cardioType.length > 0 && cardioType.toLowerCase() !== "cardio")
    )
  ).sort((a, b) => a.localeCompare(b));
  const cardioScopeOptions = [
    { value: cardioGoalScopeAllCardio(), label: "All cardio types" },
    ...cardioTypeOptions.map((cardioType) => ({
      value: cardioGoalScopeCardioType(cardioType),
      label: `${cardioType} cardio`,
    })),
    ...runRoutines.map((routine) => ({
      value: cardioGoalScopeRoutine(routine.id),
      label: `${routine.name} (routine)`,
    })),
  ];

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Goals</h1>
          <div style={{ opacity: 0.75, marginTop: 8 }}>
            Active goals are grouped by category with live current/closest values.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {mode === "active" ? (
            <Link href="/goals?mode=create" style={linkBtn}>Create Goals</Link>
          ) : mode === "create" ? (
            <Link href="/goals" style={linkBtn}>Back To Active Goals</Link>
          ) : (
            <Link href="/goals" style={linkBtn}>Back To Active Goals</Link>
          )}
        </div>
      </div>

      {mode === "active" && (
        <section style={panel}>
          <div style={panelHeader}>FILTERS</div>
          <form method="get" style={{ padding: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <input type="hidden" name="mode" value="active" />
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Category</label>
              <select name="category" defaultValue={filterCategory} style={selectStyle}>
                <option value="all">All</option>
                <option value="Routine Planning">Routine Planning</option>
                <option value="Routine">Routine</option>
                <option value="Cardio">Cardio</option>
                <option value="Exercise">Exercise</option>
              </select>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Type</label>
              <select name="scope" defaultValue={filterScope} style={selectStyle}>
                <option value="all">All</option>
                <option value="routine">Routine</option>
                <option value="run">Cardio</option>
                <option value="exercise">Exercise</option>
              </select>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Routine</label>
              <select name="routineId" defaultValue={filterRoutineId} style={selectStyle}>
                <option value="all">All</option>
                {routines.map((routine) => (
                  <option key={routine.id} value={routine.id}>
                    {routine.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Exercise</label>
              <select name="exerciseId" defaultValue={filterExerciseId} style={selectStyle}>
                <option value="all">All</option>
                {exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit">Apply</button>
            <Link href="/goals" style={linkBtn}>Reset</Link>
          </form>
        </section>
      )}

      {mode === "active" && (
        <section style={panel}>
          <div style={panelHeader}>ACTIVE GOALS</div>
          <div style={{ padding: 12, display: "grid", gap: 14 }}>
            {filteredGoalCards.length === 0 && <div style={{ opacity: 0.75 }}>No active goals match the current filters.</div>}
            {inProgressGoalCards.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.4 }}>IN PROGRESS</div>
                {orderedCategories.map((category) => (
                    <details key={`in-progress-${category}`} style={goalGroupDetails} open={(inProgressByCategory.get(category) ?? []).length > 0}>
                      {(inProgressByCategory.get(category) ?? []).length > 0 && (
                      <summary data-collapsible-summary style={goalGroupSummary}>
                        {category.toUpperCase()} ({(inProgressByCategory.get(category) ?? []).length})
                      </summary>
                    )}
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {(inProgressByCategory.get(category) ?? []).map((card) => {
                      const fraction = card.targetValue > 0 ? card.currentValue / card.targetValue : 0;
                      return (
                        <div key={card.goal.id} style={goalCard}>
                          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                            <ProgressRing
                              current={card.currentDisplay}
                              target={card.targetDisplay}
                              fraction={fraction}
                            />
                            <div>
                              <div style={{ fontWeight: 900, fontSize: 16 }}>{card.title}</div>
                              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>{card.goalLabel}</div>
                              <div style={{ marginTop: 2, fontSize: 13, opacity: 0.9 }}>
                                {card.valueLabel}: {card.currentDisplay}/{card.targetDisplay}
                              </div>
                              <div style={{ marginTop: 2, fontSize: 12, opacity: 0.75 }}>
                                {card.goal.isVirtual ? "Source: routine setup sessions/week" : `Created: ${new Date(card.goal.createdAt).toLocaleDateString()}`}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                            <Link
                              href={`/goals?mode=edit${card.goal.isVirtual ? `&type=${encodeURIComponent(card.goal.type)}` : `&goalId=${encodeURIComponent(card.goal.id)}`}`}
                              style={linkBtn}
                            >
                              Edit
                            </Link>
                            <DeleteGoalButton
                              goalId={card.goal.isVirtual ? undefined : card.goal.id}
                              goalType={card.goal.type}
                            />
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </details>
                ))}
              </div>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.4 }}>COMPLETED GOALS</div>
              {completedGoalCards.length === 0 && <div style={{ opacity: 0.75 }}>No completed goals yet.</div>}
              {orderedCategories.map((category) => (
                <div key={`completed-${category}`} style={{ display: "grid", gap: 8 }}>
                  {(completedByCategory.get(category) ?? []).length > 0 && (
                    <div style={goalGroupStaticHeader}>
                      {category.toUpperCase()} ({(completedByCategory.get(category) ?? []).length})
                    </div>
                  )}
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {(completedByCategory.get(category) ?? []).map((card) => {
                    const fraction = card.targetValue > 0 ? card.currentValue / card.targetValue : 0;
                    return (
                      <div key={`completed-${card.goal.id}`} style={{ ...goalCard, borderColor: "rgba(34,197,94,0.5)" }}>
                        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                          <ProgressRing
                            current={card.currentDisplay}
                            target={card.targetDisplay}
                            fraction={fraction}
                          />
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 16 }}>{card.title}</div>
                            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>{card.goalLabel}</div>
                            <div style={{ marginTop: 2, fontSize: 13, opacity: 0.9 }}>
                              {card.valueLabel}: {card.currentDisplay}/{card.targetDisplay}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                          <Link
                            href={`/goals?mode=edit${card.goal.isVirtual ? `&type=${encodeURIComponent(card.goal.type)}` : `&goalId=${encodeURIComponent(card.goal.id)}`}`}
                            style={linkBtn}
                          >
                            Edit
                          </Link>
                          <DeleteGoalButton
                            goalId={card.goal.isVirtual ? undefined : card.goal.id}
                            goalType={card.goal.type}
                          />
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {mode === "edit" && (
        <section style={panel}>
          <div style={panelHeader}>EDIT GOAL</div>
          <div style={{ padding: 12, display: "grid", gap: 10 }}>
            {!selectedEditCard && <div style={{ opacity: 0.75 }}>Goal not found. Go back to Active Goals and choose Edit.</div>}
            {selectedEditCard && (
              <div style={goalCard}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{selectedEditCard.title}</div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>{selectedEditCard.goalLabel}</div>
                  <div style={{ marginTop: 2, fontSize: 13, opacity: 0.9 }}>
                    {selectedEditCard.valueLabel}: {selectedEditCard.currentDisplay}/{selectedEditCard.targetDisplay}
                  </div>
                </div>
                <form action={editActiveGoal} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {!selectedEditCard.goal.isVirtual && (
                    <input type="hidden" name="goalId" value={selectedEditCard.goal.id} />
                  )}
                  {selectedEditCard.goal.isVirtual && (
                    <input type="hidden" name="type" value={selectedEditCard.goal.type} />
                  )}
                  <input
                    name="target"
                    type="number"
                    min="0"
                    step="0.1"
                    defaultValue={selectedEditCard.goal.targetValue}
                    style={{ width: 120 }}
                  />
                  <button type="submit">Save</button>
                </form>
              </div>
            )}
          </div>
        </section>
      )}

      {mode === "create" && (
        <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
          <section style={panel}>
            <div style={panelHeader}>ROUTINE GOALS</div>
            <div style={panelBody}>
              <form action={saveRoutinePlannedPerWeekGoal} style={formRow}>
                <b>Routine planning target</b>
                <select name="routineId" defaultValue={routines[0]?.id ?? ""} style={selectStyle}>
                  {routines.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.kind}) | suggestion {r.timesPerWeek ?? 0}/week
                    </option>
                  ))}
                </select>
                <input name="target" type="number" min="0" step="1" defaultValue={routines[0]?.timesPerWeek ?? 0} />
                <button type="submit">Save</button>
              </form>

              <form action={saveRoutineCompletionGoal} style={formRow}>
                <b>Completion target (sessions)</b>
                <select name="routineId" defaultValue={routines[0]?.id ?? ""} style={selectStyle}>
                  {routines.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.kind})
                    </option>
                  ))}
                </select>
                <input name="target" type="number" min="0" step="1" defaultValue={3} />
                <button type="submit">Save</button>
              </form>

              <form action={saveRoutineStreakGoal} style={formRow}>
                <b>Completion streak target (periods)</b>
                <select name="routineId" defaultValue={routines[0]?.id ?? ""} style={selectStyle}>
                  {routines.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.kind})
                    </option>
                  ))}
                </select>
                <input name="target" type="number" min="0" step="1" defaultValue={4} />
                <button type="submit">Save</button>
              </form>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>CARDIO GOALS</div>
            <div style={panelBody}>
              <form action={saveRunWeeklyMileageGoal} style={formRow}>
                <b>Weekly mileage target (mi)</b>
                <select name="scope" defaultValue={cardioScopeOptions[0]?.value ?? ""} style={selectStyle}>
                  {cardioScopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input name="target" type="number" min="0" step="0.1" defaultValue={20} />
                <button type="submit">Save</button>
              </form>

              <form action={saveRunLongestGoal} style={formRow}>
                <b>Longest cardio target (mi)</b>
                <select name="scope" defaultValue={cardioScopeOptions[0]?.value ?? ""} style={selectStyle}>
                  {cardioScopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input name="target" type="number" min="0" step="0.1" defaultValue={10} />
                <button type="submit">Save</button>
              </form>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>EXERCISE GOALS</div>
            <div style={panelBody}>
              <form action={saveExerciseWeightGoal} style={formRow}>
                <b>Weight/time target</b>
                <select name="exerciseId" defaultValue={exercises[0]?.id ?? ""} style={selectStyle}>
                  {exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.unit}
                      {e.supportsWeight ? "+wt" : ""})
                    </option>
                  ))}
                </select>
                <input name="target" type="number" min="0" step="0.1" defaultValue={25} />
                <button type="submit">Save</button>
              </form>

              <form action={saveExerciseAvgRepsGoal} style={formRow}>
                <b>Avg reps per set target</b>
                <select name="exerciseId" defaultValue={exercises[0]?.id ?? ""} style={selectStyle}>
                  {exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <input name="target" type="number" min="0" step="0.1" defaultValue={8} />
                <button type="submit">Save</button>
              </form>

              <form action={saveExerciseRepsAtWeightGoal} style={formRow}>
                <b>Reps target at specific weight</b>
                <select name="exerciseId" defaultValue={exercises[0]?.id ?? ""} style={selectStyle}>
                  {exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <input name="weightLb" type="number" min="0" step="0.1" defaultValue={25} placeholder="Weight lb" />
                <input name="repsTarget" type="number" min="0" step="1" defaultValue={8} placeholder="Reps target" />
                <button type="submit">Save</button>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
};

const panelBody: React.CSSProperties = {
  padding: 12,
  display: "grid",
  gap: 10,
};

const goalGroupDetails: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.22)",
  borderRadius: 12,
  padding: 10,
  background: "rgba(128,128,128,0.04)",
};

const goalGroupSummary: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  opacity: 0.9,
};

const goalGroupStaticHeader: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  opacity: 0.9,
};

const formRow: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 12,
  padding: 10,
  background: "rgba(128,128,128,0.06)",
  display: "grid",
  gap: 8,
  gridTemplateColumns: "minmax(180px,1fr) minmax(220px,1.2fr) minmax(110px,0.7fr) auto",
  alignItems: "center",
};

const selectStyle: React.CSSProperties = {
  background: "#111b2e",
  color: "rgba(255,255,255,0.92)",
};

const goalCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.06)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const linkBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.12)",
};

