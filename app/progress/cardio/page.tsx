import { getMetadataIndex, resolveGroupTarget } from "../data";
import { EmptyState, FilterBar, FilterInput, ProgressShell, SectionCard, TargetCard } from "../ui";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProgressCardioIndexPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const query = (getParam(searchParams, "q") ?? "").trim().toLowerCase();
  const groups = await getMetadataIndex();
  const cardioGroups = groups.filter((group) => group.kind === "CARDIO_ACTIVITY");
  const previews = (
    await Promise.all(
      cardioGroups.map(async (group) => ({
        group,
        target: await resolveGroupTarget(group.slug, "4w"),
      }))
    )
  )
    .filter(({ group }) => !query || group.label.toLowerCase().includes(query) || group.slug.includes(query))
    .sort((a, b) => (b.target?.logs.length ?? 0) - (a.target?.logs.length ?? 0) || a.group.label.localeCompare(b.group.label));

  return (
    <ProgressShell
      section="cardio"
      title="Cardio Progress"
      subtitle="Navigate cardio rollups like all cardio, running, and run + walk."
    >
      <SectionCard title="Find a Cardio Target">
        <FilterBar>
          <FilterInput name="q" defaultValue={query} placeholder="Search cardio target" />
          <button type="submit" style={{ padding: "8px 12px" }}>
            Apply
          </button>
        </FilterBar>
      </SectionCard>

      <SectionCard title="Cardio Targets">
        {previews.length === 0 ? <EmptyState message="No cardio targets match the current search." /> : null}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
          {previews.map(({ group, target }) => (
            <TargetCard
              key={group.id}
              href={`/progress/cardio/${group.slug}?tab=overview&range=4w`}
              title={group.label}
              subtitle="Cardio rollup"
              chips={[
                `${target?.logs.length ?? 0} sessions`,
                `${(target?.logs.reduce((sum, log) => sum + (log.distanceMi ?? 0), 0) ?? 0).toFixed(1)} mi`,
                `${Math.round((target?.logs.reduce((sum, log) => sum + (log.durationSec ?? 0), 0) ?? 0) / 60)} min`,
              ]}
            />
          ))}
        </div>
      </SectionCard>
    </ProgressShell>
  );
}
