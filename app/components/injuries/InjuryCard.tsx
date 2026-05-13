import Link from "next/link";
import type { InjuryStatus } from "@/generated/prisma";
import { formatAppDate } from "@/lib/dates";
import PainSparkline, { type PainSparkDay, type PainSparkTrend } from "./PainSparkline";

type Zone = { slug: string; label: string };

export type InjuryCardProps = {
  injury: {
    id: string;
    name: string;
    severity: number;
    status: InjuryStatus;
    startedAt: Date;
    zones: Array<{ zone: Zone }>;
  };
  lastPainLog?: { level: number; loggedAt: string } | null;
  sparkline?: { days: PainSparkDay[]; trend: PainSparkTrend } | null;
};

function painColor(level: number) {
  if (level >= 7) return "#F87171";
  if (level >= 4) return "#FBBF24";
  if (level >= 1) return "#86EFAC";
  return "rgba(255,255,255,0.45)";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

function statusLabel(s: InjuryStatus) {
  if (s === "ACTIVE") return "Active";
  if (s === "FLARED") return "Flared";
  if (s === "RECOVERING") return "Recovering";
  return "Resolved";
}

function statusPillStyle(s: InjuryStatus): React.CSSProperties {
  if (s === "ACTIVE") return { background: "rgba(248,113,113,0.18)", border: "1px solid rgba(248,113,113,0.4)", color: "#FCA5A5" };
  if (s === "FLARED") return { background: "rgba(251,146,60,0.18)", border: "1px solid rgba(251,146,60,0.4)", color: "#FED7AA" };
  if (s === "RECOVERING") return { background: "rgba(96,165,250,0.16)", border: "1px solid rgba(96,165,250,0.35)", color: "#BFDBFE" };
  return { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.6)" };
}

function cardBorder(s: InjuryStatus): React.CSSProperties {
  if (s === "ACTIVE") return { border: "1px solid rgba(248,113,113,0.28)", background: "rgba(248,113,113,0.06)" };
  if (s === "FLARED") return { border: "1px solid rgba(251,146,60,0.28)", background: "rgba(251,146,60,0.06)" };
  if (s === "RECOVERING") return { border: "1px solid rgba(96,165,250,0.2)", background: "rgba(96,165,250,0.04)" };
  return { border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" };
}

export default function InjuryCard({ injury, lastPainLog, sparkline }: InjuryCardProps) {
  const zones: Zone[] = injury.zones.map((z) => z.zone);
  const daysInjured = Math.floor((Date.now() - new Date(injury.startedAt).getTime()) / 86_400_000);

  return (
    <div style={{ ...cardBase, ...cardBorder(injury.status) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 5 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>{injury.name}</span>
            <span style={{ ...pillBase, ...statusPillStyle(injury.status) }}>{statusLabel(injury.status)}</span>
          </div>
          <div style={meta}>
            {"●".repeat(injury.severity)}{"○".repeat(Math.max(0, 5 - injury.severity))}
            {" · "}
            {daysInjured === 0 ? "started today" : `${daysInjured}d`}
            {" · started "}
            {formatAppDate(injury.startedAt, { month: "short", day: "numeric" })}
          </div>
        </div>
        {lastPainLog ? (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 950, lineHeight: 1, color: painColor(lastPainLog.level) }}>
              {lastPainLog.level}
              <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.55 }}>/10</span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.45, fontWeight: 700, marginTop: 2 }}>
              {timeAgo(lastPainLog.loggedAt)}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, opacity: 0.35, fontWeight: 700, flexShrink: 0 }}>no pain logged</div>
        )}
      </div>

      {sparkline && (
        <div style={sparkRow}>
          <span style={sparkLabel}>30d pain</span>
          <PainSparkline days={sparkline.days} trend={sparkline.trend} />
        </div>
      )}

      <div style={tagRow}>
        {zones.map((z) => (
          <span key={z.slug} style={tag}>{z.label}</span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Link href={`/injuries/${injury.id}`} style={detailLink}>
          Details →
        </Link>
      </div>
    </div>
  );
}

const cardBase: React.CSSProperties = {
  borderRadius: 18,
  padding: "14px 16px",
  display: "grid",
  gap: 10,
};

const pillBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  flexShrink: 0,
};

const meta: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.55)",
  fontWeight: 700,
};

const sparkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  paddingTop: 2,
};

const sparkLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
  opacity: 0.45,
  flexShrink: 0,
};

const tagRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const tag: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 999,
  padding: "4px 9px",
  background: "rgba(255,255,255,0.04)",
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,0.75)",
};

const detailLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
  minHeight: 38,
  marginLeft: "auto",
};
