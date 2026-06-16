import { getGoalsOverview } from "@/lib/goals";

// Compact non-frequency goals for the home Goals section's "Other goals"
// subgroup. Frequency goals render via the HabitGrid rows already on home —
// this covers PERFORMANCE / VOLUME / COMPLETION targets so the user can
// glance their progress without a trip to /plan.
//
// Reuses getGoalsOverview's tested insight math (fractionComplete, display
// strings) rather than re-deriving progress, then flattens to a small
// serializable shape for the client component.
export type HomeOtherGoal = {
  id: string;
  name: string;
  goalType: string;
  /** 0–1 progress toward target. */
  fraction: number;
  isAchieved: boolean;
  actualDisplay: string;
  targetDisplay: string;
  timeframeLabel: string;
  detailHref: string;
};

const MAX_HOME_OTHER_GOALS = 6;

export async function getHomeOtherGoals(): Promise<HomeOtherGoal[]> {
  const insights = await getGoalsOverview({ active: "active" });
  return insights
    // Frequency goals (manual FREQUENCY, fg_*, group-frequency:*) already
    // render as HabitGrid rows on home — exclude them here so the subgroup
    // is strictly the scalar-progress goals.
    .filter((entry) => entry.goal.goalType !== "FREQUENCY")
    .slice(0, MAX_HOME_OTHER_GOALS)
    .map((entry) => ({
      id: entry.goal.id,
      name: entry.goal.name,
      goalType: String(entry.goal.goalType),
      fraction: Math.min(1, Math.max(0, entry.fractionComplete)),
      isAchieved: entry.isAchieved,
      actualDisplay: entry.actualDisplay,
      targetDisplay: entry.targetDisplay,
      timeframeLabel: entry.timeframeLabel,
      detailHref: entry.detailHref ?? `/plan/goals/${encodeURIComponent(entry.goal.id)}`,
    }));
}
