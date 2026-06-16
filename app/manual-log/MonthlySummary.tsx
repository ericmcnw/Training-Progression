// MonthlySummary — profile-page module summarizing the current calendar
// month. Composes the strongest pieces of the three proposed designs:
//
//   • KPI tiles (M1): sessions, total time, distance, active days.
//   • Calendar heatmap (M1): 7-col Sun-anchored grid of the month with
//     each cell shaded by session intensity. Today is ringed.
//   • Domain composition (M3): horizontal stacked bar + per-domain legend.
//   • Top routines (M2): leaderboard of the most-logged routines in the
//     month with their counts and a domain color stripe.
//
// Server component; receives the already-fetched log array from the page.

import type { CSSProperties } from "react";
import { APP_TIME_ZONE, getAppDayRange, toAppYmd } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { formatHoursMinutes } from "@/lib/progress";
import { domainColor, effectiveRoutineDomain } from "@/lib/routines";
import {
  PROFILE_DOMAIN_LABELS as DOMAIN_LABELS,
  PROFILE_DOMAIN_ORDER as DOMAIN_ORDER,
  ymdWeekday,
  type ProfileDomain as Domain,
} from "@/lib/profile-summary";

type EnrichedLog = {
  id: string;
  routineId: string;
  performedAt: Date;
  distanceMi: number | null;
  durationSec: number | null;
  domain: Domain;
  routine: { name: string };
};

const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

