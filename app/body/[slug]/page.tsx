import Link from "next/link";
import { notFound } from "next/navigation";
import BodyMap from "@/app/components/body-map/BodyMap";
import ManualZoneActivityForm from "./_components/ManualZoneActivityForm";
import type { ZoneFreshness } from "@/app/components/body-map/types";
import { getZoneState } from "@/lib/body-zones";
import { addDaysYmd, formatAppDate, formatAppDateTime, formatUtcDateLabel, toAppYmd, todayAppYmd } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

const freshnessLabels: Record<ZoneFreshness, string> = {
  FRESH: "Fresh",
  WORKED_TODAY: "Worked Today",
  RECENTLY_WORKED: "Recently Worked",
  RECOVERING: "Recovering",
  INJURED: "Injured",
};

const badgeColors: Record<ZoneFreshness, React.CSSProperties> = {
  FRESH: { background: "rgba(229,231,235,0.12)", borderColor: "rgba(229,231,235,0.22)", color: "#E5E7EB" },
  WORKED_TODAY: { background: "rgba(67,56,202,0.18)", borderColor: "rgba(129,140,248,0.36)", color: "#C7D2FE" },
  RECENTLY_WORKED: { background: "rgba(37,99,235,0.16)", borderColor: "rgba(96,165,250,0.34)", color: "#BFDBFE" },
  RECOVERING: { background: "rgba(147,197,253,0.16)", borderColor: "rgba(147,197,253,0.34)", color: "#DBEAFE" },
  INJURED: { background: "rgba(225,29,29,0.18)", borderColor: "rgba(255,56,56,0.42)", color: "#FCA5A5" },
};

function relativeDayLabel(ymd: string, today: string) {
  if (ymd === today) return "Today";
  if (ymd === addDaysYmd(today, -1)) return "Yesterday";
  return formatUtcDateLabel(ymd, { weekday: "short", month: "short", day: "numeric" });
}

function sourceLabel(source: string) {
  return source.toLowerCase().replace(/_/g, " ");
}

function contextColor(context: string) {
  switch (context) {
    case "AT_REST":
      return "#F87171";
    case "DURING_ACTIVITY":
      return "#F59E0B";
    case "AFTER_ACTIVITY":
      return "#60A5FA";
    case "MORNING":
      return "#A78BFA";
    default:
      return "#E5E7EB";
  }
}

