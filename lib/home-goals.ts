import { getGoalsOverview } from "@/lib/goals";

// Non-frequency goals for the home Goals section. Frequency goals render as
// HabitGrid rows; this covers everything else and classifies each by SHAPE:
//
//   "recurring" — a per-window accumulating target (run 5mi/week, 100mi/
//     month). Structurally identical to a weekly frequency goal, so it
//     renders with the same bars-vs-target look and groups next to the
//     non-daily frequency goals rather than under one-off PRs.
//
//   "oneoff" — a single achievement / PR (squat 1RM 225, send a V8). A
//     scalar progress bar fits; bars-over-time would be meaningless.
//
// Reuses getGoalsOverview's tested insight math — including the per-window
// `history` series aggregateHistory already computes — so there's no new
// aggregation here, only flattening + classification.
export type HomeGoalHistoryPoint = { label: string; value: number };

export type HomeOtherGoal = {
  id: string;
  name: string;
  goalType: string;
  shape: "recurring" | "oneoff";
  fraction: number;
  isAchieved: boolean;
  actualDisplay: string;
  targetDisplay: string;
  timeframeLabel: string;
  detailHref: string;
  /** Raw per-window target value — the bars' target line. recurring only. */
  targetValue: number;
  /** 8-window history of summed values (oldest → newest). recurring only. */
  history: HomeGoalHistoryPoint[];
};

const MAX_HOME_OTHER_GOALS = 8;

// Recurring = a window that resets and accumulates. Performance goals are
// always one-off PRs; one-time goals obviously so. Everything else with a
// weekly/monthly window is recurring.
function classifyShape(goalType: string, timeframe: string): "recurring" | "oneoff" {
  if (goalType === "PERFORMANCE") return "oneoff";
  if (timeframe === "WEEK" || timeframe === "MONTH") return "recurring";
  return "oneoff";
}

export async function getHomeOtherGoals(): Promise<HomeOtherGoal[]> {
  const insights = await getGoalsOverview({ active: "active" });
  return insights
    .filter((entry) => entry.goal.goalType !== "FREQUENCY")
    .slice(0, MAX_HOME_OTHER_GOALS)
    .map((entry) => {
      const goalType = String(entry.goal.goalType);
      const timeframe = String(entry.goal.timeframe);
      const shape = classifyShape(goalType, timeframe);
      return {
        id: entry.goal.id,
        name: entry.goal.name,
        goalType,
        shape,
        fraction: Math.min(1, Math.max(0, entry.fractionComplete)),
        isAchieved: entry.isAchieved,
        actualDisplay: entry.actualDisplay,
        targetDisplay: entry.targetDisplay,
        timeframeLabel: entry.timeframeLabel,
        detailHref: entry.detailHref ?? `/plan/goals/${encodeURIComponent(entry.goal.id)}`,
        targetValue: entry.goal.targetValue ?? 0,
        history: shape === "recurring" ? entry.history.map((h) => ({ label: h.label, value: h.value })) : [],
      };
    });
}