// Self-fetches its own month window (rather than reusing the page's 500-row
// recent-logs prop) so a heavy logger's current month is never silently
// truncated — same rationale as YearlySummary.
export default async function MonthlySummary({ today }: { today: Date }) {
  const todayYmd = toAppYmd(today);
  const [calYear, calMonthNum] = todayYmd.split("-").slice(0, 2).map(Number);
  const calMonthIdx = calMonthNum - 1;
  const daysInMonth = new Date(Date.UTC(calYear, calMonthIdx + 1, 0)).getUTCDate();
  const todayDay = parseInt(todayYmd.split("-")[2], 10);

  const monthYmd = `${calYear}-${String(calMonthNum).padStart(2, "0")}`;
  const nextMonthFirst =
    calMonthNum === 12
      ? `${calYear + 1}-01-01`
      : `${calYear}-${String(calMonthNum + 1).padStart(2, "0")}-01`;
  const monthStart = getAppDayRange(`${monthYmd}-01`).start;
  const monthEndExclusive = getAppDayRange(nextMonthFirst).start;

  const firstDayOfWeek = ymdWeekday(`${monthYmd}-01`);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(today);

  const rawLogs = await prisma.routineLog.findMany({
    where: { performedAt: { gte: monthStart, lt: monthEndExclusive } },
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      distanceMi: true,
      durationSec: true,
      routine: { select: { name: true, domain: true, kind: true, subtype: true } },
    },
  });
  const monthLogs: EnrichedLog[] = rawLogs.map((l) => ({
    id: l.id,
    routineId: l.routineId,
    performedAt: l.performedAt,
    distanceMi: l.distanceMi,
    durationSec: l.durationSec,
    domain: effectiveRoutineDomain(l.routine.domain, l.routine.kind, l.routine.subtype) as Domain,
    routine: { name: l.routine.name },
  }));

  // ── KPIs ────────────────────────────────────────────────────────────────
  const sessions = monthLogs.length;
  const totalSec = monthLogs.reduce((sum, l) => sum + (l.durationSec ?? 0), 0);
  const totalMi = monthLogs.reduce((sum, l) => sum + (l.distanceMi ?? 0), 0);
  const activeDays = new Set(monthLogs.map((l) => toAppYmd(l.performedAt))).size;
  const daysSoFar = Math.min(todayDay, daysInMonth);

  // ── Heatmap day buckets ─────────────────────────────────────────────────
  const dayCounts = new Map<number, number>();
  for (const log of monthLogs) {
    const ymd = toAppYmd(log.performedAt);
    const [ly, lm, ld] = ymd.split("-").map(Number);
    if (ly === calYear && lm === calMonthNum) {
      dayCounts.set(ld, (dayCounts.get(ld) ?? 0) + 1);
    }
  }

  // ── Per-domain counts ───────────────────────────────────────────────────
  const perDomain: Record<Domain, number> = {
    strength: 0, cardio: 0, mobility: 0, sport: 0, lifestyle: 0,
  };
  for (const l of monthLogs) perDomain[l.domain]++;
  const activeDomains = DOMAIN_ORDER.filter((d) => perDomain[d] > 0);

  // ── Top routines ────────────────────────────────────────────────────────
  type RoutineBucket = { id: string; name: string; count: number; domain: Domain };
  const routineMap = new Map<string, RoutineBucket>();
  for (const log of monthLogs) {
    const existing = routineMap.get(log.routineId);
    if (existing) existing.count++;
    else routineMap.set(log.routineId, {
      id: log.routineId,
      name: log.routine.name,
      count: 1,
      domain: log.domain,
    });
  }
  const topRoutines = Array.from(routineMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Empty state ─────────────────────────────────────────────────────────
  if (sessions === 0) {
    return (
      <section style={panel} aria-label="Monthly summary">
        <div style={panelHeader}>{monthLabel.toUpperCase()}</div>
        <div style={emptyBody}>No sessions logged this month yet.</div>
      </section>
    );
  }

  // Determine heatmap intensity steps: 4 bins based on max count seen.
  const maxCount = Math.max(...Array.from(dayCounts.values()), 1);
  function intensity(count: number): number {
    if (count <= 0) return 0;
    if (count <= 1) return 1;
    if (count <= Math.ceil(maxCount * 0.5)) return 2;
    return 3;
  }

  return (
    <section style={panel} aria-label="Monthly summary">
      <div style={panelHeader}>{monthLabel.toUpperCase()}</div>
      <div style={body}>
        {/* KPI strip */}
        <div style={kpiRow}>
          <Kpi label="Sessions" value={String(sessions)} />
          <Kpi label="Time" value={totalSec > 0 ? formatHoursMinutes(totalSec) : "—"} />
          <Kpi label="Distance" value={totalMi > 0 ? `${totalMi.toFixed(1)}mi` : "—"} />
          <Kpi label="Active" value={`${activeDays}/${daysSoFar}`} />
        </div>

        {/* Heatmap */}
        <div>
          <div style={sectionLabel}>HEATMAP</div>
          <div style={weekdayRow}>
            {WEEKDAY_HEADERS.map((h, i) => (
              <div key={i} style={weekdayHeader}>{h}</div>
            ))}
          </div>
          <div style={heatGrid}>
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`pad-${i}`} style={padCell} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const count = dayCounts.get(day) ?? 0;
              const lvl = intensity(count);
              const isToday = day === todayDay;
              return (
                <div
                  key={day}
                  style={heatCell(lvl, isToday)}
                  title={`Day ${day} — ${count} session${count === 1 ? "" : "s"}`}
                >
                  <span style={heatCellNum(lvl, isToday)}>{day}</span>
                </div>
              );
            })}
          </div>
          <div style={heatLegend}>
            <span style={heatLegendLabel}>less</span>
            {[0, 1, 2, 3].map((lvl) => (
              <span key={lvl} style={heatLegendSwatch(lvl)} aria-hidden />
            ))}
            <span style={heatLegendLabel}>more</span>
          </div>
        </div>

        {/* Domain composition */}
        {activeDomains.length > 0 ? (
          <div>
            <div style={sectionLabel}>BY DOMAIN</div>
            <div style={stackTrack} aria-hidden>
              {activeDomains.map((d) => (
                <div
                  key={d}
                  title={`${DOMAIN_LABELS[d]}: ${perDomain[d]}`}
                  style={{
                    width: `${(perDomain[d] / sessions) * 100}%`,
                    background: domainColor(d),
                  }}
                />
              ))}
            </div>
            <div style={domainLegend}>
              {activeDomains.map((d) => (
                <div key={d} style={legendItem}>
                  <span style={{ ...legendDot, background: domainColor(d) }} aria-hidden />
                  <span style={legendLabel}>{DOMAIN_LABELS[d]}</span>
                  <span style={legendCount}>{perDomain[d]}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Top routines */}
        {topRoutines.length > 0 ? (
          <div>
            <div style={sectionLabel}>TOP ROUTINES</div>
            <ol style={leaderboard}>
              {topRoutines.map((r, i) => {
                const widthPct = (r.count / topRoutines[0].count) * 100;
                return (
                  <li key={r.id} style={leaderboardItem}>
                    <span style={leaderboardRank}>{i + 1}</span>
                    <div style={leaderboardBody}>
                      <div style={leaderboardName}>{r.name}</div>
                      <div style={leaderboardBarTrack}>
                        <div
                          style={{
                            ...leaderboardBarFill,
                            width: `${widthPct}%`,
                            background: domainColor(r.domain),
                          }}
                        />
                      </div>
                    </div>
                    <span style={leaderboardCount}>{r.count}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ───────────────────────────── subcomponents

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={kpiTile}>
      <div style={kpiValue}>{value}</div>
      <div style={kpiLabel}>{label}</div>
    </div>
  );
}

// ───────────────────────────── styles

const panel: CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 18,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

const panelHeader: CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 0.5,
};

const body: CSSProperties = {
  padding: 14,
  display: "grid",
  gap: 18,
};

const emptyBody: CSSProperties = {
  padding: 18,
  fontSize: 13,
  color: "rgba(255,255,255,0.6)",
  fontStyle: "italic",
};

const sectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
  marginBottom: 8,
};

// KPI ─────────────────

const kpiRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const kpiTile: CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "10px 8px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  textAlign: "center",
  minWidth: 0,
};

const kpiValue: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.05,
  color: "rgba(255,255,255,0.95)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const kpiLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: "rgba(255,255,255,0.5)",
  textTransform: "uppercase",
};

// Heatmap ─────────────

const weekdayRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 3,
  marginBottom: 4,
};

const weekdayHeader: CSSProperties = {
  textAlign: "center",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
};

const heatGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 3,
};

const padCell: CSSProperties = {
  aspectRatio: "1 / 1",
};

function heatCell(lvl: number, isToday: boolean): CSSProperties {
  return {
    aspectRatio: "1 / 1",
    borderRadius: 6,
    background: HEAT_BG[lvl],
    border: isToday
      ? "1.5px solid rgba(51,255,122,0.85)"
      : "1px solid rgba(255,255,255,0.05)",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    boxSizing: "border-box",
  };
}

function heatCellNum(lvl: number, isToday: boolean): CSSProperties {
  return {
    fontSize: 9.5,
    fontWeight: isToday ? 900 : 800,
    color: isToday
      ? "rgba(51,255,122,1)"
      : lvl >= 2
      ? "rgba(0,0,0,0.7)"
      : "rgba(255,255,255,0.6)",
    lineHeight: 1,
  };
}

// Green intensity ramp. Level 0 = nothing logged.
const HEAT_BG = [
  "rgba(255,255,255,0.04)",   // 0
  "rgba(51,255,122,0.22)",    // 1
  "rgba(51,255,122,0.55)",    // 2
  "rgba(51,255,122,0.85)",    // 3
] as const;

const heatLegend: CSSProperties = {
  marginTop: 8,
  display: "flex",
  gap: 4,
  alignItems: "center",
  justifyContent: "flex-end",
};

const heatLegendLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
};

function heatLegendSwatch(lvl: number): CSSProperties {
  return {
    width: 12,
    height: 12,
    borderRadius: 3,
    background: HEAT_BG[lvl],
    border: "1px solid rgba(255,255,255,0.06)",
  };
}

// Domain stack + legend ────

const stackTrack: CSSProperties = {
  display: "flex",
  width: "100%",
  height: 10,
  borderRadius: 999,
  overflow: "hidden",
  background: "rgba(255,255,255,0.05)",
};

const domainLegend: CSSProperties = {
  marginTop: 8,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const legendItem: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const legendDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const legendLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.7)",
};

const legendCount: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "rgba(255,255,255,0.95)",
};

// Leaderboard ─────────

const leaderboard: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: 6,
};

const leaderboardItem: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "24px 1fr auto",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
};

const leaderboardRank: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "rgba(255,255,255,0.4)",
  textAlign: "center",
};

const leaderboardBody: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const leaderboardName: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(255,255,255,0.95)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const leaderboardBarTrack: CSSProperties = {
  width: "100%",
  height: 4,
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  overflow: "hidden",
};

const leaderboardBarFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
};

const leaderboardCount: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "rgba(255,255,255,0.95)",
  whiteSpace: "nowrap",
};
