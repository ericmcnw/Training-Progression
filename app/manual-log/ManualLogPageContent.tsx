import Link from "next/link";
import { APP_TIME_ZONE, formatAppDate, formatAppDateTime, toAppYmd } from "@/lib/dates";
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
import { loadProfileStats } from "@/lib/profile-stats";
import { getProfileIdentity } from "@/lib/profile-identity";
import { getLogDisplayName } from "@/lib/routine-display";
import WeeklySummary from "./WeeklySummary";
import ProfileHeader from "@/app/profile/ProfileHeader";
import ProfileMilestones from "@/app/profile/ProfileMilestones";
import LogHistoryFeed, { type HistoryRow } from "./LogHistoryFeed";

export const dynamic = "force-dynamic";

// Pre-formatted native metric line for a history row, mirroring the card
// detail lines by routine kind.
function buildHistoryMetricLine(
  log: {
    distanceMi: number | null;
    durationSec: number | null;
    elevationGainFt: number | null;
    completionCount: number | null;
    exercises: { exercise: { name: string }; sets: { id: string }[] }[];
    routine: { subtype: string | null };
  },
  kind: string,
  setCount: number,
): string | null {
  if (isCardioKind(kind)) {
    const parts = [`${(log.distanceMi ?? 0).toFixed(2)} mi`];
    if (log.durationSec) parts.push(formatHoursMinutes(log.durationSec));
    if (log.elevationGainFt) parts.push(`${log.elevationGainFt} ft`);
    return parts.join(" · ");
  }
  if (isWorkoutKind(kind)) {
    return `${setCount} sets${log.exercises.length > 0 ? ` · ${log.exercises.length} exercises` : ""}`;
  }
  if (isGuidedKind(kind) && log.durationSec) {
    return `${formatHoursMinutes(log.durationSec)}${log.routine.subtype ? ` · ${formatRoutineSubtype(log.routine.subtype)}` : ""}`;
  }
  if (isSessionKind(kind) && log.durationSec) return formatHoursMinutes(log.durationSec);
  if (isCompletionKind(kind) && log.completionCount) return `Count: ${log.completionCount}`;
  return null;
}

const DOMAIN_ORDER = ["strength", "cardio", "mobility", "sport", "lifestyle"] as const;
type Domain = (typeof DOMAIN_ORDER)[number];

const DOMAIN_LABELS: Record<Domain, string> = {
  strength: "Strength",
  cardio: "Endurance",
  mobility: "Mobility",
  sport: "Sport",
  lifestyle: "Lifestyle",
};

