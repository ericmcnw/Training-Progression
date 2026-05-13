import Link from "next/link";
import InjuryCard from "@/app/components/injuries/InjuryCard";
import type { PainSparkDay, PainSparkTrend } from "@/app/components/injuries/PainSparkline";
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

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={eyebrow}>Body</div>
          <h1 style={h1}>Injuries</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/body/log-pain" style={{ ...linkStyle, borderColor: "rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.08)" }}>
            Log pain
          </Link>
          <Link href="/injuries/new" style={linkStyle}>
            New injury
          </Link>
        </div>
      </div>

      {groups.map((group) => {
        const rows = injuriesByGroup.get(group.key) ?? [];
        if (rows.length === 0 && group.key !== "resolved") return null;
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
            <summary style={summaryStyle}>{group.title}</summary>
            <div style={{ padding: 14 }}>{content}</div>
          </details>
        ) : (
          <section key={group.key} style={panel}>
            <div style={header}>{group.title}</div>
            <div style={{ padding: 14 }}>{content}</div>
          </section>
        );
      })}
    </main>
  );
}

const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: 1.2, opacity: 0.55, textTransform: "uppercase" };
const h1: React.CSSProperties = { margin: "5px 0 0", fontSize: 32, lineHeight: 1.08 };
const panel: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden", background: "rgba(255,255,255,0.04)" };
const header: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", fontWeight: 900, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", opacity: 0.7 };
const summaryStyle: React.CSSProperties = { ...header, cursor: "pointer" };
const empty: React.CSSProperties = { color: "rgba(255,255,255,0.45)", fontSize: 13 };
const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  minHeight: 38,
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  padding: "8px 14px",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};
