import { getMetadataIndex, resolveGroupTarget } from "./data";
import { EmptyState, FilterBar, FilterInput, FilterSelect, ProgressShell, SectionCard, TargetCard } from "./ui";
import { formatMetadataGroupKind } from "@/lib/metadata";
import type { MetadataGroupKind } from "@/generated/prisma";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function GroupsIndexView(props: {
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
  const kindOrder: MetadataGroupKind[] = [
    "MUSCLE_GROUP",
    "MOVEMENT_PATTERN",
    "TRAINING_GROUP",
    "CARDIO_ACTIVITY",
    "ROUTINE_FOCUS",
  ];
  const previewsByKind = new Map<MetadataGroupKind, typeof previews>();

  for (const preview of previews) {
    const current = previewsByKind.get(preview.group.kind) ?? [];
    current.push(preview);
    previewsByKind.set(preview.group.kind, current);
  }

  return (
    <ProgressShell
      section="groups"
      title="Group Progress"
      subtitle="Rollups across body areas, movement patterns, training groups, cardio groups, and routine focus."
    >
      <SectionCard title="Find a Group">
        <FilterBar>
          <input type="hidden" name="section" value="groups" />
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

      {previews.length === 0 ? (
        <SectionCard title="All Groups">
          <EmptyState message="No groups match the current filters." />
        </SectionCard>
      ) : (
        kindOrder
          .map((groupKind) => ({
            groupKind,
            items: previewsByKind.get(groupKind) ?? [],
          }))
          .filter(({ items }) => items.length > 0)
          .map(({ groupKind, items }) => (
            <SectionCard
              key={groupKind}
              title={formatMetadataGroupKind(groupKind)}
              subtitle={`${items.length} ${items.length === 1 ? "group" : "groups"}`}
            >
              <details open>
                <summary
                  data-collapsible-summary
                  style={{
                    cursor: "pointer",
                    listStyle: "none",
                    fontSize: 13,
                    fontWeight: 800,
                    opacity: 0.86,
                    marginBottom: 12,
                  }}
                >
                  Show {formatMetadataGroupKind(groupKind).toLowerCase()}
                </summary>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
                  {items.map(({ group, target }) => (
                    <TargetCard
                      key={group.id}
                      href={`/progress/groups/${group.slug}?tab=overview&range=4w`}
                      title={group.label}
                      subtitle={formatMetadataGroupKind(group.kind)}
                      chips={[
                        `${target?.logs.length ?? 0} sessions`,
                        `${target?.routineIds.length ?? 0} routines`,
                        `${target?.exerciseIds.length ?? 0} exercises`,
                      ]}
                    />
                  ))}
                </div>
              </details>
            </SectionCard>
          ))
      )}
    </ProgressShell>
  );
}