export default async function ManualLogPageContent({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; domain?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const view = resolvedSearchParams?.view === "history" ? "history" : "profile";
  const showHistory = view === "history";
  const rawDomain = (resolvedSearchParams?.domain ?? "").toLowerCase();
  const filterDomain: Domain | "" = (DOMAIN_ORDER as readonly string[]).includes(rawDomain)
    ? (rawDomain as Domain)
    : "";

  const [recentLogs, allHistoryLogs, goalCount, routineCount] = await Promise.all([
    // Profile view: recent window for the calendar / pulse / recent-5.
    showHistory
      ? Promise.resolve([])
      : prisma.routineLog.findMany({
          orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
          take: 500,
          select: {
            id: true,
            routineId: true,
            performedAt: true,
            notes: true,
            completionCount: true,
            distanceMi: true,
            elevationGainFt: true,
            durationSec: true,
            location: true,
            sportData: true,
            routine: { select: { id: true, name: true, kind: true, domain: true, subtype: true } },
            exercises: { select: { id: true, sets: { select: { id: true } } } },
          },
        }),
    // History view: the FULL log history, with exercise names for search.
    showHistory
      ? prisma.routineLog.findMany({
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
        })
      : Promise.resolve([]),
    prisma.goal.count({ where: { isActive: true } }),
    prisma.routine.count({ where: { isDeleted: false, isActive: true } }),
  ]);

  // Enrich logs with effective domain
  const enrichedLogs = recentLogs.map((log) => ({
    ...log,
    domain: effectiveRoutineDomain(
      log.routine.domain,
      log.routine.kind,
      log.routine.subtype
    ) as Domain,
  }));

  // Pre-shape the full history into lean search rows for the client feed.
  const historyRows: HistoryRow[] = allHistoryLogs.map((log) => {
    const domain = effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype) as Domain;
    const kind = String(log.routine.kind);
    const name = getLogDisplayName(log);
    const exerciseNames = log.exercises.map((e) => e.exercise.name);
    const setCount = log.exercises.reduce((s, e) => s + e.sets.length, 0);
    return {
      id: log.id,
      routineId: log.routineId,
      name,
      domain,
      typeLabel: formatRoutineTypeLabel(kind),
      dateKey: toAppYmd(log.performedAt),
      timeLabel: formatAppDateTime(log.performedAt, { hour: "numeric", minute: "2-digit" }),
      metricLine: buildHistoryMetricLine(log, kind, setCount),
      notes: log.notes ?? null,
      searchText: [name, log.notes ?? "", ...exerciseNames].join(" ").toLowerCase(),
      editHref: `/routines/${log.routineId}/logs/${log.id}/edit?returnTo=${encodeURIComponent(
        filterDomain ? `/profile/history?domain=${filterDomain}` : "/profile/history",
      )}`,
    };
  });

  // ── Stats ────────────────────────────────────────────────────────────────────
  // The profile keeps only the WeeklySummary pulse; full week/month/year
  // reports moved to /reports (navigable + evaluative).
  const now = new Date();

  // ── Calendar (current month in app timezone) ─────────────────────────────────
  const todayYmd = toAppYmd(now);

  // Profile-view-only data: lifetime stats + milestones + sport settings.
  // Skipped on the history view since none of it renders there.
  const [profileStats, identity] = showHistory
    ? [null, null]
    : await Promise.all([loadProfileStats(todayYmd), getProfileIdentity()]);
  const [calYear, calMonthNum] = todayYmd.split("-").slice(0, 2).map(Number);
  const calMonthIdx = calMonthNum - 1;
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const todayDay = parseInt(todayYmd.split("-")[2], 10);
  const firstOfMonthUTC = new Date(
    `${calYear}-${String(calMonthNum).padStart(2, "0")}-01T12:00:00Z`
  );
  const firstDayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
  }).format(firstOfMonthUTC);
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const firstDayOfWeek = dayMap[firstDayLabel] ?? 0;
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(now);

  // Map day-of-month → domain colors. On history, source from the full
  // history rows; on profile, from the recent window.
  const calDayDomains = new Map<number, Domain[]>();
  const calSource: Array<{ ymd: string; domain: Domain }> = showHistory
    ? historyRows.map((r) => ({ ymd: r.dateKey, domain: r.domain as Domain }))
    : enrichedLogs.map((l) => ({ ymd: toAppYmd(l.performedAt), domain: l.domain }));
  for (const item of calSource) {
    const [ly, lm, ld] = item.ymd.split("-").map(Number);
    if (ly === calYear && lm === calMonthNum) {
      if (!calDayDomains.has(ld)) calDayDomains.set(ld, []);
      calDayDomains.get(ld)!.push(item.domain);
    }
  }

  const latestLog = enrichedLogs[0] ?? null;

  const historyDomainOptions = [
    { value: "", label: "All" },
    ...DOMAIN_ORDER.map((d) => ({ value: d, label: DOMAIN_LABELS[d] })),
  ];

  const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div
      className="mobileManualLogPage mobilePageShell"
      style={{ maxWidth: 980, margin: "0 auto", padding: 4, display: "grid", gap: 18 }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <h1 className="mobilePageTitle" style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>
          Profile
        </h1>
      </div>

      {/* ── Athlete card + quick nav (profile view only) ── */}
      {!showHistory && profileStats && (
        <section style={{ display: "grid", gap: 14 }}>
          <ProfileHeader stats={profileStats} identity={identity ?? undefined} />

          <div className="mobileManualLogHeroActions mobileActionRow" style={heroActionRow}>
            <Link href="/profile/history" style={primaryLinkBtn}>
              History
            </Link>
            <Link href="/reports/week" style={linkBtn}>Reports</Link>
            <Link href="/profile/settings" style={linkBtn}>⚙ Settings</Link>
          </div>

          <div style={summaryGrid}>
            <div style={summaryCard}>
              <div style={summaryLabel}>Latest Log</div>
              <div style={summaryValue}>
                {latestLog
                  ? formatAppDate(latestLog.performedAt, { month: "short", day: "numeric" })
                  : "-"}
              </div>
              <div style={summaryMeta}>
                {latestLog ? latestLog.routine.name : "No logs yet"}
              </div>
            </div>
            <div style={summaryCard}>
              <div style={summaryLabel}>Active Goals</div>
              <div style={summaryValue}>{goalCount}</div>
              <div style={summaryMeta}>Current targets</div>
            </div>
            <div style={summaryCard}>
              <div style={summaryLabel}>Active Routines</div>
              <div style={summaryValue}>{routineCount}</div>
              <div style={summaryMeta}>Ready to log</div>
            </div>
          </div>
        </section>
      )}

      {/* ── Personal bests ── */}
      {!showHistory && profileStats && (
        <section className="mobileSectionCard" style={panel}>
          <div className="mobileSectionHeader" style={panelHeader}>PERSONAL BESTS</div>
          <div className="mobileSectionBody" style={{ padding: 14 }}>
            <ProfileMilestones milestones={profileStats.milestones} />
          </div>
        </section>
      )}

      {/* Last-7-days pulse — a rolling glance. The full navigable + evaluative
          week/month/year reports live at /reports; the profile keeps only this. */}
      {!showHistory && <WeeklySummary logs={enrichedLogs} today={now} />}

      {/* ── Recent Activity (profile view only) ── */}
      {!showHistory && (
        <section className="mobileSectionCard" style={panel}>
          <div className="mobileSectionHeader" style={panelHeader}>RECENT ACTIVITY</div>
          <div className="mobileSectionBody" style={{ padding: 14, display: "grid", gap: 10 }}>
            {enrichedLogs.length === 0 && <div style={{ opacity: 0.75 }}>No logs yet.</div>}
            {enrichedLogs.slice(0, 5).map((log) => (
              <ActivityCard key={log.id} log={log} />
            ))}
            <Link href="/profile/history" style={linkBtn}>
              Open Full Log History
            </Link>
          </div>
        </section>
      )}


      {/* ── Full History ── */}
      {showHistory && (
        <section className="mobileSectionCard" style={panel}>
          <div
            className="mobileSectionHeader"
            style={{
              ...panelHeader,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span>LOG HISTORY</span>
            <Link href="/profile" style={miniLinkBtn}>
              Back to Profile
            </Link>
          </div>

          <div className="mobileSectionBody" style={{ padding: 14, display: "grid", gap: 16 }}>
            {/* Calendar */}
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.6, opacity: 0.6 }}>
                {monthLabel.toUpperCase()}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 2,
                  textAlign: "center",
                }}
              >
                {DAY_HEADERS.map((h) => (
                  <div
                    key={h}
                    style={{ fontSize: 10, fontWeight: 900, opacity: 0.4, paddingBottom: 4 }}
                  >
                    {h}
                  </div>
                ))}
                {Array.from({ length: firstDayOfWeek }, (_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const domains = calDayDomains.get(day) ?? [];
                  const isToday = day === todayDay;
                  const hasSessions = domains.length > 0;
                  return (
                    <div
                      key={day}
                      style={{
                        padding: "5px 2px 4px",
                        borderRadius: 8,
                        background: isToday
                          ? "rgba(255,255,255,0.08)"
                          : hasSessions
                          ? "rgba(255,255,255,0.03)"
                          : "transparent",
                        border: isToday
                          ? "1px solid rgba(255,255,255,0.18)"
                          : "1px solid transparent",
                        display: "grid",
                        gap: 2,
                        alignItems: "center",
                        justifyItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: isToday ? 900 : 700,
                          opacity: isToday ? 1 : hasSessions ? 0.9 : 0.3,
                        }}
                      >
                        {day}
                      </div>
                      {hasSessions && (
                        <div
                          style={{
                            display: "flex",
                            gap: 2,
                            flexWrap: "wrap",
                            justifyContent: "center",
                          }}
                        >
                          {domains.slice(0, 4).map((d, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: domainColor(d),
                              }}
                            />
                          ))}
                          {domains.length > 4 && (
                            <div
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                background: "rgba(255,255,255,0.3)",
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Calendar legend */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {DOMAIN_ORDER.map((d) => (
                  <div key={d} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: domainColor(d),
                      }}
                    />
                    <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>
                      {DOMAIN_LABELS[d]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Searchable + filterable feed over the FULL history. */}
            <LogHistoryFeed
              rows={historyRows}
              domainOptions={historyDomainOptions}
              initialDomain={filterDomain}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function ActivityCard({
  log,
}: {
  log: {
    id: string;
    routineId: string;
    performedAt: Date;
    distanceMi: number | null;
    durationSec: number | null;
    completionCount: number | null;
    domain: Domain;
    sportData?: unknown;
    routine: { name: string; kind: string | null; subtype: string | null };
    exercises: { id: string; sets: { id: string }[] }[];
  };
}) {
  const exerciseSetCount = log.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const routineKind = String(log.routine.kind);
  const typeLabel = formatRoutineTypeLabel(routineKind);
  const color = domainColor(log.domain);

  return (
    <div
      className="mobileCard"
      style={{
        ...activityCard,
        borderLeft: `3px solid ${color.replace("0.9)", "0.6)")}`,
        paddingLeft: 12,
      }}
    >
      <div style={{ fontWeight: 800 }}>{getLogDisplayName(log)}</div>
      <div style={{ marginTop: 3, fontSize: 12, opacity: 0.72 }}>
        {typeLabel} ·{" "}
        {formatAppDateTime(log.performedAt, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>
      {isCardioKind(routineKind) && (
        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>
          {(log.distanceMi ?? 0).toFixed(2)} mi
          {log.durationSec
            ? ` · ${formatHoursMinutes(log.durationSec)}`
            : ""}
        </div>
      )}
      {isWorkoutKind(routineKind) && (
        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>
          {exerciseSetCount} sets · {log.exercises.length} exercises
        </div>
      )}
      {isGuidedKind(routineKind) && log.durationSec ? (
        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>
          {formatHoursMinutes(log.durationSec)}
        </div>
      ) : null}
      {isSessionKind(routineKind) && log.durationSec ? (
        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>
          {formatHoursMinutes(log.durationSec)}
        </div>
      ) : null}
      {isCompletionKind(routineKind) && log.completionCount ? (
        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>
          Count: {log.completionCount}
        </div>
      ) : null}
    </div>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 18,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
};

const heroActionRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
};

const summaryCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.24)",
  borderRadius: 16,
  padding: 14,
  background: "rgba(128,128,128,0.07)",
  display: "grid",
  gap: 4,
};

const summaryLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.3,
  opacity: 0.7,
};

const summaryValue: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
};

const summaryMeta: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.72,
};

const activityCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.24)",
  borderRadius: 16,
  padding: 14,
  background: "rgba(128,128,128,0.06)",
};

const linkBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.12)",
  fontSize: 13,
};

const primaryLinkBtn: React.CSSProperties = {
  ...linkBtn,
  background: "rgba(84,203,130,0.18)",
  border: "1px solid rgba(84,203,130,0.75)",
};

const miniLinkBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 10px",
  border: "1px solid rgba(128,128,128,0.7)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  background: "rgba(128,128,128,0.12)",
  fontWeight: 800,
  fontSize: 13,
};
