import { getMetadataIndex, resolveGroupTarget } from "../data";
import { EmptyState, FilterBar, FilterInput, FilterSelect, ProgressShell, SectionCard, TargetCard } from "../ui";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProgressGroupsIndexPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const query = (getParam(searchParams, "q") ?? "").trim().toLowerCase();
  const kind = (getParam(searchParams, "kind") ?? "all").trim().toUpperCase();
  const groups = await getMetadataIndex();
  const previews = (
    await Promise.all(
      groups.map(async (group) => ({
        group,
        target: await resolveGroupTarget(group.slug, "4w"),
      }))
    )
  )
    .filter(({ group }) => {
      if (query && !group.label.toLowerCase().includes(query) && !group.slug.includes(query)) return false;
      if (kind !== "ALL" && group.kind !== kind) return false;
      return true;
    })
    .sort((a, b) => (b.target?.logs.length ?? 0) - (a.target?.logs.length ?? 0) || a.group.label.localeCompare(b.group.label));

  return (
    <ProgressShell
      section="groups"
      title="Group Progress"
      subtitle="Metadata-driven rollups across muscles, movement patterns, training groups, cardio groups, and routine focus."
    >
      <SectionCard title="Find a Group">
        <FilterBar>
          <FilterInput name="q" defaultValue={query} placeholder="Search group" />
          <FilterSelect
            name="kind"
            defaultValue={kind.toLowerCase()}
            options={[
              { value: "all", label: "All group types" },
              { value: "muscle_group", label: "Muscle groups" },
              { value: "movement_pattern", label: "Movement patterns" },
              { value: "training_group", label: "Training groups" },
              { value: "cardio_activity", label: "Cardio groups" },
              { value: "routine_focus", label: "Routine focus" },
            ]}
          />
          <button type="submit" style={{ padding: "8px 12px" }}>
            Apply
          </button>
        </FilterBar>
      </SectionCard>

      <SectionCard title="All Groups">
        {previews.length === 0 ? <EmptyState message="No groups match the current filters." /> : null}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
          {previews.map(({ group, target }) => (
            <TargetCard
              key={group.id}
              href={`/progress/groups/${group.slug}?tab=overview&range=4w`}
              title={group.label}
              subtitle={group.kind.replaceAll("_", " ")}
              chips={[
                `${target?.logs.length ?? 0} sessions`,
                `${target?.routineIds.length ?? 0} routines`,
                `${target?.exerciseIds.length ?? 0} exercises`,
              ]}
            />
          ))}
        </div>
      </SectionCard>
    </ProgressShell>
  );
}
