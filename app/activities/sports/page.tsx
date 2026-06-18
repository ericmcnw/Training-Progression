import Link from "next/link";
import { ACTIVITY_FAMILY_META, activitiesByFamily, getActivityEntry } from "@/lib/activity-families";
import { loadSportsChartData } from "@/lib/activities/sports-chart";
import WeeklyEffortChart from "@/app/activities/_shared/WeeklyEffortChart";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import ActivityHeader from "@/app/activities/_shared/ActivityHeader";
import { formatHoursMinutes } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import SupportRow from "./SupportRow";

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

  // Supporting training — routines tagged with supportsSports (the
  // Fingers/hangboard → climbing pattern). Grouped by sport for the
  // "Supporting Training" section below the chart.
  const trainingRoutines = await prisma.routine.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      isPlaceholder: false,
      supportsSports: { isEmpty: false },
    },
    select: { id: true, name: true, kind: true, subtype: true, supportsSports: true },
    orderBy: [{ name: "asc" }],
  });
  const supportBySlug = new Map<string, Array<{ id: string; name: string }>>();
  for (const r of trainingRoutines) {
    for (const slug of r.supportsSports ?? []) {
      const list = supportBySlug.get(slug) ?? [];
      list.push({ id: r.id, name: r.name });
      supportBySlug.set(slug, list);
    }
  }

  // Index per-sport stats so we can render every registered sport tile
  // (including ones with no recent sessions) without losing the data
  // for the ones that DO have sessions.
  const statsBySlug = new Map(chartData.perSport.map((p) => [p.entry.slug, p]));
  const climbing = allSports.find((s) => s.slug === "climbing");
  const climbingStats = climbing ? statsBySlug.get(climbing.slug) : undefined;

  const totalSessions12w = chartData.perSport.reduce((sum, p) => sum + p.sessions, 0);

  return (
    <>
      <div style={pageBody}>
        <ActivityHeader title="Sports" accent={meta.accent} />
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
          <WeeklyEffortChart
            title="Sessions per Week by Sport — Last 12 Weeks"
            weekLabels={chartData.weekLabels}
            series={chartData.series}
            sessionsByWeek={chartData.sessionsByWeek}
            defaultLens="bars"
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

        {/* Supporting training — routines users have tagged via
            "Supports which sports?" in the routine editor (the Fingers
            hangboard → climbing pattern). Grouped by sport. Each row
            opens the routine's detail/edit. */}
        {supportBySlug.size > 0 ? (
          <SectionCard
            title="Supporting training"
            subtitle="Routines you've tagged as supporting a sport — these aren't sport sessions themselves, just training that feeds them."
          >
            <div style={{ display: "grid", gap: 10 }}>
              {Array.from(supportBySlug.entries()).map(([slug, routines]) => {
                const entry = getActivityEntry(slug);
                const accent = SPORT_SUPPORT_ACCENT[slug] ?? "rgba(255,255,255,0.5)";
                return (
                  <div key={slug} style={supportGroup}>
                    <div style={supportGroupHeader}>
                      <span style={{ ...supportDot, background: accent }} />
                      <span style={supportGroupLabel}>{entry?.label ?? slug}</span>
                      <span style={supportGroupCount}>{routines.length} routine{routines.length === 1 ? "" : "s"}</span>
                    </div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {routines.map((r) => (
                        <SupportRow
                          key={r.id}
                          routineId={r.id}
                          routineName={r.name}
                          sportSlug={slug}
                          sportLabel={entry?.label ?? slug}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
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

// Accent colors for "Supporting training" sport groupings. Mirrors
// the chart palette so a hangboard routine tagged climbing reads as
// the same orange wherever it appears.
const SPORT_SUPPORT_ACCENT: Record<string, string> = {
  climbing: "rgba(251,146,60,0.9)",
  surfing: "rgba(56,189,248,0.9)",
  snowboarding: "rgba(168,85,247,0.9)",
  skiing: "rgba(99,102,241,0.9)",
  skateboarding: "rgba(244,114,182,0.9)",
  basketball: "rgba(220,38,38,0.9)",
  tennis: "rgba(132,204,22,0.9)",
  golf: "rgba(40,212,160,0.9)",
};

const supportGroup: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
  display: "grid",
  gap: 6,
};
const supportGroupHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
};
const supportDot: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  flexShrink: 0,
};
const supportGroupLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: -0.1,
};
const supportGroupCount: React.CSSProperties = {
  marginLeft: "auto",
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.55,
};

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
