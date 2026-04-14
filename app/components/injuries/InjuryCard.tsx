import Link from "next/link";
import type { InjuryStatus } from "@/generated/prisma";
import { formatAppDate } from "@/lib/dates";

type InjuryCardProps = {
  injury: {
    id: string;
    name: string;
    severity: number;
    status: InjuryStatus;
    startedAt: Date;
    zones: Array<{ zone: { slug: string; label: string } }>;
  };
};

export default function InjuryCard({ injury }: InjuryCardProps) {
  return (
    <Link href={`/injuries/${injury.id}`} style={cardStyle(injury.status)}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{injury.name}</div>
          <div style={statusPill}>{injury.status.toLowerCase()}</div>
        </div>
        <div style={muted}>
          Severity {"●".repeat(injury.severity)}
          {"○".repeat(Math.max(0, 5 - injury.severity))} · started{" "}
          {formatAppDate(injury.startedAt, { month: "short", day: "numeric", year: "numeric" })}
        </div>
        <div style={tagRow}>
          {injury.zones.map((entry) => (
            <span key={entry.zone.slug} style={tag}>
              {entry.zone.label}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function cardStyle(status: InjuryStatus): React.CSSProperties {
  const active = status === "ACTIVE" || status === "FLARED";
  const recovering = status === "RECOVERING";
  return {
    display: "block",
    borderRadius: 16,
    border: active ? "1px solid rgba(248,113,113,0.28)" : recovering ? "1px solid rgba(252,211,77,0.28)" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(248,113,113,0.08)" : recovering ? "rgba(252,211,77,0.08)" : "rgba(255,255,255,0.04)",
    color: "inherit",
    textDecoration: "none",
    padding: 14,
  };
}

const muted: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.68)",
};

const statusPill: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "capitalize",
};

const tagRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const tag: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 999,
  padding: "4px 8px",
  background: "rgba(255,255,255,0.04)",
  fontSize: 11,
  fontWeight: 800,
};
