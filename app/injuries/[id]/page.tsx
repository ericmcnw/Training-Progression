import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import BodyMap from "@/app/components/body-map/BodyMap";
import InjuryForm from "@/app/components/injuries/InjuryForm";
import QuickInjuryPainLog from "@/app/components/injuries/QuickInjuryPainLog";
import { getInjury, updateInjury } from "../actions";
import InjuryStatusButtons from "./InjuryStatusButtons";
import { prisma } from "@/lib/prisma";
import { formatAppDate, formatAppDateTime, toAppYmd } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Params = { id: string };

const contextLabels: Record<string, string> = {
  AT_REST: "at rest",
  MORNING: "morning",
  AFTER_ACTIVITY: "after activity",
  DURING_ACTIVITY: "during activity",
  GENERAL: "general",
};

const activitySourceLabels: Record<string, string> = {
  EXERCISE: "Workout",
  SPORT_TAG: "Sport",
  MANUAL: "Manual",
};

type ZoneActivityRow = {
  id: string;
  source: string;
  label: string;
  intensity: string | null;
  notes: string | null;
  performedAt: Date;
  routineLogId: string | null;
  zone: { label: string };
  routineLog: { routine: { name: string } } | null;
};

type ActivityGroup = {
  key: string;
  source: string;
  sessionLabel: string;
  performedAt: Date;
  entries: Array<{ label: string; zones: string[] }>;
};

