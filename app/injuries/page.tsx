import Link from "next/link";
import InjuryCard from "@/app/components/injuries/InjuryCard";
import type { PainSparkDay, PainSparkTrend } from "@/app/components/injuries/PainSparkline";
import PageShell from "@/app/components/PageShell";
import { cardSurface, cardTitle, COLOR, RADIUS } from "@/lib/design-tokens";
import { getInjuries } from "./actions";
import { prisma } from "@/lib/prisma";
import { addDaysYmd, toAppYmd, todayAppYmd } from "@/lib/dates";

export const dynamic = "force-dynamic";

const SPARK_DAYS = 30;
// last-7 vs prior-21 split — same window as the sparkline, weighted so a
// recent flare-up beats a baseline established weeks ago.
const TREND_RECENT = 7;
const TREND_PRIOR = 21;

const groups = [
  { key: "needs-attention", title: "Needs attention", statuses: ["ACTIVE", "FLARED"] as const },
  { key: "recovering", title: "Recovering", statuses: ["RECOVERING"] as const },
  { key: "resolved", title: "Resolved", statuses: ["RESOLVED"] as const },
] as const;

type GroupKey = (typeof groups)[number]["key"];

type SparkData = { days: PainSparkDay[]; trend: PainSparkTrend };

function buildSpark(
  zoneIds: Set<string>,
  rows: Array<{ zoneId: string; level: number; loggedAt: Date }>,
  today: string,
): SparkData {
  const dailyPeak = new Map<string, number>();
  for (const row of rows) {
    if (!zoneIds.has(row.zoneId)) continue;
    const ymd = toAppYmd(row.loggedAt);
    const current = dailyPeak.get(ymd) ?? 0;
    if (row.level > current) dailyPeak.set(ymd, row.level);
  }

  const days: PainSparkDay[] = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    const ymd = addDaysYmd(today, -i);
    days.push({ ymd, peak: dailyPeak.has(ymd) ? dailyPeak.get(ymd)! : null });
  }

  const recentSlice = days.slice(-TREND_RECENT).filter((d) => d.peak !== null) as Array<{ ymd: string; peak: number }>;
  const priorSlice = days.slice(-(TREND_RECENT + TREND_PRIOR), -TREND_RECENT).filter((d) => d.peak !== null) as Array<{ ymd: string; peak: number }>;

  const last7avg = recentSlice.length > 0 ? recentSlice.reduce((sum, d) => sum + d.peak, 0) / recentSlice.length : null;
  const prior21avg = priorSlice.length > 0 ? priorSlice.reduce((sum, d) => sum + d.peak, 0) / priorSlice.length : null;

  let direction: PainSparkTrend["direction"] = "unknown";
  let weeklyDelta: number | null = null;
  if (last7avg !== null && prior21avg !== null) {
    const delta = last7avg - prior21avg;
    weeklyDelta = Math.round(delta * 10) / 10;
    if (Math.abs(delta) < 0.4) direction = "steady";
    else if (delta < 0) direction = "improving";
    else direction = "worsening";
  } else if (last7avg !== null && prior21avg === null) {
    // First week of data with no prior baseline — show steady until we have
    // something to compare against rather than flagging it as worsening.
    direction = "steady";
  }

  return { days, trend: { direction, weeklyDelta, last7avg, prior21avg } };
}

