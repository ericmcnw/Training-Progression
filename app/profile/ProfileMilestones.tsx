import type { Milestone } from "@/lib/profile-stats";

// Personal bests + lifetime records. Only milestones backed by real data are
// passed in (loadProfileStats filters empties), so an early user sees a small
// honest set rather than a wall of dashes. Room to grow as more metrics land.
export default function ProfileMilestones({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return (
      <div style={emptyStyle}>
        Log climbs, runs, or lifts and your personal bests show up here.
      </div>
    );
  }

  return (
    <div style={gridStyle}>
      {milestones.map((m) => (
        <div key={m.key} style={cellStyle}>
          <div style={labelStyle}>{m.label}</div>
          <div style={{ ...valueStyle, color: m.accent ?? "inherit" }}>{m.value}</div>
          {m.sub ? <div style={subStyle}>{m.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
  gap: 8,
};

const cellStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12,
  padding: "12px 12px",
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 3,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.6,
};

const valueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1.1,
};

const subStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.62,
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.6,
  padding: "8px 2px",
};
