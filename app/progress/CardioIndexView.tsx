import Link from "next/link";
import MetricLineChart from "./MetricLineChart";
import StackedWeeklyBarChart, { type StackedBarSeries } from "./StackedWeeklyBarChart";
import { getMetadataIndex, getRoutineIndex, getRoutineLogs } from "./data";
import { EmptyState, ProgressShell, SectionCard } from "./ui";
import { formatDuration, formatPace } from "@/lib/progress";
import { fillWeeklySeries, incrementWeekMap, startOfYear, weekKey } from "@/lib/progress-v2";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function hasCardioActivityGroup(routine: Awaited<ReturnType<typeof getRoutineIndex>>[number]) {
  return routine.metadataGroups.some(
    (entry) => entry.group.kind === "CARDIO_ACTIVITY" && entry.group.slug !== "climbing"
  );
}

function StatChip({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ display: "grid", gap: 3, padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", opacity: 0.55, fontWeight: 900 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1, color: accent ?? "inherit" }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.3 }}>{sub}</div> : null}
    </div>
  );
}

function ActivityRow({
  name,
  sessions,
  miles,
  durationSec,
  avgPaceSec,
  ytdMiles,
  lastSession,
  href,
}: {
  name: string;
  sessions: number;
  miles: number;
  durationSec: number;
  avgPaceSec: number | null;
  ytdMiles: number;
  lastSession: Date | null;
  href: string;
}) {
  const lastLabel = lastSession
    ? `Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(lastSession)}`
    : "No recent activity";

  return (
    <Link
      href={href}
      scroll={false}
      style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", textDecoration: "none", color: "inherit", alignItems: "start" }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 900, fontSize: 14 }}>{name}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            `${sessions} sessions`,
            miles > 0 ? `${miles.toFixed(1)} mi total` : null,
            durationSec > 0 ? formatDuration(durationSec) : null,
            avgPaceSec ? `${formatPace(avgPaceSec)} avg pace` : null,
            `${ytdMiles.toFixed(1)} mi YTD`,
            lastLabel,
          ]
            .filter(Boolean)
            .map((chip) => (
              <span key={chip} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", fontWeight: 700 }}>
                {chip}
              </span>
            ))}
        </div>
      </div>
      <span style={{ fontSize: 18, opacity: 0.4 }}>›</span>
    </Link>
  );
}

