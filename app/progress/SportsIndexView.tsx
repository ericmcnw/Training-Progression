import Link from "next/link";
import ClimbingProgressView from "./ClimbingProgressView";
import { getMetadataIndex, getRoutineIndex, getRoutineLogs, resolveGroupTarget } from "./data";
import { EmptyState, ProgressShell, SectionCard } from "./ui";
import { isSportGroup, sportGroupKindLabel, sportGroupTargetHref, sportTargetHref } from "./sports";
import { formatRoutineSubtype } from "@/lib/routines";

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

  const [groups, routines, logs] = await Promise.all([
    getMetadataIndex(),
    getRoutineIndex(),
    getRoutineLogs("4w"),
  ]);
  const sportGroups = groups.filter((group) => isSportGroup(group) && group.slug !== "board-sports");
  const groupedTargets = await Promise.all(
    sportGroups.map(async (group) => ({
      id: group.id,
      slug: group.slug,
      label: group.label,
      eyebrow: sportGroupKindLabel(group),
      href: sportGroupTargetHref(group),
      logs: (await resolveGroupTarget(group.slug, "4w"))?.logs ?? [],
    }))
  );
  const boardSportTargets = [
    { subtype: "SURFING", slug: "surfing", label: "Surfing" },
    { subtype: "SNOWBOARDING", slug: "snowboarding", label: "Snowboarding" },
  ].map((item) => {
    const routineIds = new Set(
      routines
        .filter((routine) => routine.isActive && routine.kind === "SESSION" && routine.subtype === item.subtype)
        .map((routine) => routine.id)
    );
    return {
      id: item.slug,
      slug: item.slug,
      label: item.label,
      eyebrow: "Board sport",
      href: sportTargetHref(item.slug),
      logs: logs.filter((log) => routineIds.has(log.routineId)),
    };
  });

  const filteredSports = [...groupedTargets, ...boardSportTargets]
    .filter((entry) => !query || entry.label.toLowerCase().includes(query) || entry.slug.includes(query))
    .sort((a, b) => b.logs.length - a.logs.length || a.label.localeCompare(b.label));

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
            {filteredSports.map((entry) => {
              const entryLogs = entry.logs;
              const sessions = entryLogs.length;
              const activeRoutines = new Set(entryLogs.map((log) => log.routineId)).size;
              const lastLog = entryLogs.length > 0
                ? entryLogs.reduce((a, b) => (a.performedAt > b.performedAt ? a : b))
                : null;
              const lastLabel = lastLog
                ? `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(lastLog.performedAt)}`
                : "No recent activity";
              const subtypes = Array.from(new Set(entryLogs.map((log) => log.routine.subtype).filter((value): value is string => Boolean(value))));
              const subtypeLabel = subtypes.length === 1 ? formatRoutineSubtype(subtypes[0]) : null;

              return (
                <Link
                  key={entry.id}
                  href={entry.href}
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
                    {entry.eyebrow}
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{entry.label}</div>
                  {subtypeLabel ? <div style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.7 }}>Recent subtype: {subtypeLabel}</div> : null}
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
