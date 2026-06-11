// Pulse strip — at-a-glance momentum row used at the top of every activity
// world. Each card is a labeled headline value with optional sub-line and a
// trend chip (up / down / flat). Climbing has its own inline composition;
// other sports build a PulseSlot[] from family-aware aggregates and render via
// the ActivityPulseStrip wrapper here.
//
// Cards can optionally render in "goal mode" — when an active goal cleanly
// maps to a slot's role, the slot is replaced with goal progress (badge +
// progress bar + click-through to the goal detail page). Default cards still
// render for slots without a matching goal.

import Link from "next/link";

export type PulseTrend = {
  arrow: string;
  tone: "up" | "down" | "flat";
  delta: string;
  suffix?: string;
};

/** Logical role each pulse card plays. Goals override slots by role —
 *  a "Run 3x/wk" frequency goal will replace the default "frequency" card.
 *  When the same role has both a default slot and a goal, the goal wins. */
export type PulseSlotRole = "frequency" | "recent-performance" | "all-time-best" | "streak";

export type PulseSlot = {
  label: string;
  value: string;
  sub?: string;
  trend?: PulseTrend;
  /** "rgba(r,g,b,0.9)" form — derived variants are computed inside PulseCard. */
  accent: string;
  /** What this card represents semantically — used by goal-slot replacement. */
  role?: PulseSlotRole;
  /** When set, the card renders in goal mode: goal badge + progress bar + click-through. */
  goal?: {
    href: string;
    fractionComplete: number;
    isAchieved: boolean;
  };
};

export function PulseCard({ label, value, sub, trend, accent, goal }: PulseSlot) {
  const accentSoft = accent.replace("0.9)", "0.10)");
  const accentBorder = accent.replace("0.9)", goal ? "0.42)" : "0.28)");
  const accentGlow = accent.replace("0.9)", "0.05)");
  const trendColor =
    trend?.tone === "up" ? "rgba(74,222,128,0.95)" : trend?.tone === "down" ? "rgba(251,113,133,0.95)" : "rgba(255,255,255,0.55)";
  const trendBg =
    trend?.tone === "up" ? "rgba(74,222,128,0.10)" : trend?.tone === "down" ? "rgba(251,113,133,0.10)" : "rgba(255,255,255,0.04)";
  const trendBorder =
    trend?.tone === "up" ? "rgba(74,222,128,0.28)" : trend?.tone === "down" ? "rgba(251,113,133,0.28)" : "rgba(255,255,255,0.10)";

  // Condensed sizing (2026-06-11): padding 16/18 → 10/12, value font
  // 32 → 22 max. The cards keep their trend chips / sub-lines / goal
  // progress bars but stop dominating the first mobile screen.
  const baseStyle: React.CSSProperties = {
    flex: "1 1 140px",
    minWidth: 0,
    display: "grid",
    gap: 4,
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${accentBorder}`,
    background: `radial-gradient(circle at top left, ${accentSoft}, transparent 55%), linear-gradient(180deg, ${accentGlow}, rgba(255,255,255,0.02))`,
    position: "relative",
    overflow: "hidden",
    color: "inherit",
    textDecoration: "none",
    transition: "border-color 120ms ease",
  };

  const trendChip = trend ? (
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
  ) : null;

  const inner = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
          {goal ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                padding: "2px 6px",
                borderRadius: 4,
                background: accent.replace("0.9)", "0.18)"),
                color: accent,
                letterSpacing: 0.6,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              GOAL
            </span>
          ) : null}
          <span style={{
            fontSize: 10,
            letterSpacing: 1.1,
            textTransform: "uppercase",
            opacity: 0.6,
            fontWeight: 900,
            minWidth: 0,
            // Goal labels are user-named ("50 LBS WEIGHT GOAL") and were
            // truncating to "50 LBS WE..." on mobile. Allow 2 lines so
            // the whole name reads. Non-goal labels are short app-defined
            // strings ("This week", "Best lift") so wrapping is unlikely.
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.2,
          }}>
            {label}
          </span>
        </div>
        {/* In goal mode, the trend (Behind / On track / Ahead / Done) status drops
            to the bottom row alongside the progress bar — a goal name + GOAL badge
            already crowds the top row, and the progress bar carries the
            "how am I doing" signal more visually anyway. */}
        {!goal && trendChip}
      </div>
      <div
        style={{
          // Auto-scale value font based on string length so long values
          // like "35.0 lb/50.0 lb" don't wrap to 3 lines. Goal cards
          // typically need the smaller size; flat values stay biggest.
          fontSize: value.length > 12 ? 15 : value.length > 8 ? 18 : 22,
          fontWeight: 950,
          lineHeight: 1.05,
          color: accent,
          letterSpacing: -0.4,
          // wrap is allowed if needed but the auto-scale above usually
          // keeps things on one line.
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
      {sub ? <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.35 }}>{sub}</div> : null}
      {goal ? (
        <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
          <div
            style={{
              height: 5,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.max(0, Math.min(1, goal.fractionComplete)) * 100}%`,
                background: goal.isAchieved
                  ? "linear-gradient(90deg, rgba(74,222,128,0.85), rgba(34,197,94,0.95))"
                  : `linear-gradient(90deg, ${accent.replace("0.9)", "0.5)")}, ${accent.replace("0.9)", "0.95)")})`,
                borderRadius: 999,
                transition: "width 200ms ease",
              }}
            />
          </div>
          {trendChip ? <div style={{ alignSelf: "start" }}>{trendChip}</div> : null}
        </div>
      ) : null}
    </>
  );

  if (goal) {
    return (
      <Link href={goal.href} style={baseStyle}>
        {inner}
      </Link>
    );
  }
  return <div style={baseStyle}>{inner}</div>;
}

export default function ActivityPulseStrip({ slots }: { slots: PulseSlot[] }) {
  if (slots.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(136px, 1fr))" }}>
      {slots.map((slot) => (
        <PulseCard key={slot.label} {...slot} />
      ))}
    </div>
  );
}
