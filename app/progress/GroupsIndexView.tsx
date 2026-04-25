import { getMetadataIndex, resolveGroupTarget } from "./data";
import { EmptyState, FilterBar, FilterInput, FilterSubmitButton, ProgressShell, SectionCard, TargetCard } from "./ui";

type SearchParams = Record<string, string | string[] | undefined>;

type ProgressGroupItem = {
  slug: string;
  label: string;
  subtitle: string;
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

const STIMULUS_GROUPS: ProgressGroupItem[] = [
  { slug: "push", label: "Push", subtitle: "" },
  { slug: "pull", label: "Pull", subtitle: "" },
  { slug: "squat", label: "Squat", subtitle: "" },
  { slug: "hinge", label: "Hinge", subtitle: "" },
  { slug: "core", label: "Core", subtitle: "" },
  { slug: "grip", label: "Grip", subtitle: "" },
  { slug: "cardio", label: "Cardio", subtitle: "" },
  { slug: "mobility", label: "Mobility", subtitle: "" },
];

export default async function GroupsIndexView(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const query = (getParam(searchParams, "q") ?? "").trim().toLowerCase();
  const groups = await getMetadataIndex();

  const sportAndCategoryGroups: ProgressGroupItem[] = groups
    .filter((group) => group.kind === "CARDIO_ACTIVITY" || group.kind === "ROUTINE_FOCUS")
    .map((group) => ({
      slug: group.slug,
      label: group.label,
      subtitle: "",
    }));

  const muscleGroups: ProgressGroupItem[] = groups
    .filter((group) => group.kind === "MUSCLE_GROUP")
    .map((group) => ({
      slug: group.slug,
      label: group.label,
      subtitle: "",
    }));

  const sections = [
    { key: "sport-category", title: "Sport / Category Sessions", items: sportAndCategoryGroups },
    { key: "muscles", title: "Muscle Groups", items: muscleGroups },
    { key: "stimulus", title: "Movement / Stimulus Groups", items: STIMULUS_GROUPS },
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !query || item.label.toLowerCase().includes(query) || item.slug.includes(query)),
    }))
    .filter((section) => section.items.length > 0);

  const previewsBySlug = new Map(
    await Promise.all(
      sections
        .flatMap((section) => section.items)
        .map(async (item) => {
          const target = await resolveGroupTarget(item.slug, "4w");
          return [item.slug, target] as const;
        })
    )
  );

  return (
    <ProgressShell
      section="groups"
      title="Group Progress"
      subtitle="Browse progress by sport and session categories, muscle groups, and the movement / stimulus groups that now drive the stimulus overview."
    >
      <SectionCard title="Find a Group">
        <FilterBar>
          <input type="hidden" name="section" value="groups" />
          <FilterInput name="q" defaultValue={query} placeholder="Search group" />
          <FilterSubmitButton />
        </FilterBar>
      </SectionCard>

      {sections.length === 0 ? (
        <SectionCard title="All Groups">
          <EmptyState message="No groups match the current search." />
        </SectionCard>
      ) : (
        sections.map((section) => (
          <SectionCard
            key={section.key}
            title={section.title}
            subtitle={`${section.items.length} ${section.items.length === 1 ? "group" : "groups"}`}
          >
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
              {section.items.map((item) => {
                const target = previewsBySlug.get(item.slug);
                const lastLog = target?.logs.sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime())[0];
                const lastLabel = lastLog
                  ? `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(lastLog.performedAt)}`
                  : null;
                const href = section.key === "sport-category" && groups.find((g) => g.slug === item.slug)?.kind === "CARDIO_ACTIVITY"
                  ? `/progress/cardio/${item.slug}?tab=overview&range=4w`
                  : `/progress/groups/${item.slug}?tab=overview&range=4w`;
                return (
                  <TargetCard
                    key={item.slug}
                    href={href}
                    title={item.label}
                    chips={[
                      `${target?.logs.length ?? 0} sessions`,
                      ...(lastLabel ? [lastLabel] : ["No recent activity"]),
                    ]}
                  />
                );
              })}
            </div>
          </SectionCard>
        ))
      )}
    </ProgressShell>
  );
}
