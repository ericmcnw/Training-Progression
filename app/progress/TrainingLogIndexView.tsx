import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { APP_TIME_ZONE, toAppYmd } from "@/lib/dates";
import { effectiveRoutineDomain, domainColor, formatRoutineSubtype } from "@/lib/routines";
import { ProgressShell, SectionCard } from "./ui";

type SearchParams = Record<string, string | string[] | undefined>;

const DOMAIN_ORDER = ["strength", "cardio", "mobility", "sport", "recovery", "habit"] as const;
type Domain = (typeof DOMAIN_ORDER)[number];

const DOMAIN_LABELS: Record<Domain, string> = {
  strength: "Strength",
  cardio: "Cardio",
  mobility: "Mobility",
  sport: "Sport",
  recovery: "Recovery",
  habit: "Habit",
};

function logSummaryLine(log: {
  distanceMi: number | null;
  durationSec: number | null;
  _count: { exercises: number };
  routine: { kind: string | null; subtype: string | null };
}): string {
  const kind = (log.routine.kind ?? "").toUpperCase();
  if (kind === "CARDIO") {
    if (log.distanceMi) return `${log.distanceMi.toFixed(2)} mi`;
    if (log.durationSec) return `${Math.round(log.durationSec / 60)} min`;
    return formatRoutineSubtype(log.routine.subtype) || "Cardio";
  }
  if (kind === "WORKOUT") {
    const n = log._count.exercises;
    return n > 0 ? `${n} exercise${n !== 1 ? "s" : ""}` : "Workout";
  }
  if (kind === "COMPLETION") return "Completed";
  if (kind === "GUIDED") return formatRoutineSubtype(log.routine.subtype) || "Guided";
  return formatRoutineSubtype(log.routine.subtype) || kind.charAt(0) + kind.slice(1).toLowerCase();
}

