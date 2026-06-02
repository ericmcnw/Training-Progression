// WeeklySummary — profile-page module summarizing the trailing 7 days.
// Composes three of the proposed designs:
//
//   • KPI strip (W1): four big numbers at the top — sessions, time,
//     distance, current daily-log streak.
//   • Day cards (W3): one cell per day Sun→Sat showing what fired, with
//     a small count badge underneath. Today gets a ring.
//   • Domain breakdown (W2): a stacked horizontal bar showing the week's
//     domain composition + the per-domain count.
//   • Highlights (W3): up to four curated bullets — longest session,
//     furthest cardio, biggest day, etc.
//
// Server component; receives the already-fetched log array from the page
// so we don't refetch.

import type { CSSProperties } from "react";
import { toAppYmd } from "@/lib/dates";
import { formatHoursMinutes } from "@/lib/progress";
import { domainColor } from "@/lib/routines";

type Domain = "strength" | "cardio" | "mobility" | "sport" | "lifestyle";

const DOMAIN_ORDER: Domain[] = ["strength", "cardio", "mobility", "sport", "lifestyle"];
const DOMAIN_LABELS: Record<Domain, string> = {
  strength: "Strength",
  cardio: "Endurance",
  mobility: "Mobility",
  sport: "Sport",
  lifestyle: "Lifestyle",
};

type EnrichedLog = {
  id: string;
  routineId: string;
  performedAt: Date;
  distanceMi: number | null;
  durationSec: number | null;
  domain: Domain;
  routine: { name: string };
};

