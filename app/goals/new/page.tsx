import { ProgressShell, SectionCard, SectionLinkButton } from "@/app/progress/ui";
import { getGoalFormOptions } from "@/lib/goals";
import GoalForm, { type GoalFormInitial } from "../GoalForm";
import { createGoal } from "../actions";

export const dynamic = "force-dynamic";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewGoalPage() {
  const options = await getGoalFormOptions();
  const initial: GoalFormInitial = {
    name: "",
    goalType: "FREQUENCY",
    targetType: "ROUTINE",
    targetId: options.routines[0]?.id ?? "",
    metricType: "SESSIONS",
    timeframe: "WEEK",
    targetValue: 4,
    startDate: todayYmd(),
    endDate: "",
    isActive: true,
    notes: "",
    benchmarkDistanceMi: "3.11",
    benchmarkLabel: "5K",
  };

  return (
    <ProgressShell
      section="overview"
      title="New Goal"
      subtitle="Structured goals stay tied to your existing training logs, so there is nothing separate to track."
      actions={<SectionLinkButton href="/goals" label="Back to Goals" />}
    >
      <SectionCard title="Create Goal">
        <GoalForm action={createGoal} options={options} submitLabel="Save Goal" initial={initial} />
      </SectionCard>
    </ProgressShell>
  );
}