export default async function TrainingLogIndexView({ searchParams }: { searchParams?: SearchParams }) {
  const rawDomain = ((searchParams?.["domain"] as string | undefined) ?? "").toLowerCase();
  const filterDomain: Domain | "" = (DOMAIN_ORDER as readonly string[]).includes(rawDomain)
    ? (rawDomain as Domain)
    : "";

  const since = new Date();
  since.setDate(since.getDate() - 90);

  const rawLogs = await prisma.routineLog.findMany({
    where: { performedAt: { gte: since } },
    orderBy: { performedAt: "desc" },
    take: 500,
    select: {
      id: true,
      performedAt: true,
      distanceMi: true,
      durationSec: true,
      routine: {
        select: { id: true, name: true, kind: true, subtype: true, domain: true },
      },
      _count: { select: { exercises: true } },
    },
  });

  const logs = rawLogs.map((log) => ({
    ...log,
    domain: effectiveRoutineDomain(log.routine.domain, log.routine.kind, log.routine.subtype) as Domain,
  }));

  // ── Stats ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekSessions = logs.filter((l) => l.performedAt >= weekAgo).length;
  const monthSessions = logs.filter((l) => l.performedAt >= monthStart).length;

  // ── Calendar (current month in app timezone) ───────────────────────────────
  const todayYmd = toAppYmd(now);
  const [calYear, calMonthNum] = todayYmd.split("-").slice(0, 2).map(Number);
  const calMonthIdx = calMonthNum - 1;
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const todayDay = parseInt(todayYmd.split("-")[2], 10);

  const firstOfMonthUTC = new Date(`${calYear}-${String(calMonthNum).padStart(2, "0")}-01T12:00:00Z`);
  const firstDayLabel = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, weekday: "short" }).format(firstOfMonthUTC);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const firstDayOfWeek = dayMap[firstDayLabel] ?? 0;

  const monthLabel = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, month: "long", year: "numeric" }).format(now);

  // Map day-of-month → domains logged that day
  const calDayDomains = new Map<number, Domain[]>();
  for (const log of logs) {
    const ymd = toAppYmd(log.performedAt);
    const [ly, lm, ld] = ymd.split("-").map(Number);
    if (ly === calYear && lm === calMonthNum) {
      const day = ld;
      if (!calDayDomains.has(day)) calDayDomains.set(day, []);
      calDayDomains.get(day)!.push(log.domain);
    }
  }

  // ── Feed (filtered, grouped by date) ──────────────────────────────────────
  const feedLogs = filterDomain ? logs.filter((l) => l.domain === filterDomain) : logs;

  type FeedGroup = { dateKey: string; dateLabel: string; entries: typeof feedLogs };
  const feedGroups: FeedGroup[] = [];
  const fullDateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  for (const log of feedLogs) {
    const key = toAppYmd(log.performedAt);
    const last = feedGroups[feedGroups.length - 1];
    if (last?.dateKey === key) {
      last.entries.push(log);
    } else {
      feedGroups.push({ dateKey: key, dateLabel: fullDateFmt.format(log.performedAt), entries: [log] });
    }
  }

  const domainFilterHref = (d: Domain | "") =>
    d ? `/progress/logs?domain=${d}` : "/progress/logs";

  const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <ProgressShell
      section="logs"
      title="Training Log"
      subtitle="Your full session history — browse by day, filter by training domain."
    >
      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <StatChip label="This Week" value={String(weekSessions)} sub="sessions" />
        <StatChip label="This Month" value={String(monthSessions)} sub="sessions" />
        <StatChip label="Last 90 Days" value={String(logs.length)} sub="sessions" />
      </div>

      {/* ── Calendar ── */}
      <SectionCard title={monthLabel} subtitle="Sessions this month — colored by training domain.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
          {DAY_HEADERS.map((h) => (
            <div key={h} style={{ fontSize: 10, fontWeight: 900, opacity: 0.45, paddingBottom: 6, letterSpacing: 0.5 }}>{h}</div>
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
                  background: isToday ? "rgba(255,255,255,0.08)" : hasSessions ? "rgba(255,255,255,0.03)" : "transparent",
                  border: isToday ? "1px solid rgba(255,255,255,0.18)" : "1px solid transparent",
                  display: "grid",
                  gap: 3,
                  alignItems: "center",
                  justifyItems: "center",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: isToday ? 900 : 700, opacity: isToday ? 1 : hasSessions ? 0.9 : 0.35 }}>{day}</div>
                {hasSessions && (
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                    {domains.slice(0, 4).map((d, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: domainColor(d),
                          flexShrink: 0,
                        }}
                      />
                    ))}
                    {domains.length > 4 && (
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {DOMAIN_ORDER.map((d) => (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: domainColor(d) }} />
              <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>{DOMAIN_LABELS[d]}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Domain filter ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {([["", "All"], ...DOMAIN_ORDER.map((d) => [d, DOMAIN_LABELS[d]])] as [Domain | "", string][]).map(
          ([d, label]) => {
            const active = filterDomain === d;
            return (
              <Link
                key={d || "all"}
                href={domainFilterHref(d)}
                scroll={false}
                style={{
                  padding: "7px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: "none",
                  color: active ? "#fff" : "inherit",
                  background: active
                    ? d
                      ? domainColor(d).replace("0.9)", "0.22)")
                      : "rgba(255,255,255,0.12)"
                    : "rgba(255,255,255,0.05)",
                  border: active
                    ? `1px solid ${d ? domainColor(d).replace("0.9)", "0.38)") : "rgba(255,255,255,0.3)"}`
                    : "1px solid rgba(255,255,255,0.09)",
                }}
              >
                {label}
              </Link>
            );
          }
        )}
      </div>

      {/* ── Feed ── */}
      {feedGroups.length === 0 ? (
        <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 14, opacity: 0.6 }}>
          No sessions logged in the last 90 days{filterDomain ? ` for ${DOMAIN_LABELS[filterDomain]}` : ""}.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {feedGroups.map((group) => (
            <div key={group.dateKey}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", opacity: 0.5, marginBottom: 8 }}>
                {group.dateLabel}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {group.entries.map((log) => {
                  const color = domainColor(log.domain);
                  const summary = logSummaryLine(log);
                  return (
                    <Link
                      key={log.id}
                      href={`/progress/routines/${log.routine.id}?tab=overview&range=4w`}
                      style={{
                        display: "flex",
                        alignItems: "stretch",
                        gap: 0,
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.07)",
                        background: "rgba(255,255,255,0.03)",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div style={{ width: 4, background: color, flexShrink: 0 }} />
                      <div style={{ padding: "10px 12px", flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {log.routine.name}
                          </div>
                          {summary && (
                            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{summary}</div>
                          )}
                        </div>
                        <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: color.replace("0.9)", "0.1)"), border: `1px solid ${color.replace("0.9)", "0.25)")}`, color, whiteSpace: "nowrap" }}>
                          {DOMAIN_LABELS[log.domain]}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </ProgressShell>
  );
}

function StatChip({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", display: "grid", gap: 3 }}>
      <div style={{ fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", opacity: 0.5, fontWeight: 900 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.6 }}>{sub}</div>
    </div>
  );
}
