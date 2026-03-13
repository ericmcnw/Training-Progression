import Link from "next/link";
import { FilterBar, FilterSelect, ProgressShell, SectionCard, SectionLinkButton } from "@/app/progress/ui";
import { GOAL_TYPE_LABELS } from "@/lib/goals-config";
import { getGoalsOverview } from "@/lib/goals";
import { GoalCardShell, GoalMetaLine, GoalProgressRing, GoalStatusBadge, chipStyle, subtleTextStyle } from "./ui";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const type = getParam(params, "type") ?? "all";
  const active = getParam(params, "active") ?? "active";
  const goals = await getGoalsOverview({ type, active });

  return (
    <ProgressShell
      section="overview"
      title="Goals"
      subtitle="Active targets calculated directly from your existing routine, exercise, cardio, and metadata-group logs."
      actions={<SectionLinkButton href="/goals/new" label="New Goal" />}
    >
      <SectionCard title="Filters">
        <FilterBar>
          <FilterSelect
            name="type"
            defaultValue={type}
            options={[
              { value: "all", label: "All goal types" },
              ...Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />
          <FilterSelect
            name="active"
            defaultValue={active}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "all", label: "Active + inactive" },
            ]}
          />
          <button type="submit" style={buttonStyle}>
            Apply
          </button>
          <Link href="/goals" style={secondaryButtonStyle}>
            Reset
          </Link>
        </FilterBar>
      </SectionCard>

      <SectionCard title="Overview">
        {goals.length === 0 ? (
          <div style={subtleTextStyle}>No goals match the current filters.</div>
        ) : (
          <div style={gridStyle}>
            {goals.map((entry) => (
              <GoalCardShell key={entry.goal.id} href={`/goals/${entry.goal.id}`}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 8, flex: "1 1 260px" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>{entry.goal.name}</div>
                      <GoalMetaLine>{entry.summaryLabel}</GoalMetaLine>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={chipStyle}>{entry.goalTypeLabel}</span>
                      <span style={chipStyle}>{entry.targetKindLabel}</span>
                      <span style={chipStyle}>{entry.timeframeLabel}</span>
                      {!entry.goal.isActive ? <span style={chipStyle}>Inactive</span> : null}
                    </div>
                    <GoalMetaLine>
                      Actual vs goal: {entry.actualDisplay} / {entry.targetDisplay}
                    </GoalMetaLine>
                    <GoalMetaLine>
                      {entry.timeframeWindowLabel} status: <GoalStatusBadge label={entry.timeframeStatusLabel} achieved={entry.isAchieved} />
                    </GoalMetaLine>
                  </div>

                  <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
                    <GoalProgressRing current={entry.actualDisplay} target={entry.targetDisplay} fraction={entry.fractionComplete} />
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{entry.targetLabel}</div>
                  </div>
                </div>
              </GoalCardShell>
            ))}
          </div>
        )}
      </SectionCard>
    </ProgressShell>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.45)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 800,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  textDecoration: "none",
};
