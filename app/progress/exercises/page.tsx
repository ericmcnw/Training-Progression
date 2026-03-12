import { getExerciseIndex, getRoutineLogs } from "../data";
import { EmptyState, FilterBar, FilterInput, FilterSelect, ProgressShell, SectionCard, SectionLinkButton, TargetCard } from "../ui";
import { trendLabel } from "@/lib/progress-v2";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProgressExercisesIndexPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const query = (getParam(searchParams, "q") ?? "").trim().toLowerCase();
  const filter = (getParam(searchParams, "filter") ?? "all").trim();
  const [exercises, logs] = await Promise.all([getExerciseIndex(), getRoutineLogs("12w")]);

  const rows = exercises
    .map((exercise) => {
      const sessions = logs.flatMap((log) =>
        log.exercises
          .filter((entry) => entry.exerciseId === exercise.id)
          .map((entry) => ({
            performedAt: log.performedAt,
            totalSets: entry.sets.length,
            totalReps: entry.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0),
            totalVolume: entry.sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.weightLb ?? 0), 0),
            topMetric: exercise.unit === "TIME" && !exercise.supportsWeight
              ? Math.max(0, ...entry.sets.map((set) => set.seconds ?? 0))
              : Math.max(0, ...entry.sets.map((set) => set.weightLb ?? 0)),
          }))
      );
      return { exercise, sessions };
    })
    .filter(({ exercise }) => {
      if (query && !exercise.name.toLowerCase().includes(query)) return false;
      if (filter === "weighted" && !exercise.supportsWeight) return false;
      if (filter === "time" && exercise.unit !== "TIME") return false;
      return true;
    })
    .sort((a, b) =>
      b.sessions.length - a.sessions.length ||
      b.sessions.reduce((sum, session) => sum + session.totalVolume, 0) - a.sessions.reduce((sum, session) => sum + session.totalVolume, 0) ||
      a.exercise.name.localeCompare(b.exercise.name)
    );

  return (
    <ProgressShell
      section="exercises"
      title="Exercise Progress"
      subtitle="Search quickly, scan useful previews, and jump straight into performance or workload."
      actions={<SectionLinkButton href="/exercises" label="Manage Exercises" />}
    >
      <SectionCard title="Find an Exercise">
        <FilterBar>
          <FilterInput name="q" defaultValue={query} placeholder="Search exercise" />
          <FilterSelect
            name="filter"
            defaultValue={filter}
            options={[
              { value: "all", label: "All exercises" },
              { value: "weighted", label: "Weighted only" },
              { value: "time", label: "Time-based only" },
            ]}
          />
          <button type="submit" style={{ padding: "8px 12px" }}>
            Apply
          </button>
        </FilterBar>
      </SectionCard>

      <SectionCard title="All Exercises">
        {rows.length === 0 ? <EmptyState message="No exercises match the current filters." /> : null}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
          {rows.map(({ exercise, sessions }) => (
            <TargetCard
              key={exercise.id}
              href={`/progress/exercises/${exercise.id}?tab=overview&range=12w`}
              title={exercise.name}
              subtitle={`${exercise.unit}${exercise.supportsWeight ? " | Weighted" : ""}`}
              chips={[
                `${sessions.length} sessions`,
                `${sessions.reduce((sum, session) => sum + session.totalSets, 0)} sets`,
                `${sessions.reduce((sum, session) => sum + session.totalVolume, 0).toFixed(0)} volume`,
                trendLabel(sessions.map((session) => session.topMetric)),
              ]}
            />
          ))}
        </div>
      </SectionCard>
    </ProgressShell>
  );
}