function PainChart({ logs }: { logs: Array<{ id: string; level: number; loggedAt: Date; context: string }> }) {
  if (logs.length === 0) {
    return <div style={emptyState}>No pain logged for this zone.</div>;
  }

  const sorted = [...logs].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());
  const width = 640;
  const height = 180;
  const pad = 28;
  const minTime = sorted[0].loggedAt.getTime();
  const maxTime = sorted[sorted.length - 1].loggedAt.getTime();
  const span = Math.max(1, maxTime - minTime);
  const point = (entry: (typeof sorted)[number]) => {
    const x = pad + ((entry.loggedAt.getTime() - minTime) / span) * (width - pad * 2);
    const y = pad + (1 - entry.level / 10) * (height - pad * 2);
    return { x, y };
  };
  const path = sorted.map((entry, index) => `${index === 0 ? "M" : "L"} ${point(entry).x.toFixed(1)} ${point(entry).y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Pain history chart">
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgba(255,255,255,0.18)" />
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(255,255,255,0.18)" />
      {[0, 5, 10].map((level) => {
        const y = pad + (1 - level / 10) * (height - pad * 2);
        return (
          <g key={level}>
            <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(255,255,255,0.06)" />
            <text x={8} y={y + 4} fill="rgba(255,255,255,0.62)" fontSize="11">
              {level}
            </text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke="#F87171" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {sorted.map((entry) => {
        const p = point(entry);
        return (
          <g key={entry.id}>
            <title>{`${formatAppDateTime(entry.loggedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}: ${entry.level}/10`}</title>
            <circle cx={p.x} cy={p.y} r="5" fill={contextColor(entry.context)} stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" />
          </g>
        );
      })}
    </svg>
  );
}

export default async function BodyZoneDetailPage(props: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const selectedDay = getParam(searchParams, "day");
  const showManualForm = getParam(searchParams, "manual") === "1";
  const detail = await getZoneState(params.slug);

  if (!detail) notFound();

  const today = todayAppYmd();
  const weekDays = Array.from({ length: 7 }, (_, index) => addDaysYmd(today, index - 6));
  const activityDayCounts = new Map<string, number>();
  for (const activity of detail.recentActivities) {
    const ymd = toAppYmd(activity.performedAt);
    activityDayCounts.set(ymd, (activityDayCounts.get(ymd) ?? 0) + 1);
  }

  const filteredActivities = selectedDay
    ? detail.recentActivities.filter((activity) => toAppYmd(activity.performedAt) === selectedDay)
    : detail.recentActivities;
  const groupedActivities = new Map<string, typeof filteredActivities>();
  for (const activity of filteredActivities) {
    const key = toAppYmd(activity.performedAt);
    groupedActivities.set(key, [...(groupedActivities.get(key) ?? []), activity]);
  }

  const headerDescription =
    detail.activeInjuries.length > 0
      ? `Currently injured since ${formatAppDate(detail.activeInjuries[0].startedAt, { month: "short", day: "numeric", year: "numeric" })}`
      : `This zone has ${detail.activityCount ?? 0} work entr${detail.activityCount === 1 ? "y" : "ies"} in the last 7 days.`;

  return (
    <main style={page}>
      <div style={topRow}>
        <Link href="/" style={secondaryLink}>
          Back to dashboard
        </Link>
        <div style={actionRow}>
          <Link href={`/body/log-pain?zone=${detail.slug}`} style={primaryLink}>
            Log pain here
          </Link>
          <Link href={`/body/${detail.slug}?manual=1`} style={secondaryLink}>
            Log activity
          </Link>
          <Link href={`/injuries/new?zone=${detail.slug}`} style={dangerLink}>
            Mark as injured
          </Link>
        </div>
      </div>

      <section style={heroCard}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={eyebrow}>Body zone</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <h1 style={title}>{detail.zone.label}</h1>
            <span style={{ ...badge, ...badgeColors[detail.freshness] }}>{freshnessLabels[detail.freshness]}</span>
          </div>
          <p style={subtitle}>{headerDescription}</p>
        </div>
        <div style={{ minWidth: 220 }}>
          <BodyMap
            zones={[{ slug: detail.slug, freshness: detail.freshness, painLevel: detail.painLevel, activityCount: detail.activityCount }]}
            selectedSlugs={[detail.slug]}
            view={detail.zone.bodyView === "FRONT" ? "front" : detail.zone.bodyView === "BACK" ? "back" : "both"}
            size="sm"
            showLegend={false}
          />
        </div>
      </section>

      {detail.activeInjuries.length > 0 ? (
        <section style={panel}>
          <div style={panelHeader}>INJURY STATUS</div>
          <div style={panelBody}>
            {detail.activeInjuries.map((injury) => (
              <div key={injury.id} style={injuryCard}>
                <div style={{ display: "grid", gap: 5 }}>
                  <div style={{ fontWeight: 900 }}>{injury.name}</div>
                  <div style={mutedLine}>
                    Severity {"●".repeat(injury.severity)}
                    {"○".repeat(Math.max(0, 5 - injury.severity))} · {injury.status.toLowerCase()} · started{" "}
                    {formatAppDate(injury.startedAt, { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  {injury.notes ? <div style={mutedLine}>{injury.notes}</div> : null}
                </div>
                <Link href={`/injuries/${injury.id}`} style={secondaryLink}>
                  View details
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showManualForm ? <ManualZoneActivityForm zoneSlug={detail.slug} /> : null}

      <section style={panel}>
        <div style={panelHeader}>THIS WEEK</div>
        <div style={panelBody}>
          <div style={weekStrip}>
            {weekDays.map((day) => {
              const count = activityDayCounts.get(day) ?? 0;
              const active = day === selectedDay;
              return (
                <Link key={day} href={active ? `/body/${detail.slug}` : `/body/${detail.slug}?day=${day}`} style={dayCell(active)}>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{relativeDayLabel(day, today)}</span>
                  <span style={dayBubble(count > 0)}>{count > 0 ? count : ""}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div style={contentGrid}>
        <section style={panel}>
          <div style={panelHeader}>WHAT WORKED IT</div>
          <div style={panelBody}>
            {filteredActivities.length === 0 ? <div style={emptyState}>No work entries found for this zone.</div> : null}
            {Array.from(groupedActivities.entries()).map(([day, activities]) => (
              <div key={day} style={activityGroup}>
                <div style={groupTitle}>{relativeDayLabel(day, today)}</div>
                {activities.map((activity) => (
                  <div key={activity.id} style={activityRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 850 }}>{activity.label}</div>
                      <div style={mutedLine}>
                        {formatAppDateTime(activity.performedAt, { hour: "numeric", minute: "2-digit" })}
                        {activity.routineLogId ? ` · session ${activity.routineLogId.slice(0, 6)}` : ""}
                      </div>
                    </div>
                    <div style={pillRow}>
                      <span style={chip}>{sourceLabel(activity.source)}</span>
                      {activity.intensity ? <span style={chip}>{activity.intensity}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section style={panel}>
          <div style={panelHeader}>PAIN HISTORY</div>
          <div style={panelBody}>
            <PainChart logs={detail.painHistory} />
          </div>
        </section>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "4px 0 28px",
  display: "grid",
  gap: 16,
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const heroCard: React.CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(20,29,46,0.9), rgba(13,19,31,0.92))",
  boxShadow: "0 12px 34px rgba(0,0,0,0.16)",
  padding: 18,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 320px)",
  gap: 18,
  alignItems: "center",
};

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  opacity: 0.55,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.05,
};

const subtitle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.55,
  color: "rgba(255,255,255,0.72)",
};

const badge: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
};

const panel: React.CSSProperties = {
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const panelHeader: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const panelBody: React.CSSProperties = {
  padding: 14,
  display: "grid",
  gap: 12,
};

const contentGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.15fr 0.85fr",
  gap: 16,
  alignItems: "start",
};

const injuryCard: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  borderRadius: 14,
  padding: 12,
  border: "1px solid rgba(248,113,113,0.28)",
  background: "rgba(248,113,113,0.08)",
};

const activityGroup: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const groupTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "rgba(255,255,255,0.62)",
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const activityRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  borderRadius: 14,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const mutedLine: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.66)",
  lineHeight: 1.45,
};

const pillRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const chip: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 800,
  background: "rgba(255,255,255,0.05)",
  textTransform: "capitalize",
};

const weekStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 8,
};

function dayCell(active: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: 8,
    justifyItems: "center",
    borderRadius: 12,
    border: active ? "1px solid rgba(84,203,130,0.45)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(84,203,130,0.12)" : "rgba(255,255,255,0.03)",
    color: "inherit",
    textDecoration: "none",
    padding: 10,
    minWidth: 0,
  };
}

function dayBubble(filled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    border: filled ? "1px solid rgba(96,165,250,0.45)" : "1px solid rgba(255,255,255,0.12)",
    background: filled ? "rgba(96,165,250,0.16)" : "rgba(255,255,255,0.02)",
    fontSize: 12,
    fontWeight: 900,
  };
}

const primaryLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(84,203,130,0.35)",
  background: "rgba(84,203,130,0.12)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};

const secondaryLink: React.CSSProperties = {
  ...primaryLink,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
};

const dangerLink: React.CSSProperties = {
  ...primaryLink,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(248,113,113,0.10)",
};

const emptyState: React.CSSProperties = {
  fontSize: 13,
  color: "rgba(255,255,255,0.62)",
};
