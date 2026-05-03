import type React from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate } from "@/lib/dates";

function painColor(level: number) {
  if (level >= 7) return "#F87171";
  if (level >= 4) return "#FBBF24";
  if (level >= 1) return "#86EFAC";
  return "rgba(255,255,255,0.45)";
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

function statusLabel(s: string) {
  if (s === "ACTIVE") return "Active";
  if (s === "FLARED") return "Flared";
  if (s === "RECOVERING") return "Recovering";
  return s.toLowerCase();
}

function statusPill(s: string): React.CSSProperties {
  if (s === "ACTIVE") return { background: "rgba(248,113,113,0.18)", border: "1px solid rgba(248,113,113,0.4)", color: "#FCA5A5" };
  if (s === "FLARED") return { background: "rgba(251,146,60,0.18)", border: "1px solid rgba(251,146,60,0.4)", color: "#FED7AA" };
  if (s === "RECOVERING") return { background: "rgba(96,165,250,0.16)", border: "1px solid rgba(96,165,250,0.35)", color: "#BFDBFE" };
  return { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" };
}

export default async function DashboardInjuries() {
  const injuries = await prisma.activeInjury.findMany({
    where: { status: { in: ["ACTIVE", "FLARED", "RECOVERING"] } },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    include: { zones: { include: { zone: { select: { slug: true, label: true } } }, orderBy: { zone: { sortOrder: "asc" } } } },
  });

  if (injuries.length === 0) return null;

  const allZoneIds = [...new Set(injuries.flatMap((i) => i.zones.map((z) => z.zoneId)))];
  const recentLogs = await prisma.painLog.findMany({
    where: { zoneId: { in: allZoneIds } },
    orderBy: { loggedAt: "desc" },
    take: 300,
    select: { zoneId: true, level: true, loggedAt: true },
  });

  const lastLogByInjuryId = new Map<string, { level: number; loggedAt: Date }>();
  for (const inj of injuries) {
    if (lastLogByInjuryId.has(inj.id)) continue;
    const injZoneIds = new Set(inj.zones.map((z) => z.zoneId));
    const match = recentLogs.find((l) => injZoneIds.has(l.zoneId));
    if (match) lastLogByInjuryId.set(inj.id, match);
  }

  const activeCount = injuries.filter((i) => i.status === "ACTIVE" || i.status === "FLARED").length;

  return (
    <section style={panel}>
      {/* Header */}
      <div style={header}>
        <div>
          <div style={title}>INJURIES</div>
          <div style={subtitle}>
            {activeCount > 0 ? `${activeCount} active` : `${injuries.length} recovering`}
            {injuries.length > activeCount && activeCount > 0 ? ` · ${injuries.length - activeCount} recovering` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/body/log-pain" style={logPainLink}>Log pain</Link>
          <Link href="/injuries" style={allLink}>All →</Link>
        </div>
      </div>

      {/* Injury rows */}
      <div style={body}>
        {injuries.map((inj) => {
          const lastLog = lastLogByInjuryId.get(inj.id);
          const daysInjured = Math.floor((Date.now() - inj.startedAt.getTime()) / 86_400_000);
          const zoneLabels = inj.zones.map((z) => z.zone.label).join(" · ");

          return (
            <Link key={inj.id} href={`/injuries/${inj.id}`} style={injuryRow(inj.status)}>
              {/* Left: name + meta */}
              <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
                <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.2 }}>{inj.name}</span>
                  <span style={{ ...pillBase, ...statusPill(inj.status) }}>{statusLabel(inj.status)}</span>
                </div>
                <div style={rowMeta}>
                  {zoneLabels}
                  {" · "}
                  {daysInjured === 0 ? "started today" : `${daysInjured}d · since ${formatAppDate(inj.startedAt, { month: "short", day: "numeric" })}`}
                </div>
              </div>

              {/* Right: pain level */}
              {lastLog ? (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1, color: painColor(lastLog.level) }}>
                    {lastLog.level}
                    <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.55 }}>/10</span>
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.45, fontWeight: 700, marginTop: 2 }}>{timeAgo(lastLog.loggedAt)}</div>
                </div>
              ) : (
                <div style={{ fontSize: 11, opacity: 0.3, fontWeight: 700, flexShrink: 0 }}>no logs</div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  borderRadius: 20,
  overflow: "hidden",
  border: "1px solid rgba(248,113,113,0.18)",
  background: "linear-gradient(180deg, rgba(30,14,14,0.7), rgba(13,19,31,0.92))",
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
};

const header: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(248,113,113,0.05)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const title: React.CSSProperties = { fontSize: 12, fontWeight: 900, letterSpacing: 1, color: "rgba(252,165,165,0.9)" };
const subtitle: React.CSSProperties = { marginTop: 3, fontSize: 12, opacity: 0.58 };

const body: React.CSSProperties = { padding: "10px 14px", display: "grid", gap: 6 };

const logPainLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 32,
  padding: "6px 11px",
  borderRadius: 8,
  border: "1px solid rgba(248,113,113,0.4)",
  background: "rgba(248,113,113,0.12)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const allLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 32,
  padding: "6px 11px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};

const pillBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.3,
  flexShrink: 0,
};

const rowMeta: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.45)",
  fontWeight: 700,
  lineHeight: 1.4,
};

function injuryRow(status: string): React.CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 14,
    border: status === "ACTIVE" || status === "FLARED"
      ? "1px solid rgba(248,113,113,0.15)"
      : "1px solid rgba(255,255,255,0.06)",
    background: status === "ACTIVE" || status === "FLARED"
      ? "rgba(248,113,113,0.05)"
      : "rgba(255,255,255,0.025)",
    color: "inherit",
    textDecoration: "none",
    transition: "background 0.15s",
  };
}
