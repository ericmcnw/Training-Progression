// Goals tab — consolidated Goals surface. Frequency goals render using
// Home's HabitGrid (in bare mode, no card chrome) so the two surfaces
// share one visual language. Non-frequency goals (Performance, Volume,
// Completion) currently support two parallel layouts so you can pick:
//   • "cards" — type-tailored cards (Performance shows current → target
//     with delta; Volume/Completion show progress bars/dots).
//   • "rows" — unified compact rows, matches frequency-goal styling.
// Driven by the `goalLayout` query param + a small chip toggle near the
// section header. Once one is picked we delete the other and drop the
// toggle.
//
// Filter: single chip row combining goal type + an Inactive toggle.
// Default is active-only; pressing Inactive expands to show inactive goals.
//
// Note on data: this tab calls getHomeData() to pick up the precomputed
// HabitRow[] (same shape Home uses). That's wasteful — getHomeData
// computes things like movement patterns we don't need here — but
// extracting computeHabitRows() into a shared lib is a follow-up.

import Link from "next/link";
import type { CSSProperties } from "react";
import { ProgressShell, SectionCard } from "@/app/progress/ui";
import { NewGoalDrawerButton } from "@/app/components/FormDrawerButtons";
import { GOAL_TYPE_LABELS } from "@/lib/goals-config";
import { getGoalsOverview } from "@/lib/goals";
import { getHomeData } from "@/app/_home/data";
import HabitGrid from "@/app/_home/HabitGrid";
import { subtleTextStyle } from "@/app/goals/ui";
import NonFreqGoals, { type NonFreqLayout } from "./NonFreqGoals";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildGoalsHref(params: { type?: string; active?: string; goalLayout?: string }) {
  const search = new URLSearchParams();
  search.set("tab", "goals");
  if (params.type && params.type !== "all") search.set("type", params.type);
  if (params.active && params.active !== "active") search.set("active", params.active);
  if (params.goalLayout && params.goalLayout !== "cards") search.set("goalLayout", params.goalLayout);
  return `/plan?${search.toString()}`;
}

const TYPE_CHIPS = [
  { value: "all", label: "All" },
  { value: "FREQUENCY", label: "Frequency" },
  { value: "PERFORMANCE", label: "Performance" },
  { value: "VOLUME", label: "Volume" },
  { value: "COMPLETION", label: "Completion" },
] as const;

const LAYOUT_CHIPS: Array<{ value: NonFreqLayout; label: string }> = [
  { value: "cards", label: "Cards" },
  { value: "rows", label: "Rows" },
];

function parseLayout(raw: string | undefined): NonFreqLayout {
  return raw === "rows" ? "rows" : "cards";
}

export default async function GoalsTab({ searchParams }: { searchParams: SearchParams }) {
  const type = getParam(searchParams, "type") ?? "all";
  const active = getParam(searchParams, "active") ?? "active";
  const goalLayout = parseLayout(getParam(searchParams, "goalLayout"));
  const showInactive = active === "all" || active === "inactive";

  const [allGoals, homeData] = await Promise.all([
    getGoalsOverview({ type, active }),
    getHomeData(),
  ]);

  const otherGoals = allGoals.filter((e) => e.goal.goalType !== "FREQUENCY");
  const frequencyRows = homeData.habitRows;

  const showFrequency = (type === "all" || type === "FREQUENCY") && frequencyRows.length > 0;
  const showOthers = (type === "all" || type !== "FREQUENCY") && otherGoals.length > 0;

  return (
    <ProgressShell
      section="overview"
      title="Plan / Goals"
      displayTitle={`Goals${type === "all" ? "" : ` — ${GOAL_TYPE_LABELS[type as keyof typeof GOAL_TYPE_LABELS] ?? ""}`}`}
      subtitle="Frequency, performance, volume, and completion goals — all derived from your routine and exercise logs."
      navLabel="Filter"
      navHint="Filter by goal type."
      navItems={TYPE_CHIPS.map((chip) => ({
        href: buildGoalsHref({ type: chip.value, active, goalLayout }),
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
            href={buildGoalsHref({ type, active: showInactive ? "active" : "all", goalLayout })}
            style={{
              ...inactivePillStyle,
              ...(showInactive ? inactivePillActiveStyle : {}),
            }}
          >
            {showInactive ? "Showing inactive" : "Show inactive"}
          </Link>
        </div>

        {!showFrequency && !showOthers ? (
          <div style={subtleTextStyle}>No goals match the current filters.</div>
        ) : (
          <>
            {showFrequency ? (
              <>
                {showOthers ? <div style={sectionSubheadStyle}>Frequency</div> : null}
                <HabitGrid rows={frequencyRows} today={homeData.today} chrome="bare" />
              </>
            ) : null}

            {showFrequency && showOthers ? <div style={sectionDividerStyle} /> : null}

            {showOthers ? (
              <>
                {/* Layout toggle — only shown while we're A/B-ing the two
                    designs. Once one is picked, remove this chip pair and
                    the parseLayout/layout-aware code. */}
                <div style={layoutToggleRow}>
                  {showFrequency ? (
                    <div style={sectionSubheadStyle}>Performance &amp; Other</div>
                  ) : <div />}
                  <div style={layoutToggleGroup} role="group" aria-label="Goal card layout">
                    <span style={layoutToggleLabel}>Layout:</span>
                    {LAYOUT_CHIPS.map((chip) => {
                      const isActive = chip.value === goalLayout;
                      return (
                        <Link
                          key={chip.value}
                          href={buildGoalsHref({ type, active, goalLayout: chip.value })}
                          replace
                          style={{
                            ...layoutChipStyle,
                            ...(isActive ? layoutChipActiveStyle : {}),
                          }}
                        >
                          {chip.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <NonFreqGoals entries={otherGoals} layout={goalLayout} />
              </>
            ) : null}
          </>
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

const sectionSubheadStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.45,
  textTransform: "uppercase",
  letterSpacing: 0.6,
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

const layoutToggleRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 8,
};

const layoutToggleGroup: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: 3,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
};

const layoutToggleLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
  paddingInline: 6,
};

const layoutChipStyle: CSSProperties = {
  padding: "4px 12px",
  borderRadius: 999,
  textDecoration: "none",
  color: "rgba(255,255,255,0.65)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.2,
  background: "transparent",
  border: "1px solid transparent",
};

const layoutChipActiveStyle: CSSProperties = {
  background: "rgba(51,255,122,0.12)",
  color: "rgba(51,255,122,0.95)",
  border: "1px solid rgba(51,255,122,0.40)",
};
