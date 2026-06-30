import type { CSSProperties } from "react";
import { toAppYmd } from "@/lib/dates";
import { formatHoursMinutes } from "@/lib/progress";
import { domainColor } from "@/lib/routines";
import { ymdWeekday, PROFILE_DOMAIN_LABELS as DOMAIN_LABELS } from "@/lib/profile-summary";
import { resolvePeriod, type Period } from "@/lib/reports/period";
import { loadReportLogs } from "@/lib/reports/load";
import { loadReportTotals } from "@/lib/reports/totals";
import { loadPeriodGoals } from "@/lib/reports/evaluate";
import { delta, summarize } from "@/lib/reports/aggregate";
import GoalsBlock from "./GoalsBlock";
import {
  buildNumbers,
  countChip,
  DeltaChips,
  DomainBar,
  KpiStrip,
  NumbersGrid,
  pctChip,
  body,
  emptyBody,
  panel,
  panelHeader,
  sectionLabel,
} from "./_ui";

const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

export default async function MonthReport({ period }: { period: Period }) {
  const todayYmd = toAppYmd(new Date());
  const [year, monthNum] = period.key.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const todayDay = period.isCurrent ? Number(todayYmd.slice(8, 10)) : daysInMonth;
  const daysElapsed = Math.min(todayDay, daysInMonth);
  const firstDayOfWeek = ymdWeekday(`${period.key}-01`);

  const logs = await loadReportLogs(period);
  const cur = summarize(logs);

  if (cur.sessions === 0) {
    return (
      <section style={panel}>
        <div style={panelHeader}>{period.label.toUpperCase()}</div>
        <div style={emptyBody}>No sessions logged this month.</div>
      </section>
    );
  }

  // vs last month + per-domain headline totals run in parallel.
  const prevPeriod = resolvePeriod("month", period.prevKey);
  const [prevLogs, totals] = await Promise.all([
    loadReportLogs(prevPeriod),
    loadReportTotals(logs.map((l) => l.id)),
  ]);
  const prev = summarize(prevLogs);

  const maxDayCount = Math.max(1, ...Array.from(cur.dayCounts.values()));
  const numbers = buildNumbers(cur, totals);
  const goals = period.isCurrent ? await loadPeriodGoals("month") : [];

  return (
    <>
      <GoalsBlock goals={goals} />
      <section style={panel}>
      <div style={panelHeader}>{period.label.toUpperCase()}</div>
      <div style={body}>
        <KpiStrip
          items={[
            { label: "Sessions", value: String(cur.sessions) },
            { label: "Time", value: cur.totalSec > 0 ? formatHoursMinutes(cur.totalSec) : "—" },
            { label: "Distance", value: cur.totalMi > 0 ? `${cur.totalMi.toFixed(1)}mi` : "—" },
            { label: "Active", value: `${cur.activeDays}/${daysElapsed}` },
          ]}
        />

        {prev.sessions > 0 && (
          <div>
            <div style={sectionLabel}>VS LAST MONTH</div>
            <DeltaChips
              items={[
                countChip("Sessions", delta(cur.sessions, prev.sessions)),
                pctChip("Load", delta(cur.load, prev.load)),
                pctChip("Time", delta(cur.totalSec, prev.totalSec)),
              ]}
            />
          </div>
        )}

        {/* Calendar heatmap */}
        <div>
          <div style={sectionLabel}>CONSISTENCY</div>
          <div style={weekdayRow}>
            {WEEKDAY_HEADERS.map((h, i) => (
              <div key={i} style={weekdayHeader}>{h}</div>
            ))}
          </div>
          <div style={heatGrid}>
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`pad-${i}`} style={{ aspectRatio: "1 / 1" }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ymd = `${period.key}-${String(day).padStart(2, "0")}`;
              const count = cur.dayCounts.get(ymd) ?? 0;
              const lvl = intensity(count, maxDayCount);
              const isToday = period.isCurrent && day === todayDay;
              return (
                <div key={day} style={heatCell(lvl, isToday)} title={`Day ${day} — ${count} session${count === 1 ? "" : "s"}`}>
                  <span style={heatCellNum(lvl, isToday)}>{day}</span>
                </div>
              );
            })}
          </div>
        </div>

        <DomainBar perDomain={cur.perDomain} activeDomains={cur.activeDomains} total={cur.sessions} />

        <NumbersGrid title="THIS MONTH IN NUMBERS" rows={numbers} />

        {/* Top routines */}
        {cur.topRoutines.length > 0 && (
          <div>
            <div style={sectionLabel}>TOP ROUTINES</div>
            <ol style={leaderboard}>
              {cur.topRoutines.map((r, i) => (
                <li key={r.id} style={leaderboardItem}>
                  <span style={leaderboardRank}>{i + 1}</span>
                  <div style={leaderboardBody}>
                    <div style={leaderboardName}>{r.name}</div>
                    <div style={leaderboardBarTrack}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 999,
                          width: `${(r.count / cur.topRoutines[0].count) * 100}%`,
                          background: domainColor(r.domain),
                        }}
                      />
                    </div>
                  </div>
                  <span style={leaderboardCount}>{r.count}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      </section>
    </>
  );
}

// ── styles (heatmap + leaderboard, ported from MonthlySummary) ──────────────

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

const HEAT_BG = [
  "rgba(255,255,255,0.04)",
  "rgba(51,255,122,0.22)",
  "rgba(51,255,122,0.55)",
  "rgba(51,255,122,0.85)",
] as const;

function intensity(count: number, maxCount: number): number {
  if (count <= 0) return 0;
  if (count <= 1) return 1;
  if (count <= Math.ceil(maxCount * 0.5)) return 2;
  return 3;
}

function heatCell(lvl: number, isToday: boolean): CSSProperties {
  return {
    aspectRatio: "1 / 1",
    borderRadius: 6,
    background: HEAT_BG[lvl],
    border: isToday ? "1.5px solid rgba(51,255,122,0.85)" : "1px solid rgba(255,255,255,0.05)",
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
    color: isToday ? "rgba(51,255,122,1)" : lvl >= 2 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.6)",
    lineHeight: 1,
  };
}

const leaderboard: CSSProperties = { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 };
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
const leaderboardRank: CSSProperties = { fontSize: 14, fontWeight: 900, color: "rgba(255,255,255,0.4)", textAlign: "center" };
const leaderboardBody: CSSProperties = { display: "grid", gap: 4, minWidth: 0 };
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
const leaderboardCount: CSSProperties = { fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.95)", whiteSpace: "nowrap" };
