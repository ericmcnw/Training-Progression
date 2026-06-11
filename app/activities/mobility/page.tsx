// Mobility world page — Phase 2.
// Structure follows the endurance gold standard: hero → pulse strip →
// 12-week sessions chart → range-filtered stats + sessions list.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate } from "@/lib/dates";
import { effectiveRoutineDomain } from "@/lib/routines";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";
import WeeklyBarChartWithSessions from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { buildSessionsChartData } from "@/lib/activities/sessions-chart";

export const dynamic = "force-dynamic";

const ACCENT = "rgba(192,132,252,0.9)";
const ACCENT_BG = "rgba(192,132,252,0.08)";
const ACCENT_BORDER = "rgba(192,132,252,0.28)";
const ACCENT_TEXT = "rgba(216,180,254,0.95)";

type SearchParams = Record<string, string | string[] | undefined>;
type RangeFilter = "4w" | "12w" | "1y" | "all";

const RANGE_DAYS: Record<Exclude<RangeFilter, "all">, number> = {
  "4w": 28,
  "12w": 84,
  "1y": 365,
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseRange(value: string | undefined): RangeFilter {
  if (value === "4w" || value === "12w" || value === "1y" || value === "all") return value;
  return "12w";
}

function rangeLabel(range: RangeFilter): string {
  if (range === "4w") return "last 4 weeks";
  if (range === "12w") return "last 12 weeks";
  if (range === "1y") return "last year";
  return "all time";
}

function buildHref(overrides: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined && v !== "") qs.set(k, v);
  }
  const s = qs.toString();
  return `/activities/mobility${s ? `?${s}` : ""}`;
}

