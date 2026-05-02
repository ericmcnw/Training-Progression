import Link from "next/link";
import BodyMap from "@/app/components/body-map/BodyMap";
import { prisma } from "@/lib/prisma";
import { formatAppDate } from "@/lib/dates";
import { ProgressShell, SectionCard, EmptyState } from "./ui";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function painColor(level: number) {
  if (level >= 7) return "#F87171";
  if (level >= 4) return "#FBBF24";
  if (level >= 1) return "#86EFAC";
  return "rgba(255,255,255,0.35)";
}

function statusBadgeStyle(status: string): React.CSSProperties {
  if (status === "ACTIVE") return { background: "rgba(248,113,113,0.18)", borderColor: "rgba(248,113,113,0.4)", color: "#FCA5A5" };
  if (status === "FLARED") return { background: "rgba(251,146,60,0.18)", borderColor: "rgba(251,146,60,0.4)", color: "#FED7AA" };
  if (status === "RECOVERING") return { background: "rgba(96,165,250,0.16)", borderColor: "rgba(96,165,250,0.35)", color: "#BFDBFE" };
  return { background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.7)" };
}

function statusLabel(s: string) {
  if (s === "ACTIVE") return "Active";
  if (s === "FLARED") return "Flared";
  if (s === "RECOVERING") return "Recovering";
  return s.toLowerCase();
}

