import Link from "next/link";
import MetricLineChart from "./MetricLineChart";
import { getMetadataIndex, getRoutineIndex, getRoutineLogs } from "./data";
import { EmptyState, ProgressShell, SectionCard } from "./ui";
import { formatDuration, formatPace } from "@/lib/progress";
import { fillWeeklySeries, incrementWeekMap, startOfYear, weekKey } from "@/lib/progress-v2";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
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

  const cardioRoutines = routines.filter((r) => r.kind === "CARDIO" && r.isActive);
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
  const weeklySessionsMap = new Map<string, number>();
  for (const log of allCardioLogs) {
    incrementWeekMap(weeklyMilesMap, log.performedAt, log.distanceMi ?? 0);
    incrementWeekMap(weeklySessionsMap, log.performedAt, 1);
  }
  const weeklyMilesSeries = fillWeeklySeries(weeklyMilesMap, "12w", now);
  const weeklySessionsSeries = fillWeeklySeries(weeklySessionsMap, "12w", now);

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
      return { routine, sessions: logs.length, miles, durationSec, avgPaceSec, ytdMiles, lastSession };
    })
    .filter((b) => b.sessions > 0 || !query)
    .filter((b) => !query || b.routine.name.toLowerCase().includes(query))
    .sort((a, b) => b.miles - a.miles || b.sessions - a.sessions);

  // ── Group cards for navigation (no heavy resolveGroupTarget) ─────────────────
  const filteredGroups = cardioGroups.filter(
    (g) => !query || g.label.toLowerCase().includes(query) || g.slug.includes(query)
  );

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

      {/* ── Weekly mileage chart ── */}
      {hasAnyData ? (
        <SectionCard title="Weekly Mileage" subtitle="Miles logged per week across all cardio activities — last 12 weeks.">
          <div style={{ display: "grid", gap: 10 }}>
            <MetricLineChart
              title="Total Miles per Week"
              yLabel="Miles"
              xLabel="Week"
              points={weeklyMilesSeries}
              unit="mi"
              decimals={1}
            />
            <MetricLineChart
              title="Sessions per Week"
              yLabel="Sessions"
              xLabel="Week"
              points={weeklySessionsSeries}
              decimals={0}
              compact
            />
          </div>
        </SectionCard>
      ) : null}

      {/* ── Per-routine breakdown ── */}
      {routineBreakdowns.length > 0 ? (
        <SectionCard title="By Activity" subtitle="Each cardio routine you've logged, sorted by total distance.">
          <div style={{ display: "grid", gap: 8 }}>
            {routineBreakdowns.map(({ routine, sessions, miles, durationSec, avgPaceSec, ytdMiles, lastSession }) => (
              <ActivityRow
                key={routine.id}
                name={routine.name}
                sessions={sessions}
                miles={miles}
                durationSec={durationSec}
                avgPaceSec={avgPaceSec}
                ytdMiles={ytdMiles}
                lastSession={lastSession}
                href={`/progress/routines/${routine.id}?tab=overview&range=4w`}
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

      {/* ── Activity type rollups (navigation links) ── */}
      {filteredGroups.length > 0 ? (
        <SectionCard title="Activity Rollups" subtitle="Drill into aggregated stats per sport — pace, elevation, distance, and trends.">
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {filteredGroups.map((group) => (
              <Link
                key={group.id}
                href={`/progress/cardio/${group.slug}?tab=overview&range=4w`}
                scroll={false}
                style={{ display: "grid", gap: 4, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(78,148,255,0.18)", background: "rgba(78,148,255,0.06)", textDecoration: "none", color: "inherit" }}
              >
                <div style={{ fontWeight: 900, fontSize: 14 }}>{group.label}</div>
                <div style={{ fontSize: 12, opacity: 0.65 }}>Cardio rollup — pace, distance, elevation</div>
              </Link>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </ProgressShell>
  );
}
