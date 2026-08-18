import Link from "next/link";
import { formatAppDate } from "@/lib/dates";
import { domainColor } from "@/lib/routines";
import type { ProfileStats } from "@/lib/profile-stats";
import type { ProfileIdentity } from "@/lib/profile-identity";

const DOMAIN_LABELS: Record<string, string> = {
  strength: "Strength",
  cardio: "Endurance",
  mobility: "Mobility",
  sport: "Sport",
  lifestyle: "Lifestyle",
};

// Athlete card — the identity anchor of the Profile page. Avatar + lifetime
// totals + a per-domain composition bar. Name/avatar are placeholders until
// auth lands; the numbers are real from day one.
export default function ProfileHeader({
  stats,
  identity,
}: {
  stats: ProfileStats;
  identity?: ProfileIdentity;
}) {
  const totalSplit = stats.domainSplit.reduce((sum, d) => sum + d.count, 0);
  const since = stats.firstLogDate
    ? formatAppDate(stats.firstLogDate, { month: "long", year: "numeric" })
    : null;
  const avatarEmoji = identity?.avatarEmoji || "🏔";
  const avatarBg = identity?.avatarColor || "rgba(255,255,255,0.06)";
  const displayName = identity?.displayName || "Your Training";

  const topStats: Array<{ label: string; value: string }> = [
    { label: "Sessions", value: stats.totalSessions.toLocaleString() },
    { label: "Active days", value: stats.activeDays.toLocaleString() },
    { label: "Hours", value: stats.totalHours.toLocaleString() },
    {
      label: "Streak",
      value: stats.currentStreak > 0 ? `${stats.currentStreak}d` : "—",
    },
  ];

  return (
    <div style={cardStyle}>
      <div style={topRowStyle}>
        <div style={{ ...avatarStyle, background: avatarBg }} aria-hidden>
          {avatarEmoji}
        </div>
        <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <div style={titleStyle}>{displayName}</div>
          <div style={subtitleStyle}>
            {since ? `Tracking since ${since}` : "Log a session to start tracking"}
            {stats.longestStreak > 0 ? ` · Best streak ${stats.longestStreak}d` : ""}
          </div>
        </div>
      </div>

      <div style={statRowStyle}>
        {topStats.map((s) => (
          <div key={s.label} style={statCellStyle}>
            <div style={statValueStyle}>{s.value}</div>
            <div style={statLabelStyle}>{s.label}</div>
          </div>
        ))}
      </div>

      {totalSplit > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={splitBarStyle}>
            {stats.domainSplit.map((d) => (
              <div
                key={d.domain}
                title={`${DOMAIN_LABELS[d.domain] ?? d.domain}: ${d.count}`}
                style={{
                  flex: d.count,
                  background: domainColor(d.domain),
                  minWidth: 3,
                }}
              />
            ))}
          </div>
          <div style={legendRowStyle}>
            {stats.domainSplit.map((d) => {
              const pct = Math.round((d.count / totalSplit) * 100);
              return (
                <Link
                  key={d.domain}
                  href={`/profile/history?domain=${d.domain}`}
                  style={{ ...legendItemStyle, textDecoration: "none", color: "inherit" }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: domainColor(d.domain),
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 800 }}>{DOMAIN_LABELS[d.domain] ?? d.domain}</span>
                  <span style={{ opacity: 0.55 }}>{pct}%</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 18,
  padding: 18,
  background: "linear-gradient(180deg, rgba(128,128,128,0.14), rgba(128,128,128,0.05))",
  display: "grid",
  gap: 16,
};

const topRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const avatarStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 26,
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: -0.3,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12.5,
  opacity: 0.7,
  fontWeight: 600,
};

const statRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
};

const statCellStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "10px 8px",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 2,
  justifyItems: "center",
  textAlign: "center",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.6,
};

const splitBarStyle: React.CSSProperties = {
  display: "flex",
  height: 12,
  borderRadius: 999,
  overflow: "hidden",
  background: "rgba(255,255,255,0.04)",
};

const legendRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const legendItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11,
};
