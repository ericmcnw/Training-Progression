import Link from "next/link";
import { ACTIVITY_FAMILY_META, activitiesByFamily } from "@/lib/activity-families";
import { loadSportsChartData } from "@/lib/activities/sports-chart";
import WeeklyBarChartWithSessions from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { SectionCard, SectionLinkButton, TargetHeader, EmptyState } from "@/app/progress/ui";
import { formatHoursMinutes } from "@/lib/progress";

export const dynamic = "force-dynamic";

// Sports dashboard — full build. Mirrors the endurance dashboard's
// shape (interactive 12w stacked chart at the top, then per-activity
// content) but tuned for skill/session sports: durations + session
// counts instead of distance, plus a prominent Climbing hero card
// since climbing is the only sport with a deep world today.
export default async function SportsDashboardPage() {
  const meta = ACTIVITY_FAMILY_META["sports"];
  const chartData = await loadSportsChartData();
  const allSports = activitiesByFamily("sports");

  // Index per-sport stats so we can render every registered sport tile
  // (including ones with no recent sessions) without losing the data
  // for the ones that DO have sessions.
  const statsBySlug = new Map(chartData.perSport.map((p) => [p.entry.slug, p]));
  const climbing = allSports.find((s) => s.slug === "climbing");
  const climbingStats = climbing ? statsBySlug.get(climbing.slug) : undefined;

  const totalSessions12w = chartData.perSport.reduce((sum, p) => sum + p.sessions, 0);

  return (
    <>
      <TargetHeader
        section="sports"
        title="Sports"
        eyebrow="Activity world"
        subtitle={meta.description}
        basePath="/activities/sports"
        tab="overview"
        range="all"
        hideTabs
        hideRange
        actions={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <SectionLinkButton href="/activities" label="All activities" />
          </div>
        }
      />

      <div style={pageBody}>
        {/* Climbing hero — climbing is the only sport with a built-out
            deep world today, so we surface it prominently rather than
            making the user hunt for it in the tile grid below. */}
        {climbing ? (
          <ClimbingHero
            sessions12w={climbingStats?.sessions ?? 0}
            totalDurationSec={climbingStats?.totalDurationSec ?? 0}
            lastSessionAt={climbingStats?.lastSessionAt ?? null}
            accent={meta.accent}
          />
        ) : null}

        {/* Interactive 12w stacked chart — always 12 weeks. Shows
            sessions per week per sport so the user can scan cadence
            without doing math. */}
        {chartData.series.length > 0 ? (
          <WeeklyBarChartWithSessions
            title="Sessions per Week by Sport — Last 12 Weeks"
            weekLabels={chartData.weekLabels}
            series={chartData.series}
            sessionsByWeek={chartData.sessionsByWeek}
            unit="sess"
            decimals={0}
          />
        ) : (
          <SectionCard title="No sport sessions yet" subtitle="Log a sport routine to start populating this view.">
            <EmptyState message="Tag a routine with a sport activity (climbing, surfing, basketball, etc.) and log it to see this dashboard fill in." />
          </SectionCard>
        )}

        {/* Top sports list — ranked by 12w session count. Each row
            links into the per-sport page at /activities/<slug>. */}
        {chartData.perSport.length > 0 ? (
          <SectionCard
            title="Top sports"
            subtitle={`${totalSessions12w} session${totalSessions12w === 1 ? "" : "s"} across ${chartData.perSport.length} sport${chartData.perSport.length === 1 ? "" : "s"} in the last 12 weeks`}
          >
            <div style={{ display: "grid", gap: 6 }}>
              {chartData.perSport.map((p) => (
                <SportRankingRow
                  key={p.entry.slug}
                  slug={p.entry.slug}
                  label={p.entry.label}
                  sessions={p.sessions}
                  totalDurationSec={p.totalDurationSec}
                  lastSessionAt={p.lastSessionAt}
                  accent={meta.accent}
                />
              ))}
            </div>
          </SectionCard>
        ) : null}

        {/* All registered sports — every sport tile, including
            inactive ones, so the user can dive into any sport at any
            time even without recent sessions. */}
        <SectionCard
          title="All sports"
          subtitle="Every registered sport — tap any tile to open its activity page."
        >
          <div style={tileGrid}>
            {allSports.map((entry) => {
              const stats = statsBySlug.get(entry.slug);
              return (
                <SportTile
                  key={entry.slug}
                  slug={entry.slug}
                  label={entry.label}
                  eyebrow={entry.eyebrow}
                  sessions={stats?.sessions ?? 0}
                  totalDurationSec={stats?.totalDurationSec ?? 0}
                  hasDeepWorld={Boolean(entry.hasDeepWorld)}
                  accent={meta.accent}
                />
              );
            })}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

// ─── Climbing hero ───────────────────────────────────────────────────────────

function ClimbingHero({
  sessions12w,
  totalDurationSec,
  lastSessionAt,
  accent,
}: {
  sessions12w: number;
  totalDurationSec: number;
  lastSessionAt: Date | null;
  accent: string;
}) {
  return (
    <Link href="/activities/climbing" style={climbingHeroStyle(accent)}>
      <div style={{ display: "grid", gap: 6 }}>
        <span style={heroEyebrow}>Deep world</span>
        <span style={heroTitle}>Climbing →</span>
        <span style={heroSubtitle}>
          Sends, projects, locations, problems — the full climbing world.
        </span>
      </div>
      <div style={heroStats}>
        <HeroStat value={String(sessions12w)} label={sessions12w === 1 ? "session 12w" : "sessions 12w"} />
        {totalDurationSec > 0 ? (
          <HeroStat value={formatHoursMinutes(totalDurationSec)} label="active time" />
        ) : null}
        {lastSessionAt ? (
          <HeroStat
            value={new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(lastSessionAt)}
            label="last session"
          />
        ) : null}
      </div>
    </Link>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={heroStatStyle}>
      <span style={heroStatValue}>{value}</span>
      <span style={heroStatLabel}>{label}</span>
    </div>
  );
}

// ─── Top sport ranking row ───────────────────────────────────────────────────

function SportRankingRow({
  slug,
  label,
  sessions,
  totalDurationSec,
  lastSessionAt,
  accent,
}: {
  slug: string;
  label: string;
  sessions: number;
  totalDurationSec: number;
  lastSessionAt: Date | null;
  accent: string;
}) {
  return (
    <Link href={`/activities/${slug}`} style={rowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{label}</div>
        <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 700, marginTop: 2 }}>
          {sessions} session{sessions === 1 ? "" : "s"}
          {totalDurationSec > 0 ? ` · ${formatHoursMinutes(totalDurationSec)} active` : ""}
          {lastSessionAt
            ? ` · Last ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(lastSessionAt)}`
            : ""}
        </div>
      </div>
      <span style={metricChip(accent)}>{sessions}× 12w</span>
      <span style={{ fontSize: 16, opacity: 0.4, fontWeight: 700 }}>›</span>
    </Link>
  );
}

// ─── Sport tile (in "All sports" grid) ───────────────────────────────────────

function SportTile({
  slug,
  label,
  eyebrow,
  sessions,
  totalDurationSec,
  hasDeepWorld,
  accent,
}: {
  slug: string;
  label: string;
  eyebrow: string;
  sessions: number;
  totalDurationSec: number;
  hasDeepWorld: boolean;
  accent: string;
}) {
  const active = sessions > 0;
  return (
    <Link href={`/activities/${slug}`} style={tileStyle(accent, active || hasDeepWorld)}>
      <div style={tileEyebrow}>
        {eyebrow}
        {hasDeepWorld ? <span style={deepBadge}>Deep world</span> : null}
      </div>
      <div style={tileLabel}>{label}</div>
      <div style={tileFooter}>
        {sessions > 0 ? (
          <>
            <span style={tilePrimary(accent)}>{sessions}</span>
            <span style={tileSecondary}>
              {sessions === 1 ? "session 12w" : "sessions 12w"}
              {totalDurationSec > 0 ? ` · ${formatHoursMinutes(totalDurationSec)}` : ""}
            </span>
          </>
        ) : (
          <span style={tileNoData}>No recent sessions</span>
        )}
      </div>
    </Link>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageBody: React.CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 14px 60px",
  display: "grid",
  gap: 16,
};

function climbingHeroStyle(accent: string): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 16,
    alignItems: "center",
    padding: "18px 20px",
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: accent.replace("0.9)", "0.45)"),
    background: `linear-gradient(135deg, ${accent.replace("0.9)", "0.18)")}, rgba(255,255,255,0.025))`,
    textDecoration: "none",
    color: "inherit",
  };
}

