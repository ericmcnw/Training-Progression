import { getRoutineIndex, getRoutineLogs, routineSubtitle, summarizeRoutineLogs } from "../data";
import { EmptyState, FilterBar, FilterInput, FilterSelect, ProgressShell, SectionCard, SectionLinkButton, TargetCard } from "../ui";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProgressRoutinesIndexPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const query = (getParam(searchParams, "q") ?? "").trim().toLowerCase();
  const kind = (getParam(searchParams, "kind") ?? "all").trim().toUpperCase();
  const status = (getParam(searchParams, "status") ?? "active").trim();
  const [routines, logs] = await Promise.all([getRoutineIndex(), getRoutineLogs("4w")]);

  const rows = routines
    .map((routine) => {
      const routineLogs = logs.filter((log) => log.routineId === routine.id);
      const summary = summarizeRoutineLogs(routineLogs, routine.timesPerWeek);
      return { routine, summary };
    })
    .filter(({ routine }) => {
      if (query && !routine.name.toLowerCase().includes(query) && !routine.category.toLowerCase().includes(query)) return false;
      if (kind !== "ALL" && routine.kind !== kind) return false;
      if (status === "active" && !routine.isActive) return false;
      if (status === "archived" && routine.isActive) return false;
      return true;
    })
    .sort((a, b) =>
      Number(b.routine.isActive) - Number(a.routine.isActive) ||
      b.summary.sessions - a.summary.sessions ||
      a.routine.name.localeCompare(b.routine.name)
    );

  return (
    <ProgressShell
      section="routines"
      title="Routine Progress"
      subtitle="Find a routine quickly, then switch between summary, completion, performance, and workload."
      actions={<SectionLinkButton href="/routines" label="Manage Routines" />}
    >
      <SectionCard title="Find a Routine">
        <FilterBar>
          <FilterInput name="q" defaultValue={query} placeholder="Search routine or category" />
          <FilterSelect
            name="kind"
            defaultValue={kind.toLowerCase()}
            options={[
              { value: "all", label: "All types" },
              { value: "completion", label: "Completion" },
              { value: "workout", label: "Workout" },
              { value: "cardio", label: "Cardio" },
              { value: "guided", label: "Guided" },
              { value: "session", label: "Session" },
            ]}
          />
          <FilterSelect
            name="status"
            defaultValue={status}
            options={[
              { value: "active", label: "Active only" },
              { value: "all", label: "Active + archived" },
              { value: "archived", label: "Archived only" },
            ]}
          />
          <button type="submit" style={{ padding: "8px 12px" }}>
            Apply
          </button>
        </FilterBar>
      </SectionCard>

      <SectionCard title="All Routines">
        {rows.length === 0 ? <EmptyState message="No routines match the current filters." /> : null}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
          {rows.map(({ routine, summary }) => (
            <TargetCard
              key={routine.id}
              href={`/progress/routines/${routine.id}?tab=overview&range=4w`}
              title={routine.name}
              subtitle={routineSubtitle(routine)}
              chips={[
                `${summary.sessions} sessions`,
                `${summary.ytd} YTD`,
                routine.timesPerWeek ? `${summary.weeksGoalMet} goal weeks` : `${summary.weeksActive} active weeks`,
                summary.lastSession ? `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(summary.lastSession)}` : "No recent activity",
              ]}
            />
          ))}
        </div>
      </SectionCard>
    </ProgressShell>
  );
}
