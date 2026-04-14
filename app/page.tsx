import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getRecommendationModel } from "@/lib/recommendations";
import WeeklyMomentumSectionBoundary from "./WeeklyMomentumSectionBoundary";
import WeekAtGlanceClient from "./WeekAtGlanceClient";
import DashboardBodyMap from "@/app/components/dashboard/DashboardBodyMap";
import RehabRoutinePrompt from "@/app/components/dashboard/RehabRoutinePrompt";
import { sparklineCoordinates, sparklinePoints } from "@/lib/progress";
import { addDaysYmd, diffYmdDays, formatAppDate, formatAppDateTime, formatUtcDateLabel, getAppDayRange, toAppYmd, todayAppYmd } from "@/lib/dates";
import { formatRoutineSubtype, formatRoutineTypeLabel, normalizeRoutineKind, routineKindColor, effectiveRoutineDomain, type RoutineDomain } from "@/lib/routines";
import { getWeekBoundsSunday } from "@/lib/week";

export const dynamic = "force-dynamic";

function utcDateOnlyYmd(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function addDays(ymd: string, plus: number) {
  return addDaysYmd(ymd, plus);
}

function dayDiff(a: string, b: string) {
  return diffYmdDays(a, b);
}

function formatDayLabel(ymd: string) {
  return formatUtcDateLabel(ymd, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatShortWeekRangeLabel(startYmd: string) {
  const endYmd = addDays(startYmd, 6);
  const start = formatUtcDateLabel(startYmd, { month: "numeric", day: "numeric" });
  const end = formatUtcDateLabel(endYmd, { month: "numeric", day: "numeric" });
  return `${start}-${end}`;
}

function formatHeroWeekRange(startYmd: string) {
  const endYmd = addDays(startYmd, 6);
  const start = formatUtcDateLabel(startYmd, { month: "short", day: "numeric" });
  const end = formatUtcDateLabel(endYmd, { day: "numeric" });
  return `${start}–${end}`;
}

function formatWeeklyPointTooltip(week: {
  label: string;
  sessions: number;
  miles: number;
  logs: Array<{ routineName: string; performedAt: Date }>;
}) {
  const header = `${formatShortWeekRangeLabel(week.label)}\n${week.sessions} logs • ${week.miles.toFixed(1)} mi`;
  if (week.logs.length === 0) return `${header}\nNo sessions logged`;

  const details = week.logs.map((log) => {
    const dateLabel = formatAppDate(log.performedAt, { month: "numeric", day: "numeric" });
    return `${dateLabel}: ${log.routineName}`;
  });
  return `${header}\n${details.join("\n")}`;
}

function formatLogTime(date: Date) {
  return formatAppDateTime(date, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLastCompletedLabel(date: Date | null) {
  if (!date) return "Never completed";
  return `Last completed ${formatAppDate(date, { month: "short", day: "numeric" })}`;
}

function localDayRange(ymd: string) {
  return getAppDayRange(ymd);
}

function kindAccent(kind: string) {
  return routineKindColor(kind);
}

function domainColor(domain: RoutineDomain): string {
  switch (domain) {
    case "strength":  return "rgba(84,203,130,0.9)";
    case "cardio":    return "rgba(78,148,255,0.9)";
    case "mobility":  return "rgba(192,132,252,0.9)";
    case "sport":     return "rgba(251,146,60,0.9)";
    case "recovery":  return "rgba(251,113,133,0.9)";
    case "skill":     return "rgba(251,199,92,0.9)";
    case "habit":     return "rgba(156,163,175,0.9)";
    default:          return "rgba(156,163,175,0.7)";
  }
}

function TrainingBalance({ rows }: {
  rows: Array<{ domain: RoutineDomain; label: string; sessions: number; maxSessions: number }>;
}) {
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.maxSessions));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((row) => {
        const fillPct = max > 0 ? (row.sessions / max) * 100 : 0;
        const color = domainColor(row.domain);
        const status = row.sessions === 0 ? "absent" : row.sessions < 2 ? "light" : "active";
        return (
          <div key={row.domain} style={{ display: "grid", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.3 }}>{row.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 900,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: status === "absent" ? "rgba(255,255,255,0.06)" : status === "light" ? "rgba(251,199,92,0.15)" : "rgba(84,203,130,0.12)",
                  color: status === "absent" ? "rgba(255,255,255,0.4)" : status === "light" ? "rgba(251,199,92,0.9)" : "rgba(84,203,130,0.9)",
                  border: `1px solid ${status === "absent" ? "rgba(255,255,255,0.08)" : status === "light" ? "rgba(251,199,92,0.25)" : "rgba(84,203,130,0.25)"}`,
                }}>
                  {status === "absent" ? "Quiet" : status === "light" ? "Light" : "Active"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>{row.sessions}</span>
              </div>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                borderRadius: 999,
                width: `${fillPct}%`,
                background: color,
                transition: "width 0.4s ease",
                minWidth: row.sessions > 0 ? 10 : 0,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function loggingHref(routine: { routineId: string; kind: string }) {
  return `/routines/${routine.routineId}/log`;
}

function recommendationPriorityBadge(priority: "high" | "medium" | "low"): React.CSSProperties {
  if (priority === "high") {
    return {
      ...recommendationBadgeBase,
      background: "rgba(255, 186, 125, 0.18)",
      borderColor: "rgba(255, 186, 125, 0.4)",
      color: "#ffd4a8",
    };
  }
  if (priority === "medium") {
    return {
      ...recommendationBadgeBase,
      background: "rgba(142, 197, 255, 0.18)",
      borderColor: "rgba(142, 197, 255, 0.35)",
      color: "#d2e7ff",
    };
  }
  return {
    ...recommendationBadgeBase,
    background: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.16)",
    color: "rgba(255,255,255,0.82)",
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WeeklyMomentumSection({
  weekDateRangeLabel,
  weekLoggedTotal,
  weekSessionTargetTotal,
  totalWeeklyCardioMiles,
  cardioTypeGroups,
  weeklySeries,
  weeklySparkPoints,
  recentCompletions,
  needsAttention,
}: {
  weekDateRangeLabel: string;
  weekLoggedTotal: number;
  weekSessionTargetTotal: number;
  totalWeeklyCardioMiles: number;
  cardioTypeGroups: Array<{
    type: string;
    miles: number;
    items: Array<{ id: string; name: string; miles: number; logs: number }>;
  }>;
  weeklySeries: Array<{
    label: string;
    sessions: number;
    miles: number;
    logs: Array<{ routineName: string; performedAt: Date }>;
  }>;
  weeklySparkPoints: Array<{ x: number; y: number }>;
  recentCompletions: Array<{ id: string; name: string; lastCompletedAt: Date | null }>;
  needsAttention: Array<{ id: string; name: string; lastCompletedAt: Date | null }>;
}) {
  return (
    <section style={panel}>
      <div style={panelHeader}>WEEKLY MOMENTUM</div>
      <div style={{ padding: 14, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="mobileHomeWeeklyHeader" style={weeklySubheaderRow}>
            <div style={weeklySubheader}>This Week</div>
            <SessionFractionRing current={weekLoggedTotal} target={weekSessionTargetTotal} />
          </div>
          <div style={sectionSub}>{weekDateRangeLabel}</div>
        </div>

        <div style={mileageBand}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Weekly Cardio Mileage</div>
            <div style={sectionSub}>Combined miles from all cardio routines this week.</div>
          </div>
          <div className="mobileHomeMileageValue" style={mileageValue}>{totalWeeklyCardioMiles.toFixed(1)} mi</div>
          <details style={cardioDetails}>
            <summary data-collapsible-summary style={cardioSummary}>
              Show cardio routine breakdown
            </summary>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {cardioTypeGroups.length === 0 && <div style={emptyState}>No cardio logged this week.</div>}
              {cardioTypeGroups.map((group) => (
                <div key={group.type} style={cardioGroupCard}>
                  <div className="mobileHomeCardioRow" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>{group.type}</div>
                    <div style={cardioMilesPill}>{group.miles.toFixed(1)} mi</div>
                  </div>
                  <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                    {group.items.map((item) => (
                      <div key={item.id} style={cardioRoutineRow}>
                        <span>{item.name}</span>
                        <span>{item.miles.toFixed(1)} mi ({item.logs} logs)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div style={sparkCard}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Last 4 Weeks</div>
            <div style={sectionSub}>Session count trend with weekly dots you can hover for the session list.</div>
          </div>
          <svg width="100%" height="84" viewBox="0 0 220 84" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="rgba(84,203,130,0.95)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparklinePoints(weeklySeries.map((item) => item.sessions), 220, 84, 8)}
            />
            {weeklySparkPoints.map((point, index) => {
              const week = weeklySeries[index];
              if (!week) return null;
              return (
                <g key={week.label}>
                  <title>{formatWeeklyPointTooltip(week)}</title>
                  <circle cx={point.x} cy={point.y} r="9" fill="transparent" style={{ cursor: "pointer" }} />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="3.5"
                    fill="rgba(84,203,130,0.98)"
                    stroke="rgba(246,252,248,0.96)"
                    strokeWidth="1.5"
                    style={{ pointerEvents: "none" }}
                  />
                </g>
              );
            })}
          </svg>
          <div className="mobileHomeSparkMeta" style={sparkMetaRow}>
            {weeklySeries.map((item) => (
              <div key={item.label} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, opacity: 0.66 }}>{formatShortWeekRangeLabel(item.label)}</div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{item.sessions} logs</div>
                <div style={{ fontSize: 11, opacity: 0.74 }}>{item.miles.toFixed(1)} mi</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mobileHomeTwoCol" style={twoColGrid}>
          <div style={subPanel}>
            <div style={subPanelTitle}>Recently Completed</div>
            <div style={{ display: "grid", gap: 8 }}>
              {recentCompletions.length === 0 && <div style={emptyState}>No routines completed yet.</div>}
              {recentCompletions.map((item) => (
                <div key={item.id} style={miniCardSuccess}>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div style={miniCardMeta}>{formatLastCompletedLabel(item.lastCompletedAt)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={subPanel}>
            <div style={subPanelTitle}>Needs Attention</div>
            <div style={{ display: "grid", gap: 8 }}>
              {needsAttention.length === 0 && <div style={emptyState}>Everything has been completed recently.</div>}
              {needsAttention.map((item) => (
                <div key={item.id} style={miniCardWarn}>
                  <div style={{ fontWeight: 800 }}>{item.name}</div>
                  <div style={miniCardMeta}>{formatLastCompletedLabel(item.lastCompletedAt)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SessionFractionRing({ current, target }: { current: number; target: number }) {
  const size = 86;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = target > 0 ? current / target : 0;
  const clamped = Math.max(0, Math.min(1, fraction));
  const dashOffset = circumference * (1 - clamped);

  return (
    <div style={{ width: size, height: size, position: "relative", display: "grid", placeItems: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(128,128,128,0.25)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(84,203,130,0.95)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center", lineHeight: 1.1 }}>
        <div style={{ fontWeight: 900, fontSize: 17 }}>
          {current}/{target}
        </div>
        <div style={{ fontSize: 10, opacity: 0.72 }}>sessions</div>
      </div>
    </div>
  );
}

function SummaryFractionRing({ current, target }: { current: number; target: number }) {
  const size = 92;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = target > 0 ? current / target : 0;
  const clamped = Math.max(0, Math.min(1, fraction));
  const dashOffset = circumference * (1 - clamped);

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
      <div style={{ width: size, height: size, position: "relative", display: "grid", placeItems: "center" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(84,203,130,0.95)"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div style={{ position: "absolute", textAlign: "center", lineHeight: 1.05 }}>
          <div style={{ fontSize: 19, fontWeight: 900 }}>
            {current}/{target}
          </div>
          <div style={{ fontSize: 10, opacity: 0.68 }}>done</div>
        </div>
      </div>
      <div style={{ textAlign: "center", display: "grid", gap: 3 }}>
        <div style={summaryLabel}>Today: Done/Planned</div>
        <div style={summarySub}>completed routines / planned routines</div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const today = todayAppYmd();
  const tomorrow = addDays(today, 1);
  const weekBounds = getWeekBoundsSunday(new Date());
  const weekStart = toAppYmd(weekBounds.start);
  const sparkStart = addDays(weekStart, -35);
  const glanceWeekCount = 12;
  const glanceStart = addDays(weekStart, -(glanceWeekCount - 1) * 7);

  const [
    routines,
    recentLogs,
    weeklyLogs,
    latestLogs,
    activeGoals,
    planEntriesRaw,
    manualEntriesRaw,
    sparkLogs,
    glanceLogs,
    recommendationModel,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        category: string;
        subtype: string | null;
        domain: string;
        kind: string;
      }>
    >(
      'SELECT "id","name","category","subtype","domain","kind" FROM "Routine" WHERE "isDeleted" = false AND "isActive" = true ORDER BY "kind" ASC, "category" ASC, "name" ASC'
    ),
    prisma.routineLog.findMany({
      orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        performedAt: true,
        distanceMi: true,
        elevationGainFt: true,
        durationSec: true,
        exercises: { select: { id: true, sets: { select: { id: true } } } },
        routine: { select: { id: true, name: true, category: true, kind: true } },
      },
    }),
    prisma.routineLog.groupBy({
      by: ["routineId"],
      where: {
        performedAt: {
          gte: weekBounds.start,
          lt: weekBounds.end,
        },
      },
      _count: { _all: true },
      _sum: { distanceMi: true },
      _max: { performedAt: true },
    }),
    prisma.routineLog.groupBy({
      by: ["routineId"],
      _max: { performedAt: true },
    }),
    prisma.goal.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, targetValue: true, createdAt: true },
    }),
    prisma.$queryRawUnsafe<Array<{ routineId: string; dayOffset: number; sortOrder: number; startDate: string; cycleLengthDays: number }>>(
      'SELECT e."routineId", e."dayOffset", e."sortOrder", a."startDate", p."cycleLengthDays" FROM "ScheduleEntry" e INNER JOIN "SchedulePlanActivation" a ON a."schedulePlanId" = e."schedulePlanId" INNER JOIN "SchedulePlan" p ON p."id" = e."schedulePlanId" WHERE a."isEnabled" = true'
    ),
    prisma.$queryRawUnsafe<Array<{ routineId: string; scheduledDate: string; sortOrder: number }>>(
      'SELECT "routineId","scheduledDate","sortOrder" FROM "ScheduleManualEntry"'
    ),
    prisma.routineLog.findMany({
      where: {
        performedAt: {
          gte: new Date(`${sparkStart}T00:00:00.000Z`),
          lt: weekBounds.end,
        },
      },
      orderBy: { performedAt: "asc" },
      select: {
        performedAt: true,
        distanceMi: true,
        routine: { select: { id: true, name: true, kind: true } },
      },
    }),
    prisma.routineLog.findMany({
      where: {
        performedAt: {
          gte: new Date(`${glanceStart}T00:00:00.000Z`),
          lt: weekBounds.end,
        },
      },
      orderBy: { performedAt: "asc" },
      select: {
        id: true,
        performedAt: true,
        routine: { select: { name: true, kind: true, domain: true, subtype: true } },
      },
    }),
    getRecommendationModel(),
  ]);

  const routineMap = new Map(routines.map((routine) => [routine.id, routine]));

  const weeklyMap = new Map(
    weeklyLogs.map((row) => [
      row.routineId,
      {
        count: row._count._all,
        miles: row._sum.distanceMi ?? 0,
        lastAt: row._max.performedAt,
      },
    ])
  );
  const latestLogMap = new Map(latestLogs.map((row) => [row.routineId, row._max.performedAt]));

  const manualToday = manualEntriesRaw
    .map((entry) => ({
      routineId: entry.routineId,
      scheduledDate: utcDateOnlyYmd(entry.scheduledDate),
      sortOrder: Number(entry.sortOrder),
    }))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.sortOrder - b.sortOrder);

  const cycleEntries = planEntriesRaw
    .map((entry) => ({
      routineId: entry.routineId,
      dayOffset: Number(entry.dayOffset),
      sortOrder: Number(entry.sortOrder),
      startDate: utcDateOnlyYmd(entry.startDate),
      cycleLengthDays: Number(entry.cycleLengthDays),
    }));

  function buildPlanForDay(day: string) {
    const dayPlanMap = new Map<
      string,
      { routineId: string; routineName: string; category: string; kind: string; planned: number; logged: number }
    >();

    const manualForDay = manualToday.filter((entry) => entry.scheduledDate === day);
    const cyclesForDay = cycleEntries.filter((entry) => {
      if (entry.cycleLengthDays <= 0) return false;
      const diff = dayDiff(day, entry.startDate);
      return diff >= 0 && diff % entry.cycleLengthDays === entry.dayOffset;
    });

    for (const item of [...manualForDay, ...cyclesForDay]) {
      const routine = routineMap.get(item.routineId);
      if (!routine) continue;
      const existing = dayPlanMap.get(item.routineId);
      if (existing) {
        existing.planned += 1;
        continue;
      }
      dayPlanMap.set(item.routineId, {
        routineId: item.routineId,
        routineName: routine.name,
        category: routine.category,
        kind: routine.kind,
        planned: 1,
        logged: 0,
      });
    }

    return dayPlanMap;
  }

  const todayPlanMap = buildPlanForDay(today);
  const tomorrowPlanMap = buildPlanForDay(tomorrow);

  const todayRange = localDayRange(today);
  const todayLogs = await prisma.routineLog.findMany({
    where: {
      performedAt: {
        gte: todayRange.start,
        lt: todayRange.end,
      },
    },
    select: { routineId: true },
  });

  const todayLogCountMap = new Map<string, number>();
  for (const log of todayLogs) {
    todayLogCountMap.set(log.routineId, (todayLogCountMap.get(log.routineId) ?? 0) + 1);
  }

  for (const [routineId, count] of todayLogCountMap.entries()) {
    const routine = routineMap.get(routineId);
    if (!routine) continue;
    const existing = todayPlanMap.get(routineId);
    if (existing) {
      existing.logged = count;
    } else {
      todayPlanMap.set(routineId, {
        routineId,
        routineName: routine.name,
        category: routine.category,
        kind: routine.kind,
        planned: 0,
        logged: count,
      });
    }
  }

  const todayFocus = Array.from(todayPlanMap.values()).sort(
    (a, b) => b.logged - a.logged || b.planned - a.planned || a.routineName.localeCompare(b.routineName)
  );
  const tomorrowPlan = Array.from(tomorrowPlanMap.values()).sort(
    (a, b) => b.planned - a.planned || a.routineName.localeCompare(b.routineName)
  );

  const weeklyCards = routines
    .map((routine) => {
      const week = weeklyMap.get(routine.id) ?? { count: 0, miles: 0, lastAt: null };
      return {
        id: routine.id,
        name: routine.name,
        category: routine.category,
        kind: routine.kind,
        count: week.count,
        miles: week.miles,
        lastCompletedAt: latestLogMap.get(routine.id) ?? null,
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const weeklyCardioBreakdown = routines
    .filter((routine) => normalizeRoutineKind(routine.kind) === "CARDIO")
    .map((routine) => ({
      id: routine.id,
      name: routine.name,
      cardioType: formatRoutineSubtype(routine.subtype) || "Cardio",
      miles: weeklyMap.get(routine.id)?.miles ?? 0,
      logs: weeklyMap.get(routine.id)?.count ?? 0,
    }))
    .sort((a, b) => b.miles - a.miles || b.logs - a.logs || a.name.localeCompare(b.name));

  const totalWeeklyCardioMiles = weeklyCardioBreakdown.reduce((sum, item) => sum + item.miles, 0);
  const cardioByType = new Map<string, typeof weeklyCardioBreakdown>();
  for (const item of weeklyCardioBreakdown) {
    if (!cardioByType.has(item.cardioType)) cardioByType.set(item.cardioType, []);
    cardioByType.get(item.cardioType)!.push(item);
  }
  const cardioTypeGroups = Array.from(cardioByType.entries())
    .map(([type, items]) => ({
      type,
      items,
      miles: items.reduce((sum, item) => sum + item.miles, 0),
    }))
    .sort((a, b) => b.miles - a.miles || a.type.localeCompare(b.type));

  const recentCompletions = weeklyCards
    .filter((item) => item.lastCompletedAt)
    .sort((a, b) => (b.lastCompletedAt?.getTime() ?? 0) - (a.lastCompletedAt?.getTime() ?? 0))
    .slice(0, 4);

  const weeklySeries = Array.from({ length: 4 }, (_, index) => {
    const start = addDays(weekStart, -(3 - index) * 7);
    const end = addDays(start, 7);
    const logsInWeek = sparkLogs.filter((log) => {
      const ymd = toAppYmd(log.performedAt);
      return ymd >= start && ymd < end;
    });
    return {
      label: start,
      sessions: logsInWeek.length,
      miles: logsInWeek.reduce((sum, log) => sum + (log.distanceMi ?? 0), 0),
      logs: logsInWeek.map((log) => ({
        routineName: log.routine.name,
        performedAt: log.performedAt,
      })),
    };
  });
  const weeklySparkPoints = sparklineCoordinates(
    weeklySeries.map((item) => item.sessions),
    220,
    84,
    8
  );

  const todayPlannedTotal = todayFocus.reduce((sum, item) => sum + item.planned, 0);
  const todayDoneRoutines = todayFocus.filter((item) => item.logged > 0).length;
  const tomorrowPlannedTotal = tomorrowPlan.reduce((sum, item) => sum + item.planned, 0);
  const weekLoggedByRoutine = new Map(weeklyCards.map((item) => [item.id, item.count]));
  const weekLoggedTotal = weeklyCards.reduce((sum, item) => sum + item.count, 0);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekPlannedByRoutine = new Map<string, number>();
  for (const day of weekDays) {
    const dayPlan = buildPlanForDay(day);
    for (const item of dayPlan.values()) {
      weekPlannedByRoutine.set(item.routineId, (weekPlannedByRoutine.get(item.routineId) ?? 0) + item.planned);
    }
  }
  const weekPlannedTotal = Array.from(weekPlannedByRoutine.values()).reduce((sum, count) => sum + count, 0);
  const weekUnplannedLoggedTotal = Array.from(weekLoggedByRoutine.entries()).reduce((sum, [routineId, logged]) => {
    const planned = weekPlannedByRoutine.get(routineId) ?? 0;
    return sum + Math.max(0, logged - planned);
  }, 0);
  const weekSessionTargetTotal = weekPlannedTotal + weekUnplannedLoggedTotal;
  const needsAttention = weeklyCards
    .map((item) => {
      const lastCompletedYmd = item.lastCompletedAt ? toAppYmd(item.lastCompletedAt) : null;
      return {
        ...item,
        daysSinceLastCompleted: lastCompletedYmd ? dayDiff(today, lastCompletedYmd) : Number.POSITIVE_INFINITY,
      };
    })
    .filter((item) => item.daysSinceLastCompleted > 7)
    .sort((a, b) => b.daysSinceLastCompleted - a.daysSinceLastCompleted || a.name.localeCompare(b.name))
    .slice(0, 4);
  const weekEnd = addDays(weekStart, 6);
  const weekDateRangeLabel = `${formatDayLabel(weekStart)} - ${formatDayLabel(weekEnd)}`;
  const glanceLogsByDay = new Map<
    string,
    Array<{ id: string; routineName: string; kind: string; domain: RoutineDomain }>
  >();
  for (const log of glanceLogs) {
    const ymd = toAppYmd(log.performedAt);
    if (!glanceLogsByDay.has(ymd)) glanceLogsByDay.set(ymd, []);
    glanceLogsByDay.get(ymd)!.push({
      id: log.id,
      routineName: log.routine.name,
      kind: log.routine.kind,
      domain: effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype),
    });
  }
  const glanceDays = Array.from({ length: glanceWeekCount * 7 }, (_, index) => {
    const ymd = addDays(glanceStart, index);
    return {
      ymd,
      label: dayLabels[index % 7],
      dayNumber: formatUtcDateLabel(ymd, { day: "numeric" }),
      logs: glanceLogsByDay.get(ymd) ?? [],
    };
  });

  // Consecutive active-day streak ending today
  const loggedDaySet = new Set(sparkLogs.map((log) => toAppYmd(log.performedAt)));
  let currentStreak = 0;
  {
    let check = today;
    while (loggedDaySet.has(check)) {
      currentStreak++;
      check = addDays(check, -1);
    }
    // If today has no log yet, check if yesterday kept the streak alive
    if (currentStreak === 0) {
      const yesterday = addDays(today, -1);
      if (loggedDaySet.has(yesterday)) {
        let check2 = yesterday;
        while (loggedDaySet.has(check2)) {
          currentStreak++;
          check2 = addDays(check2, -1);
        }
      }
    }
  }

  // Training balance: sessions per domain over last 4 weeks (sparkLogs window)
  const domainSessionMap = new Map<RoutineDomain, number>();
  for (const log of sparkLogs) {
    const routine = routineMap.get(log.routine.id);
    if (!routine) continue;
    const domain = effectiveRoutineDomain(routine.domain, routine.kind, routine.subtype);
    domainSessionMap.set(domain, (domainSessionMap.get(domain) ?? 0) + 1);
  }
  const domainOrder: RoutineDomain[] = ["strength", "cardio", "mobility", "sport", "recovery", "skill", "habit"];
  const domainLabels: Record<RoutineDomain, string> = {
    strength: "Strength", cardio: "Cardio", mobility: "Mobility",
    sport: "Sport / Sessions", recovery: "Recovery", skill: "Skill Work",
    habit: "Habits", general: "General",
  };
  const trainingBalanceRows = domainOrder
    .map((domain) => ({
      domain,
      label: domainLabels[domain],
      sessions: domainSessionMap.get(domain) ?? 0,
      maxSessions: domainSessionMap.get(domain) ?? 0,
    }))
    .filter((row) => {
      // Always show domains with sessions; also show domains that have active routines
      const hasRoutine = routines.some((r) => effectiveRoutineDomain(r.domain, r.kind, r.subtype) === row.domain);
      return row.sessions > 0 || hasRoutine;
    });
  const maxDomainSessions = Math.max(1, ...trainingBalanceRows.map((r) => r.sessions));
  const trainingBalanceRowsWithMax = trainingBalanceRows.map((r) => ({ ...r, maxSessions: maxDomainSessions }));

  // Today's top unlogged planned item for the hero CTA
  const todayNextAction = todayFocus.find((item) => item.planned > item.logged) ?? null;

  const recentItems = recentLogs.map((log) => {
    const setCount = log.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    const isRun = log.distanceMi !== null && log.durationSec !== null;
    const isWorkout = !isRun && log.exercises.length > 0;
    return {
      id: log.id,
      name: log.routine.name,
      category: log.routine.category,
      kind: log.routine.kind,
      stamp: formatLogTime(log.performedAt),
      detail: isRun
        ? `${(log.distanceMi ?? 0).toFixed(2)} mi${log.elevationGainFt ? ` | ${log.elevationGainFt} ft` : ""}`
        : isWorkout
        ? `${setCount} sets logged`
        : "Completed check-in",
    };
  });

  const goalCards = activeGoals.map((goal) => ({
    id: goal.id,
    title: goal.name,
    target: goal.targetValue,
    createdAt: formatAppDate(goal.createdAt),
  }));

  return (
    <div className="mobileHomePage" style={page}>
      {/* ── HERO STATUS STRIP ── */}
      <div className="mobileHeroStrip" style={heroStrip}>
        <div style={heroCell}>
          <div style={heroCellLabel}>THIS WEEK</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{ position: "relative", width: 46, height: 46, flexShrink: 0 }}>
              <svg width={46} height={46} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={23} cy={23} r={18} stroke="rgba(255,255,255,0.12)" strokeWidth={5} fill="none" />
                <circle
                  cx={23} cy={23} r={18}
                  stroke="rgba(84,203,130,0.95)" strokeWidth={5} fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 18}
                  strokeDashoffset={2 * Math.PI * 18 * (1 - Math.min(1, weekSessionTargetTotal > 0 ? weekLoggedTotal / weekSessionTargetTotal : 0))}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", lineHeight: 1.1 }}>
                <span style={{ fontSize: 12, fontWeight: 900 }}>{weekLoggedTotal}</span>
                <span style={{ fontSize: 9, opacity: 0.6 }}>/{weekSessionTargetTotal}</span>
              </div>
            </div>
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontSize: 14, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{weekLoggedTotal} sessions</div>
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{formatHeroWeekRange(weekStart)}</div>
            </div>
          </div>
        </div>

        <div className="mobileHeroPriority" style={{ ...heroCell, borderLeft: "1px solid rgba(255,255,255,0.07)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={heroCellLabel}>TODAY&apos;S PRIORITY</div>
          {todayNextAction ? (
            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{todayNextAction.routineName}</div>
              <div style={{ fontSize: 11, opacity: 0.6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{todayNextAction.category} · {formatRoutineTypeLabel(todayNextAction.kind)}</div>
              <Link href={loggingHref(todayNextAction)} style={heroCTALink}>Log Now →</Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 900 }}>
                {todayFocus.length > 0 ? "All done today!" : "Rest day"}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                {todayFocus.length > 0 ? `${todayDoneRoutines} done` : "Nothing scheduled"}
              </div>
            </div>
          )}
        </div>

        <div className="mobileHeroStreak" style={heroCell}>
          <div style={heroCellLabel}>STREAK</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color: currentStreak >= 7 ? "rgba(251,199,92,0.95)" : currentStreak >= 3 ? "rgba(84,203,130,0.95)" : "inherit" }}>
              {currentStreak}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>day{currentStreak !== 1 ? "s" : ""}</div>
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 1 }}>
                {currentStreak === 0 ? "Start today" : currentStreak >= 7 ? "On fire!" : currentStreak >= 3 ? "Building" : "Keep it up"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── WEEK AT A GLANCE ── */}
      <section style={panel}>
        <div style={panelHeader}>WEEK AT A GLANCE</div>
        <div style={{ padding: "12px 14px 14px" }}>
          <WeekAtGlanceClient days={glanceDays} today={today} currentWeekStart={weekStart} />
        </div>
      </section>

      <div className="mobileHomeMainGrid" style={mainGrid}>
        <div className="mobileHomePrimaryColumn" style={{ display: "grid", gap: 14 }}>
          <section style={panel}>
            <div style={panelHeader}>TODAY&apos;S FOCUS</div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div style={sectionSub}>{formatDayLabel(today)}</div>
              <div className="mobileHomeSummaryGrid" style={summaryGrid}>
                <div style={summaryRingCard}>
                  <SummaryFractionRing current={todayDoneRoutines} target={todayPlannedTotal} />
                </div>
              </div>
              {todayFocus.length === 0 && <div style={emptyState}>Nothing planned or logged yet today.</div>}
              {todayFocus.map((item) => (
                <div key={item.routineId} style={item.logged > 0 ? focusDoneCard : focusCard}>
                  <div style={focusCardTopRow}>
                    <div style={focusCardInfo}>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>{item.routineName}</div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.78 }}>
                        {item.category} | {formatRoutineTypeLabel(item.kind)}
                      </div>
                      <div style={focusMetaLine}>
                        Planned: {item.planned} | Logged: {item.logged} | Remaining: {Math.max(0, item.planned - item.logged)}
                      </div>
                    </div>
                    <div style={focusStatusColumn}>
                      <div className="mobileHomeKindPill" style={{ ...kindPill, borderColor: kindAccent(item.kind), color: kindAccent(item.kind) }}>
                        {item.logged > 0 ? "DONE" : "PLANNED"}
                      </div>
                      {item.planned > 0 && (
                        <Link href={loggingHref(item)} style={focusActionLink}>
                          Log
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <DashboardBodyMap />

          <section style={panel}>
            <div style={panelHeader}>SUGGESTED NEXT</div>
            <div style={{ padding: 14, display: "grid", gap: 12 }}>
              <RehabRoutinePrompt />
              <div style={sectionSub}>
                Recommendations prioritize behind-target routines, thin recent coverage, and recent overconcentration. Focus only nudges the ranking when the main evidence is close.
              </div>
              {recommendationModel.primaryRecommendation ? (
                <div style={recommendationPrimaryCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>{recommendationModel.primaryRecommendation.title}</div>
                      <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.82 }}>{recommendationModel.primaryRecommendation.summary}</div>
                    </div>
                    <div style={recommendationPriorityBadge(recommendationModel.primaryRecommendation.priority)}>
                      {recommendationModel.primaryRecommendation.priority.toUpperCase()}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(recommendationModel.emphasisLabels.length > 0 ? recommendationModel.emphasisLabels : ["No special focus"]).slice(0, 3).map((label) => (
                      <span key={label} style={recommendationChip}>
                        {label}
                      </span>
                    ))}
                    {recommendationModel.primaryRecommendation.targetCategories.map((slug) => (
                      <span key={slug} style={recommendationChipMuted}>
                        {slug}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <Link href={recommendationModel.primaryRecommendation.suggestedAction.href} style={recommendationActionLink}>
                      {recommendationModel.primaryRecommendation.suggestedAction.label}
                    </Link>
                    {recommendationModel.primaryRecommendation.suggestedRoutines[1] ? (
                      <Link href={recommendationModel.primaryRecommendation.suggestedRoutines[1].href} style={recommendationSecondaryLink}>
                        Or {recommendationModel.primaryRecommendation.suggestedRoutines[1].name}
                      </Link>
                    ) : null}
                  </div>

                  <details style={recommendationDetails}>
                    <summary data-collapsible-summary style={recommendationSummary}>
                      Why?
                    </summary>
                    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                      {recommendationModel.primaryRecommendation.rationale.map((item) => (
                        <div key={item} style={recommendationWhyRow}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ) : (
                <div style={emptyState}>Recommendations will appear once there is enough recent routine and coverage history to rank the next best move.</div>
              )}

              {recommendationModel.secondaryRecommendations.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {recommendationModel.secondaryRecommendations.map((item) => (
                    <div key={item.id} style={recommendationSecondaryCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                          <div style={{ fontWeight: 800 }}>{item.title}</div>
                          <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.76 }}>{item.summary}</div>
                        </div>
                        <div style={recommendationPriorityBadge(item.priority)}>{item.priority.toUpperCase()}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <Link href={item.suggestedAction.href} style={recommendationSecondaryLink}>
                          {item.suggestedAction.label}
                        </Link>
                        {item.suggestedRoutines[1] ? <span style={{ fontSize: 12, opacity: 0.62 }}>or {item.suggestedRoutines[1].name}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {recommendationModel.hiddenDueToInjury.length > 0 ? (
                <details style={recommendationDetails}>
                  <summary data-collapsible-summary style={recommendationSummary}>
                    Hidden due to injury
                  </summary>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {recommendationModel.hiddenDueToInjury.map((item) => (
                      <div key={item.routineId} style={recommendationWhyRow}>
                        <Link href={item.href} style={{ color: "inherit", fontWeight: 900 }}>
                          {item.routineName}
                        </Link>{" "}
                        - {item.reason}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>TOMORROW PREVIEW</div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div style={sectionSub}>{formatDayLabel(tomorrow)}</div>
              <div style={summaryCard}>
                <div style={summaryLabel}>Tomorrow Planned</div>
                <div style={summaryValue}>{tomorrowPlannedTotal}</div>
                <div style={summarySub}>planned entries tomorrow</div>
              </div>
              {tomorrowPlan.length === 0 && <div style={emptyState}>Nothing planned yet for tomorrow.</div>}
              <div className="mobileHomeTomorrowGrid" style={tomorrowPreviewGrid}>
                {tomorrowPlan.slice(0, 8).map((item) => (
                  <div key={`tomorrow-${item.routineId}`} style={metricChip}>
                    {item.routineName} ({item.kind}) | planned {item.planned}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>RECENT ACTIVITY</div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              {recentItems.length === 0 && <div style={emptyState}>No logs yet.</div>}
              {recentItems.map((item) => (
                <div key={item.id} className="mobileHomeActivityRow" style={activityRow}>
                  <div style={activityDot(item.kind)} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{item.name}</div>
                    <div style={{ marginTop: 3, fontSize: 12, opacity: 0.76 }}>
                      {item.category} | {item.detail}
                    </div>
                  </div>
                  <div className="mobileHomeActivityStamp" style={{ fontSize: 12, opacity: 0.7, textAlign: "right" }}>{item.stamp}</div>
                </div>
              ))}
              <Link href="/manual-log" style={secondaryLinkBlock}>Open Log History</Link>
            </div>
          </section>
        </div>

        <div className="mobileHomeSecondaryColumn" style={{ display: "grid", gap: 14 }}>
          <section style={panel}>
            <div style={panelHeader}>TRAINING BALANCE <span style={{ fontWeight: 500, opacity: 0.55, letterSpacing: 0 }}>· last 4 weeks</span></div>
            <div style={{ padding: "12px 14px 14px", display: "grid", gap: 10 }}>
              <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.45 }}>
                Sessions across all training domains. Quiet domains may need attention.
              </div>
              <TrainingBalance rows={trainingBalanceRowsWithMax} />
              {trainingBalanceRowsWithMax.length === 0 && (
                <div style={{ fontSize: 12, opacity: 0.55 }}>No training logged yet. Start a session to see your balance.</div>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                <Link href="/progress" style={secondaryLinkBlock}>Full Progress View →</Link>
              </div>
            </div>
          </section>

          <div className="homeMomentumSection">
            <WeeklyMomentumSectionBoundary
              weekDateRangeLabel={weekDateRangeLabel}
              weekLoggedTotal={weekLoggedTotal}
              weekSessionTargetTotal={weekSessionTargetTotal}
              totalWeeklyCardioMiles={totalWeeklyCardioMiles}
              cardioTypeGroups={cardioTypeGroups}
              weeklySeries={weeklySeries.map((item) => ({
                ...item,
                logs: item.logs.map((log) => ({
                  ...log,
                  performedAt: log.performedAt.toISOString(),
                })),
              }))}
              weeklySparkPoints={weeklySparkPoints}
              recentCompletions={recentCompletions.map((item) => ({
                ...item,
                lastCompletedAt: item.lastCompletedAt ? item.lastCompletedAt.toISOString() : null,
              }))}
              needsAttention={needsAttention.map((item) => ({
                ...item,
                lastCompletedAt: item.lastCompletedAt ? item.lastCompletedAt.toISOString() : null,
              }))}
            />
          </div>

          <section style={panel}>
            <div style={panelHeader}>ACTIVE GOALS</div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              {goalCards.length === 0 && <div style={emptyState}>No active goals yet.</div>}
              {goalCards.map((goal) => (
                <div key={goal.id} style={goalRow}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{goal.title}</div>
                    <div style={{ marginTop: 3, fontSize: 12, opacity: 0.76 }}>
                      Target: {goal.target} | Created: {goal.createdAt}
                    </div>
                  </div>
                </div>
              ))}
              <Link href="/goals" style={secondaryLinkBlock}>Manage Goals</Link>
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>QUICK PATHS</div>
            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div className="mobileHomeQuickGrid" style={quickGrid}>
                <Link href="/routines?mode=new" style={quickCard}>
                  <div style={quickTitle}>New Routine</div>
                  <div style={quickSub}>Add a workout, cardio, or check routine.</div>
                </Link>
                <Link href="/schedule" style={quickCard}>
                  <div style={quickTitle}>Plan Week</div>
                  <div style={quickSub}>Adjust today and this month on the schedule board.</div>
                </Link>
                <Link href="/progress" style={quickCard}>
                  <div style={quickTitle}>Review Trends</div>
                  <div style={quickSub}>Open progression charts and completion history.</div>
                </Link>
                <Link href="/goals?mode=new" style={quickCard}>
                  <div style={quickTitle}>Set Goal</div>
                  <div style={quickSub}>Start from a goal template tied to routine, cardio, exercise, or group progress.</div>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 16,
};

const mainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.25fr 0.95fr",
  gap: 16,
  alignItems: "start",
};

const panel: React.CSSProperties = {
  borderRadius: 20,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(20,29,46,0.9), rgba(13,19,31,0.92))",
  boxShadow: "0 12px 34px rgba(0,0,0,0.16)",
};

const panelHeader: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const sectionSub: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.68,
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 8,
};

const summaryCard: React.CSSProperties = {
  borderRadius: 12,
  padding: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 3,
};

const summaryRingCard: React.CSSProperties = {
  ...summaryCard,
  justifyItems: "center",
  padding: 14,
};

const summaryLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.35,
  opacity: 0.72,
};

const summaryValue: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.1,
};

const summarySub: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.7,
};

const focusCard: React.CSSProperties = {
  borderRadius: 14,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const focusDoneCard: React.CSSProperties = {
  ...focusCard,
  border: "1px solid rgba(84,203,130,0.72)",
  background: "rgba(84,203,130,0.10)",
  boxShadow: "0 0 0 1px rgba(84,203,130,0.14), 0 0 18px rgba(84,203,130,0.18)",
};

const focusCardTopRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

const focusCardInfo: React.CSSProperties = {
  minWidth: 0,
  flex: 1,
};

const focusMetaLine: React.CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  opacity: 0.88,
};

const focusActionLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "7px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
};

const focusStatusColumn: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  alignContent: "start",
  gap: 6,
  flexShrink: 0,
};

const kindPill: React.CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.4,
};

const sparkCard: React.CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(180deg, rgba(84,203,130,0.10), rgba(76,163,255,0.06) 45%, rgba(255,255,255,0.02))",
  display: "grid",
  gap: 10,
};

const mileageBand: React.CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: "1px solid rgba(76,163,255,0.24)",
  background: "linear-gradient(135deg, rgba(76,163,255,0.12), rgba(84,203,130,0.07))",
  display: "grid",
  gap: 10,
};

const mileageValue: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
  lineHeight: 1,
};

const cardioDetails: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 10,
};

const cardioSummary: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 800,
};

const cardioGroupCard: React.CSSProperties = {
  borderRadius: 12,
  padding: 10,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.03)",
};

const cardioMilesPill: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(76,163,255,0.14)",
  border: "1px solid rgba(76,163,255,0.35)",
  fontSize: 11,
  fontWeight: 900,
};

const cardioRoutineRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 12,
  opacity: 0.88,
};

const sparkMetaRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const twoColGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const weeklySubheader: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: 0.3,
};

const weeklySubheaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
};

const tomorrowPreviewGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 8,
};

const subPanel: React.CSSProperties = {
  borderRadius: 16,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 10,
};

const subPanelTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
};

const metricChip: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 10,
  padding: "7px 9px",
  fontSize: 12,
  opacity: 0.9,
  background: "rgba(128,128,128,0.08)",
};

const miniCardSuccess: React.CSSProperties = {
  borderRadius: 12,
  padding: 10,
  border: "1px solid rgba(84,203,130,0.42)",
  background: "rgba(84,203,130,0.08)",
};

const miniCardWarn: React.CSSProperties = {
  borderRadius: 12,
  padding: 10,
  border: "1px solid rgba(255,199,92,0.42)",
  background: "rgba(255,199,92,0.08)",
};

const miniCardMeta: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  opacity: 0.78,
};

const activityRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "14px minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

function activityDot(kind: string): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: kindAccent(kind),
    boxShadow: `0 0 14px ${kindAccent(kind)}`,
  };
}

const goalRow: React.CSSProperties = {
  borderRadius: 14,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const quickGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const quickCard: React.CSSProperties = {
  display: "block",
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  textDecoration: "none",
  color: "inherit",
};

const quickTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
};

const quickSub: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  opacity: 0.76,
  lineHeight: 1.45,
};

const secondaryLink: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  textDecoration: "none",
  color: "inherit",
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.04)",
  fontWeight: 800,
};

const secondaryLinkBlock: React.CSSProperties = {
  ...secondaryLink,
  display: "inline-flex",
  justifyContent: "center",
};

const emptyState: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.64,
};

const recommendationBadgeBase: React.CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  whiteSpace: "nowrap",
};

const recommendationPrimaryCard: React.CSSProperties = {
  borderRadius: 16,
  padding: 14,
  border: "1px solid rgba(142,197,255,0.24)",
  background: "linear-gradient(135deg, rgba(142,197,255,0.12), rgba(84,203,130,0.06))",
  display: "grid",
  gap: 12,
};

const recommendationSecondaryCard: React.CSSProperties = {
  borderRadius: 14,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  display: "grid",
  gap: 10,
};

const recommendationChip: React.CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  background: "rgba(84,203,130,0.14)",
  border: "1px solid rgba(84,203,130,0.3)",
  fontSize: 11,
  fontWeight: 800,
};

const recommendationChipMuted: React.CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "capitalize",
};

const recommendationActionLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 10,
  background: "rgba(84,203,130,0.18)",
  border: "1px solid rgba(84,203,130,0.34)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};

const recommendationSecondaryLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.84,
};

const recommendationDetails: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(12,18,30,0.24)",
  padding: 10,
};

const recommendationSummary: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.35,
};

const recommendationWhyRow: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
  opacity: 0.78,
};

const heroStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  borderRadius: 20,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(20,29,46,0.95), rgba(13,19,31,0.97))",
  boxShadow: "0 12px 34px rgba(0,0,0,0.18)",
};

const heroCell: React.CSSProperties = {
  padding: "16px 18px",
  display: "grid",
  gap: 8,
  alignContent: "start",
};

const heroCellLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  opacity: 0.5,
};

const heroCTALink: React.CSSProperties = {
  display: "inline-flex",
  alignSelf: "start",
  alignItems: "center",
  padding: "6px 11px",
  borderRadius: 8,
  border: "1px solid rgba(84,203,130,0.4)",
  background: "rgba(84,203,130,0.12)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
  marginTop: 2,
};
