import Link from "next/link";
import { getMetadataIndex, resolveGroupTarget } from "./data";
import { EmptyState, ProgressShell, SectionCard } from "./ui";
import { formatDuration, formatPace } from "@/lib/progress";
import ClimbingProgressView from "./ClimbingProgressView";

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
  const cardioGroups = groups.filter((g) => g.kind === "CARDIO_ACTIVITY");
  const sessionGroups = groups.filter((g) => g.kind === "ROUTINE_FOCUS");

  // Load 4w stats for each group in parallel
  const [cardioTargets, sessionTargets] = await Promise.all([
    Promise.all(
      cardioGroups.map(async (group) => ({
        group,
        target: await resolveGroupTarget(group.slug, "4w"),
      }))
    ),
    Promise.all(
      sessionGroups.map(async (group) => ({
        group,
        target: await resolveGroupTarget(group.slug, "4w"),
      }))
    ),
  ]);

  const filteredCardio = cardioTargets
    .filter(({ group }) => !query || group.label.toLowerCase().includes(query) || group.slug.includes(query))
    .sort((a, b) => (b.target?.logs.length ?? 0) - (a.target?.logs.length ?? 0) || a.group.label.localeCompare(b.group.label));

  const filteredSessions = sessionTargets
    .filter(({ group }) => !query || group.label.toLowerCase().includes(query) || group.slug.includes(query))
    .filter(({ target }) => (target?.logs.length ?? 0) > 0) // only show session categories with recent activity
    .sort((a, b) => (b.target?.logs.length ?? 0) - (a.target?.logs.length ?? 0) || a.group.label.localeCompare(b.group.label));

  return (
    <ProgressShell
      section="sports"
      title="Sports"
      subtitle="Per-sport performance — pace, elevation, distance trends, and session history."
    >
      <ClimbingProgressView />

      <SectionCard title="Cardio Activities" subtitle="Sport-specific rollups: pace trends, distance, elevation, and weekly charts.">
        {filteredCardio.length === 0 ? (
          <EmptyState message="No cardio activities found." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {filteredCardio.map(({ group, target }) => {
              const logs = target?.logs ?? [];
              const sessions = logs.length;
              const totalMi = logs.reduce((s, l) => s + (l.distanceMi ?? 0), 0);
              const totalSec = logs.reduce((s, l) => s + (l.durationSec ?? 0), 0);
              const avgPaceSec = totalMi > 0 ? totalSec / totalMi : null;
              const lastLog = logs.length > 0
                ? logs.reduce((a, b) => a.performedAt > b.performedAt ? a : b)
                : null;
              const lastLabel = lastLog
                ? `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(lastLog.performedAt)}`
                : null;

              return (
                <Link
                  key={group.id}
                  href={`/progress/cardio/${group.slug}?tab=overview&range=4w`}
                  scroll={false}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: sessions > 0 ? "1px solid rgba(78,148,255,0.22)" : "1px solid rgba(255,255,255,0.08)",
                    background: sessions > 0 ? "rgba(78,148,255,0.06)" : "rgba(255,255,255,0.03)",
                    textDecoration: "none",
                    color: "inherit",
                    alignItems: "start",
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 900, fontSize: 15 }}>{group.label}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[
                        sessions > 0 ? `${sessions} session${sessions !== 1 ? "s" : ""} (4w)` : "No recent sessions",
                        totalMi > 0 ? `${totalMi.toFixed(1)} mi` : null,
                        totalSec > 0 && !totalMi ? formatDuration(totalSec) : null,
                        avgPaceSec ? `${formatPace(avgPaceSec)} avg pace` : null,
                        lastLabel,
                      ]
                        .filter(Boolean)
                        .map((chip) => (
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
                  </div>
                  <span style={{ fontSize: 18, opacity: 0.4, paddingTop: 2 }}>›</span>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>

      {filteredSessions.length > 0 ? (
        <SectionCard
          title="Session Categories"
          subtitle="Tracked session types with recent activity — see volume and trends per category."
        >
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {filteredSessions.map(({ group, target }) => {
              const sessions = target?.logs.length ?? 0;
              const lastLog = (target?.logs ?? []).length > 0
                ? (target!.logs).reduce((a, b) => a.performedAt > b.performedAt ? a : b)
                : null;
              const lastLabel = lastLog
                ? `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(lastLog.performedAt)}`
                : "No recent sessions";
              return (
                <Link
                  key={group.id}
                  href={`/progress/groups/${group.slug}?tab=overview&range=4w`}
                  scroll={false}
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.09)",
                    background: "rgba(255,255,255,0.03)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 14 }}>{group.label}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[`${sessions} session${sessions !== 1 ? "s" : ""} (4w)`, lastLabel].map((chip) => (
                      <span key={chip} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", fontWeight: 700 }}>
                        {chip}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      ) : null}
    </ProgressShell>
  );
}
