import Link from "next/link";
import { APP_TIME_ZONE, formatAppDateTime, toAppYmd } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { formatHoursMinutes } from "@/lib/progress";
import {
  domainColor,
  effectiveRoutineDomain,
  formatRoutineSubtype,
  formatRoutineTypeLabel,
  isCardioKind,
  isCompletionKind,
  isGuidedKind,
  isSessionKind,
  isWorkoutKind,
} from "@/lib/routines";
import { getLogDisplayName, getLogVenue } from "@/lib/routine-display";
import LogHistoryFeed, { type HistoryRow } from "./LogHistoryFeed";

export const dynamic = "force-dynamic";

const DOMAIN_ORDER = ["strength", "cardio", "mobility", "sport", "lifestyle"] as const;
type Domain = (typeof DOMAIN_ORDER)[number];

const DOMAIN_LABELS: Record<Domain, string> = {
  strength: "Strength",
  cardio: "Endurance",
  mobility: "Mobility",
  sport: "Sport",
  lifestyle: "Lifestyle",
};

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export default async function LogHistory({ domain }: { domain?: string }) {
  const rawDomain = (domain ?? "").toLowerCase();
  const filterDomain: Domain | "" = (DOMAIN_ORDER as readonly string[]).includes(rawDomain) ? (rawDomain as Domain) : "";
  const returnTo = filterDomain ? `/log?view=history&domain=${filterDomain}` : "/log?view=history";

  const logs = await prisma.routineLog.findMany({
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      notes: true,
      completionCount: true,
      distanceMi: true,
      elevationGainFt: true,
      durationSec: true,
      packWeightGrams: true,
      location: true,
      climbLocation: { select: { name: true, type: true } },
      activitySpot: { select: { name: true } },
      sportData: true,
      activityType: { select: { name: true } },
      routine: {
        select: {
          id: true,
          name: true,
          kind: true,
          domain: true,
          subtype: true,
          activityType: { select: { name: true } },
        },
      },
      exercises: { select: { exercise: { select: { name: true } }, sets: { select: { id: true } } } },
    },
  });

  const rows: HistoryRow[] = logs.map((log) => {
    const logDomain = effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype) as Domain;
    const kind = String(log.routine.kind);
    const name = getLogDisplayName(log);
    const exerciseNames = log.exercises.map((e) => e.exercise.name);
    const venue = getLogVenue(log);
    return {
      id: log.id,
      routineId: log.routineId,
      name,
      domain: logDomain,
      typeLabel: formatRoutineTypeLabel(kind),
      dateKey: toAppYmd(log.performedAt),
      timeLabel: formatAppDateTime(log.performedAt, { hour: "numeric", minute: "2-digit" }),
      metricLine: metricLine(log, kind),
      venueLabel: venue?.label ?? null,
      venueGlyph: venue?.glyph ?? null,
      searchText: [name, log.notes ?? "", venue?.label ?? "", ...exerciseNames].join(" ").toLowerCase(),
      editHref: `/routines/${log.routineId}/logs/${log.id}/edit?returnTo=${encodeURIComponent(returnTo)}`,
    };
  });

  return (
    <div className="logHistoryStream" style={{ gap: 16 }}>
      <div style={headRow}>
        <h1 className="mobilePageTitle" style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>History</h1>
        <Link href="/reports/week" style={reportsLink}>Reports →</Link>
      </div>
      {rows.length > 0 ? <MonthCalendar rows={rows} /> : null}
      <LogHistoryFeed
        rows={rows}
        domainOptions={[{ value: "", label: "All" }, ...DOMAIN_ORDER.map((d) => ({ value: d, label: DOMAIN_LABELS[d] }))]}
        initialDomain={filterDomain}
      />
    </div>
  );
}

