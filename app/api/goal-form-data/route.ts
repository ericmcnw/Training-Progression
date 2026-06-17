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
    // A goal id can arrive in several shapes:
    //   • Goal-table row      → a bare cuid (VOLUME/PERFORMANCE/… goals)
    //   • FrequencyGoal       → "group-frequency:<id>", "fg_<routineId>", OR a
    //                            bare FrequencyGoal cuid (the /plan/goals/[id]
    //                            detail page links with the bare id).
    // Resolve robustly: try the Goal table for un-prefixed ids, and treat
    // anything that isn't a Goal row (or is explicitly fg_/group-frequency:)
    // as a FrequencyGoal. Previously only the "group-frequency:" prefix was
    // recognized, so editing any other frequency-goal id 404'd.
    const looksFrequency = goalId.startsWith("group-frequency:") || goalId.startsWith("fg_");
    const goalRow = looksFrequency ? null : await getGoalById(goalId);

    if (looksFrequency || !goalRow) {
      const [goal, options] = await Promise.all([
        getGroupFrequencyGoalById(goalId),
        getGoalFormOptions(),
      ]);
      if (goal) {
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
          minReps: "",
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
      if (!goalRow) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const options = await getGoalFormOptions();
    if (!goalRow) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    const initial: GoalFormInitial = {
      id: goalRow.id,
      name: goalRow.name,
      goalType: goalRow.goalType,
      targetType: goalRow.targetType,
      targetId: goalRow.targetId,
      metricType: goalRow.metricType,
      timeframe: goalRow.timeframe,
      targetValue: goalRow.targetValue,
      startDate: toYmd(goalRow.startDate),
      endDate: toYmd(goalRow.endDate),
      isActive: goalRow.isActive,
      notes: goalRow.notes ?? "",
      benchmarkDistanceMi: goalRow.config?.benchmarkDistanceMi ? String(goalRow.config.benchmarkDistanceMi) : "",
      benchmarkLabel: goalRow.config?.benchmarkLabel ?? "",
      sessionMetricDefinitionId: goalRow.config?.sessionMetricDefinitionId ?? "",
      sessionMetricTarget: goalRow.config?.sessionMetricTargetText ?? "",
      minReps: goalRow.config?.minReps ? String(goalRow.config.minReps) : "",
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
    minReps: "",
  };
  return NextResponse.json({ mode: "new" as const, options, initial });
}
