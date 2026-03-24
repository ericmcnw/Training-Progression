import Link from "next/link";
import { FilterBar, FilterSelect, ProgressShell, SectionCard, SectionLinkButton } from "@/app/progress/ui";
import { GOAL_TYPE_LABELS } from "@/lib/goals-config";
import { getGoalFormOptions, getGoalsOverview } from "@/lib/goals";
import GoalForm, { type GoalFormInitial } from "./GoalForm";
import { createGoal } from "./actions";
import { GoalCardShell, GoalMetaLine, GoalProgressRing, GoalStatusBadge, chipStyle, subtleTextStyle } from "./ui";
import { GOAL_TEMPLATES, getGoalTemplate, type GoalTemplateKey } from "@/lib/goal-templates";

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
  const mode = getParam(params, "mode") === "new" ? "new" : "list";
  const builderMode = getParam(params, "builder") === "advanced" ? "advanced" : "guided";
  const templateKey = (getParam(params, "template") as GoalTemplateKey | undefined) ?? GOAL_TEMPLATES[0].key;
  const template = getGoalTemplate(templateKey);
  const [goals, options] = await Promise.all([
    getGoalsOverview({ type, active }),
    mode === "new" ? getGoalFormOptions() : Promise.resolve(null),
  ]);

  const targetId =
    template.targetType === "ROUTINE"
      ? options?.routines[0]?.id ?? ""
      : template.targetType === "EXERCISE"
      ? options?.exercises[0]?.id ?? ""
      : template.targetType === "CARDIO"
      ? options?.cardioTargets[0]?.id ?? ""
      : template.targetType === "SESSION_TEMPLATE"
      ? options?.sessionTemplates[0]?.id ?? ""
      : options?.groups[0]?.id ?? "";

  const initial: GoalFormInitial = {
    name: "",
    goalType: template.goalType,
    targetType: template.targetType,
    targetId,
    metricType: template.metricType,
    timeframe: template.timeframe,
    targetValue: template.targetValue,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    isActive: true,
    notes: "",
    benchmarkDistanceMi: template.benchmarkDistanceMi ? String(template.benchmarkDistanceMi) : "3.11",
    benchmarkLabel: template.benchmarkLabel ?? "5K",
    sessionMetricDefinitionId: "",
    sessionMetricTarget: "",
  };

  return (
    <ProgressShell
      section="overview"
      title="Goals"
      subtitle="Active targets calculated directly from your existing routine, exercise, cardio, and group logs."
      actions={<SectionLinkButton href={mode === "new" ? "/goals" : `/goals?mode=new&template=${template.key}`} label={mode === "new" ? "Back to Goals" : "New Goal"} />}
    >
      {mode === "new" && options ? (
        <SectionCard title={builderMode === "advanced" ? "Advanced Goal Setup" : "Create Goal"}>
          <GoalForm
            action={createGoal}
            options={options}
            submitLabel="Save Goal"
            initial={initial}
            mode={builderMode}
            initialTemplateKey={template.key}
          />
          {builderMode === "guided" ? (
            <div style={modeRowStyle}>
              <div style={templateDescriptionStyle}>Need full control over goal type, target type, metric, and timeframe?</div>
              <Link href={`/goals?mode=new&template=${template.key}&builder=advanced`} style={modeLinkStyle}>
                Open advanced goal builder
              </Link>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

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

const templateDescriptionStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.76,
};

const modeRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const modeLinkStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.4)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
};
