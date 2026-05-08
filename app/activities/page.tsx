import Link from "next/link";
import { getMetadataIndex, getRoutineIndex, getRoutineLogs } from "@/app/progress/data";
import StackedWeeklyBarChart, { type StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";
import {
  ACTIVITY_FAMILY_META,
  ACTIVITY_FAMILY_ORDER,
  ACTIVITY_REGISTRY,
  activitiesByFamily,
  getActivityEntry,
  type ActivityFamily,
  type ActivityRegistryEntry,
} from "@/lib/activity-families";
import { effectiveRoutineDomain } from "@/lib/routines";
import { fillWeeklySeries, incrementWeekMap } from "@/lib/progress-v2";
import { ActivitiesEmpty, ActivitiesShell, ActivityCard, ActivityCardGrid, FamilySection } from "./ui";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

type ActivityStats = {
  entry: ActivityRegistryEntry;
  /** Logs in the last 4 weeks tagged with this activity (via metadata or fallback subtype). */
  sessions4w: number;
  totalDistanceMi: number;
  totalDurationSec: number;
  totalElevationFt: number;
  /** Most recent log date for this activity. */
  lastSession: Date | null;
  /** Distinct active routines tagged for this activity. */
  activeRoutines: number;
};

function formatLastLabel(date: Date | null) {
  if (!date) return "No recent activity";
  return `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)}`;
}

function formatNumber(value: number) {
  if (value >= 100) return value.toFixed(0);
  return value.toFixed(1);
}

export default async function ActivitiesPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const query = (getParam(searchParams, "q") ?? "").trim().toLowerCase();
  const familyFilter = (getParam(searchParams, "family") ?? "").trim().toLowerCase() as ActivityFamily | "";
  const showAll = getParam(searchParams, "show") === "all";

  const now = new Date();
  // Kick off all three independent queries immediately. We don't await them
  // sequentially — `routines` is needed first to compute the endurance routine
  // ids for the 12w chart fetch, but groups/logs can resolve in parallel with
  // that work, so we await routines first and then a Promise.all for the rest.
  const groupsPromise = getMetadataIndex();
  const routinesPromise = getRoutineIndex();
  const logs4wPromise = getRoutineLogs("4w");

  const routines = await routinesPromise;

  // For each routine, collect every CARDIO_ACTIVITY metadata slug it touches.
  // Routines are tagged via the metadataGroups relation; we treat any slug in
  // the activity registry as belonging to that activity.
  const routineSlugs = new Map<string, Set<string>>();
  for (const routine of routines) {
    const slugs = new Set<string>();
    for (const entry of routine.metadataGroups ?? []) {
      const slug = entry.group?.slug;
      if (!slug) continue;
      if (getActivityEntry(slug)) slugs.add(slug);
    }
    // Fallback: if no metadata tags resolve to a known activity, try the
    // routine subtype mapped through the registry (e.g., CLIMBING → climbing).
    if (slugs.size === 0 && routine.subtype) {
      const slugFromSubtype = routine.subtype.toLowerCase().replace(/_/g, "-");
      if (getActivityEntry(slugFromSubtype)) slugs.add(slugFromSubtype);
    }
    if (slugs.size > 0) routineSlugs.set(routine.id, slugs);
  }

  // Now we know which routines are endurance — kick off the 12w chart fetch
  // in parallel with awaiting groups + 4w logs (which are still in flight).
  const enduranceSlugsPreview = new Set(activitiesByFamily("endurance").map((e) => e.slug));
  const enduranceRoutineIdsPreview = Array.from(routineSlugs.entries())
    .filter(([, slugs]) => [...slugs].some((s) => enduranceSlugsPreview.has(s)))
    .map(([routineId]) => routineId);
  const logs12wPromise = enduranceRoutineIdsPreview.length > 0
    ? getRoutineLogs("12w", { routineIds: enduranceRoutineIdsPreview })
    : Promise.resolve([] as Awaited<ReturnType<typeof getRoutineLogs>>);

  const [groups, logs] = await Promise.all([groupsPromise, logs4wPromise]);
  const groupBySlug = new Map(groups.map((group) => [group.slug, group]));

  // Aggregate per-activity stats from the last 4 weeks of logs.
  const statsBySlug = new Map<string, ActivityStats>();
  for (const entry of ACTIVITY_REGISTRY) {
    statsBySlug.set(entry.slug, {
      entry,
      sessions4w: 0,
      totalDistanceMi: 0,
      totalDurationSec: 0,
      totalElevationFt: 0,
      lastSession: null,
      activeRoutines: 0,
    });
  }
  const seenRoutinesBySlug = new Map<string, Set<string>>();
  for (const log of logs) {
    const slugs = routineSlugs.get(log.routineId);
    if (!slugs) continue;
    for (const slug of slugs) {
      const stats = statsBySlug.get(slug);
      if (!stats) continue;
      stats.sessions4w += 1;
      stats.totalDistanceMi += log.distanceMi ?? 0;
      stats.totalDurationSec += log.durationSec ?? 0;
      stats.totalElevationFt += log.elevationGainFt ?? 0;
      if (!stats.lastSession || log.performedAt > stats.lastSession) {
        stats.lastSession = log.performedAt;
      }
      const seen = seenRoutinesBySlug.get(slug) ?? new Set<string>();
      seen.add(log.routineId);
      seenRoutinesBySlug.set(slug, seen);
    }
  }
  for (const [slug, seen] of seenRoutinesBySlug) {
    const stats = statsBySlug.get(slug);
    if (stats) stats.activeRoutines = seen.size;
  }

  // Counts for the Strength / Body Work synthetic sections.
  const strengthLogs4w = logs.filter((log) => effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype) === "strength");
  const strengthRoutineIds = new Set(strengthLogs4w.map((log) => log.routineId));
  const strengthActiveRoutines = routines.filter((r) => r.isActive && effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "strength").length;

  const bodyWorkLogs4w = logs.filter((log) => {
    const domain = effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype);
    return domain === "mobility";
  });
  const bodyWorkActiveRoutines = routines.filter((r) => {
    if (!r.isActive) return false;
    return effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "mobility";
  }).length;

  // ── Endurance chart data (12w stacked bar by activity type) ──────────────────
  // Promise was kicked off above immediately after we knew the routine ids,
  // so this just awaits whatever already finished while groups + logs4w resolved.
  const enduranceSlugs = enduranceSlugsPreview;
  const enduranceRoutineIds = enduranceRoutineIdsPreview;
  const enduranceLogs12w = await logs12wPromise;

  const enduranceActivityColors: Record<string, string> = {
    running:    "#3AAFE8",
    cycling:    "#F5C842",
    biking:     "#F5C842",
    swimming:   "#1DC9BC",
    hiking:     "#3ECC72",
    rowing:     "#F07030",
    walking:    "#88BFEE",
    golf:       "#28D4A0",
    triathlon:  "#B04EF5",
  };
  const enduranceFallbackColors = ["#F04DB0", "#F5A420", "#4ADE80"];

  const routineEnduranceLabel = new Map<string, string>();
  for (const [routineId, slugs] of routineSlugs) {
    const slug = [...slugs].find((s) => enduranceSlugs.has(s));
    if (!slug) continue;
    const entry = getActivityEntry(slug);
    if (entry) routineEnduranceLabel.set(routineId, entry.label);
  }

  const weeklyMilesPerActivity = new Map<string, Map<string, number>>();
  const weeklyMinutesPerActivity = new Map<string, Map<string, number>>();
  for (const log of enduranceLogs12w) {
    const label = routineEnduranceLabel.get(log.routineId);
    if (!label) continue;
    if (!weeklyMilesPerActivity.has(label)) weeklyMilesPerActivity.set(label, new Map());
    if (!weeklyMinutesPerActivity.has(label)) weeklyMinutesPerActivity.set(label, new Map());
    incrementWeekMap(weeklyMilesPerActivity.get(label)!, log.performedAt, log.distanceMi ?? 0);
    incrementWeekMap(weeklyMinutesPerActivity.get(label)!, log.performedAt, (log.durationSec ?? 0) / 60);
  }

  const enduranceWeekLabels = fillWeeklySeries(new Map(), "12w", now).map((p) => p.label);
  let enduranceFallbackIdx = 0;
  const enduranceStackedSeries: StackedBarSeries[] = Array.from(weeklyMilesPerActivity.entries())
    .map(([label, weekMap]) => ({ label, total: Array.from(weekMap.values()).reduce((a, b) => a + b, 0), weekMap }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((e) => {
      const slug = e.label.toLowerCase().replace(/\s+/g, "-");
      const color = enduranceActivityColors[slug] ?? enduranceFallbackColors[enduranceFallbackIdx++ % enduranceFallbackColors.length];
      return {
        label: e.label,
        color,
        weeklyValues: fillWeeklySeries(e.weekMap, "12w", now).map((p) => p.value),
        weeklyMinutes: fillWeeklySeries(weeklyMinutesPerActivity.get(e.label) ?? new Map(), "12w", now).map((p) => p.value),
      };
    });

  // Apply text query filter to activity entries (not the synthetic sections).
  function matchesQuery(entry: ActivityRegistryEntry) {
    if (!query) return true;
    return entry.label.toLowerCase().includes(query) || entry.slug.includes(query);
  }

  const familiesToRender: ActivityFamily[] = familyFilter
    ? ACTIVITY_FAMILY_ORDER.filter((f) => f === familyFilter)
    : ACTIVITY_FAMILY_ORDER;

  const totalSessions4w = logs.length;

  return (
    <ActivitiesShell
      title="Activities"
      subtitle={`Your training worlds — browse by activity and dive into each one's recent volume, trends, and content. ${totalSessions4w} ${totalSessions4w === 1 ? "session" : "sessions"} logged in the last 4 weeks.`}
      toolbar={<FilterBar query={query} familyFilter={familyFilter} />}
    >
      {familiesToRender.map((family) => {
        const meta = ACTIVITY_FAMILY_META[family];

        // Endurance & Sports: data-driven from the registry.
        if (family === "endurance" || family === "sports") {
          const entries = activitiesByFamily(family).filter(matchesQuery);
          const familySessions = entries.reduce((sum, e) => sum + (statsBySlug.get(e.slug)?.sessions4w ?? 0), 0);
          const familyActiveActivities = entries.filter((e) => (statsBySlug.get(e.slug)?.sessions4w ?? 0) > 0).length;

          // Hide entries with no activity by default — focus on what the user actually trains.
          // Always show climbing because it's the deep one.
          // Searching or ?show=all reveals every registered activity.
          const visibleEntries = query || showAll
            ? entries
            : entries.filter((e) => (statsBySlug.get(e.slug)?.sessions4w ?? 0) > 0 || e.hasDeepWorld);

          if (entries.length === 0 && query) return null;

          return (
            <FamilySection
              key={family}
              family={family}
              label={meta.label}
              description={meta.description}
              accent={meta.accent}
              totals={{
                sessions: familySessions,
                activeActivities: familyActiveActivities,
              }}
            >
              {family === "endurance" && enduranceStackedSeries.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <StackedWeeklyBarChart
                    title="Miles per Week by Activity — Last 12 Weeks"
                    weekLabels={enduranceWeekLabels}
                    series={enduranceStackedSeries}
                    unit="mi"
                    decimals={1}
                  />
                </div>
              )}
              {visibleEntries.length === 0 ? (
                <ActivitiesEmpty message={`No ${meta.label.toLowerCase()} sessions yet. Log one to start populating this section.`} />
              ) : (
                <ActivityCardGrid>
                  {visibleEntries.map((entry) => {
                    const stats = statsBySlug.get(entry.slug)!;
                    const hasActivity = stats.sessions4w > 0;
                    const chips: string[] = [];
                    if (stats.totalDistanceMi > 0) {
                      chips.push(`${formatNumber(stats.totalDistanceMi)} mi 4w`);
                    } else if (stats.totalDurationSec > 0) {
                      const minutes = Math.round(stats.totalDurationSec / 60);
                      chips.push(`${minutes} min 4w`);
                    }
                    if (stats.activeRoutines > 0) {
                      chips.push(`${stats.activeRoutines} routine${stats.activeRoutines === 1 ? "" : "s"}`);
                    }
                    chips.push(formatLastLabel(stats.lastSession));

                    return (
                      <ActivityCard
                        key={entry.slug}
                        href={`/activities/${entry.slug}`}
                        eyebrow={entry.eyebrow}
                        label={entry.label}
                        primaryStat={{
                          value: String(stats.sessions4w),
                          suffix: stats.sessions4w === 1 ? "session 4w" : "sessions 4w",
                        }}
                        chips={chips}
                        highlight={hasActivity || entry.hasDeepWorld}
                        accent={meta.accent}
                      />
                    );
                  })}
                  {!query && !showAll && hasMissingActivity(entries, statsBySlug) ? (
                    <Link
                      href={`/activities?show=all${familyFilter ? `&family=${familyFilter}` : ""}`}
                      style={{
                        display: "grid",
                        placeItems: "center",
                        minHeight: 120,
                        padding: 14,
                        borderRadius: 16,
                        border: "1px dashed rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.02)",
                        textDecoration: "none",
                        color: "rgba(255,255,255,0.7)",
                        fontSize: 13,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      + Browse all {meta.label.toLowerCase()}
                    </Link>
                  ) : null}
                </ActivityCardGrid>
              )}
            </FamilySection>
          );
        }

        // Strength — synthetic section, links to Log → Routines filtered to strength.
        if (family === "strength") {
          if (query) return null; // Don't include in text search results — it's a meta-tile.
          return (
            <FamilySection
              key={family}
              family={family}
              label={meta.label}
              description={meta.description}
              accent={meta.accent}
              totals={{ sessions: strengthLogs4w.length, activeActivities: strengthActiveRoutines }}
            >
              <ActivityCardGrid>
                <ActivityCard
                  href="/activities/strength"
                  eyebrow="Activity world"
                  label="Strength"
                  primaryStat={{
                    value: String(strengthLogs4w.length),
                    suffix: strengthLogs4w.length === 1 ? "session 4w" : "sessions 4w",
                  }}
                  chips={[
                    `${strengthActiveRoutines} active routine${strengthActiveRoutines === 1 ? "" : "s"}`,
                    `${strengthRoutineIds.size} logged routine${strengthRoutineIds.size === 1 ? "" : "s"}`,
                  ]}
                  highlight={strengthLogs4w.length > 0}
                  accent={meta.accent}
                />
                <ActivityCard
                  href="/log?view=exercises"
                  eyebrow="Library"
                  label="Exercises"
                  chips={["Browse and edit your exercise library"]}
                  accent={meta.accent}
                />
              </ActivityCardGrid>
            </FamilySection>
          );
        }

        // Body Work — synthetic section linking into Body and mobility/recovery routines.
        if (family === "body-work") {
          if (query) return null;
          return (
            <FamilySection
              key={family}
              family={family}
              label={meta.label}
              description={meta.description}
              accent={meta.accent}
              totals={{ sessions: bodyWorkLogs4w.length, activeActivities: bodyWorkActiveRoutines }}
            >
              <ActivityCardGrid>
                <ActivityCard
                  href="/log?view=routines&domain=mobility"
                  eyebrow="Mobility"
                  label="Mobility Routines"
                  chips={["Stretching, yoga, mobility flows"]}
                  accent={meta.accent}
                />
                <ActivityCard
                  href="/log?view=routines&domain=habit"
                  eyebrow="Daily Habits"
                  label="Daily Routines"
                  chips={["Cold plunge, sauna, breathwork, foam rolling"]}
                  accent={meta.accent}
                />
                <ActivityCard
                  href="/body"
                  eyebrow="Status"
                  label="Body Status"
                  chips={["Body map · injuries · coverage"]}
                  accent={meta.accent}
                />
              </ActivityCardGrid>
            </FamilySection>
          );
        }

        return null;
      })}
    </ActivitiesShell>
  );
}

function hasMissingActivity(entries: ActivityRegistryEntry[], statsBySlug: Map<string, ActivityStats>) {
  return entries.some((e) => (statsBySlug.get(e.slug)?.sessions4w ?? 0) === 0 && !e.hasDeepWorld);
}

function FilterBar({ query, familyFilter }: { query: string; familyFilter: string }) {
  return (
    <form
      action="/activities"
      method="get"
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <input
        name="q"
        defaultValue={query}
        placeholder="Search activities…"
        style={{
          flex: "1 1 240px",
          minHeight: 38,
          fontSize: 13,
          padding: "8px 12px",
          borderRadius: 12,
        }}
      />
      <FamilyChip href="/activities" label="All" active={!familyFilter} />
      {ACTIVITY_FAMILY_ORDER.map((family) => (
        <FamilyChip
          key={family}
          href={`/activities?family=${family}`}
          label={ACTIVITY_FAMILY_META[family].label}
          active={familyFilter === family}
          accent={ACTIVITY_FAMILY_META[family].accent}
        />
      ))}
    </form>
  );
}

function FamilyChip({ href, label, active, accent }: { href: string; label: string; active: boolean; accent?: string }) {
  return (
    <Link
      href={href}
      className="activityFamilyChip"
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        textDecoration: "none",
        border: active
          ? `1px solid ${(accent ?? "rgba(51,255,122,0.55)").replace("0.9)", "0.55)")}`
          : "1px solid rgba(255,255,255,0.14)",
        background: active
          ? (accent ?? "rgba(51,255,122,0.18)").replace("0.9)", "0.18)")
          : "rgba(255,255,255,0.04)",
        color: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}
