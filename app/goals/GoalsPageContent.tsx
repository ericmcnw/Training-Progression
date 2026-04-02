import Link from "next/link";
import { FilterBar, FilterSelect, ProgressShell, SectionCard, SectionLinkButton } from "@/app/progress/ui";
import { GOAL_TYPE_LABELS } from "@/lib/goals-config";
import { getGoalFormOptions, getGoalsOverview } from "@/lib/goals";
import GoalForm, { type GoalFormInitial } from "./GoalForm";
import { createGoal, toggleGoalActive, toggleRoutineFrequencyGoal } from "./actions";
import { createFrequencyGoal } from "@/app/routines/actions";
import { GoalCardShell, GoalMetaLine, GoalProgressRing, GoalStatusBadge, chipStyle, smallActionLinkStyle, subtleTextStyle } from "./ui";
import { GOAL_TEMPLATES, getGoalTemplate, type GoalTemplateKey } from "@/lib/goal-templates";
import FrequencyGoalsSection from "./FrequencyGoalsSection";

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
  if (params.active && params.active !== "all") search.set("active", params.active);
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
  const active = getParam(params, "active") ?? "all";
  const mode = getParam(params, "mode") === "new" ? "new" : "list";
  const builderMode = getParam(params, "builder") === "advanced" ? "advanced" : "guided";
  const templateKey = (getParam(params, "template") as GoalTemplateKey | undefined) ?? GOAL_TEMPLATES[0].key;
  const template = getGoalTemplate(templateKey);
  const currentGoalsHref = buildGoalsHref({ type, active });
  const [goals, options] = await Promise.all([
    getGoalsOverview({ type, active }),
    mode === "new" ? getGoalFormOptions() : Promise.resolve(null),
  ]);
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

      <SectionCard title="Filters">
        <FilterBar>
          <input type="hidden" name="type" value={type} />
          <FilterSelect
            name="active"
            defaultValue={active}
            options={[
              { value: "all", label: "Active + inactive" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
          <button type="submit" style={buttonStyle}>
            Apply
          </button>
          <Link href={buildGoalsHref({ type })} style={secondaryButtonStyle}>
            Reset
          </Link>
        </FilterBar>
      </SectionCard>

      <SectionCard title={`${typeLabel} Goals`}>
        {goals.length === 0 ? (
          <div style={subtleTextStyle}>No goals match the current filters.</div>
        ) : (
          <div style={gridStyle}>
            {goals.map((entry) => {
              const showFrequencyToggle = entry.goal.goalType === "FREQUENCY";
              const toggleAction = entry.toggleFrequencyGoalHref ? toggleRoutineFrequencyGoal : toggleGoalActive;

              return (
                <GoalCardShell
                  key={entry.goal.id}
                  href={entry.detailHref ?? undefined}
                  action={
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {showFrequencyToggle ? (
                        <form action={toggleAction}>
                          {entry.toggleFrequencyGoalHref ? <input type="hidden" name="routineId" value={entry.toggleFrequencyGoalHref} /> : null}
                          <input type="hidden" name="goalId" value={entry.goal.id} />
                          <input type="hidden" name="enabled" value={entry.isToggleEnabled ? "0" : "1"} />
                          <input type="hidden" name="returnTo" value={currentGoalsHref} />
                          <button
                            type="submit"
                            style={{
                              ...smallToggleButtonStyle,
                              ...(entry.isToggleEnabled ? toggleOnStyle : toggleOffStyle),
                            }}
                            aria-pressed={entry.isToggleEnabled}
                          >
                            <span style={toggleTextStyle}>{entry.isToggleEnabled ? "Active" : "Inactive"}</span>
                            <span style={toggleTrackStyle}>
                              <span
                                style={{
                                  ...toggleThumbStyle,
                                  ...(entry.isToggleEnabled ? toggleThumbOnStyle : toggleThumbOffStyle),
                                }}
                              />
                            </span>
                          </button>
                        </form>
                      ) : null}
                      {entry.editHref ? (
                        <Link href={entry.editHref} style={smallActionLinkStyle}>
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  }
                >
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
              );
            })}
          </div>
        )}
      </SectionCard>

      <FrequencyGoalsSection />
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

const smallToggleButtonStyle: React.CSSProperties = {
  ...smallActionLinkStyle,
  cursor: "pointer",
  minWidth: 108,
  justifyContent: "space-between",
  gap: 10,
  padding: "6px 8px 6px 12px",
};

const toggleTextStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const toggleTrackStyle: React.CSSProperties = {
  position: "relative",
  width: 34,
  height: 20,
  borderRadius: 999,
  background: "rgba(10,14,20,0.34)",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
  flexShrink: 0,
};

const toggleThumbStyle: React.CSSProperties = {
  position: "absolute",
  top: 2,
  width: 16,
  height: 16,
  borderRadius: 999,
  transition: "transform 140ms ease, background 140ms ease, box-shadow 140ms ease",
};

const toggleThumbOnStyle: React.CSSProperties = {
  left: 2,
  transform: "translateX(14px)",
  background: "#54cb82",
  boxShadow: "0 0 12px rgba(84,203,130,0.45)",
};

const toggleThumbOffStyle: React.CSSProperties = {
  left: 2,
  transform: "translateX(0)",
  background: "rgba(226,232,240,0.95)",
  boxShadow: "0 0 10px rgba(15,23,42,0.25)",
};

const toggleOnStyle: React.CSSProperties = {
  borderColor: "rgba(84,203,130,0.5)",
  background: "rgba(84,203,130,0.16)",
  color: "#dff7e8",
};

const toggleOffStyle: React.CSSProperties = {
  borderColor: "rgba(248,113,113,0.38)",
  background: "rgba(248,113,113,0.12)",
  color: "#ffd4d4",
};