function daysAgo(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

// ─── Chart ────────────────────────────────────────────────────────────────────

type ChartPoint = { label: string; value: number };

function PainLineChart({ points }: { points: ChartPoint[] }) {
  const vw = 560, vh = 140;
  const ml = 30, mt = 10, mr = 12, mb = 34;
  const iw = vw - ml - mr;
  const ih = vh - mt - mb;

  function xAt(i: number) {
    if (points.length === 1) return ml + iw / 2;
    return ml + (i / (points.length - 1)) * iw;
  }
  function yAt(v: number) {
    return mt + (1 - v / 10) * ih;
  }

  // Colored zone band backgrounds
  const bands = [
    { from: 7, to: 10, fill: "rgba(248,113,113,0.09)" },
    { from: 4, to: 7,  fill: "rgba(251,191,36,0.08)" },
    { from: 0, to: 4,  fill: "rgba(134,239,172,0.06)" },
  ];

  const yTicks = [0, 5, 10];

  // Pick evenly spaced x-axis tick indices (max 6)
  const tickCount = Math.min(6, points.length);
  const tickIndices = Array.from({ length: tickCount }, (_, t) =>
    points.length === 1 ? 0 : Math.round((t / (tickCount - 1)) * (points.length - 1))
  );

  const polyPts = points
    .map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`)
    .join(" ");

  // Area fill (closed polygon down to y=0 baseline)
  const areaPts = [
    ...points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`),
    `${xAt(points.length - 1).toFixed(1)},${yAt(0).toFixed(1)}`,
    `${xAt(0).toFixed(1)},${yAt(0).toFixed(1)}`,
  ].join(" ");

  const lastLevel = points[points.length - 1]?.value ?? 0;
  const lineColor = painColor(lastLevel);

  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      width="100%"
      height={vh}
      style={{ display: "block" }}
      aria-hidden
    >
      {/* Zone background bands */}
      {bands.map((band) => (
        <rect
          key={band.from}
          x={ml}
          y={yAt(band.to)}
          width={iw}
          height={yAt(band.from) - yAt(band.to)}
          fill={band.fill}
        />
      ))}

      {/* Y gridlines + labels */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={ml}
            y1={yAt(v)}
            x2={ml + iw}
            y2={yAt(v)}
            stroke={v === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)"}
            strokeDasharray={v > 0 ? "3 3" : undefined}
          />
          <text x={ml - 5} y={yAt(v) + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.45)">
            {v}
          </text>
        </g>
      ))}

      {/* Chart border */}
      <rect x={ml} y={mt} width={iw} height={ih} fill="none" stroke="rgba(255,255,255,0.08)" />

      {/* Area fill */}
      {points.length >= 2 && (
        <polygon
          points={areaPts}
          fill={lineColor}
          opacity={0.08}
        />
      )}

      {/* Line */}
      {points.length >= 2 && (
        <polyline
          points={polyPts}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
        />
      )}

      {/* Dots — each colored by its own level */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xAt(i)} cy={yAt(p.value)} r={3.5} fill={painColor(p.value)} opacity={0.95} />
          <circle cx={xAt(i)} cy={yAt(p.value)} r={3.5} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
        </g>
      ))}

      {/* X-axis ticks + labels */}
      {tickIndices.map((idx) => (
        <g key={idx}>
          <line
            x1={xAt(idx)}
            y1={mt + ih}
            x2={xAt(idx)}
            y2={mt + ih + 4}
            stroke="rgba(255,255,255,0.22)"
          />
          <text
            x={xAt(idx)}
            y={mt + ih + 16}
            textAnchor="middle"
            fontSize="9"
            fill="rgba(255,255,255,0.5)"
          >
            {points[idx].label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Data fetching ────────────────────────────────────────────────────────────

type PainEntry = { level: number; loggedAt: Date };

function buildDailyPoints(logs: PainEntry[]): ChartPoint[] {
  const byDay = new Map<string, number>();
  for (const log of logs) {
    const key = log.loggedAt.toISOString().slice(0, 10);
    byDay.set(key, Math.max(byDay.get(key) ?? 0, log.level));
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, level]) => {
      const d = new Date(key + "T12:00:00Z");
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
      return { label, value: level };
    });
}

async function getInjuryProgressData() {
  const injuries = await prisma.activeInjury.findMany({
    where: { status: { not: "RESOLVED" } },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    include: {
      zones: {
        include: { zone: { select: { id: true, slug: true, label: true } } },
        orderBy: { zone: { sortOrder: "asc" } },
      },
    },
  });

  if (injuries.length === 0) {
    return { injuries: [], painByInjuryId: new Map<string, PainEntry[]>() };
  }

  const allZoneIds = [...new Set(injuries.flatMap((inj) => inj.zones.map((z) => z.zoneId)))];
  const since = new Date();
  since.setDate(since.getDate() - 60);

  const painLogs = await prisma.painLog.findMany({
    where: { zoneId: { in: allZoneIds }, loggedAt: { gte: since } },
    orderBy: { loggedAt: "asc" },
    select: { zoneId: true, level: true, loggedAt: true },
  });

  const zoneToInjuries = new Map<string, string[]>();
  for (const inj of injuries) {
    for (const z of inj.zones) {
      const arr = zoneToInjuries.get(z.zoneId) ?? [];
      arr.push(inj.id);
      zoneToInjuries.set(z.zoneId, arr);
    }
  }

  const painByInjuryId = new Map<string, PainEntry[]>();
  for (const log of painLogs) {
    for (const injuryId of zoneToInjuries.get(log.zoneId) ?? []) {
      const arr = painByInjuryId.get(injuryId) ?? [];
      arr.push({ level: log.level, loggedAt: log.loggedAt });
      painByInjuryId.set(injuryId, arr);
    }
  }

  return { injuries, painByInjuryId };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default async function InjuriesIndexView() {
  const { injuries, painByInjuryId } = await getInjuryProgressData();

  const allZoneSlugs = [...new Set(injuries.flatMap((inj) => inj.zones.map((z) => z.zone.slug)))];

  const bodyMapZones = allZoneSlugs.map((slug) => {
    const parentInjury = injuries.find((inj) => inj.zones.some((z) => z.zone.slug === slug));
    const freshness = parentInjury?.status === "RECOVERING" ? ("RECOVERING" as const) : ("INJURED" as const);
    return { slug, freshness };
  });

  const activeCount = injuries.filter((i) => i.status === "ACTIVE").length;
  const flaredCount = injuries.filter((i) => i.status === "FLARED").length;
  const recoveringCount = injuries.filter((i) => i.status === "RECOVERING").length;

  return (
    <ProgressShell
      section="injuries"
      title="Injuries"
      subtitle="Active injuries, pain trends, and training load on affected zones."
    >
      {injuries.length === 0 ? (
        <SectionCard title="Injury Tracker" subtitle="No active or recovering injuries.">
          <EmptyState message="No active or recovering injuries. Log an injury from the Body page or Injuries list." />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <Link href="/injuries" style={linkBtn}>View all injuries</Link>
            <Link href="/injuries/new" style={linkBtn}>New injury</Link>
          </div>
        </SectionCard>
      ) : (
        <>
          {/* Summary bar */}
          <div style={summaryBar}>
            {activeCount + flaredCount > 0 && (
              <div style={summaryChip}>
                <span style={{ fontSize: 22, fontWeight: 950, color: "#FCA5A5", lineHeight: 1 }}>
                  {activeCount + flaredCount}
                </span>
                <span style={summaryLabel}>active{flaredCount > 0 ? " / flared" : ""}</span>
              </div>
            )}
            {recoveringCount > 0 && (
              <div style={summaryChip}>
                <span style={{ fontSize: 22, fontWeight: 950, color: "#BFDBFE", lineHeight: 1 }}>
                  {recoveringCount}
                </span>
                <span style={summaryLabel}>recovering</span>
              </div>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Link href="/injuries" style={linkBtn}>All injuries</Link>
              <Link href="/injuries/new" style={{ ...linkBtn, borderColor: "rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)" }}>
                New injury
              </Link>
            </div>
          </div>

          {/* Body map */}
          {allZoneSlugs.length > 0 && (
            <SectionCard title="Affected zones" subtitle="Zones currently involved in active or recovering injuries.">
              <BodyMap zones={bodyMapZones} selectedSlugs={allZoneSlugs} size="sm" />
            </SectionCard>
          )}

          {/* Per-injury pain timeline cards */}
          {injuries.map((inj) => {
            const rawLogs = painByInjuryId.get(inj.id) ?? [];
            const chartPoints = buildDailyPoints(rawLogs);
            const allLevels = rawLogs.map((l) => l.level);
            const recentPain = allLevels.length > 0 ? allLevels[allLevels.length - 1] : null;
            const avgPain =
              allLevels.length > 0
                ? Math.round((allLevels.reduce((s, v) => s + v, 0) / allLevels.length) * 10) / 10
                : null;
            const maxPain = allLevels.length > 0 ? Math.max(...allLevels) : null;
            const days = daysAgo(inj.startedAt);
            const zoneLabels = inj.zones.map((z) => z.zone.label).join(", ");

            return (
              <div key={inj.id} style={injuryCard}>
                {/* Card header */}
                <div style={cardHeader}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
                    <span style={{ fontWeight: 900, fontSize: 16 }}>{inj.name}</span>
                    <span style={{ ...badgeBase, ...statusBadgeStyle(inj.status) }}>
                      {statusLabel(inj.status)}
                    </span>
                  </div>
                  <Link href={`/injuries/${inj.id}`} style={detailLink}>Details</Link>
                </div>

                {/* Meta */}
                <div style={metaLine}>
                  {"●".repeat(inj.severity)}{"○".repeat(Math.max(0, 5 - inj.severity))}
                  {" · "}{zoneLabels}
                  {" · "}{days === 0 ? "started today" : `${days}d injured`}
                  {" · started "}
                  {formatAppDate(inj.startedAt, { month: "short", day: "numeric", year: "numeric" })}
                </div>

                {/* Stats row */}
                {recentPain !== null ? (
                  <div style={statsRow}>
                    <div style={statChip}>
                      <span style={{ ...statValue, color: painColor(recentPain) }}>{recentPain}/10</span>
                      <span style={statLabel}>most recent</span>
                    </div>
                    {avgPain !== null && (
                      <div style={statChip}>
                        <span style={{ ...statValue, color: painColor(avgPain) }}>{avgPain}</span>
                        <span style={statLabel}>average</span>
                      </div>
                    )}
                    {maxPain !== null && (
                      <div style={statChip}>
                        <span style={{ ...statValue, color: painColor(maxPain) }}>{maxPain}</span>
                        <span style={statLabel}>peak</span>
                      </div>
                    )}
                    <div style={statChip}>
                      <span style={statValue}>{rawLogs.length}</span>
                      <span style={statLabel}>logs</span>
                    </div>
                  </div>
                ) : null}

                {/* Chart or empty state */}
                {chartPoints.length >= 2 ? (
                  <div style={chartWrap}>
                    <div style={chartLegend}>
                      <span style={{ color: "#F87171", opacity: 0.7 }}>■</span> severe (7–10)
                      <span style={{ color: "#FBBF24", opacity: 0.7, marginLeft: 10 }}>■</span> moderate (4–6)
                      <span style={{ color: "#86EFAC", opacity: 0.7, marginLeft: 10 }}>■</span> mild (1–3)
                    </div>
                    <PainLineChart points={chartPoints} />
                  </div>
                ) : chartPoints.length === 1 ? (
                  <div style={singleLogNote}>
                    1 reading on {chartPoints[0].label} — pain level{" "}
                    <span style={{ fontWeight: 900, color: painColor(chartPoints[0].value) }}>
                      {chartPoints[0].value}/10
                    </span>. Log more to see a trend.
                  </div>
                ) : (
                  <div style={noLogsNote}>
                    No pain logged for this injury yet.{" "}
                    <Link href={`/body/log-pain`} style={{ color: "rgba(252,165,165,0.9)", textDecoration: "none", fontWeight: 800 }}>
                      Log pain now →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </ProgressShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const summaryBar: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
  padding: "12px 16px",
  borderRadius: 16,
  border: "1px solid rgba(248,113,113,0.2)",
  background: "rgba(248,113,113,0.05)",
};

const summaryChip: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const summaryLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.5,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const injuryCard: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  padding: "14px 16px",
  display: "grid",
  gap: 10,
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const badgeBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 9px",
  borderRadius: 999,
  border: "1px solid",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
};

const metaLine: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.58,
  lineHeight: 1.45,
};

const statsRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const statChip: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.03)",
  minWidth: 60,
};

const statValue: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
  lineHeight: 1,
};

const statLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  opacity: 0.5,
};

const chartWrap: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(0,0,0,0.15)",
  padding: "10px 10px 4px",
  overflow: "hidden",
};

const chartLegend: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  opacity: 0.6,
  marginBottom: 4,
  display: "flex",
  alignItems: "center",
  gap: 2,
};

const singleLogNote: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.02)",
};

const noLogsNote: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.65,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,0.12)",
  background: "rgba(248,113,113,0.04)",
};

const detailLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
  flexShrink: 0,
  minHeight: 32,
};

const linkBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "7px 10px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
  minHeight: 34,
};