function groupZoneActivities(activities: ZoneActivityRow[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();
  for (const act of activities) {
    const key = act.routineLogId ?? `_${act.id}`;
    if (!groups.has(key)) {
      const sessionLabel =
        act.routineLog?.routine?.name ??
        (act.source === "SPORT_TAG" ? "Sport session" : act.source === "MANUAL" ? "Manual entry" : "Workout");
      groups.set(key, { key, source: act.source, sessionLabel, performedAt: act.performedAt, entries: [] });
    }
    const group = groups.get(key)!;
    const existing = group.entries.find((e) => e.label === act.label);
    if (existing) {
      if (!existing.zones.includes(act.zone.label)) existing.zones.push(act.zone.label);
    } else {
      group.entries.push({ label: act.label, zones: [act.zone.label] });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime());
}

function sourceStyle(source: string): React.CSSProperties {
  if (source === "EXERCISE") return { background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", color: "#93C5FD" };
  if (source === "SPORT_TAG") return { background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#6EE7B7" };
  return { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" };
}

function painColor(level: number): string {
  if (level >= 8) return "#F87171";
  if (level >= 5) return "#FBBF24";
  if (level >= 3) return "#A3E635";
  return "rgba(255,255,255,0.55)";
}

function PainBar({ level }: { level: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${level * 10}%`, height: "100%", borderRadius: 4, background: painColor(level), transition: "width 0.2s" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 900, color: painColor(level), minWidth: 32, textAlign: "right" }}>{level}/10</span>
    </div>
  );
}

export default async function InjuryDetailPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const injury = await getInjury(params.id);
  if (!injury) notFound();

  const zoneIds = injury.zones.map((entry) => entry.zoneId);
  const zoneSlugs = injury.zones.map((entry) => entry.zone.slug);
  const painZones = injury.zones.map((entry) => ({ slug: entry.zone.slug, label: entry.zone.label }));

  const [zones, painLogs, zoneActivities] = await Promise.all([
    prisma.bodyZone.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { slug: true, label: true } }),
    prisma.painLog.findMany({
      where: {
        zoneId: { in: zoneIds },
        loggedAt: { gte: injury.startedAt },
      },
      orderBy: { loggedAt: "desc" },
      include: {
        zone: { select: { label: true, slug: true } },
        routineLog: { select: { id: true, routine: { select: { name: true } } } },
      },
    }),
    prisma.zoneActivity.findMany({
      where: {
        zoneId: { in: zoneIds },
        performedAt: { gte: injury.startedAt },
      },
      orderBy: { performedAt: "desc" },
      take: 50,
      include: {
        zone: { select: { label: true } },
        routineLog: { select: { routine: { select: { name: true } } } },
      },
    }),
  ]);

  const recentPainLevel = painLogs.length > 0 ? painLogs[0].level : null;
  const avgPainLevel =
    painLogs.length > 0
      ? Math.round((painLogs.reduce((sum, l) => sum + l.level, 0) / painLogs.length) * 10) / 10
      : null;

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", display: "grid", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={eyebrow}>Injury</div>
          <h1 style={h1}>{injury.name}</h1>
          <div style={muted}>
            {injury.status.toLowerCase()} · severity {injury.severity}/5 · started{" "}
            {formatAppDate(injury.startedAt, { month: "short", day: "numeric", year: "numeric" })}
          </div>
        </div>
        <Link href="/injuries" style={linkStyle}>
          Back
        </Link>
      </div>

      {/* Body map + status */}
      <section style={panel}>
        <BodyMap
          zones={zoneSlugs.map((slug) => ({ slug, freshness: injury.status === "RESOLVED" ? "RECOVERING" : "INJURED" }))}
          selectedSlugs={zoneSlugs}
          size="md"
        />
        {injury.notes ? <div style={muted}>{injury.notes}</div> : null}
        <InjuryStatusButtons id={injury.id} />
      </section>

      {/* Pain stats + quick log */}
      {injury.status !== "RESOLVED" && (
        <section style={panel}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {recentPainLevel !== null && (
              <div>
                <div style={statLabel}>Most recent</div>
                <div style={{ ...statValue, color: painColor(recentPainLevel) }}>{recentPainLevel}/10</div>
              </div>
            )}
            {avgPainLevel !== null && (
              <div>
                <div style={statLabel}>Avg pain ({painLogs.length} logs)</div>
                <div style={{ ...statValue, color: painColor(avgPainLevel) }}>{avgPainLevel}/10</div>
              </div>
            )}
          </div>
          <QuickInjuryPainLog zones={painZones} />
        </section>
      )}

      {/* Pain history */}
      <section style={panel}>
        <div style={sectionTitle}>Pain history</div>
        {painLogs.length === 0 ? (
          <div style={muted}>No pain logs since this injury started.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {painLogs.map((log) => (
              <div key={log.id} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{log.zone.label}</span>
                    <span style={{ fontSize: 12, opacity: 0.55, fontWeight: 700 }}>
                      {contextLabels[log.context] ?? log.context}
                    </span>
                    {log.routineLog?.routine && (
                      <span style={{ fontSize: 12, opacity: 0.55, fontWeight: 700 }}>· {log.routineLog.routine.name}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                    {formatAppDateTime(log.loggedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                  {log.notes ? (
                    <div style={{ fontSize: 13, marginTop: 5, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", lineHeight: 1.45 }}>
                      {log.notes}
                    </div>
                  ) : null}
                </div>
                <div style={{ minWidth: 120 }}>
                  <PainBar level={log.level} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Training history on affected zones */}
      <section style={panel}>
        <div style={sectionTitle}>Training load on affected zones</div>
        {zoneActivities.length === 0 ? (
          <div style={muted}>No training activity logged for these zones since this injury started.</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {groupZoneActivities(zoneActivities).map((group) => (
              <div key={group.key} style={sessionCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    <span style={{ fontWeight: 900, fontSize: 13 }}>{group.sessionLabel}</span>
                    <span style={{ ...sourcePill, ...sourceStyle(group.source) }}>
                      {activitySourceLabels[group.source] ?? group.source}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, opacity: 0.4, flexShrink: 0 }}>
                    {formatAppDate(group.performedAt, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {group.entries.map((entry, i) => (
                    <span key={i} style={exerciseChip} title={entry.zones.join(", ")}>
                      {entry.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit form */}
      <section style={panel}>
        <div style={sectionTitle}>Edit</div>
        <InjuryForm
          zones={zones}
          submitLabel="Save injury"
          action={updateInjury.bind(null, injury.id)}
          initial={{
            id: injury.id,
            name: injury.name,
            severity: injury.severity,
            status: injury.status,
            startedAt: toAppYmd(injury.startedAt),
            resolvedAt: injury.resolvedAt ? toAppYmd(injury.resolvedAt) : "",
            notes: injury.notes ?? "",
            zoneSlugs,
          }}
        />
      </section>
    </main>
  );
}

const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: 1.2, opacity: 0.55, textTransform: "uppercase" };
const h1: React.CSSProperties = { margin: "5px 0 0", fontSize: 32, lineHeight: 1.08 };
const panel: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, background: "rgba(255,255,255,0.04)", padding: 14, display: "grid", gap: 14 };
const sectionTitle: React.CSSProperties = { fontSize: 12, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", opacity: 0.7 };
const muted: React.CSSProperties = { fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 1.45 };
const row: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)" };
const statLabel: React.CSSProperties = { fontSize: 11, fontWeight: 800, opacity: 0.5, letterSpacing: 0.5, textTransform: "uppercase" };
const statValue: React.CSSProperties = { fontSize: 26, fontWeight: 900, lineHeight: 1.1, marginTop: 2 };
const sourcePill: React.CSSProperties = { fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 6, flexShrink: 0 };
const sessionCard: React.CSSProperties = { borderLeft: "2px solid rgba(255,255,255,0.1)", paddingLeft: 12, display: "grid", gap: 7 };
const exerciseChip: React.CSSProperties = { fontSize: 12, fontWeight: 700, padding: "4px 9px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1.4, cursor: "default" };
const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  minHeight: 38,
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 8,
  padding: "8px 12px",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};
