// Goals section — embedded at the top of the unified Plan page. Each goal is
// a horizontal row with a type-aware progress visual. Per the locked "habit
// lens = gentle visibility" feedback, behind-pace state is subtle amber on
// the left edge — not red, no alarm language.
//
// Sorted by status so the user immediately sees what needs attention without
// aggressive call-outs. Filter: a chip row for goal type + an Inactive
// toggle. Active-only by default. The page provides the section chrome +
// New Goal button; this component returns just the filter row + list.

import Link from "next/link";
import type { CSSProperties } from "react";
import { getGoalsOverview, type GoalInsight } from "@/lib/goals";
import { getHabitRowsOnly } from "@/app/_home/data";
import type { HabitRow } from "@/app/_home/types";
import { subtleTextStyle } from "@/app/goals/ui";
import GoalRow from "./GoalRow";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

// Build a /plan goal-filter href that preserves every other search param
// (e.g. the calendar's `month`) and only overrides type/active. Anchored to
// #goals so the filter tap keeps you at the goals section, not the page top.
function buildGoalsHref(current: SearchParams, override: { type?: string; active?: string }) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (key === "tab" || key === "type" || key === "active") continue;
    if (typeof value === "string") search.set(key, value);
  }
  if (override.type && override.type !== "all") search.set("type", override.type);
  if (override.active && override.active !== "active") search.set("active", override.active);
  const qs = search.toString();
  return `/plan${qs ? `?${qs}` : ""}#goals`;
}

const TYPE_CHIPS = [
  { value: "all", label: "All" },
  { value: "FREQUENCY", label: "Frequency" },
  { value: "PERFORMANCE", label: "Performance" },
  { value: "VOLUME", label: "Volume" },
  { value: "COMPLETION", label: "Completion" },
] as const;

// Sort goals by attention need so behind / at-risk surface first without
// any "Needs Attention" callout — the gentle-lens decision rules out the
// aggressive variant.
const STATUS_ORDER: Record<string, number> = {
  at_risk: 0,
  behind: 1,
  on_track: 2,
  ahead: 3,
  complete: 4,
};

type GoalRowEntry = {
  insight: GoalInsight;
  habitRow?: HabitRow;
  sortKey: number;
};

export default async function GoalsTab({ searchParams }: { searchParams: SearchParams }) {
  const type = getParam(searchParams, "type") ?? "all";
  const active = getParam(searchParams, "active") ?? "active";
  const showInactive = active === "all" || active === "inactive";

  const [allGoals, habitData] = await Promise.all([
    getGoalsOverview({ type, active }),
    getHabitRowsOnly(),
  ]);

  // Map habit rows by goal id so each FREQUENCY GoalInsight gets paired
  // with its dailyState data for the week-strip visual. Non-frequency
  // goals render through the scalar progress visual using
  // GoalInsight.actualDisplay / targetDisplay / fractionComplete only.
  const habitByGoalId = new Map<string, HabitRow>();
  for (const row of habitData.habitRows) {
    habitByGoalId.set(row.goalId, row);
  }

  const entries: GoalRowEntry[] = allGoals.map((insight) => {
    const habitRow = insight.goal.goalType === "FREQUENCY"
      ? habitByGoalId.get(insight.goal.id)
      : undefined;
    const statusKey = habitRow
      ? habitRow.status
      : insight.isAchieved
        ? "complete"
        : insight.fractionComplete >= 0.6
          ? "on_track"
          : insight.fractionComplete >= 0.3
            ? "behind"
            : "at_risk";
    return {
      insight,
      habitRow,
      sortKey: (STATUS_ORDER[statusKey] ?? 99) * 1000 + (1 - insight.fractionComplete) * 10,
    };
  });

  entries.sort((a, b) => a.sortKey - b.sortKey);

  // One-time achieved milestones latch forever — parking them in a collapsed
  // trophy shelf keeps the active list about what's in play, without hiding
  // the wins. Recurring "complete" goals stay in the main list (they refill
  // next window).
  const achieved = entries.filter(
    (e) => e.insight.isAchieved && e.insight.goal.timeframe === "ONE_TIME" && e.insight.goal.isActive
  );
  const achievedIds = new Set(achieved.map((e) => e.insight.goal.id));
  const activeEntries = entries.filter((e) => !achievedIds.has(e.insight.goal.id));

  const hasEntries = activeEntries.length > 0 || achieved.length > 0;

  return (
    <div style={wrapStyle}>
      <div style={filterRowStyle}>
        <div style={chipRowStyle} role="tablist" aria-label="Filter goals by type">
          {TYPE_CHIPS.map((chip) => {
            const isActive = chip.value === type;
            return (
              <Link
                key={chip.value}
                href={buildGoalsHref(searchParams, { type: chip.value, active })}
                scroll={false}
                style={{ ...chipStyle, ...(isActive ? chipActiveStyle : {}) }}
              >
                {chip.label}
              </Link>
            );
          })}
        </div>
        <Link
          href={buildGoalsHref(searchParams, { type, active: showInactive ? "active" : "all" })}
          scroll={false}
          style={{ ...inactivePillStyle, ...(showInactive ? inactivePillActiveStyle : {}) }}
        >
          {showInactive ? "Showing inactive" : "Show inactive"}
        </Link>
      </div>

      {!hasEntries ? (
        <div style={subtleTextStyle}>No goals match the current filters.</div>
      ) : (
        <div style={listStyle}>
          {activeEntries.map((entry) => (
            <GoalRow
              key={entry.insight.goal.id}
              insight={entry.insight}
              habitRow={entry.habitRow}
              today={habitData.today}
            />
          ))}
        </div>
      )}

      {achieved.length > 0 ? (
        <details style={achievedShellStyle}>
          <summary style={achievedSummaryStyle}>
            🏆 Achieved
            <span style={achievedCountStyle}>{achieved.length}</span>
          </summary>
          <div style={{ ...listStyle, marginTop: 8 }}>
            {achieved.map((entry) => (
              <GoalRow
                key={entry.insight.goal.id}
                insight={entry.insight}
                habitRow={entry.habitRow}
                today={habitData.today}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const filterRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const chipStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.2,
  textDecoration: "none",
  color: "inherit",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  minHeight: 32,
  display: "inline-flex",
  alignItems: "center",
};

const chipActiveStyle: CSSProperties = {
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
};

const inactivePillStyle: CSSProperties = {
  padding: "5px 12px",
  border: "1px solid rgba(128,128,128,0.32)",
  borderRadius: 999,
  background: "rgba(128,128,128,0.07)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 700,
};

const inactivePillActiveStyle: CSSProperties = {
  border: "1px solid rgba(128,128,128,0.55)",
  background: "rgba(128,128,128,0.2)",
  fontWeight: 900,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const achievedShellStyle: CSSProperties = {
  border: "1px solid rgba(74,222,128,0.22)",
  borderRadius: 12,
  padding: "10px 12px",
  background: "rgba(74,222,128,0.04)",
};

const achievedSummaryStyle: CSSProperties = {
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  gap: 8,
  listStyle: "none",
  minHeight: 28,
};

const achievedCountStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 900,
  padding: "1px 7px",
  borderRadius: 999,
  border: "1px solid rgba(74,222,128,0.4)",
  background: "rgba(74,222,128,0.1)",
  color: "rgba(134,239,172,0.95)",
};

