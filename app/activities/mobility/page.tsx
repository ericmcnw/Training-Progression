// Mobility world page — Phase 2.
//
// Structure follows the new activity-page model:
//   - Pulse strip mixes a recent window with all-time so the user sees
//     both rhythms at a glance.
//   - Each chart owns its own time-range pill (no page-level filter).
//   - Recent Sessions defaults to 10 rows with a "View all" expansion
//     via ?recent=all (server-rendered, no client state).
//
// Pattern is the new shape for every activity-world page — mobility +
// lifestyle ship it first, climbing/strength/endurance/sports follow.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate } from "@/lib/dates";
import { effectiveRoutineDomain, domainColor } from "@/lib/routines";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";
import WeeklyBarChartWithSessions from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import ActivityHeader from "@/app/activities/_shared/ActivityHeader";
import { buildSessionsChartData, type SessionChartWeeks } from "@/lib/activities/sessions-chart";

export const dynamic = "force-dynamic";

// Canonical mobility purple — single source of truth in lib/routines.
// The soft BG / BORDER / TEXT variants are tuned for the card chrome
// and stay local.
const ACCENT = domainColor("mobility");
const ACCENT_BG = "rgba(192,132,252,0.08)";
const ACCENT_BORDER = "rgba(192,132,252,0.28)";
const ACCENT_TEXT = "rgba(216,180,254,0.95)";

// Sky-blue is the app's "interactive selection" cue (range pills on
// endurance, family tabs, chart selection). Used here for consistency
// across all activity-world pill rows.
const PILL_SELECT_BG = "rgba(120,190,255,0.15)";
const PILL_SELECT_BORDER = "rgba(120,190,255,0.45)";
const PILL_SELECT_TEXT = "rgba(191,219,254,0.98)";

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
  return `/activities/mobility${qs ? `?${qs}` : ""}`;
}

export default async function MobilityWorldPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const chartWeeks = parseChartWeeks(getParam(searchParams, "chart"));
  const recentExpanded = getParam(searchParams, "recent") === "all";

  const now = new Date();

  // Parallel: routines list + every mobility log (unbounded). The log
  // query uses an OR over routine-domain candidates so we don't have to
  // wait on the routines query to know which IDs to filter. We then
  // re-filter by effectiveRoutineDomain to catch legacy "recovery" +
  // WORKOUT-REHAB / GUIDED rows.
  //
  // Unbounded is intentional — the pulse strip's "All time" stat and
  // the "View all" recent-sessions expansion both need every log. At
  // single-user scale this is small enough to JS-filter in-memory.
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
            { domain: "mobility" },
            { domain: "recovery" },
            { AND: [{ kind: "WORKOUT" }, { subtype: "REHAB" }] },
            { kind: "GUIDED" },
            { AND: [{ kind: "SESSION" }, { subtype: "YOGA_SESSION" }] },
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

  const mobilityRoutines = allActiveRoutines.filter(
    (r) => effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "mobility"
  );

  const allLogs = candidateLogs.filter((l) =>
    effectiveRoutineDomain(l.routine.domain, l.routine.kind, l.routine.subtype) === "mobility"
  );

  // Pulse rollups — rolling windows + all-time so the user sees recent
  // rhythm AND total commitment in the same row.
  const thisWeekStart = startOfWeekMonday(now);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const sessionsThisWeek = allLogs.filter((l) => l.performedAt >= thisWeekStart).length;
  const sessions4w = allLogs.filter((l) => l.performedAt >= fourWeeksAgo).length;
  const sessions12w = allLogs.filter((l) => l.performedAt >= twelveWeeksAgo).length;
  const sessionsAllTime = allLogs.length;

  // Last-session lookup
  const lastSessionByRoutineId = new Map<string, Date>();
  for (const log of allLogs) {
    if (!lastSessionByRoutineId.has(log.routineId)) {
      lastSessionByRoutineId.set(log.routineId, log.performedAt);
    }
  }

  // Chart data — windowed by the chart's own time pill.
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

  const recentCount = recentExpanded ? RECENT_MAX : RECENT_DEFAULT;
  const recentSessions = allLogs.slice(0, recentCount);
  const recentHasMore = !recentExpanded && allLogs.length > RECENT_DEFAULT;

  return (
    <div style={pageStyle}>
      <ActivityHeader
        title="Mobility"
        accent={ACCENT}
        actions={
          <NewRoutineDrawerButton presetDomain="mobility" style={primaryCtaStyle}>
            + New routine
          </NewRoutineDrawerButton>
        }
      />

      <div style={pulseStripStyle}>
        <PulseStat label="This wk" value={sessionsThisWeek} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="4 wks" value={sessions4w} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="12 wks" value={sessions12w} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="All time" value={sessionsAllTime} />
      </div>

      {/* Per-chart range pill — only this chart responds to it. */}
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
          title={`Sessions per Week — Last ${chartWeeks} Weeks`}
          weekLabels={chartData.weekLabels}
          series={chartData.series}
          sessionsByWeek={chartData.sessionsByWeek}
          unit=""
          decimals={0}
          compact={false}
        />
      ) : null}

      <SectionCard
        title="Mobility Routines"
        subtitle="Your active mobility, stretching, and rehab routines."
      >
        {mobilityRoutines.length === 0 ? (
          <EmptyState message="No active mobility routines yet. Create one from above." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {mobilityRoutines.map((r) => (
              <RoutineRow
                key={r.id}
                href={`/routines/${r.id}`}
                name={r.name}
                subtype={r.subtype ?? r.kind}
                lastDate={lastSessionByRoutineId.get(r.id) ?? null}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Recent Sessions"
        subtitle={
          recentSessions.length === 0
            ? undefined
            : recentExpanded
              ? `Showing ${recentSessions.length} of ${allLogs.length}.`
              : `Last ${recentSessions.length} of ${allLogs.length}.`
        }
      >
        {recentSessions.length === 0 ? (
          <EmptyState message="Log a mobility session to start the timeline." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recentSessions.map((s) => (
              <SessionRow
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
                View all {allLogs.length} sessions →
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
                Showing the {RECENT_MAX} most recent. Older sessions are still in the all-time count.
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/log?domain=mobility" style={quickLinkStyle}>Mobility routines →</Link>
        <Link href="/body" style={quickLinkStyle}>Body status →</Link>
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

function RoutineRow({
  href,
  name,
  subtype,
  lastDate,
}: {
  href: string;
  name: string;
  subtype: string;
  lastDate: Date | null;
}) {
  return (
    <Link href={href} style={routineRowStyle}>
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>{name}</span>
        <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>
          {formatSubtypeLabel(subtype)}
        </span>
      </div>
      <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700, whiteSpace: "nowrap" }}>
        {lastDate ? `Last ${formatAppDate(lastDate, { month: "short", day: "numeric" })}` : "Not logged"}
      </span>
    </Link>
  );
}

function SessionRow({ href, routineName, date }: { href: string; routineName: string; date: Date }) {
  return (
    <Link href={href} style={sessionRowStyle}>
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

// Per-chart time range pill row. Sits above the chart; only the chart
// responds. Pattern: small "Chart range" label + horizontal pills.
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

const routineRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${ACCENT_BG}, rgba(255,255,255,0.02))`,
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};

const sessionRowStyle: React.CSSProperties = {
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
