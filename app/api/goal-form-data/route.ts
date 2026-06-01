import { NextResponse } from "next/server";
import {
  getGoalById,
  getGoalFormOptions,
  getGroupFrequencyGoalById,
} from "@/lib/goals";
import { todayAppYmd, toAppYmd } from "@/lib/dates";
import type { GoalFormInitial } from "@/app/goals/GoalForm";
import type { GoalTypeValue } from "@/lib/goals-config";

function toYmd(date: Date | null) {
  return date ? toAppYmd(date) : "";
}

// Loads the data the goal create/edit drawer needs in one round-trip:
//   - options: GoalFormOptions for the picker (routines, exercises, etc.)
//   - initial: pre-filled GoalFormInitial state (defaults for new, current
//     values for edit)
// Mirrors the server-side logic in GoalsPageContent + GoalDetailPage so the
// FormDrawer can render the same GoalForm without re-fetching.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const goalId = url.searchParams.get("goalId")?.trim() || null;
  const prefillGoalType = (url.searchParams.get("goalType") || "").toUpperCase();
  const prefillRoutineId = url.searchParams.get("routineId") || "";

  if (goalId) {
    const isGroupFrequencyGoal = goalId.startsWith("group-frequency:");
    if (isGroupFrequencyGoal) {
      const [goal, options] = await Promise.all([
        getGroupFrequencyGoalById(goalId),
        getGoalFormOptions(),
      ]);
      if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      const initial: GoalFormInitial = {
        name: goal.name,
        goalType: "FREQUENCY",
        targetType: "GROUP",
        targetId: "",
        metricType: "SESSIONS",
        timeframe: goal.targetUnit,
        targetValue: goal.targetCount,
        startDate: "",
        endDate: "",
        isActive: goal.isActive,
        notes: "",
        benchmarkDistanceMi: "",
        benchmarkLabel: "",
        sessionMetricDefinitionId: "",
        sessionMetricTarget: "",
        groupFrequencyGoalId: goal.id,
        groupFrequency: {
          targetCount: goal.targetCount,
          targetInterval: goal.targetInterval,
          targetUnit: goal.targetUnit,
          weekdayMask: goal.weekdayMask ?? null,
          routineIds: goal.routines.filter((r) => r.role !== "SUBSTITUTE").map((r) => r.routineId),
          substituteRoutineIds: goal.routines.filter((r) => r.role === "SUBSTITUTE").map((r) => r.routineId),
          triggerExerciseIds: goal.triggerExerciseIds,
          triggerSubtypes: goal.triggerSubtypes,
          triggerActivityTypeIds: goal.triggerActivityTypeIds,
          triggerActivityFamilyIds: goal.triggerActivityFamilyIds,
          triggerMinSets: goal.triggerMinSets,
        },
      };
      return NextResponse.json({ mode: "edit-group" as const, options, initial });
    }

    const [goal, options] = await Promise.all([getGoalById(goalId), getGoalFormOptions()]);
    if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    const initial: GoalFormInitial = {
      id: goal.id,
      name: goal.name,
      goalType: goal.goalType,
      targetType: goal.targetType,
      targetId: goal.targetId,
      metricType: goal.metricType,
      timeframe: goal.timeframe,
      targetValue: goal.targetValue,
      startDate: toYmd(goal.startDate),
      endDate: toYmd(goal.endDate),
      isActive: goal.isActive,
      notes: goal.notes ?? "",
      benchmarkDistanceMi: goal.config?.benchmarkDistanceMi ? String(goal.config.benchmarkDistanceMi) : "",
      benchmarkLabel: goal.config?.benchmarkLabel ?? "",
      sessionMetricDefinitionId: goal.config?.sessionMetricDefinitionId ?? "",
      sessionMetricTarget: goal.config?.sessionMetricTargetText ?? "",
    };
    return NextResponse.json({ mode: "edit" as const, options, initial });
  }

  const options = await getGoalFormOptions();
  const prefillRoutine = prefillRoutineId
    ? options.routines.find((r) => r.id === prefillRoutineId)
    : null;
  const initialGoalType: GoalTypeValue =
    prefillGoalType === "FREQUENCY" ||
    prefillGoalType === "PERFORMANCE" ||
    prefillGoalType === "VOLUME" ||
    prefillGoalType === "COMPLETION"
      ? (prefillGoalType as GoalTypeValue)
      : "FREQUENCY";
  const initialTargetId = prefillRoutine?.id ?? options.routines[0]?.id ?? "";
  const initialName = prefillRoutine ? `${prefillRoutine.label} frequency` : "";
  const initial: GoalFormInitial = {
    name: initialName,
    goalType: initialGoalType,
    targetType: "ROUTINE",
    targetId: initialTargetId,
    metricType: "SESSIONS",
    timeframe: "WEEK",
    targetValue: 3,
    startDate: todayAppYmd(),
    endDate: "",
    isActive: true,
    notes: "",
    benchmarkDistanceMi: "3.11",
    benchmarkLabel: "5K",
    sessionMetricDefinitionId: "",
    sessionMetricTarget: "",
  };
  return NextResponse.json({ mode: "new" as const, options, initial });
}
