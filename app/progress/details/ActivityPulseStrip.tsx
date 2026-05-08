// Pulse strip — at-a-glance momentum row used at the top of every activity
// world. Each card is a labeled headline value with optional sub-line and a
// trend chip (up / down / flat). Climbing has its own inline composition;
// other sports build a PulseSlot[] from family-aware aggregates and render via
// the ActivityPulseStrip wrapper here.

export type PulseTrend = {
  arrow: string;
  tone: "up" | "down" | "flat";
  delta: string;
  suffix?: string;
};

export type PulseSlot = {
  label: string;
  value: string;
  sub?: string;
  trend?: PulseTrend;
  /** "rgba(r,g,b,0.9)" form — derived variants are computed inside PulseCard. */
  accent: string;
};

export function PulseCard({ label, value, sub, trend, accent }: PulseSlot) {
  const accentSoft = accent.replace("0.9)", "0.10)");
  const accentBorder = accent.replace("0.9)", "0.28)");
  const accentGlow = accent.replace("0.9)", "0.05)");
  const trendColor =
    trend?.tone === "up" ? "rgba(74,222,128,0.95)" : trend?.tone === "down" ? "rgba(251,113,133,0.95)" : "rgba(255,255,255,0.55)";
  const trendBg =
    trend?.tone === "up" ? "rgba(74,222,128,0.10)" : trend?.tone === "down" ? "rgba(251,113,133,0.10)" : "rgba(255,255,255,0.04)";
  const trendBorder =
    trend?.tone === "up" ? "rgba(74,222,128,0.28)" : trend?.tone === "down" ? "rgba(251,113,133,0.28)" : "rgba(255,255,255,0.10)";

  return (
    <div
      style={{
        flex: "1 1 160px",
        minWidth: 0,
        display: "grid",
        gap: 6,
        padding: "16px 18px",
        borderRadius: 18,
        border: `1px solid ${accentBorder}`,
        background: `radial-gradient(circle at top left, ${accentSoft}, transparent 55%), linear-gradient(180deg, ${accentGlow}, rgba(255,255,255,0.02))`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase", opacity: 0.6, fontWeight: 900 }}>
          {label}
        </span>
        {trend ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 7px",
              borderRadius: 999,
              border: `1px solid ${trendBorder}`,
              background: trendBg,
              color: trendColor,
              letterSpacing: 0.3,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 11, lineHeight: 1 }}>{trend.arrow}</span>
            {trend.delta}{trend.suffix ?? ""}
          </span>
        ) : null}
      </div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 950,
          lineHeight: 1,
          color: accent,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </div>
      {sub ? <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>{sub}</div> : null}
    </div>
  );
}

export default function ActivityPulseStrip({ slots }: { slots: PulseSlot[] }) {
  if (slots.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
      {slots.map((slot) => (
        <PulseCard key={slot.label} {...slot} />
      ))}
    </div>
  );
}