export default async function MobilityWorldPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const range = parseRange(getParam(searchParams, "range"));

  const now = new Date();
  // Chart is always 12 weeks regardless of range filter (cadence trends
  // need a stable window). Stats + recent-sessions list use the filter.
  const chartCutoff = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);
  const rangeCutoff = range === "all" ? null : new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  // widestCutoff = the OLDER of (chart window, stats window). null = unbounded
  // when range=all so the Recent Sessions list actually surfaces all time
  // instead of silently capping at 12 weeks.
  const widestCutoff: Date | null =
    range === "all"
      ? null
      : rangeCutoff && rangeCutoff < chartCutoff
        ? rangeCutoff
        : chartCutoff;

  // Parallel: routines list + every log within the widest window. The log
  // query uses an OR over routine-domain candidates so we don't have to
  // wait on the routines query to know which IDs to filter. We then
  // re-filter by effectiveRoutineDomain on the client side to catch
  // legacy "recovery" + WORKOUT-REHAB / GUIDED rows.
  const [allActiveRoutines, candidateLogs] = await Promise.all([
    prisma.routine.findMany({
      where: { isActive: true, isDeleted: false, isPlaceholder: false },
      select: { id: true, name: true, domain: true, kind: true, subtype: true },
      orderBy: { name: "asc" },
    }),
    prisma.routineLog.findMany({
      where: {
        ...(widestCutoff ? { performedAt: { gte: widestCutoff } } : {}),
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

  // Post-filter candidate logs against the authoritative domain derivation.
  const allLogs = candidateLogs.filter((l) =>
    effectiveRoutineDomain(l.routine.domain, l.routine.kind, l.routine.subtype) === "mobility"
  );

  // Stats window — bounded by the active range filter.
  const statsCutoff = rangeCutoff;
  const logsInRange = statsCutoff
    ? allLogs.filter((l) => l.performedAt >= statsCutoff)
    : allLogs;

  // Pulse rollups — fixed windows, regardless of range filter, so the
  // "this week / last week / 4w / 12w" reads sit on stable comparisons.
  const thisWeekStart = startOfWeekMonday(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const sessionsThisWeek = allLogs.filter((l) => l.performedAt >= thisWeekStart).length;
  const sessionsLastWeek = allLogs.filter(
    (l) => l.performedAt >= lastWeekStart && l.performedAt < thisWeekStart
  ).length;
  const sessions4w = allLogs.filter((l) => l.performedAt >= fourWeeksAgo).length;
  const sessions12w = allLogs.filter((l) => l.performedAt >= twelveWeeksAgo).length;

  // Last-session lookup
  const lastSessionByRoutineId = new Map<string, Date>();
  for (const log of allLogs) {
    if (!lastSessionByRoutineId.has(log.routineId)) {
      lastSessionByRoutineId.set(log.routineId, log.performedAt);
    }
  }

  // Chart data — always 12-week window.
  const chartData = buildSessionsChartData(
    allLogs
      .filter((l) => l.performedAt >= chartCutoff)
      .map((l) => ({
        id: l.id,
        date: l.performedAt,
        routineId: l.routineId,
        routineName: l.routine.name,
      })),
    { accentFirst: ACCENT, now }
  );
  const chartHasData = chartData.series.some((s) =>
    s.weeklyValues.some((v) => v > 0)
  );

  const recentSessions = logsInRange.slice(0, 12);

  return (
    <div style={pageStyle}>
      <Link href="/activities" style={backLinkStyle}>
        ← Activities
      </Link>
      <header style={{ display: "grid", gap: 6 }}>
        <div style={eyebrowStyle}>Activity world</div>
        <h1 style={{ ...titleStyle, color: ACCENT }}>Mobility</h1>
        <p style={subtitleStyle}>Stretching, yoga, warmups, breathwork, rehab.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <NewRoutineDrawerButton presetDomain="mobility" style={primaryCtaStyle}>
            + New mobility routine
          </NewRoutineDrawerButton>
        </div>
      </header>

      <div style={pulseRowStyle}>
        <PulseStat label="This week" value={sessionsThisWeek} sublabel="sessions" />
        <PulseStat label="Last week" value={sessionsLastWeek} sublabel="sessions" />
        <PulseStat label="4 weeks" value={sessions4w} sublabel="total" />
        <PulseStat label="12 weeks" value={sessions12w} sublabel="total" />
      </div>

      {chartHasData ? (
        <WeeklyBarChartWithSessions
          title="Sessions per Week — Last 12 Weeks"
          weekLabels={chartData.weekLabels}
          series={chartData.series}
          sessionsByWeek={chartData.sessionsByWeek}
          unit=""
          decimals={0}
          compact={false}
        />
      ) : null}

      <div style={rangeRowStyle}>
        <span style={rangeLabelStyle}>Range</span>
        {(["4w", "12w", "1y", "all"] as const).map((r) => (
          <Link
            key={r}
            href={buildHref({ range: r === "12w" ? undefined : r })}
            style={range === r ? rangePillActive : rangePill}
          >
            {r === "all" ? "All" : r}
          </Link>
        ))}
      </div>

      <SectionCard
        title="Mobility Routines"
        subtitle="Your active mobility, stretching, and rehab routines."
      >
        {mobilityRoutines.length === 0 ? (
          <EmptyState message="No active mobility routines yet. Create one from the Log page or above." />
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
        subtitle={recentSessions.length === 0 ? `Nothing logged in the ${rangeLabel(range)}.` : `Last ${recentSessions.length} of ${logsInRange.length} · ${rangeLabel(range)}.`}
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

function PulseStat({ label, value, sublabel }: { label: string; value: number; sublabel: string }) {
  return (
    <div style={pulseStatStyle}>
      <div style={pulseLabelStyle}>{label}</div>
      <div style={{ ...pulseValueStyle, color: ACCENT_TEXT }}>{value}</div>
      <div style={pulseSubStyle}>{sublabel}</div>
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

const backLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.65,
  textDecoration: "none",
  color: "inherit",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  letterSpacing: -0.4,
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  opacity: 0.72,
  lineHeight: 1.5,
};

// Responsive pulse grid — collapses to 2 columns under ~440px so the
// stats don't squeeze on small phones. Previous `repeat(4, 1fr)` left
// ~94px per stat on iPhone SE and the values stacked awkwardly.
const pulseRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
  gap: 8,
};

const pulseStatStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "12px 10px",
  borderRadius: 12,
  border: `1px solid ${ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${ACCENT_BG}, rgba(255,255,255,0.02))`,
  textAlign: "center",
};

const pulseLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.62,
};

const pulseValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
};

const pulseSubStyle: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.55,
  fontWeight: 700,
};

const rangeRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};

const rangeLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.55,
  textTransform: "uppercase",
  marginRight: 4,
};

const rangePill: React.CSSProperties = {
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

const rangePillActive: React.CSSProperties = {
  ...rangePill,
  background: ACCENT_BG,
  borderColor: ACCENT_BORDER,
  color: ACCENT_TEXT,
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