function metricLine(
  log: {
    distanceMi: number | null;
    durationSec: number | null;
    elevationGainFt: number | null;
    packWeightGrams: number | null;
    completionCount: number | null;
    exercises: { sets: { id: string }[] }[];
    routine: { subtype: string | null };
  },
  kind: string,
): string | null {
  if (isCardioKind(kind)) {
    const parts = [`${(log.distanceMi ?? 0).toFixed(2)} mi`];
    if (log.durationSec) parts.push(formatHoursMinutes(log.durationSec));
    if (log.elevationGainFt) parts.push(`${log.elevationGainFt} ft`);
    if (log.packWeightGrams) parts.push(`${Math.round((log.packWeightGrams / 453.59237) * 10) / 10} lb carried`);
    return parts.join(" · ");
  }
  if (isWorkoutKind(kind)) {
    const sets = log.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    return `${log.exercises.length} exercises · ${sets} sets`;
  }
  if (isGuidedKind(kind) && log.durationSec) {
    return `${formatHoursMinutes(log.durationSec)}${log.routine.subtype ? ` · ${formatRoutineSubtype(log.routine.subtype)}` : ""}`;
  }
  if (isSessionKind(kind) && log.durationSec) return formatHoursMinutes(log.durationSec);
  if (isCompletionKind(kind) && log.completionCount) return `Count: ${log.completionCount}`;
  return null;
}

function MonthCalendar({ rows }: { rows: HistoryRow[] }) {
  const now = new Date();
  const todayYmd = toAppYmd(now);
  const [year, month, todayDay] = todayYmd.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstOfMonth = new Date(`${year}-${String(month).padStart(2, "0")}-01T12:00:00Z`);
  const firstWeekday = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, weekday: "short" }).format(firstOfMonth);
  const leadingBlanks = WEEKDAY_INDEX[firstWeekday] ?? 0;
  const monthLabel = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, month: "long", year: "numeric" }).format(now);

  const monthPrefix = todayYmd.slice(0, 8);
  const dayDomains = new Map<number, string[]>();
  for (const row of rows) {
    if (!row.dateKey.startsWith(monthPrefix)) continue;
    const day = Number(row.dateKey.slice(8));
    const list = dayDomains.get(day);
    if (list) list.push(row.domain);
    else dayDomains.set(day, [row.domain]);
  }

  return (
    <section style={calendarCard} aria-label={`${monthLabel} sessions`}>
      <div style={calendarTitle}>{monthLabel}</div>
      <div style={calendarGrid}>
        {DAY_HEADERS.map((h) => (
          <div key={h} style={dayHeader}>{h}</div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const domains = dayDomains.get(day) ?? [];
          const isToday = day === todayDay;
          const hasSessions = domains.length > 0;
          return (
            <div
              key={day}
              style={{
                ...dayCell,
                background: isToday ? "rgba(255,255,255,0.08)" : hasSessions ? "rgba(255,255,255,0.03)" : "transparent",
                borderColor: isToday ? "rgba(255,255,255,0.18)" : "transparent",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: isToday ? 900 : 700, opacity: isToday ? 1 : hasSessions ? 0.9 : 0.3 }}>
                {day}
              </div>
              {hasSessions ? (
                <div style={dotRow}>
                  {domains.slice(0, 4).map((d, idx) => (
                    <div key={idx} style={{ ...dot, background: domainColor(d) }} />
                  ))}
                  {domains.length > 4 ? <div style={{ ...dot, background: "rgba(255,255,255,0.3)" }} /> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {DOMAIN_ORDER.map((d) => (
          <div key={d} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ ...dot, width: 7, height: 7, background: domainColor(d) }} />
            <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>{DOMAIN_LABELS[d]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const headRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const reportsLink: React.CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  color: "inherit",
  opacity: 0.7,
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};
const calendarCard: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.03)",
};
const calendarTitle: React.CSSProperties = { fontSize: 12, fontWeight: 900, letterSpacing: 0.6, opacity: 0.6, textTransform: "uppercase" };
const calendarGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" };
const dayHeader: React.CSSProperties = { fontSize: 10, fontWeight: 900, opacity: 0.4, paddingBottom: 4 };
const dayCell: React.CSSProperties = {
  padding: "5px 2px 4px",
  borderRadius: 8,
  borderWidth: 1,
  borderStyle: "solid",
  display: "grid",
  gap: 2,
  alignItems: "center",
  justifyItems: "center",
};
const dotRow: React.CSSProperties = { display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" };
const dot: React.CSSProperties = { width: 5, height: 5, borderRadius: "50%" };