export default async function CardioIndexView(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const query = (getParam(searchParams, "q") ?? "").trim().toLowerCase();
  const now = new Date();

  const [routines, groups] = await Promise.all([getRoutineIndex(), getMetadataIndex()]);

  const cardioRoutines = routines.filter(
    (r) => r.isActive && (r.kind === "CARDIO" || hasCardioActivityGroup(r))
  );
  const cardioGroups = groups.filter((g) => g.kind === "CARDIO_ACTIVITY");

  // Fetch all-time cardio logs once — used for every stat (totals, chart, per-routine)
  const cardioRoutineIds = cardioRoutines.map((r) => r.id);
  const allCardioLogs =
    cardioRoutineIds.length > 0
      ? await getRoutineLogs("all", { routineIds: cardioRoutineIds })
      : [];

  // ── Date buckets ─────────────────────────────────────────────────────────────
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = startOfYear(now);

  const thisWeekLogs = allCardioLogs.filter((l) => l.performedAt >= weekStart);
  const thisMonthLogs = allCardioLogs.filter((l) => l.performedAt >= monthStart);
  const ytdLogs = allCardioLogs.filter((l) => l.performedAt >= yearStart);

  // ── Aggregate totals ──────────────────────────────────────────────────────────
  const totalMilesWeek = thisWeekLogs.reduce((s, l) => s + (l.distanceMi ?? 0), 0);
  const totalMilesMonth = thisMonthLogs.reduce((s, l) => s + (l.distanceMi ?? 0), 0);
  const totalMilesYTD = ytdLogs.reduce((s, l) => s + (l.distanceMi ?? 0), 0);
  const totalMilesAllTime = allCardioLogs.reduce((s, l) => s + (l.distanceMi ?? 0), 0);
  const sessionsWeek = thisWeekLogs.length;
  const sessionsYTD = ytdLogs.length;

  // ── Streak (consecutive weeks ending now with at least one cardio session) ────
  const activeWeekKeys = new Set(allCardioLogs.map((l) => weekKey(l.performedAt)));
  let streak = 0;
  const streakCursor = new Date(now);
  for (let i = 0; i < 156; i++) {
    const wk = weekKey(streakCursor);
    if (!activeWeekKeys.has(wk)) break;
    streak++;
    streakCursor.setDate(streakCursor.getDate() - 7);
  }

  // ── Weekly series (12 weeks) ──────────────────────────────────────────────────
  const weeklyMilesMap = new Map<string, number>();
  const weeklyMinutesMap = new Map<string, number>();
  for (const log of allCardioLogs) {
    incrementWeekMap(weeklyMilesMap, log.performedAt, log.distanceMi ?? 0);
    incrementWeekMap(weeklyMinutesMap, log.performedAt, (log.durationSec ?? 0) / 60);
  }
  const weeklyMilesSeries = fillWeeklySeries(weeklyMilesMap, "12w", now);
  const stackedWeekLabels = weeklyMilesSeries.map((p) => p.label);

  // ── Stacked mileage by activity type (CARDIO_ACTIVITY group) ─────────────────
  const activityColors: Record<string, string> = {
    running:    "#3AAFE8",
    cycling:    "#F5C842",
    biking:     "#F5C842",
    swimming:   "#1DC9BC",
    hiking:     "#3ECC72",
    rowing:     "#F07030",
    walking:    "#88BFEE",
    golf:       "#28D4A0",
    basketball: "#F03D6A",
  };
  const fallbackColors = ["#B04EF5", "#F04DB0", "#F5A420"];

  // Priority: specific sports win over umbrella labels ("Run + Walk", "All Cardio")
  const CARDIO_PRIORITY = ["hiking", "running", "cycling", "biking", "walking", "swimming", "rowing", "golf", "basketball"];

  function pickCardioActivityGroup(routine: (typeof cardioRoutines)[number]) {
    const groups = routine.metadataGroups
      .map((mg) => mg.group)
      .filter((g) => g.kind === "CARDIO_ACTIVITY");
    if (groups.length === 0) return null;
    return [...groups].sort((a, b) => {
      const ia = CARDIO_PRIORITY.indexOf(a.slug);
      const ib = CARDIO_PRIORITY.indexOf(b.slug);
      return (ia === -1 ? CARDIO_PRIORITY.length : ia) - (ib === -1 ? CARDIO_PRIORITY.length : ib);
    })[0];
  }

  // Build routineId → activity group maps (label for chart, slug for links)
  const routineActivityGroupMap = new Map<string, string>();
  const routineCardioGroupSlugMap = new Map<string, string>();
  for (const routine of cardioRoutines) {
    const best = pickCardioActivityGroup(routine);
    if (best) {
      routineActivityGroupMap.set(routine.id, best.label);
      routineCardioGroupSlugMap.set(routine.id, best.slug);
    }
  }

  // Aggregate miles, minutes, and sessions per activity type per week
  const activityWeeklyMiles = new Map<string, Map<string, number>>();
  const activityWeeklyMinutes = new Map<string, Map<string, number>>();
  const activityWeeklySessions = new Map<string, Map<string, number>>();
  for (const log of allCardioLogs) {
    const activityLabel = routineActivityGroupMap.get(log.routineId) ?? "Other";
    if (!activityWeeklyMiles.has(activityLabel)) activityWeeklyMiles.set(activityLabel, new Map());
    if (!activityWeeklyMinutes.has(activityLabel)) activityWeeklyMinutes.set(activityLabel, new Map());
    if (!activityWeeklySessions.has(activityLabel)) activityWeeklySessions.set(activityLabel, new Map());
    incrementWeekMap(activityWeeklyMiles.get(activityLabel)!, log.performedAt, log.distanceMi ?? 0);
    incrementWeekMap(activityWeeklyMinutes.get(activityLabel)!, log.performedAt, (log.durationSec ?? 0) / 60);
    incrementWeekMap(activityWeeklySessions.get(activityLabel)!, log.performedAt, 1);
  }

  const stackedSessionsSeries: StackedBarSeries[] = Array.from(activityWeeklySessions.entries())
    .map(([label, weekMap]) => ({ label, total: Array.from(weekMap.values()).reduce((a, b) => a + b, 0), weekMap }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((entry, idx) => {
      const slug = entry.label.toLowerCase();
      const color = activityColors[slug] ?? fallbackColors[idx % fallbackColors.length];
      const filled = fillWeeklySeries(entry.weekMap, "12w", now);
      return { label: entry.label, color, weeklyValues: filled.map((p) => p.value) };
    });

  // Convert to stacked series aligned to stackedWeekLabels
  const activitySeriesEntries = Array.from(activityWeeklyMiles.entries())
    .map(([label, weekMap]) => ({ label, total: Array.from(weekMap.values()).reduce((a, b) => a + b, 0), weekMap }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total);

  const stackedSeries: StackedBarSeries[] = activitySeriesEntries.map((entry, idx) => {
    const slug = entry.label.toLowerCase();
    const color = activityColors[slug] ?? fallbackColors[idx % fallbackColors.length];
    const filled = fillWeeklySeries(entry.weekMap, "12w", now);
    const minutesFilled = fillWeeklySeries(activityWeeklyMinutes.get(entry.label) ?? new Map(), "12w", now);
    return {
      label: entry.label,
      color,
      weeklyValues: filled.map((p) => p.value),
      weeklyMinutes: minutesFilled.map((p) => p.value),
    };
  });

  // ── Per-routine breakdown ─────────────────────────────────────────────────────
  const routineBreakdowns = cardioRoutines
    .map((routine) => {
      const logs = allCardioLogs.filter((l) => l.routineId === routine.id);
      const miles = logs.reduce((s, l) => s + (l.distanceMi ?? 0), 0);
      const durationSec = logs.reduce((s, l) => s + (l.durationSec ?? 0), 0);
      const ytdMiles = logs
        .filter((l) => l.performedAt >= yearStart)
        .reduce((s, l) => s + (l.distanceMi ?? 0), 0);
      const avgPaceSec = miles > 0 ? durationSec / miles : null;
      const lastSession = logs.length > 0 ? logs[logs.length - 1].performedAt : null;
      const cardioGroupSlug = routineCardioGroupSlugMap.get(routine.id);
      const href = cardioGroupSlug
        ? `/progress/cardio/${cardioGroupSlug}?tab=overview&range=4w`
        : `/progress/routines/${routine.id}?tab=overview&range=4w`;
      return { routine, sessions: logs.length, miles, durationSec, avgPaceSec, ytdMiles, lastSession, href };
    })
    .filter((b) => b.sessions > 0 || !query)
    .filter((b) => !query || b.routine.name.toLowerCase().includes(query))
    .sort((a, b) => b.miles - a.miles || b.sessions - a.sessions);

  const hasAnyData = allCardioLogs.length > 0;

  return (
    <ProgressShell
      section="cardio"
      title="Cardio Progress"
      subtitle="Distance, pace, duration, and elevation across all cardio activities."
    >
      {/* ── Summary strip ── */}
      <SectionCard title="Totals">
        {!hasAnyData ? (
          <EmptyState message="No cardio sessions logged yet." />
        ) : (
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
            <StatChip label="This Week" value={totalMilesWeek > 0 ? `${totalMilesWeek.toFixed(1)} mi` : "—"} sub={`${sessionsWeek} session${sessionsWeek !== 1 ? "s" : ""}`} accent={totalMilesWeek > 0 ? "rgba(78,148,255,0.95)" : undefined} />
            <StatChip label="This Month" value={totalMilesMonth > 0 ? `${totalMilesMonth.toFixed(1)} mi` : "—"} sub={`${thisMonthLogs.length} sessions`} />
            <StatChip label="YTD" value={totalMilesYTD > 0 ? `${totalMilesYTD.toFixed(1)} mi` : "—"} sub={`${sessionsYTD} sessions`} />
            <StatChip label="All Time" value={totalMilesAllTime > 0 ? `${totalMilesAllTime.toFixed(1)} mi` : "—"} sub={`${allCardioLogs.length} sessions`} />
            <StatChip
              label="Active Streak"
              value={streak > 0 ? `${streak} wk${streak !== 1 ? "s" : ""}` : "—"}
              sub={streak > 0 ? "consecutive weeks" : "no current streak"}
              accent={streak >= 4 ? "rgba(84,203,130,0.95)" : streak > 0 ? "rgba(251,199,92,0.9)" : undefined}
            />
          </div>
        )}
      </SectionCard>

      {/* ── Weekly mileage stacked bar chart ── */}
      {hasAnyData ? (
        <SectionCard title="Weekly Mileage" subtitle="Miles per week by activity type — last 12 weeks.">
          <div style={{ display: "grid", gap: 10 }}>
            {stackedSeries.length > 0 ? (
              <StackedWeeklyBarChart
                title="Miles per Week by Activity"
                weekLabels={stackedWeekLabels}
                series={stackedSeries}
                unit="mi"
                decimals={1}
              />
            ) : (
              <MetricLineChart
                title="Total Miles per Week"
                yLabel="Miles"
                xLabel="Week"
                points={weeklyMilesSeries}
                unit="mi"
                decimals={1}
              />
            )}
            {stackedSessionsSeries.length > 0 && (
              <StackedWeeklyBarChart
                title="Sessions per Week by Activity"
                weekLabels={stackedWeekLabels}
                series={stackedSessionsSeries}
                unit=""
                decimals={0}
                compact
              />
            )}
          </div>
        </SectionCard>
      ) : null}

      {/* ── Per-routine breakdown ── */}
      {routineBreakdowns.length > 0 ? (
        <SectionCard title="By Activity" subtitle="Each cardio routine you've logged, sorted by total distance.">
          <div style={{ display: "grid", gap: 8 }}>
            {routineBreakdowns.map(({ routine, sessions, miles, durationSec, avgPaceSec, ytdMiles, lastSession, href }) => (
              <ActivityRow
                key={routine.id}
                name={routine.name}
                sessions={sessions}
                miles={miles}
                durationSec={durationSec}
                avgPaceSec={avgPaceSec}
                ytdMiles={ytdMiles}
                lastSession={lastSession}
                href={href}
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

    </ProgressShell>
  );
}
