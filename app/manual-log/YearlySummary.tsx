// YearlySummary — profile-page module summarizing the current calendar
// year. Mixes pieces from all three proposed designs while staying
// focused on what's *uniquely year-scale* — no duplication of the
// monthly module's top-routines leaderboard or domain composition bar.
//
//   • KPI tiles — total sessions, total time, total distance, days
//     active out of days elapsed.
//   • Year heatmap (Y1) — 53 weeks × 7 weekdays. Each cell shaded by
//     activity intensity, Sunday-anchored vertically. Today is ringed.
//   • Monthly trend bars (Y2) — 12 horizontal bars Jan→Dec with a
//     domain-stacked fill and session count. Future months render
//     muted so the visual still occupies the same vertical footprint.
//   • Records (Y2) — up to 5 bullets: best month, longest streak,
//     longest session, furthest cardio, top routine.
//
// This component does its own Prisma fetch (rather than receiving the
// page's already-fetched recent-logs prop) because a year can span far
// more logs than the page's 500-row limit covers for heavy users.

import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { addDaysYmd, diffYmdDays, getAppDayRange, toAppYmd } from "@/lib/dates";
import { formatHoursMinutes } from "@/lib/progress";
import { domainColor, effectiveRoutineDomain } from "@/lib/routines";
import {
  longestDailyStreak,
  PROFILE_DOMAIN_LABELS as DOMAIN_LABELS,
  PROFILE_DOMAIN_ORDER as DOMAIN_ORDER,
  ymdWeekday,
  type ProfileDomain as Domain,
} from "@/lib/profile-summary";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function YearlySummary({ today }: { today: Date }) {
  const todayYmd = toAppYmd(today);
  const year = Number(todayYmd.slice(0, 4));
  const currentMonthIdx = Number(todayYmd.slice(5, 7)) - 1;
  // App-timezone year bounds, not server-local — a New Year's Eve session in
  // ET must land in the right year on a UTC host.
  const yearStart = getAppDayRange(`${year}-01-01`).start;
  const yearEnd = getAppDayRange(`${year + 1}-01-01`).start;

  const rawLogs = await prisma.routineLog.findMany({
    where: { performedAt: { gte: yearStart, lt: yearEnd } },
    orderBy: { performedAt: "asc" },
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      distanceMi: true,
      durationSec: true,
      routine: {
        select: { name: true, domain: true, kind: true, subtype: true },
      },
    },
  });

  const logs = rawLogs.map((l) => ({
    ...l,
    domain: effectiveRoutineDomain(l.routine.domain, l.routine.kind, l.routine.subtype) as Domain,
  }));

  // ── KPIs ────────────────────────────────────────────────────────────────
  const sessions = logs.length;
  const totalSec = logs.reduce((s, l) => s + (l.durationSec ?? 0), 0);
  const totalMi = logs.reduce((s, l) => s + (l.distanceMi ?? 0), 0);
  const activeDaySet = new Set(logs.map((l) => toAppYmd(l.performedAt)));
  const dayOfYear = diffYmdDays(todayYmd, `${year}-01-01`) + 1; // inclusive of today
  const daysElapsed = Math.min(dayOfYear, isLeapYear(year) ? 366 : 365);

  // ── Empty state ─────────────────────────────────────────────────────────
  if (sessions === 0) {
    return (
      <section style={panel} aria-label="Yearly summary">
        <div style={panelHeader}>{year}</div>
        <div style={emptyBody}>No sessions logged this year yet.</div>
      </section>
    );
  }

  // ── Heatmap day counts ──────────────────────────────────────────────────
  const dayCounts = new Map<string, number>();
  for (const log of logs) {
    const ymd = toAppYmd(log.performedAt);
    dayCounts.set(ymd, (dayCounts.get(ymd) ?? 0) + 1);
  }

  // Build week columns (Sun → Sat, oldest week → newest week). First column
  // pads the leading days from before Jan 1 with null so the calendar reads
  // correctly weekday-aligned.
  type HeatCell = { ymd: string; count: number; isToday: boolean } | null;
  const weeks: HeatCell[][] = [];
  const totalDays = isLeapYear(year) ? 366 : 365;
  let week: HeatCell[] = [];
  const firstDow = ymdWeekday(`${year}-01-01`);
  for (let i = 0; i < firstDow; i++) week.push(null);
  for (let d = 0; d < totalDays; d++) {
    const ymd = addDaysYmd(`${year}-01-01`, d);
    week.push({
      ymd,
      count: dayCounts.get(ymd) ?? 0,
      isToday: ymd === todayYmd,
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const maxDayCount = Math.max(0, ...Array.from(dayCounts.values()));

  // ── Monthly totals ──────────────────────────────────────────────────────
  type MonthBucket = {
    label: string;
    total: number;
    byDomain: Record<Domain, number>;
    isFuture: boolean;
  };
  const monthBuckets: MonthBucket[] = MONTH_LABELS.map((label, i) => ({
    label,
    total: 0,
    byDomain: { strength: 0, cardio: 0, mobility: 0, sport: 0, lifestyle: 0 },
    isFuture: i > currentMonthIdx,
  }));
  for (const log of logs) {
    const m = Number(toAppYmd(log.performedAt).slice(5, 7)) - 1;
    monthBuckets[m].total++;
    monthBuckets[m].byDomain[log.domain]++;
  }
  const maxMonthTotal = Math.max(1, ...monthBuckets.map((m) => m.total));

  // ── Records ─────────────────────────────────────────────────────────────
  const records = buildRecords(logs, monthBuckets, activeDaySet);

  return (
    <section style={panel} aria-label="Yearly summary">
      <div style={panelHeader}>{year}</div>
      <div style={body}>
        {/* KPI strip */}
        <div style={kpiRow}>
          <Kpi label="Sessions" value={String(sessions)} />
          <Kpi label="Time" value={totalSec > 0 ? formatHoursMinutes(totalSec) : "—"} />
          <Kpi label="Distance" value={totalMi > 0 ? `${totalMi.toFixed(0)}mi` : "—"} />
          <Kpi label="Active" value={`${activeDaySet.size}/${daysElapsed}`} />
        </div>

        {/* Year heatmap */}
        <div>
          <div style={sectionLabel}>YEAR HEATMAP</div>
          <div style={heatScroll}>
            <div style={heatGrid}>
              {weeks.map((wk, weekIdx) =>
                wk.map((cell, dayIdx) => {
                  if (!cell) {
                    return (
                      <span
                        key={`pad-${weekIdx}-${dayIdx}`}
                        style={heatPad}
                        aria-hidden
                      />
                    );
                  }
                  const lvl = intensityLevel(cell.count, maxDayCount);
                  return (
                    <span
                      key={cell.ymd}
                      style={heatCellStyle(lvl, cell.isToday)}
                      title={`${cell.ymd} — ${cell.count} session${cell.count === 1 ? "" : "s"}`}
                    />
                  );
                })
              )}
            </div>
          </div>
          <div style={heatFooter}>
            <div style={monthRow} aria-hidden>
              {MONTH_LABELS.map((m, i) => (
                <span key={i} style={monthCell}>{m[0]}</span>
              ))}
            </div>
            <div style={heatLegend} aria-hidden>
              <span style={heatLegendLabel}>less</span>
              {[0, 1, 2, 3, 4].map((lvl) => (
                <span key={lvl} style={heatLegendSwatch(lvl)} />
              ))}
              <span style={heatLegendLabel}>more</span>
            </div>
          </div>
        </div>

        {/* Monthly trend bars */}
        <div>
          <div style={sectionLabel}>BY MONTH</div>
          <div style={monthBarStack}>
            {monthBuckets.map((m) => {
              const widthPct = m.total === 0 ? 0 : (m.total / maxMonthTotal) * 100;
              return (
                <div key={m.label} style={monthBarRow(m.isFuture)}>
                  <span style={monthBarLabel}>{m.label}</span>
                  <div style={monthBarTrack}>
                    <div style={{ ...monthBarFill, width: `${widthPct}%` }}>
                      {DOMAIN_ORDER.map((d) =>
                        m.byDomain[d] > 0 ? (
                          <div
                            key={d}
                            style={{
                              flex: m.byDomain[d],
                              background: domainColor(d),
                            }}
                          />
                        ) : null
                      )}
                    </div>
                  </div>
                  <span style={monthBarCount(m.isFuture)}>{m.total > 0 ? m.total : "—"}</span>
                </div>
              );
            })}
          </div>
          <div style={domainLegend}>
            {DOMAIN_ORDER.filter((d) =>
              monthBuckets.some((m) => m.byDomain[d] > 0)
            ).map((d) => (
              <div key={d} style={legendItem}>
                <span style={{ ...legendDot, background: domainColor(d) }} aria-hidden />
                <span style={legendLabel}>{DOMAIN_LABELS[d]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Records */}
        {records.length > 0 ? (
          <div>
            <div style={sectionLabel}>RECORDS</div>
            <ul style={recordList}>
              {records.map((r, i) => (
                <li key={i} style={recordItem}>
                  <span style={recordIcon} aria-hidden>{r.icon}</span>
                  <span style={recordLabel}>{r.label}</span>
                  <span style={recordValue}>{r.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ───────────────────────────── helpers

type EnrichedYearLog = {
  id: string;
  routineId: string;
  performedAt: Date;
  distanceMi: number | null;
  durationSec: number | null;
  domain: Domain;
  routine: { name: string };
};

type YearRecord = { icon: string; label: string; value: string };

function buildRecords(
  logs: EnrichedYearLog[],
  monthBuckets: Array<{ label: string; total: number }>,
  activeDays: Set<string>
): YearRecord[] {
  const out: YearRecord[] = [];

  // Best month — highest session total (skip future months).
  const bestMonth = monthBuckets.reduce<{ label: string; total: number } | null>(
    (best, m) => (m.total > (best?.total ?? 0) ? m : best),
    null
  );
  if (bestMonth && bestMonth.total > 0) {
    out.push({
      icon: "🏆",
      label: "Best month",
      value: `${bestMonth.label} (${bestMonth.total})`,
    });
  }

  // Longest streak — longest consecutive run of days in activeDays.
  const streak = longestDailyStreak(activeDays);
  if (streak > 0) {
    out.push({
      icon: "🔥",
      label: "Longest streak",
      value: `${streak} day${streak === 1 ? "" : "s"}`,
    });
  }

  // Longest session — max durationSec.
  const longest = logs.reduce<EnrichedYearLog | null>((best, l) => {
    if ((l.durationSec ?? 0) > (best?.durationSec ?? 0)) return l;
    return best;
  }, null);
  if (longest && (longest.durationSec ?? 0) > 0) {
    out.push({
      icon: "⏱",
      label: "Longest session",
      value: `${longest.routine.name} · ${formatHoursMinutes(longest.durationSec!)}`,
    });
  }

  // Furthest cardio — max distanceMi.
  const furthest = logs.reduce<EnrichedYearLog | null>((best, l) => {
    if (!l.distanceMi) return best;
    if ((l.distanceMi ?? 0) > (best?.distanceMi ?? 0)) return l;
    return best;
  }, null);
  if (furthest && (furthest.distanceMi ?? 0) > 0) {
    out.push({
      icon: "📍",
      label: "Furthest cardio",
      value: `${furthest.routine.name} · ${furthest.distanceMi!.toFixed(2)} mi`,
    });
  }

  // Top routine — most logs of a single routine.
  const routineCounts = new Map<string, { name: string; count: number }>();
  for (const log of logs) {
    const existing = routineCounts.get(log.routineId);
    if (existing) existing.count++;
    else routineCounts.set(log.routineId, { name: log.routine.name, count: 1 });
  }
  const topRoutine = Array.from(routineCounts.values()).sort((a, b) => b.count - a.count)[0];
  if (topRoutine && topRoutine.count > 0) {
    out.push({
      icon: "💪",
      label: "Top routine",
      value: `${topRoutine.name} · ${topRoutine.count}`,
    });
  }

  return out;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function intensityLevel(count: number, maxCount: number): number {
  if (count <= 0) return 0;
  // 4 ramped levels above zero. Scaled by overall max so the visual
  // adapts to a high-volume user vs a casual one.
  if (count <= 1) return 1;
  if (count <= Math.ceil(maxCount * 0.33)) return 2;
  if (count <= Math.ceil(maxCount * 0.66)) return 3;
  return 4;
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

// KPI ─────────

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

// Heatmap ─────

// Allow horizontal scroll on narrow phones — 53 columns × ~6px target
// width fits in ~320px but very narrow phones may need to scroll.
const heatScroll: CSSProperties = {
  overflowX: "auto",
  paddingBottom: 4,
};

const heatGrid: CSSProperties = {
  display: "grid",
  gridTemplateRows: "repeat(7, 1fr)",
  gridAutoFlow: "column",
  gridAutoColumns: "minmax(6px, 1fr)",
  gap: 2,
  minWidth: 340,
};

const heatPad: CSSProperties = {
  aspectRatio: "1 / 1",
  background: "transparent",
};

const HEAT_BG = [
  "rgba(255,255,255,0.05)",   // 0
  "rgba(51,255,122,0.18)",    // 1
  "rgba(51,255,122,0.35)",    // 2
  "rgba(51,255,122,0.65)",    // 3
  "rgba(51,255,122,0.95)",    // 4
] as const;

function heatCellStyle(lvl: number, isToday: boolean): CSSProperties {
  return {
    aspectRatio: "1 / 1",
    borderRadius: 2,
    background: HEAT_BG[lvl],
    border: isToday
      ? "1.5px solid rgba(51,255,122,1)"
      : "1px solid rgba(255,255,255,0.04)",
    boxSizing: "border-box",
  };
}

const heatFooter: CSSProperties = {
  marginTop: 6,
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const monthRow: CSSProperties = {
  flex: 1,
  display: "grid",
  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  gap: 2,
  minWidth: 240,
};

const monthCell: CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.4,
  color: "rgba(255,255,255,0.45)",
  textAlign: "center",
};

const heatLegend: CSSProperties = {
  display: "flex",
  gap: 3,
  alignItems: "center",
  flexShrink: 0,
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
    width: 10,
    height: 10,
    borderRadius: 2,
    background: HEAT_BG[lvl],
    border: "1px solid rgba(255,255,255,0.06)",
  };
}

// Monthly bars ───

const monthBarStack: CSSProperties = {
  display: "grid",
  gap: 4,
};

function monthBarRow(isFuture: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "32px 1fr 32px",
    alignItems: "center",
    gap: 8,
    opacity: isFuture ? 0.4 : 1,
  };
}

const monthBarLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  color: "rgba(255,255,255,0.75)",
};

const monthBarTrack: CSSProperties = {
  height: 12,
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  overflow: "hidden",
};

const monthBarFill: CSSProperties = {
  height: "100%",
  display: "flex",
  borderRadius: 999,
  overflow: "hidden",
};

function monthBarCount(isFuture: boolean): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 900,
    color: isFuture ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.95)",
    textAlign: "right",
  };
}

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

// Records ─────

const recordList: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: 6,
};

const recordItem: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "20px 1fr auto",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
};

const recordIcon: CSSProperties = {
  fontSize: 14,
  lineHeight: 1,
  textAlign: "center",
};

const recordLabel: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.55)",
};

const recordValue: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "rgba(255,255,255,0.95)",
  textAlign: "right",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
