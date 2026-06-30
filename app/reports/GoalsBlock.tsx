import type { CSSProperties } from "react";
import type { GoalInsight } from "@/lib/goals";
import { panel, panelHeader } from "./_ui";

// "Vs your goals" block for the current period. Renders the GoalInsight fields
// the engine already computed (status label + fraction + actual/target),
// matching the status-chip + progress-bar tone used on the progress page's
// ActivityGoalsSection. Returns null when there are no matching goals.
export default function GoalsBlock({ goals }: { goals: GoalInsight[] }) {
  if (goals.length === 0) return null;

  return (
    <section style={panel}>
      <div style={panelHeader}>VS YOUR GOALS</div>
      <div style={{ padding: 14, display: "grid", gap: 10 }}>
        {goals.map((g) => {
          const pct = Math.max(0, Math.min(100, Math.round(g.fractionComplete * 100)));
          const tone = statusTone(g.timeframeStatusLabel, g.isAchieved);
          return (
            <div key={g.goal.id} style={row}>
              <div style={topLine}>
                <span style={name}>{g.goal.name}</span>
                <span style={{ ...chip, color: tone, borderColor: tone, background: chipBg(tone) }}>
                  {g.isAchieved ? "✓ " : ""}{g.timeframeStatusLabel}
                </span>
              </div>
              <div style={barTrack}>
                <div style={{ ...barFill, width: `${pct}%`, background: tone }} />
              </div>
              <div style={metaLine}>
                <span>
                  {g.actualDisplay} / {g.targetDisplay}
                  {g.metricLabel ? ` · ${g.metricLabel}` : ""}
                </span>
                <span style={{ opacity: 0.6 }}>{g.timeframeWindowLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function statusTone(label: string, achieved: boolean): string {
  if (achieved) return GREEN;
  const l = label.toLowerCase();
  if (l.includes("done") || l.includes("achiev") || l.includes("hit")) return GREEN;
  if (l.includes("ahead")) return LIGHT_GREEN;
  if (l.includes("track") || l.includes("pace")) return SKY;
  if (l.includes("behind") || l.includes("risk")) return AMBER;
  return GRAY;
}

const GREEN = "rgba(74,222,128,0.95)";
const LIGHT_GREEN = "rgba(134,239,172,0.95)";
const SKY = "rgba(96,165,250,0.95)";
const AMBER = "rgba(251,191,36,0.95)";
const GRAY = "rgba(255,255,255,0.5)";

function chipBg(tone: string): string {
  return tone.replace(/0\.95\)$/, "0.14)");
}

const row: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
};

const topLine: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const name: CSSProperties = {
  fontSize: 13.5,
  fontWeight: 800,
  color: "rgba(255,255,255,0.95)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};

const chip: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: 0.3,
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const barTrack: CSSProperties = {
  width: "100%",
  height: 6,
  borderRadius: 999,
  background: "rgba(255,255,255,0.07)",
  overflow: "hidden",
};

const barFill: CSSProperties = { height: "100%", borderRadius: 999 };

const metaLine: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  fontSize: 11.5,
  fontWeight: 700,
  color: "rgba(255,255,255,0.75)",
};