type DayCell = {
  ymd: string;
  letter: string;     // "S" / "M" / "T" / "W" / "T" / "F" / "S"
  full: string;       // "Sun" / "Mon"
  domains: Domain[];  // one entry per session that day
  isToday: boolean;
};

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WeeklySummary({ logs, today }: { logs: EnrichedLog[]; today: Date }) {
  const todayYmd = toAppYmd(today);
  const weekStart = new Date(today);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6); // trailing 7 days including today

  const weekLogs = logs.filter((l) => l.performedAt >= weekStart);

  // ── KPIs ────────────────────────────────────────────────────────────────
  const sessions = weekLogs.length;
  const totalSec = weekLogs.reduce((sum, l) => sum + (l.durationSec ?? 0), 0);
  const totalMi = weekLogs.reduce((sum, l) => sum + (l.distanceMi ?? 0), 0);
  const streak = computeDailyStreak(logs, today);

  // ── Per-day cells (trailing 7 days, oldest → newest) ────────────────────
  const days: DayCell[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const ymd = toAppYmd(d);
    const dow = d.getDay();
    const dayLogs = weekLogs.filter((l) => toAppYmd(l.performedAt) === ymd);
    days.push({
      ymd,
      letter: DAY_LETTERS[dow],
      full: DAY_FULL[dow],
      domains: dayLogs.map((l) => l.domain),
      isToday: ymd === todayYmd,
    });
  }

  // ── Per-domain counts ───────────────────────────────────────────────────
  const perDomain: Record<Domain, number> = {
    strength: 0, cardio: 0, mobility: 0, sport: 0, lifestyle: 0,
  };
  for (const l of weekLogs) perDomain[l.domain]++;
  const activeDomains = DOMAIN_ORDER.filter((d) => perDomain[d] > 0);

  // ── Highlights ──────────────────────────────────────────────────────────
  const highlights = buildHighlights(weekLogs, days);

  // ── Empty state ─────────────────────────────────────────────────────────
  if (sessions === 0) {
    return (
      <section style={panel} aria-label="Weekly summary">
        <div style={panelHeader}>THIS WEEK</div>
        <div style={emptyBody}>No sessions logged in the last 7 days.</div>
      </section>
    );
  }

  return (
    <section style={panel} aria-label="Weekly summary">
      <div style={panelHeader}>THIS WEEK</div>
      <div style={body}>
        {/* KPI strip */}
        <div style={kpiRow}>
          <Kpi label="Sessions" value={String(sessions)} />
          <Kpi label="Time" value={totalSec > 0 ? formatHoursMinutes(totalSec) : "—"} />
          <Kpi label="Distance" value={totalMi > 0 ? `${totalMi.toFixed(1)}mi` : "—"} />
          <Kpi label="Streak" value={streak > 0 ? `${streak}🔥` : "—"} />
        </div>

        {/* 7-day rhythm */}
        <div>
          <div style={sectionLabel}>RHYTHM</div>
          <div style={dayRow}>
            {days.map((day) => (
              <DayCard key={day.ymd} day={day} />
            ))}
          </div>
        </div>

        {/* Domain breakdown */}
        {activeDomains.length > 0 ? (
          <div>
            <div style={sectionLabel}>BY DOMAIN</div>
            <DomainStack
              segments={activeDomains.map((d) => ({
                domain: d,
                count: perDomain[d],
                label: DOMAIN_LABELS[d],
              }))}
              total={sessions}
            />
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

        {/* Highlights */}
        {highlights.length > 0 ? (
          <div>
            <div style={sectionLabel}>HIGHLIGHTS</div>
            <ul style={highlightList}>
              {highlights.map((h, i) => (
                <li key={i} style={highlightItem}>
                  <span style={highlightIcon} aria-hidden>{h.icon}</span>
                  <span style={highlightText}>{h.text}</span>
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

function computeDailyStreak(logs: EnrichedLog[], today: Date): number {
  // Walks back from today, counting consecutive calendar days that have at
  // least one log. Stops on the first empty day past today. Today itself is
  // a grace day — an empty today doesn't break a streak that ran through
  // yesterday, but a logged today bumps the count.
  const loggedDays = new Set(logs.map((l) => toAppYmd(l.performedAt)));
  const todayYmd = toAppYmd(today);
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  // If today not logged, start the count at yesterday.
  if (!loggedDays.has(todayYmd)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let count = 0;
  for (let i = 0; i < 366; i++) {
    if (loggedDays.has(toAppYmd(cursor))) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

type Highlight = { icon: string; text: string };

function buildHighlights(weekLogs: EnrichedLog[], days: DayCell[]): Highlight[] {
  const out: Highlight[] = [];

  // Longest session
  const longest = weekLogs.reduce<EnrichedLog | null>((best, l) => {
    if ((l.durationSec ?? 0) > (best?.durationSec ?? 0)) return l;
    return best;
  }, null);
  if (longest && (longest.durationSec ?? 0) > 0) {
    out.push({
      icon: "⏱",
      text: `Longest: ${longest.routine.name} — ${formatHoursMinutes(longest.durationSec!)}`,
    });
  }

  // Furthest cardio
  const furthest = weekLogs.reduce<EnrichedLog | null>((best, l) => {
    if (!l.distanceMi) return best;
    if ((l.distanceMi ?? 0) > (best?.distanceMi ?? 0)) return l;
    return best;
  }, null);
  if (furthest && (furthest.distanceMi ?? 0) > 0) {
    out.push({
      icon: "📍",
      text: `Furthest: ${furthest.routine.name} — ${furthest.distanceMi!.toFixed(2)} mi`,
    });
  }

  // Biggest day
  const biggestDay = days.reduce<DayCell | null>((best, d) => {
    if (d.domains.length > (best?.domains.length ?? 0)) return d;
    return best;
  }, null);
  if (biggestDay && biggestDay.domains.length >= 2) {
    out.push({
      icon: "💪",
      text: `Biggest day: ${biggestDay.full} — ${biggestDay.domains.length} sessions`,
    });
  }

  // Active days
  const activeDayCount = days.filter((d) => d.domains.length > 0).length;
  if (activeDayCount >= 6) {
    out.push({
      icon: "🔥",
      text: `${activeDayCount}/7 days active`,
    });
  }

  return out.slice(0, 4);
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

function DayCard({ day }: { day: DayCell }) {
  const count = day.domains.length;
  const rest = count === 0;
  return (
    <div style={dayCard(day.isToday, rest)}>
      <div style={dayLetter(day.isToday)}>{day.letter}</div>
      <div style={dayDotsBox}>
        {rest ? (
          <span style={restDash} aria-hidden>—</span>
        ) : (
          day.domains.slice(0, 4).map((d, i) => (
            <span key={i} style={{ ...dayDot, background: domainColor(d) }} aria-hidden />
          ))
        )}
      </div>
      <div style={dayCount(rest)}>{rest ? "rest" : `${count}`}</div>
    </div>
  );
}

function DomainStack({
  segments,
  total,
}: {
  segments: Array<{ domain: Domain; count: number; label: string }>;
  total: number;
}) {
  return (
    <div style={stackTrack} aria-hidden>
      {segments.map((seg) => (
        <div
          key={seg.domain}
          title={`${seg.label}: ${seg.count}`}
          style={{
            width: `${(seg.count / total) * 100}%`,
            background: domainColor(seg.domain),
          }}
        />
      ))}
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
  gap: 16,
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

// KPI strip ────────────────

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

// Day cards ────────────────

const dayRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 4,
};

function dayCard(isToday: boolean, isRest: boolean): CSSProperties {
  return {
    display: "grid",
    gap: 4,
    padding: "6px 4px 5px",
    borderRadius: 10,
    border: isToday
      ? "1px solid rgba(51,255,122,0.5)"
      : "1px solid rgba(255,255,255,0.08)",
    background: isToday
      ? "rgba(51,255,122,0.08)"
      : isRest
      ? "rgba(255,255,255,0.015)"
      : "rgba(255,255,255,0.03)",
    textAlign: "center",
    minHeight: 56,
    alignContent: "start",
    opacity: isRest && !isToday ? 0.7 : 1,
  };
}

function dayLetter(isToday: boolean): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.4,
    color: isToday ? "rgba(51,255,122,0.95)" : "rgba(255,255,255,0.55)",
    textTransform: "uppercase",
  };
}

const dayDotsBox: CSSProperties = {
  display: "flex",
  gap: 2,
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",
  minHeight: 14,
};

const dayDot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
};

const restDash: CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.35)",
  fontWeight: 800,
};

function dayCount(isRest: boolean): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 800,
    color: isRest ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)",
    lineHeight: 1,
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

// Highlights ───────────────

const highlightList: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: 6,
};

const highlightItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
};

const highlightIcon: CSSProperties = {
  fontSize: 14,
  lineHeight: 1,
};

const highlightText: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "rgba(255,255,255,0.85)",
  flex: 1,
  minWidth: 0,
};
