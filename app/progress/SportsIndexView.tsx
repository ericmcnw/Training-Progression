import Link from "next/link";
import ClimbingProgressView from "./ClimbingProgressView";
import { getMetadataIndex, resolveGroupTarget } from "./data";
import { EmptyState, ProgressShell, SectionCard } from "./ui";
import { isSportGroup, sportGroupKindLabel, sportGroupTargetHref } from "./sports";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function SportsIndexView(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const query = (getParam(searchParams, "q") ?? "").trim().toLowerCase();

  const groups = await getMetadataIndex();
  const sportGroups = groups.filter((group) => isSportGroup(group));
  const sportTargets = await Promise.all(
    sportGroups.map(async (group) => ({
      group,
      target: await resolveGroupTarget(group.slug, "4w"),
    }))
  );

  const filteredSports = sportTargets
    .filter(({ group }) => !query || group.label.toLowerCase().includes(query) || group.slug.includes(query))
    .sort((a, b) => (b.target?.logs.length ?? 0) - (a.target?.logs.length ?? 0) || a.group.label.localeCompare(b.group.label));

  return (
    <ProgressShell
      section="sports"
      title="Sports"
      subtitle="Sport-specific review for climbing and tagged sports sessions without duplicating the cardio dashboard."
    >
      <ClimbingProgressView />

      <SectionCard
        title="Sport Categories"
        subtitle="Shared sport tags from the progress system. Open a category to review recent volume, trends, and linked routine history."
      >
        {filteredSports.length === 0 ? (
          <EmptyState message="No sport categories match the current search." />
        ) : (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
            {filteredSports.map(({ group, target }) => {
              const logs = target?.logs ?? [];
              const sessions = logs.length;
              const activeRoutines = new Set(logs.map((log) => log.routineId)).size;
              const lastLog = logs.length > 0
                ? logs.reduce((a, b) => (a.performedAt > b.performedAt ? a : b))
                : null;
              const lastLabel = lastLog
                ? `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(lastLog.performedAt)}`
                : "No recent activity";

              return (
                <Link
                  key={group.id}
                  href={sportGroupTargetHref(group)}
                  scroll={false}
                  style={{
                    display: "grid",
                    gap: 8,
                    minHeight: 116,
                    padding: 14,
                    borderRadius: 18,
                    border: sessions > 0 ? "1px solid rgba(84,203,130,0.2)" : "1px solid rgba(255,255,255,0.1)",
                    background: sessions > 0
                      ? "radial-gradient(circle at top right, rgba(84,203,130,0.12), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", opacity: 0.68, fontWeight: 900 }}>
                    {sportGroupKindLabel(group)}
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{group.label}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      `${sessions} session${sessions !== 1 ? "s" : ""} (4w)`,
                      `${activeRoutines} routine${activeRoutines !== 1 ? "s" : ""}`,
                      lastLabel,
                    ].map((chip) => (
                      <span
                        key={chip}
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.09)",
                          fontWeight: 700,
                        }}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>
    </ProgressShell>
  );
}
