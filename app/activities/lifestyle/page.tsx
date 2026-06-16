// Lifestyle world page — Phase 2.
//
// Same structural model as /activities/mobility:
//   - Pulse strip: recent windows + all-time
//   - Per-chart range pill (no page-level filter)
//   - Recent Completions defaults to 10 with ?recent=all expansion
//
// Adds a per-habit 12-week consistency strip on each habit row so hit
// and miss patterns read at a glance — the original stub's promised
// "habit consistency heatmap."

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate, toAppYmd } from "@/lib/dates";
import { effectiveRoutineDomain, domainColor } from "@/lib/routines";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";
import WeeklyBarChartWithSessions from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import ActivityHeader from "@/app/activities/_shared/ActivityHeader";
import { buildSessionsChartData, type SessionChartWeeks } from "@/lib/activities/sessions-chart";

export const dynamic = "force-dynamic";

// Canonical lifestyle amber — single source of truth in lib/routines.
// The soft BG / BORDER / TEXT variants are tuned for the card chrome
// and stay local.
const ACCENT = domainColor("lifestyle");
const ACCENT_BG = "rgba(251,191,36,0.08)";
const ACCENT_BORDER = "rgba(251,191,36,0.28)";
const ACCENT_TEXT = "rgba(253,224,71,0.95)";

const PILL_SELECT_BG = "rgba(120,190,255,0.15)";
const PILL_SELECT_BORDER = "rgba(120,190,255,0.45)";
const PILL_SELECT_TEXT = "rgba(191,219,254,0.98)";

const STRIP_DAYS = 84;
const RECENT_DEFAULT = 10;
const RECENT_MAX = 100;

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseChartWeeks(value: string | undefined): SessionChartWeeks {
  return value === "4w" ? 4 : 12;
}

function buildHref(searchParams: SearchParams, overrides: Record<string, string | undefined>): string {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") next[k] = v;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") delete next[k];
    else next[k] = v;
  }
  const qs = new URLSearchParams(next).toString();
  return `/activities/lifestyle${qs ? `?${qs}` : ""}`;
}

