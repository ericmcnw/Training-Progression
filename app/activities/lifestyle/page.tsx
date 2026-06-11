// Lifestyle world page — Phase 2.
// Layout mirrors mobility but adds a per-habit consistency strip below
// the chart so each routine shows its hit/miss pattern across 12 weeks
// — the "habit consistency heatmap" promised in the previous stub.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate } from "@/lib/dates";
import { effectiveRoutineDomain } from "@/lib/routines";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";
import WeeklyBarChartWithSessions from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { buildSessionsChartData } from "@/lib/activities/sessions-chart";

export const dynamic = "force-dynamic";

const ACCENT = "rgba(251,191,36,0.9)";
const ACCENT_BG = "rgba(251,191,36,0.08)";
const ACCENT_BORDER = "rgba(251,191,36,0.28)";
const ACCENT_TEXT = "rgba(253,224,71,0.95)";

const STRIP_DAYS = 84;

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
  return `/activities/lifestyle${s ? `?${s}` : ""}`;
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function LifestyleWorldPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const range = parseRange(getParam(searchParams, "range"));

  const now = new Date();
  const chartCutoff = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);
  const rangeCutoff = range === "all" ? null : new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  const widestCutoff = rangeCutoff && rangeCutoff < chartCutoff ? rangeCutoff : chartCutoff;

  // Parallel: routines + candidate logs. Lifestyle's candidate filter is
  // narrower than mobility's — only `domain = lifestyle | habit` and the
  // COMPLETION default. Post-filtered through effectiveRoutineDomain for
  // correctness.
  const [allActiveRoutines, candidateLogs] = await Promise.all([
    prisma.routine.findMany({
      where: { isActive: true, isDeleted: false, isPlaceholder: false },
      select: { id: true, name: true, domain: true, kind: true, subtype: true },
      orderBy: { name: "asc" },
    }),
    prisma.routineLog.findMany({
      where: {
        performedAt: { gte: widestCutoff },
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

  const statsCutoff = rangeCutoff;
  const logsInRange = statsCutoff
    ? allLogs.filter((l) => l.performedAt >= statsCutoff)
    : allLogs;

  // Pulse rollups
  const thisWeekStart = startOfWeekMonday(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const completionsThisWeek = allLogs.filter((l) => l.performedAt >= thisWeekStart).length;
  const completionsLastWeek = allLogs.filter(
    (l) => l.performedAt >= lastWeekStart && l.performedAt < thisWeekStart
  ).length;
  const completions4w = allLogs.filter((l) => l.performedAt >= fourWeeksAgo).length;
  const completions12w = allLogs.filter((l) => l.performedAt >= twelveWeeksAgo).length;

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
      set.add(ymdLocal(log.performedAt));
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

  // Chart data — always 12 weeks
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

  // Build the per-day labels for the consistency strip — 84 days oldest
  // → newest. Each routine's strip uses the same date axis.
  const stripDays: string[] = [];
  for (let i = STRIP_DAYS - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    stripDays.push(ymdLocal(d));
  }

  const recentLogs = logsInRange.slice(0, 12);

  return (
    <div style={pageStyle}>
      <Link href="/activities" style={backLinkStyle}>
        ← Activities
      </Link>
      <header style={{ display: "grid", gap: 6 }}>
        <div style={eyebrowStyle}>Activity world</div>
        <h1 style={{ ...titleStyle, color: ACCENT }}>Lifestyle</h1>
        <p style={subtitleStyle}>
          Daily habits, recovery, supplements, journaling — anything outside of training.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <NewRoutineDrawerButton presetDomain="lifestyle" style={primaryCtaStyle}>
            + New lifestyle routine
          </NewRoutineDrawerButton>
        </div>
      </header>

      <div style={pulseRowStyle}>
        <PulseStat label="This week" value={completionsThisWeek} sublabel="completions" />
        <PulseStat label="Last week" value={completionsLastWeek} sublabel="completions" />
        <PulseStat label="4 weeks" value={completions4w} sublabel="total" />
        <PulseStat label="12 weeks" value={completions12w} sublabel="total" />
      </div>

      {chartHasData ? (
        <WeeklyBarChartWithSessions
          title="Completions per Week — Last 12 Weeks"
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
        subtitle={recentLogs.length === 0 ? `Nothing logged in the ${rangeLabel(range)}.` : `Last ${recentLogs.length} of ${logsInRange.length} · ${rangeLabel(range)}.`}
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
          </div>
        )}
      </SectionCard>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/log?domain=lifestyle" style={quickLinkStyle}>Lifestyle routines →</Link>
        <Link href="/plan?tab=goals&type=FREQUENCY" style={quickLinkStyle}>Frequency goals →</Link>
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
  stripDays: string[];
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
        {stripDays.map((ymd) => (
          <span
            key={ymd}
            style={{
              ...stripCellStyle,
              background: hits.has(ymd) ? ACCENT : "rgba(255,255,255,0.05)",
              opacity: hits.has(ymd) ? 1 : 0.6,
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

// Per-habit 12-week consistency strip. 84 cells in one flexbox row that
// scales to its container — each cell is `flex: 1` so a wider container
// produces wider cells, no horizontal scroll required.
const consistencyStripStyle: React.CSSProperties = {
  display: "flex",
  gap: 1,
  height: 8,
  borderRadius: 4,
  overflow: "hidden",
};

const stripCellStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  borderRadius: 1,
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