const heroEyebrow: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  opacity: 0.75,
};

const heroTitle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: -0.4,
};

const heroSubtitle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.75,
  lineHeight: 1.5,
};

const heroStats: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const heroStatStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "8px 12px",
  borderRadius: 10,
  background: "rgba(0,0,0,0.18)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.08)",
  minWidth: 70,
  textAlign: "right" as const,
};

const heroStatValue: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1.1,
};

const heroStatLabel: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.6,
  fontWeight: 700,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 52,
  padding: "10px 12px",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
  textDecoration: "none",
  color: "inherit",
};

function metricChip(accent: string): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 999,
    background: accent.replace("0.9)", "0.10)"),
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: accent.replace("0.9)", "0.28)"),
    color: accent,
    whiteSpace: "nowrap",
  };
}

const tileGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
};

function tileStyle(accent: string, active: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: active ? accent.replace("0.9)", "0.32)") : "rgba(255,255,255,0.10)",
    background: active
      ? `linear-gradient(180deg, ${accent.replace("0.9)", "0.08)")}, rgba(255,255,255,0.02))`
      : "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))",
    textDecoration: "none",
    color: "inherit",
    minHeight: 110,
  };
}

const tileEyebrow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.65,
};

const deepBadge: React.CSSProperties = {
  fontSize: 8.5,
  fontWeight: 900,
  letterSpacing: 0.4,
  padding: "1px 6px",
  borderRadius: 999,
  background: "rgba(251,191,36,0.14)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(251,191,36,0.42)",
  color: "rgba(254,243,199,0.95)",
};

const tileLabel: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  lineHeight: 1.15,
};

const tileFooter: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  marginTop: "auto",
};

function tilePrimary(accent: string): React.CSSProperties {
  return {
    fontSize: 22,
    fontWeight: 900,
    color: accent,
    lineHeight: 1,
  };
}

const tileSecondary: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.7,
  fontWeight: 800,
};

const tileNoData: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.45,
  fontWeight: 700,
  fontStyle: "italic",
};
