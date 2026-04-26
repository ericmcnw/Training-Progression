import Link from "next/link";
import { ProgressShell, SectionCard, SectionLinkButton } from "@/app/progress/ui";
import { formatAppDate, todayAppYmd } from "@/lib/dates";
import { GOAL_TYPE_LABELS } from "@/lib/goals-config";
import { getGoalFormOptions, getGoalsOverview, type GoalInsight } from "@/lib/goals";
import GoalForm, { type GoalFormInitial } from "./GoalForm";
import { createGoal, toggleGoalActive, toggleGroupFrequencyGoal, toggleRoutineFrequencyGoal } from "./actions";
import { createFrequencyGoal } from "@/app/routines/actions";
import { GOAL_TYPE_CHIP_STYLE, GoalCardShell, GoalMetaLine, GoalProgressRing, GoalStatusBadge, FrequencySlotBar, chipStyle, smallActionLinkStyle, subtleTextStyle } from "./ui";
import { GOAL_TEMPLATES, getGoalTemplate, type GoalTemplateKey } from "@/lib/goal-templates";
import { FrequencyGoalRow, type FrequencyGoalRowData } from "./FrequencyGoalRow";
import DeleteGoalButton from "./DeleteGoalButton";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildGoalsHref(params: {
  type?: string;
  active?: string;
  mode?: "list" | "new";
  template?: string;
  builder?: "guided" | "advanced";
}) {
  const search = new URLSearchParams();
  if (params.type && params.type !== "all") search.set("type", params.type);
  if (params.active && params.active !== "active") search.set("active", params.active);
  if (params.mode === "new") search.set("mode", "new");
  if (params.template) search.set("template", params.template);
  if (params.builder && params.builder !== "guided") search.set("builder", params.builder);
  const query = search.toString();
  return query ? `/goals?${query}` : "/goals";
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
  const currentGoalsHref = buildGoalsHref({ type, active });
  const [goals, options] = await Promise.all([
    getGoalsOverview({ type, active }),
    mode === "new" ? getGoalFormOptions() : Promise.resolve(null),
  ]);
  const frequencyGoals = goals.filter((e) => e.goal.goalType === "FREQUENCY");
  const otherGoals = goals.filter((e) => e.goal.goalType !== "FREQUENCY");
  const typeLabel = type === "all" ? "All" : GOAL_TYPE_LABELS[type as keyof typeof GOAL_TYPE_LABELS] ?? "All";
  const typeNavItems = [
    { value: "all", label: "All" },
    { value: "FREQUENCY", label: "Frequency" },
    { value: "PERFORMANCE", label: "Performance" },
    { value: "VOLUME", label: "Volume" },
    { value: "COMPLETION", label: "Completion" },
  ].map((item) => ({
    href: buildGoalsHref({ type: item.value, active }),
    label: item.label,
    active: type === item.value || (item.value === "all" && type === "all"),
  }));

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
    startDate: todayAppYmd(),
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
      displayTitle={`Goals - ${typeLabel}`}
      subtitle="Active targets calculated directly from your existing routine, exercise, cardio, and group logs."
      navLabel="Choose Goal Type"
      navHint="Switch between all goals or a single goal category."
      navItems={typeNavItems}
      actions={
        <SectionLinkButton
          href={
            mode === "new"
              ? buildGoalsHref({ type, active })
              : buildGoalsHref({ type, active, mode: "new", template: template.key })
          }
          label={mode === "new" ? "Back to Goals" : "New Goal"}
        />
      }
    >
      {mode === "new" && options ? (
        <SectionCard title={builderMode === "advanced" ? "Advanced Goal Setup" : "Create Goal"}>
          <GoalForm
            action={createGoal}
            groupFrequencyAction={createFrequencyGoal}
            options={options}
            submitLabel="Save Goal"
            initial={initial}
            mode={builderMode}
            initialTemplateKey={template.key}
          />
          {builderMode === "guided" ? (
            <div style={modeRowStyle}>
              <div style={templateDescriptionStyle}>Need full control over goal type, target type, metric, and timeframe?</div>
              <Link href={buildGoalsHref({ type, active, mode: "new", template: template.key, builder: "advanced" })} style={modeLinkStyle}>
                Open advanced goal builder
              </Link>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard title={`${typeLabel} Goals`}>
        <div style={activeFilterRowStyle}>
          <span style={activeFilterLabelStyle}>Show:</span>
          {[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ].map((item) => (
            <Link
              key={item.value}
              href={buildGoalsHref({ type, active: item.value })}
              style={{
                ...activeFilterPillStyle,
                ...(active === item.value ? activeFilterPillActiveStyle : {}),
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {goals.length === 0 ? (
          <div style={subtleTextStyle}>No goals match the current filters.</div>
        ) : (
          <>
            {/* Frequency goals — stacked row table */}
            {frequencyGoals.length > 0 ? (
              <>
                {otherGoals.length > 0 ? (
                  <div style={sectionSubheadStyle}>Frequency</div>
                ) : null}
                <div style={frequencyTableStyle}>
                  {frequencyGoals.map((entry, idx) => {
                    const isGroupFrequency = entry.goal.id.startsWith("group-frequency:");
                    const toggleAction = isGroupFrequency
                      ? toggleGroupFrequencyGoal
                      : entry.toggleFrequencyGoalHref
                      ? toggleRoutineFrequencyGoal
                      : toggleGoalActive;
                    return (
                      <div key={entry.goal.id}>
                        <FrequencyGoalRow
                          data={toFrequencyRowData(entry)}
                          toggleAction={toggleAction}
                          currentGoalsHref={currentGoalsHref}
                        />
                        {idx < frequencyGoals.length - 1 ? (
                          <div style={rowDividerStyle} />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {/* Divider between sections */}
            {frequencyGoals.length > 0 && otherGoals.length > 0 ? (
              <div style={sectionDividerStyle} />
            ) : null}

            {/* Non-frequency goals — card grid */}
            {otherGoals.length > 0 ? (
              <>
                {frequencyGoals.length > 0 ? (
                  <div style={sectionSubheadStyle}>Performance &amp; Other</div>
                ) : null}
                <div style={gridStyle}>
                  {otherGoals.map((entry) => {
                    const typeChipStyle = { ...chipStyle, ...(GOAL_TYPE_CHIP_STYLE[entry.goal.goalType] ?? {}) };
                    return (
                      <GoalCardShell
                        key={entry.goal.id}
                        href={entry.detailHref ?? undefined}
                        goalType={entry.goal.goalType}
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
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ display: "grid", gap: 8, flex: "1 1 220px" }}>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 900 }}>{entry.goal.name}</div>
                              <GoalMetaLine>{entry.summaryLabel}</GoalMetaLine>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span style={typeChipStyle}>{entry.goalTypeLabel}</span>
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

const gridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
};

const activeFilterRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 12,
};

const activeFilterLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.55,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const activeFilterPillStyle: React.CSSProperties = {
  padding: "5px 12px",
  border: "1px solid rgba(128,128,128,0.32)",
  borderRadius: 999,
  background: "rgba(128,128,128,0.07)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 700,
};

const activeFilterPillActiveStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.55)",
  background: "rgba(128,128,128,0.2)",
  fontWeight: 900,
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

const frequencyTableStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 14,
  overflow: "hidden",
};

const rowDividerStyle: React.CSSProperties = {
  height: 1,
  background: "rgba(128,128,128,0.14)",
};

const sectionDividerStyle: React.CSSProperties = {
  height: 1,
  background: "rgba(128,128,128,0.16)",
  margin: "16px 0",
};

const sectionSubheadStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.45,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  marginBottom: 8,
};

function toFrequencyRowData(entry: GoalInsight): FrequencyGoalRowData {
  const isGroupFrequency = entry.goal.id.startsWith("group-frequency:");
  return {
    id: entry.goal.id,
    name: entry.goal.name,
    isToggleEnabled: entry.isToggleEnabled ?? false,
    isGroupFrequency,
    goalId: entry.goal.id,
    routineId: entry.toggleFrequencyGoalHref ?? null,
    actualValue: entry.actualValue,
    targetValue: entry.targetValue,
    timeframeStatusLabel: entry.timeframeStatusLabel,
    timeframeWindowLabel: entry.timeframeWindowLabel,
    isAchieved: entry.isAchieved,
    editHref: entry.editHref ?? null,
    recentItems: entry.recentItems.map((item) => ({
      id: item.id,
      routineName: item.routineName,
      date: formatAppDate(item.performedAt, { month: "short", day: "numeric" }),
    })),
    showRoutineNames: isGroupFrequency,
  };
}
