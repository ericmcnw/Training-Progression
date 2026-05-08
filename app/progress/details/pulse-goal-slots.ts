import type { GoalInsight } from "@/lib/goals";
import type { PulseSlot, PulseSlotRole } from "./ActivityPulseStrip";

const GOAL_ACCENT = "rgba(139,92,246,0.9)"; // violet — matches ActivityGoalsSection accent

/**
 * Maps a goal to the pulse slot role it best represents. Returns null when
 * the goal doesn't fit any of the four pulse roles cleanly (eg. exotic
 * one-time targets that don't map to weekly momentum).
 *
 * Priority is by goal type first, then timeframe — frequency goals always own
 * the "frequency" slot, performance goals own "recent-performance", volume
 * goals fall to whichever fits their timeframe.
 */
function goalToSlotRole(goal: GoalInsight): PulseSlotRole | null {
  const goalType = goal.goal.goalType;
  const timeframe = goal.goal.timeframe;

  if (goalType === "FREQUENCY") return "frequency";
  if (goalType === "PERFORMANCE") return "recent-performance";
  if (goalType === "COMPLETION") return "recent-performance";
  if (goalType === "VOLUME") {
    if (timeframe === "WEEK" || timeframe === "DAY") return "frequency";
    return "all-time-best";
  }

  return null;
}

function statusTrendFor(goal: GoalInsight) {
  if (goal.isAchieved) {
    return { arrow: "✓", tone: "up" as const, delta: "Done" };
  }
  if (!goal.hasData) {
    return { arrow: "→", tone: "flat" as const, delta: "No data" };
  }
  const status = goal.timeframeStatusLabel.toLowerCase();
  if (status.includes("ahead")) return { arrow: "↑", tone: "up" as const, delta: "Ahead" };
  if (status.includes("behind") || status.includes("off")) return { arrow: "↓", tone: "down" as const, delta: "Behind" };
  if (status.includes("on track")) return { arrow: "→", tone: "flat" as const, delta: "On track" };
  return { arrow: "→", tone: "flat" as const, delta: goal.timeframeStatusLabel };
}

function goalToPulseSlot(goal: GoalInsight, role: PulseSlotRole): PulseSlot {
  return {
    role,
    label: goal.goal.name,
    value: `${goal.actualDisplay}/${goal.targetDisplay}`,
    sub: `${goal.metricLabel} · ${goal.timeframeWindowLabel}`,
    trend: statusTrendFor(goal),
    accent: GOAL_ACCENT,
    goal: {
      href: goal.detailHref ?? "/goals",
      fractionComplete: goal.fractionComplete,
      isAchieved: goal.isAchieved,
    },
  };
}

/**
 * Merges goal-mode pulse cards into the default pulse slot row.
 *
 * For each pulse-slot role represented in the default slots, picks the most
 * actionable matching goal (lowest fractionComplete first — what needs
 * attention surfaces) and substitutes its slot. Slots without matching goals
 * keep their default content. Goals that don't map to any role pass through
 * unchanged in the output (they remain visible in ActivityGoalsSection).
 *
 * Stable order preserved — default slot positions don't shuffle when a goal
 * takes them over.
 */
export function applyGoalsToPulseSlots(defaults: PulseSlot[], goals: GoalInsight[]): PulseSlot[] {
  if (goals.length === 0) return defaults;

  // Bucket eligible goals by slot role, then pick the most actionable per role.
  const byRole = new Map<PulseSlotRole, GoalInsight[]>();
  for (const goal of goals) {
    if (goal.isAchieved) continue; // achieved goals don't need a hero card
    const role = goalToSlotRole(goal);
    if (!role) continue;
    const list = byRole.get(role) ?? [];
    list.push(goal);
    byRole.set(role, list);
  }

  const winningGoalByRole = new Map<PulseSlotRole, GoalInsight>();
  for (const [role, candidates] of byRole) {
    candidates.sort((a, b) => a.fractionComplete - b.fractionComplete);
    winningGoalByRole.set(role, candidates[0]);
  }

  return defaults.map((slot) => {
    if (!slot.role) return slot;
    const winner = winningGoalByRole.get(slot.role);
    if (!winner) return slot;
    return goalToPulseSlot(winner, slot.role);
  });
}
