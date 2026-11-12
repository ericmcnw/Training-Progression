// Status key for a goal row. FREQUENCY goals get theirs from the habit row
// (same math the home page uses); everything else is derived here from
// progress against how much of its own window the goal has actually had.
//
// The flat 60%/30% cutoffs this replaces judged every goal as if its window
// were already over, so a goal created today opened at "At risk" with 0%
// logged. Pro-rating by elapsed window keeps the warning tones for goals
// that have had the time to earn them.

import type { HabitRow } from "@/app/_home/types";
import type { GoalInsight } from "@/lib/goals";
import { diffYmdDays, toAppYmd } from "@/lib/dates";

type StatusKey = HabitRow["status"];

const TIMEFRAME_WINDOW_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30 };

// Progress can lag pace by this much before the row takes on a warning tone —
// without it, every goal reads "behind" for the first hour of its existence.
const PACE_TOLERANCE = 0.1;

export function goalStatusKey(
  insight: GoalInsight,
  habitRow: HabitRow | undefined,
  today: string
): StatusKey {
  if (habitRow) return habitRow.status;
  if (insight.isAchieved) return "complete";

  const { elapsed, isFirstDay } = goalWindowPace(insight, today);
  // Open-ended goals have no deadline to fall behind against.
  if (elapsed === null) return "on_track";

  const fraction = insight.fractionComplete;
  if (fraction > 0 && fraction >= elapsed * 1.1) return "ahead";
  if (fraction + PACE_TOLERANCE >= elapsed * 0.6) return "on_track";
  // A daily goal's window IS today, so pro-rating can't rescue one created
  // this morning — nothing is late on the day it was made.
  if (isFirstDay) return "on_track";
  if (elapsed < 1 || fraction >= 0.3) return "behind";
  return "at_risk";
}

/** How much of the goal's current window has elapsed, 0–1, clamped to the
 *  goal's own start so a mid-week goal isn't charged for Sunday through
 *  Tuesday. Elapsed is null when the goal has no window at all. */
function goalWindowPace(
  insight: GoalInsight,
  today: string
): { elapsed: number | null; isFirstDay: boolean } {
  const goal = insight.goal;
  const startYmd = toAppYmd(goal.startDate ?? goal.createdAt);
  const daysLived = diffYmdDays(today, startYmd) + 1;
  const isFirstDay = startYmd >= today;

  if (goal.timeframe === "ONE_TIME") {
    if (!goal.endDate) return { elapsed: null, isFirstDay };
    const span = diffYmdDays(toAppYmd(goal.endDate), startYmd) + 1;
    return { elapsed: span <= 0 ? 1 : clamp01(daysLived / span), isFirstDay };
  }

  const windowDays = TIMEFRAME_WINDOW_DAYS[goal.timeframe] ?? 7;
  return { elapsed: clamp01(daysLived / windowDays), isFirstDay };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
