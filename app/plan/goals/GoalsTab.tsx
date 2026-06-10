// Goals tab — unified tile/row list surface. Replaces the split frequency-
// heatmap + non-frequency-cards rendering with a single visual language:
// each goal is a horizontal row with a type-aware progress visual. Per the
// locked "habit lens = gentle visibility" feedback, behind-pace state is
// subtle amber on the left edge — not red, no alarm language.
//
// Sorted by status within each section so user immediately sees what
// needs attention without aggressive call-outs.
//
// Filter: single chip row for goal type + an Inactive toggle. Active-only
// by default.

import Link from "next/link";
import type { CSSProperties } from "react";
import { ProgressShell, SectionCard } from "@/app/progress/ui";
import { NewGoalDrawerButton } from "@/app/components/FormDrawerButtons";
import { GOAL_TYPE_LABELS } from "@/lib/goals-config";
import { getGoalsOverview, type GoalInsight } from "@/lib/goals";
import { getHomeData } from "@/app/_home/data";
import type { HabitRow } from "@/app/_home/types";
import { subtleTextStyle } from "@/app/goals/ui";
import GoalRow from "./GoalRow";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildGoalsHref(params: { type?: string; active?: string }) {
  const search = new URLSearchParams();
  search.set("tab", "goals");
  if (params.type && params.type !== "all") search.set("type", params.type);
  if (params.active && params.active !== "active") search.set("active", params.active);
  return `/plan?${search.toString()}`;
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

  const [allGoals, homeData] = await Promise.all([
    getGoalsOverview({ type, active }),
    getHomeData(),
  ]);

  // Map habit rows by goal id so each FREQUENCY GoalInsight gets paired
  // with its dailyState data for the week-strip visual. Non-frequency
  // goals render through the scalar progress visual using
  // GoalInsight.actualDisplay / targetDisplay / fractionComplete only.
  const habitByGoalId = new Map<string, HabitRow>();
  for (const row of homeData.habitRows) {
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

  const hasEntries = entries.length > 0;

  return (
    <ProgressShell
      section="overview"
      title="Plan / Goals"
      displayTitle={`Goals${type === "all" ? "" : ` — ${GOAL_TYPE_LABELS[type as keyof typeof GOAL_TYPE_LABELS] ?? ""}`}`}
      subtitle="Frequency, performance, volume, and completion goals — all derived from your routine and exercise logs."
      navLabel="Filter"
      navHint="Filter by goal type."
      navItems={TYPE_CHIPS.map((chip) => ({
        href: buildGoalsHref({ type: chip.value, active }),
        label: chip.label,
        active: chip.value === type,
      }))}
      actions={
        <NewGoalDrawerButton style={drawerCtaStyle}>
          New Goal
        </NewGoalDrawerButton>
      }
    >
      <SectionCard title="Goals">
        <div style={topRowStyle}>
          <Link
            href={buildGoalsHref({ type, active: showInactive ? "active" : "all" })}
            style={{
              ...inactivePillStyle,
              ...(showInactive ? inactivePillActiveStyle : {}),
            }}
          >
            {showInactive ? "Showing inactive" : "Show inactive"}
          </Link>
        </div>

        {!hasEntries ? (
          <div style={subtleTextStyle}>No goals match the current filters.</div>
        ) : (
          <div style={listStyle}>
            {entries.map((entry) => (
              <GoalRow
                key={entry.insight.goal.id}
                insight={entry.insight}
                habitRow={entry.habitRow}
                today={homeData.today}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </ProgressShell>
  );
}

const topRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 12,
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

const drawerCtaStyle: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 12,
  color: "inherit",
  fontWeight: 800,
  background: "rgba(255,255,255,0.06)",
  cursor: "pointer",
};