export default async function InjuriesPage() {
  const injuries = await getInjuries();

  const allZoneIds = [...new Set(injuries.flatMap((i) => i.zones.map((z) => z.zoneId)))];
  const today = todayAppYmd();
  const sparkFromYmd = addDaysYmd(today, -(SPARK_DAYS - 1));
  const sparkFromDate = new Date(`${sparkFromYmd}T00:00:00Z`);

  // Single bulk query covers both the sparkline strip AND the
  // "most recent log" readout used by the InjuryCard, since the sparkline
  // window is always larger than what we need for that.
  const painRows =
    allZoneIds.length > 0
      ? await prisma.painLog.findMany({
          where: { zoneId: { in: allZoneIds }, loggedAt: { gte: sparkFromDate } },
          orderBy: { loggedAt: "desc" },
          select: { zoneId: true, level: true, loggedAt: true },
        })
      : [];

  const sparkByInjuryId = new Map<string, SparkData>();
  const lastLogByInjuryId = new Map<string, { level: number; loggedAt: string }>();
  for (const injury of injuries) {
    const injZoneIds = new Set(injury.zones.map((z) => z.zoneId));
    const spark = buildSpark(injZoneIds, painRows, today);
    sparkByInjuryId.set(injury.id, spark);
    const mostRecent = painRows.find((row) => injZoneIds.has(row.zoneId));
    if (mostRecent) {
      lastLogByInjuryId.set(injury.id, {
        level: mostRecent.level,
        loggedAt: mostRecent.loggedAt.toISOString(),
      });
    }
  }

  const injuriesByGroup = new Map<GroupKey, typeof injuries>();
  for (const group of groups) {
    injuriesByGroup.set(
      group.key,
      injuries.filter((i) => (group.statuses as readonly string[]).includes(i.status)),
    );
  }

  const totalActive = injuries.filter((i) => i.status === "ACTIVE" || i.status === "FLARED").length;
  const totalRecovering = injuries.filter((i) => i.status === "RECOVERING").length;
  const subtitleBits: string[] = [];
  if (totalActive > 0) subtitleBits.push(`${totalActive} needing attention`);
  if (totalRecovering > 0) subtitleBits.push(`${totalRecovering} recovering`);
  const subtitle = subtitleBits.length > 0
    ? `Currently ${subtitleBits.join(" · ")}. Each card shows the last 30 days of pain.`
    : "Nothing flagged. Log pain on a routine or open an entry if something starts hurting.";

  return (
    <PageShell
      eyebrow="Body"
      title="Injuries"
      subtitle={subtitle}
      toolbar={
        <>
          <Link href="/body/log-pain" style={dangerLinkStyle}>Log pain</Link>
          <Link href="/injuries/new" style={linkStyle}>New injury</Link>
        </>
      }
    >
      {groups.map((group) => {
        const rows = injuriesByGroup.get(group.key) ?? [];
        if (rows.length === 0 && group.key !== "resolved") return null;
        const headerLabel = (
          <span style={groupHeaderRow}>
            <span style={cardTitle}>{group.title}</span>
            {rows.length > 0 && <span style={countBadgeStyle}>{rows.length}</span>}
          </span>
        );
        const content = (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.length === 0 ? (
              <div style={empty}>No {group.title.toLowerCase()} injuries.</div>
            ) : (
              rows.map((injury) => (
                <InjuryCard
                  key={injury.id}
                  injury={injury}
                  lastPainLog={lastLogByInjuryId.get(injury.id) ?? null}
                  sparkline={sparkByInjuryId.get(injury.id) ?? null}
                />
              ))
            )}
          </div>
        );
        return group.key === "resolved" ? (
          <details key={group.key} style={panel}>
            <summary style={summaryStyle}>{headerLabel}</summary>
            <div style={{ marginTop: 12 }}>{content}</div>
          </details>
        ) : (
          <section key={group.key} style={panel}>
            <div style={{ marginBottom: 4 }}>{headerLabel}</div>
            {content}
          </section>
        );
      })}
    </PageShell>
  );
}

const panel: React.CSSProperties = { ...cardSurface, gap: 12 };
const empty: React.CSSProperties = { color: COLOR.textFaint, fontSize: 13 };

const groupHeaderRow: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const countBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 20,
  height: 18,
  padding: "0 6px",
  borderRadius: RADIUS.pill,
  border: `1px solid ${COLOR.borderStrong}`,
  background: "rgba(255,255,255,0.06)",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.3,
  color: COLOR.text,
};

const summaryStyle: React.CSSProperties = {
  cursor: "pointer",
  listStyle: "none",
};

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  minHeight: 36,
  alignItems: "center",
  border: `1px solid ${COLOR.borderStrong}`,
  borderRadius: RADIUS.control,
  padding: "8px 14px",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
};

const dangerLinkStyle: React.CSSProperties = {
  ...linkStyle,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(248,113,113,0.08)",
};