export default async function LifestyleWorldPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const chartWeeks = parseChartWeeks(getParam(searchParams, "chart"));
  const recentExpanded = getParam(searchParams, "recent") === "all";

  const now = new Date();

  // Parallel: routines + ALL lifestyle logs (unbounded). The pulse's
  // all-time stat and the recent-sessions expansion both need every
  // log; at single-user scale this is small enough to JS-filter.
  const [allActiveRoutines, candidateLogs] = await Promise.all([
    prisma.routine.findMany({
      where: { isActive: true, isDeleted: false, isPlaceholder: false },
      select: { id: true, name: true, domain: true, kind: true, subtype: true },
      orderBy: { name: "asc" },
    }),
    prisma.routineLog.findMany({
      where: {
        routine: {
          isPlaceholder: false,
          OR: [
            { domain: "lifestyle" },
            { domain: "habit" },
            { kind: "COMPLETION" },
          ],
        },
      },
      select: {
        id: true,
        routineId: true,
        performedAt: true,
        routine: { select: { id: true, name: true, domain: true, kind: true, subtype: true } },
      },
      orderBy: { performedAt: "desc" },
    }),
  ]);

  const lifestyleRoutines = allActiveRoutines.filter(
    (r) => effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "lifestyle"
  );

  const allLogs = candidateLogs.filter((l) =>
    effectiveRoutineDomain(l.routine.domain, l.routine.kind, l.routine.subtype) === "lifestyle"
  );

  // Pulse rollups
  const thisWeekStart = startOfWeekMonday(now);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const completionsThisWeek = allLogs.filter((l) => l.performedAt >= thisWeekStart).length;
  const completions4w = allLogs.filter((l) => l.performedAt >= fourWeeksAgo).length;
  const completions12w = allLogs.filter((l) => l.performedAt >= twelveWeeksAgo).length;
  const completionsAllTime = allLogs.length;

  // Per-routine state — last log, 7-day count, and the 84-day hit set
  // used to render the consistency strip.
  const lastByRoutineId = new Map<string, Date>();
  const last7dCount = new Map<string, number>();
  const stripHitsByRoutineId = new Map<string, Set<string>>();
  for (const log of allLogs) {
    if (!lastByRoutineId.has(log.routineId)) {
      lastByRoutineId.set(log.routineId, log.performedAt);
    }
    if (log.performedAt >= sevenDaysAgo) {
      last7dCount.set(log.routineId, (last7dCount.get(log.routineId) ?? 0) + 1);
    }
    if (log.performedAt >= twelveWeeksAgo) {
      const set = stripHitsByRoutineId.get(log.routineId) ?? new Set<string>();
      set.add(toAppYmd(log.performedAt));
      stripHitsByRoutineId.set(log.routineId, set);
    }
  }

  // Sort routines: most recently logged first
  const sortedRoutines = [...lifestyleRoutines].sort((a, b) => {
    const da = lastByRoutineId.get(a.id)?.getTime() ?? 0;
    const db = lastByRoutineId.get(b.id)?.getTime() ?? 0;
    if (da !== db) return db - da;
    return a.name.localeCompare(b.name);
  });

  // Chart — bounded by the chart's own pill.
  const chartCutoff = new Date(now.getTime() - chartWeeks * 7 * 24 * 60 * 60 * 1000);
  const chartData = buildSessionsChartData(
    allLogs
      .filter((l) => l.performedAt >= chartCutoff)
      .map((l) => ({
        id: l.id,
        date: l.performedAt,
        routineId: l.routineId,
        routineName: l.routine.name,
      })),
    { accentFirst: ACCENT, now, weeks: chartWeeks }
  );
  const chartHasData = chartData.series.some((s) =>
    s.weeklyValues.some((v) => v > 0)
  );

  // Build the per-day labels for the consistency strip — 84 days oldest
  // → newest. Marking Sundays for the week-divider lines.
  const stripDays: Array<{ ymd: string; isSunday: boolean }> = [];
  for (let i = STRIP_DAYS - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    stripDays.push({ ymd: toAppYmd(d), isSunday: d.getDay() === 0 });
  }

  const recentCount = recentExpanded ? RECENT_MAX : RECENT_DEFAULT;
  const recentLogs = allLogs.slice(0, recentCount);
  const recentHasMore = !recentExpanded && allLogs.length > RECENT_DEFAULT;

  return (
    <div style={pageStyle}>
      <ActivityHeader
        title="Lifestyle"
        accent={ACCENT}
        actions={
          <NewRoutineDrawerButton presetDomain="lifestyle" style={primaryCtaStyle}>
            + New routine
          </NewRoutineDrawerButton>
        }
      />

      <div style={pulseStripStyle}>
        <PulseStat label="This wk" value={completionsThisWeek} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="4 wks" value={completions4w} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="12 wks" value={completions12w} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="All time" value={completionsAllTime} />
      </div>

      {/* Per-chart range pill — only this chart responds. */}
      <div style={chartPillRowStyle}>
        <span style={chartPillLabelStyle}>Chart range</span>
        {(["4w", "12w"] as const).map((w) => (
          <Link
            key={w}
            href={buildHref(searchParams, { chart: w === "12w" ? undefined : w })}
            style={chartWeeks === (w === "4w" ? 4 : 12) ? pillSelectStyle : pillStyle}
          >
            {w}
          </Link>
        ))}
      </div>

      {chartHasData ? (
        <WeeklyBarChartWithSessions
          title={`Completions per Week — Last ${chartWeeks} Weeks`}
          weekLabels={chartData.weekLabels}
          series={chartData.series}
          sessionsByWeek={chartData.sessionsByWeek}
          unit=""
          decimals={0}
          compact={false}
        />
      ) : null}

      <SectionCard
        title="Your Habits"
        subtitle="Active lifestyle routines · most recently logged first. Each row shows the last 12 weeks of hits and misses."
      >
        {sortedRoutines.length === 0 ? (
          <EmptyState message="No active lifestyle habits yet. Create one from above." />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {sortedRoutines.map((r) => (
              <HabitRow
                key={r.id}
                href={`/routines/${r.id}`}
                name={r.name}
                subtype={r.subtype ?? r.kind}
                lastDate={lastByRoutineId.get(r.id) ?? null}
                weekCount={last7dCount.get(r.id) ?? 0}
                hits={stripHitsByRoutineId.get(r.id) ?? new Set()}
                stripDays={stripDays}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Recent Completions"
        subtitle={
          recentLogs.length === 0
            ? undefined
            : recentExpanded
              ? `Showing ${recentLogs.length} of ${allLogs.length}.`
              : `Last ${recentLogs.length} of ${allLogs.length}.`
        }
      >
        {recentLogs.length === 0 ? (
          <EmptyState message="Log a habit to start the timeline." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recentLogs.map((s) => (
              <LogRow
                key={s.id}
                href={`/routines/${s.routineId}/logs/${s.id}/details`}
                routineName={s.routine.name}
                date={s.performedAt}
              />
            ))}
            {recentHasMore ? (
              <Link
                href={buildHref(searchParams, { recent: "all" })}
                style={viewAllLinkStyle}
              >
                View all {allLogs.length} completions →
              </Link>
            ) : null}
            {recentExpanded && allLogs.length > RECENT_DEFAULT ? (
              <Link
                href={buildHref(searchParams, { recent: undefined })}
                style={viewAllLinkStyle}
              >
                Show fewer ↑
              </Link>
            ) : null}
            {recentExpanded && allLogs.length > RECENT_MAX ? (
              <div style={{ fontSize: 11, opacity: 0.55, textAlign: "center", paddingTop: 4 }}>
                Showing the {RECENT_MAX} most recent. Older completions are still in the all-time count.
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/log?domain=lifestyle" style={quickLinkStyle}>Lifestyle routines →</Link>
        <Link href="/plan?type=FREQUENCY#goals" style={quickLinkStyle}>Frequency goals →</Link>
        <Link href="/activities" style={quickLinkStyle}>Back to Activities</Link>
      </div>
    </div>
  );
}

function startOfWeekMonday(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

function PulseStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={pulseStatStyle}>
      <div style={{ ...pulseValueStyle, color: ACCENT_TEXT }}>{value}</div>
      <div style={pulseLabelStyle}>{label}</div>
    </div>
  );
}

function HabitRow({
  href,
  name,
  subtype,
  lastDate,
  weekCount,
  hits,
  stripDays,
}: {
  href: string;
  name: string;
  subtype: string;
  lastDate: Date | null;
  weekCount: number;
  hits: Set<string>;
  stripDays: Array<{ ymd: string; isSunday: boolean }>;
}) {
  return (
    <Link href={href} style={habitRowStyle}>
      <div style={habitRowTop}>
        <div style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
          <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>
            {formatSubtypeLabel(subtype)}
            {lastDate ? ` · Last ${formatAppDate(lastDate, { month: "short", day: "numeric" })}` : " · Not logged"}
          </span>
        </div>
        <div style={weekBadgeStyle}>
          <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1, color: ACCENT_TEXT }}>
            {weekCount}
          </span>
          <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 800, letterSpacing: 0.5 }}>7d</span>
        </div>
      </div>
      <div style={consistencyStripStyle} aria-hidden>
        {stripDays.map((day, idx) => (
          <span
            key={day.ymd}
            style={{
              ...stripCellStyle,
              background: hits.has(day.ymd) ? ACCENT : "rgba(255,255,255,0.05)",
              opacity: hits.has(day.ymd) ? 1 : 0.6,
              ...(day.isSunday && idx > 0 ? stripWeekDividerStyle : {}),
            }}
          />
        ))}
      </div>
    </Link>
  );
}

function LogRow({ href, routineName, date }: { href: string; routineName: string; date: Date }) {
  return (
    <Link href={href} style={logRowStyle}>
      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.2 }}>{routineName}</span>
        <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>
          {formatAppDate(date, { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>
    </Link>
  );
}

function formatSubtypeLabel(raw: string) {
  return raw
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const pageStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "18px 14px 60px",
  display: "grid",
  gap: 18,
};

// Compact pulse strip — one bordered row, four inline stats with thin
// dividers (same treatment as the climbing hub). Replaces the previous
// four padded cards that wrapped 2x2 and ate ~76px on mobile.
const pulseStripStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 4,
  padding: "8px 12px",
  borderRadius: 12,
  border: `1px solid ${ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${ACCENT_BG}, rgba(255,255,255,0.02))`,
};

const pulseDividerStyle: React.CSSProperties = {
  width: 1,
  alignSelf: "stretch",
  background: "rgba(255,255,255,0.08)",
  flexShrink: 0,
};

const pulseStatStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  textAlign: "center",
  flex: 1,
  minWidth: 0,
};

const pulseLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.6,
  whiteSpace: "nowrap",
};

const pulseValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1,
};

const chartPillRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};

const chartPillLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.55,
  textTransform: "uppercase",
  marginRight: 4,
};

const pillStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const pillSelectStyle: React.CSSProperties = {
  ...pillStyle,
  background: PILL_SELECT_BG,
  borderColor: PILL_SELECT_BORDER,
  color: PILL_SELECT_TEXT,
};

const habitRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${ACCENT_BG}, rgba(255,255,255,0.02))`,
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};

const habitRowTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const weekBadgeStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 1,
  padding: "6px 10px",
  borderRadius: 10,
  border: `1px solid ${ACCENT_BORDER}`,
  background: ACCENT_BG,
  minWidth: 44,
  flexShrink: 0,
};

const consistencyStripStyle: React.CSSProperties = {
  display: "flex",
  gap: 0,
  height: 10,
  borderRadius: 4,
  overflow: "hidden",
};

const stripCellStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const stripWeekDividerStyle: React.CSSProperties = {
  boxShadow: "inset 1px 0 0 rgba(0,0,0,0.25)",
};

const logRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.025)",
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};

const viewAllLinkStyle: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px dashed rgba(255,255,255,0.14)",
  background: "transparent",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  marginTop: 4,
};

const quickLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};

const primaryCtaStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 16px",
  borderRadius: 10,
  border: `1px solid ${ACCENT_BORDER}`,
  background: ACCENT_BG,
  color: ACCENT_TEXT,
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  minHeight: 44,
};
