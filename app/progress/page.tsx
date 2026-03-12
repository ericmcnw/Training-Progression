import { ProgressShell, SectionCard, SectionLinkButton, StatGrid, TargetCard } from "./ui";
import { getExerciseIndex, getMetadataIndex, getRoutineIndex, getRoutineLogs, resolveGroupTarget, summarizeRoutineLogs } from "./data";

export const dynamic = "force-dynamic";

export default async function ProgressOverviewPage() {
  const [routines, exercises, groups, recentLogs] = await Promise.all([
    getRoutineIndex(),
    getExerciseIndex(),
    getMetadataIndex(),
    getRoutineLogs("4w"),
  ]);

  const cardioRoutines = routines.filter((routine) => routine.kind === "CARDIO");
  const activeRoutines = routines.filter((routine) => routine.isActive);
  const recentActive = activeRoutines
    .map((routine) => ({
      routine,
      summary: summarizeRoutineLogs(
        recentLogs.filter((log) => log.routineId === routine.id),
        routine.timesPerWeek
      ),
    }))
    .sort((a, b) => b.summary.sessions - a.summary.sessions)
    .slice(0, 6);

  const cardioGroups = groups.filter((group) => group.kind === "CARDIO_ACTIVITY");
  const cardioQuickCandidates = cardioGroups.filter((group) => group.slug !== "climbing");
  const cardioGroupPreviews = await Promise.all(
    cardioQuickCandidates.map(async (group) => ({
      group,
      target: await resolveGroupTarget(group.slug, "4w"),
    }))
  );
  const sortedQuickCardioTargets = cardioGroupPreviews.sort((a, b) => {
    const aHasData = (a.target?.logs.length ?? 0) > 0 ? 1 : 0;
    const bHasData = (b.target?.logs.length ?? 0) > 0 ? 1 : 0;
    if (bHasData !== aHasData) return bHasData - aHasData;
    if (a.group.slug === "running" && b.group.slug !== "running") return -1;
    if (b.group.slug === "running" && a.group.slug !== "running") return 1;
    return (b.target?.logs.length ?? 0) - (a.target?.logs.length ?? 0) || a.group.label.localeCompare(b.group.label);
  });
  const quickCardioTargets = sortedQuickCardioTargets.slice(0, 6);
  const runningTarget = sortedQuickCardioTargets.find((entry) => entry.group.slug === "running");
  if (runningTarget && !quickCardioTargets.some((entry) => entry.group.slug === "running")) {
    quickCardioTargets[quickCardioTargets.length - 1] = runningTarget;
  }
  const featuredGroups = groups
    .filter((group) => group.appliesToRoutine || group.appliesToExercise)
    .slice(0, 8);

  return (
    <ProgressShell
      section="overview"
      title="Progress"
      subtitle="A clean navigation layer for routines, exercises, cardio, and metadata-driven groups."
      actions={<SectionLinkButton href="/goals" label="Goals" />}
    >
      <SectionCard title="Overview">
        <StatGrid
          items={[
            { label: "Active routines", value: String(activeRoutines.length) },
            { label: "Exercises", value: String(exercises.length) },
            { label: "Cardio targets", value: String(cardioGroups.length) },
            { label: "Metadata groups", value: String(groups.length) },
          ]}
        />
      </SectionCard>

      <SectionCard title="Navigate">
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <TargetCard href="/progress/routines" title="Routines" subtitle="Specific routines with completion, performance, and workload tabs." />
          <TargetCard href="/progress/exercises" title="Exercises" subtitle="Exercise-level strength and workload analysis." />
          <TargetCard href="/progress/cardio" title="Cardio" subtitle="Running, walking, cardio rollups, and weekly distance views." />
          <TargetCard href="/progress/groups" title="Groups" subtitle="Metadata rollups like legs, push, lower body, mobility, and climbing." />
        </div>
      </SectionCard>

      <SectionCard title="Most Active Routines (Last 4 Weeks)">
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {recentActive.map(({ routine, summary }) => (
            <TargetCard
              key={routine.id}
              href={`/progress/routines/${routine.id}?tab=overview&range=4w`}
              title={routine.name}
              subtitle={`${routine.category} | ${routine.kind}`}
              chips={[
                `${summary.sessions} sessions`,
                `${summary.weeksActive} active weeks`,
                summary.lastSession ? `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(summary.lastSession)}` : "No recent logs",
              ]}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Quick Cardio Targets">
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {quickCardioTargets.map(({ group, target }) => (
            <TargetCard
              key={group.id}
              href={`/progress/cardio/${group.slug}?tab=overview&range=4w`}
              title={group.label}
              subtitle={(target?.logs.length ?? 0) > 0 ? "Cardio rollup target" : "Cardio rollup target | no recent data"}
            />
          ))}
          {cardioRoutines.slice(0, 2).map((routine) => (
            <TargetCard
              key={routine.id}
              href={`/progress/routines/${routine.id}?tab=overview&range=4w`}
              title={routine.name}
              subtitle="Specific cardio routine"
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Featured Groups">
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {featuredGroups.map((group) => (
            <TargetCard
              key={group.id}
              href={`/progress/groups/${group.slug}?tab=overview&range=4w`}
              title={group.label}
              subtitle={group.kind.replaceAll("_", " ")}
            />
          ))}
        </div>
      </SectionCard>
    </ProgressShell>
  );
}
