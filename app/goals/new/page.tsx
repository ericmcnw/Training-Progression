import Link from "next/link";
import { ProgressShell, SectionCard, SectionLinkButton } from "@/app/progress/ui";
import { getGoalFormOptions } from "@/lib/goals";
import GoalForm, { type GoalFormInitial } from "../GoalForm";
import { createGoal } from "../actions";
import { GOAL_TEMPLATES, getGoalTemplate, type GoalTemplateKey } from "@/lib/goal-templates";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewGoalPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const mode = getParam(params, "mode") === "advanced" ? "advanced" : "guided";
  const templateKey = (getParam(params, "template") as GoalTemplateKey | undefined) ?? GOAL_TEMPLATES[0].key;
  const template = getGoalTemplate(templateKey);
  const options = await getGoalFormOptions();

  const targetId =
    template.targetType === "ROUTINE"
      ? options.routines[0]?.id ?? ""
      : template.targetType === "EXERCISE"
      ? options.exercises[0]?.id ?? ""
      : template.targetType === "CARDIO"
      ? options.cardioTargets[0]?.id ?? ""
      : template.targetType === "SESSION_TEMPLATE"
      ? options.sessionTemplates[0]?.id ?? ""
      : options.groups[0]?.id ?? "";

  const initial: GoalFormInitial = {
    name: "",
    goalType: template.goalType,
    targetType: template.targetType,
    targetId,
    metricType: template.metricType,
    timeframe: template.timeframe,
    targetValue: template.targetValue,
    startDate: todayYmd(),
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
      title="New Goal"
      subtitle="Pick the goal shape first, then fill in the target details."
      actions={<SectionLinkButton href="/goals" label="Back to Goals" />}
    >
      <SectionCard title={mode === "guided" ? "Create Goal" : "Advanced Goal Setup"}>
        <GoalForm
          action={createGoal}
          options={options}
          submitLabel="Save Goal"
          initial={initial}
          mode={mode}
          initialTemplateKey={template.key}
        />
        {mode === "guided" ? (
          <div style={modeRowStyle}>
            <div style={templateDescriptionStyle}>Need full control over goal type, target type, metric, and timeframe?</div>
            <Link href={`/goals/new?mode=advanced&template=${template.key}`} style={modeLinkStyle}>
              Open advanced goal builder
            </Link>
          </div>
        ) : null}
      </SectionCard>
    </ProgressShell>
  );
}

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
