import { ProgressShell, SectionCard, SectionLinkButton } from "@/app/progress/ui";
import { getGoalById, getGoalFormOptions } from "@/lib/goals";
import GoalForm, { type GoalFormInitial } from "../../GoalForm";
import { updateGoal } from "../../actions";

export const dynamic = "force-dynamic";

type Params = { goalId: string };

function toYmd(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditGoalPage(props: {
  params: Promise<Params> | Params;
}) {
  const params = await Promise.resolve(props.params);
  const [goal, options] = await Promise.all([
    getGoalById(params.goalId),
    getGoalFormOptions(),
  ]);

  if (!goal) {
    return <div style={{ padding: 20 }}>Goal not found.</div>;
  }

  const initial: GoalFormInitial = {
    id: goal.id,
    name: goal.name,
    goalType: goal.goalType,
    targetType: goal.targetType,
    targetId: goal.targetId,
    metricType: goal.metricType,
    timeframe: goal.timeframe,
    targetValue: goal.targetValue,
    startDate: toYmd(goal.startDate),
    endDate: toYmd(goal.endDate),
    isActive: goal.isActive,
    notes: goal.notes ?? "",
    benchmarkDistanceMi: goal.config?.benchmarkDistanceMi ? String(goal.config.benchmarkDistanceMi) : "",
    benchmarkLabel: goal.config?.benchmarkLabel ?? "",
  };

  return (
    <ProgressShell
      section="overview"
      title={`Edit: ${goal.name}`}
      subtitle="Update the target definition without touching the underlying routine or progress data."
      actions={<SectionLinkButton href={`/goals/${goal.id}`} label="Back to Goal" />}
    >
      <SectionCard title="Edit Goal">
        <GoalForm action={updateGoal} options={options} submitLabel="Update Goal" initial={initial} />
      </SectionCard>
    </ProgressShell>
  );
}
