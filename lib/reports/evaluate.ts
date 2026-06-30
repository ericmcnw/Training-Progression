// "Was it enough?" — the evaluative layer for reports. Reuses the app's single
// goal-evaluation engine (getGoalsOverview) rather than recomputing anything;
// we just pick the active goals whose natural cadence matches the report kind.
//
// getGoalsOverview evaluates each goal's CURRENT window only, so callers render
// this for the current period only. Past periods are served by the trend
// deltas (Phase 2). Evaluating goals for arbitrary past windows is a separate
// effort (the engine is current-window-oriented) — deferred.

import { getGoalsOverview, type GoalInsight } from "@/lib/goals";
import type { PeriodKind } from "./period";

// Which goal timeframes belong on which report. A weekly report surfaces daily
// + weekly goals; monthly surfaces monthly; yearly surfaces long-term one-offs.
const KIND_TIMEFRAMES: Record<PeriodKind, string[]> = {
  week: ["DAY", "WEEK"],
  month: ["MONTH"],
  year: ["ONE_TIME"],
};

export async function loadPeriodGoals(kind: PeriodKind): Promise<GoalInsight[]> {
  const all = await getGoalsOverview({ active: "active" });
  const timeframes = KIND_TIMEFRAMES[kind];
  return all.filter((g) => timeframes.includes(g.goal.timeframe));
}
