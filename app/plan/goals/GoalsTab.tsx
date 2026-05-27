// Goals tab — consolidated Goals surface. Frequency goals render using
// Home's HabitGrid (in bare mode, no card chrome) so the two surfaces
// share one visual language. Non-frequency goals stay as the existing
// card grid for now; flattening them is a follow-up.
//
// Filter: single chip row combining goal type + an Inactive toggle.
// Default is active-only; pressing Inactive expands to show inactive goals.
//
// Note on data: this tab calls getHomeData() to pick up the precomputed
// HabitRow[] (same shape Home uses). That's wasteful — getHomeData
// computes things like movement patterns we don't need here — but
// extracting computeHabitRows() into a shared lib is a follow-up. This
// keeps Phase A focused.

import Link from "next/link";
import type { CSSProperties } from "react";
import { ProgressShell, SectionCard } from "@/app/progress/ui";
import { NewGoalDrawerButton } from "@/app/components/FormDrawerButtons";
import { GOAL_TYPE_LABELS } from "@/lib/goals-config";
import { getGoalsOverview, type GoalInsight } from "@/lib/goals";
import { getHomeData } from "@/app/_home/data";
import HabitGrid from "@/app/_home/HabitGrid";
import {
  GOAL_TYPE_CHIP_STYLE,
  GoalCardShell,
  GoalMetaLine,
  GoalProgressRing,
  GoalStatusBadge,
  chipStyle,
  smallActionLinkStyle,
  subtleTextStyle,
} from "@/app/goals/ui";
import DeleteGoalButton from "@/app/goals/DeleteGoalButton";

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

export default async function GoalsTab({ searchParams }: { searchParams: SearchParams }) {
  const type = getParam(searchParams, "type") ?? "all";
  const active = getParam(searchParams, "active") ?? "active";
  const showInactive = active === "all" || active === "inactive";

  // Two parallel fetches: getGoalsOverview powers the non-frequency cards;
  // getHomeData provides the HabitRow[] shape that HabitGrid expects. Yes,
  // wasteful — see file header.
  const [allGoals, homeData] = await Promise.all([
    getGoalsOverview({ type, active }),
    getHomeData(),
  ]);

  const otherGoals = allGoals.filter((e) => e.goal.goalType !== "FREQUENCY");
  // Frequency goals come from homeData.habitRows (already filtered to active
  // goals server-side). If the user toggled Inactive, we'd need the
  // FREQUENCY rows filtered separately — leaving that as a follow-up since
  // the Home dashboard treats inactive frequency goals as invisible too.
  const frequencyRows = homeData.habitRows;

  const showFrequency = (type === "all" || type === "FREQUENCY") && frequencyRows.length > 0;
  const showOthers = type === "all" || type !== "FREQUENCY";

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
        {/* Inactive chip — collapsed from the two-row filter the old page
            had. Active is the implicit default; Inactive opens the door
            to also see archived items. */}
        <div style={inactiveRowStyle}>
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

        {allGoals.length === 0 && (!showFrequency || frequencyRows.length === 0) ? (
          <div style={subtleTextStyle}>No goals match the current filters.</div>
        ) : (
          <>
            {showFrequency ? (
              <>
                {showOthers && otherGoals.length > 0 ? (
                  <div style={sectionSubheadStyle}>Frequency</div>
                ) : null}
                <HabitGrid rows={frequencyRows} today={homeData.today} chrome="bare" />
              </>
            ) : null}

            {showFrequency && showOthers && otherGoals.length > 0 ? (
              <div style={sectionDividerStyle} />
            ) : null}

            {showOthers && otherGoals.length > 0 ? (
              <>
                {showFrequency ? (
                  <div style={sectionSubheadStyle}>Performance &amp; Other</div>
                ) : null}
                <div className="goalsNonFreqGrid" style={gridStyle}>
                  {otherGoals.map((entry) => {
                    return (
                      <GoalCardShell
                        key={entry.goal.id}
                        href={entry.detailHref ? entry.detailHref.replace(/^\/goals\//, "/plan/goals/") : undefined}
                        goalType={entry.goal.goalType}
                        className="goalCardShell"
                        action={
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {entry.editHref ? (
                              <Link href={entry.editHref} style={smallActionLinkStyle}>
                                Edit
                              </Link>
                            ) : null}
                            <DeleteGoalButton goalId={entry.goal.id} />
                          </div>
                        }
                      >
                        <NonFreqGoalCardBody entry={entry} />
                      </GoalCardShell>
                    );
                  })}
                </div>
              </>
            ) : null}
          </>
        )}
      </SectionCard>
    </ProgressShell>
  );
}

function NonFreqGoalCardBody({ entry }: { entry: GoalInsight }) {
  const typeChipStyle = { ...chipStyle, ...(GOAL_TYPE_CHIP_STYLE[entry.goal.goalType] ?? {}) };
  return (
    <div className="goalCardBody" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div className="goalCardTextBlock" style={{ display: "grid", gap: 8, flex: "1 1 220px" }}>
        <div>
          <div className="goalCardName" style={{ fontSize: 18, fontWeight: 900 }}>{entry.goal.name}</div>
          <GoalMetaLine>{entry.summaryLabel}</GoalMetaLine>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={typeChipStyle}>{entry.goalTypeLabel}</span>
          <span style={chipStyle}>{entry.targetKindLabel}</span>
          <span style={chipStyle}>{entry.timeframeLabel}</span>
          {!entry.goal.isActive ? <span style={chipStyle}>Inactive</span> : null}
        </div>
        <div className="goalCardMetaLine">
          <GoalMetaLine>
            Actual vs goal: {entry.actualDisplay} / {entry.targetDisplay}
          </GoalMetaLine>
        </div>
        <div className="goalCardMetaLine">
          <GoalMetaLine>
            {entry.timeframeWindowLabel} status: <GoalStatusBadge label={entry.timeframeStatusLabel} achieved={entry.isAchieved} />
          </GoalMetaLine>
        </div>
      </div>
      <div className="goalCardRingWrap" style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <GoalProgressRing current={entry.actualDisplay} target={entry.targetDisplay} fraction={entry.fractionComplete} />
        <div className="goalCardTargetLabel" style={{ fontSize: 12, opacity: 0.75 }}>{entry.targetLabel}</div>
      </div>
    </div>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

const inactiveRowStyle: CSSProperties = {
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

const sectionSubheadStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.45,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  marginTop: 6,
  marginBottom: 8,
};

const sectionDividerStyle: CSSProperties = {
  height: 1,
  background: "rgba(128,128,128,0.16)",
  margin: "16px 0",
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
