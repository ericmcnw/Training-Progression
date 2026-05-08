import Link from "next/link";
import type { GoalInsight } from "@/lib/goals";
import { SectionCard } from "@/app/progress/ui";

const ACCENT_RGB = "139,92,246"; // violet — distinct from the four pulse cards

function statusTone(insight: GoalInsight): { label: string; tone: "done" | "good" | "warn" | "neutral" } {
  if (insight.isAchieved) return { label: "Done", tone: "done" };
  if (!insight.hasData) return { label: "No data yet", tone: "neutral" };
  // The goal infrastructure already encodes pace via timeframeStatusLabel
  // ("On track", "Behind", etc.) — surface it directly.
  const lower = insight.timeframeStatusLabel.toLowerCase();
  if (lower.includes("behind") || lower.includes("off")) return { label: insight.timeframeStatusLabel, tone: "warn" };
  if (lower.includes("ahead") || lower.includes("on track")) return { label: insight.timeframeStatusLabel, tone: "good" };
  return { label: insight.timeframeStatusLabel, tone: "neutral" };
}

function toneStyle(tone: "done" | "good" | "warn" | "neutral") {
  if (tone === "done") {
    return {
      color: "rgba(74,222,128,0.95)",
      bg: "rgba(74,222,128,0.10)",
      border: "rgba(74,222,128,0.32)",
    };
  }
  if (tone === "good") {
    return {
      color: "rgba(134,239,172,0.95)",
      bg: "rgba(74,222,128,0.08)",
      border: "rgba(74,222,128,0.22)",
    };
  }
  if (tone === "warn") {
    return {
      color: "rgba(251,191,36,0.95)",
      bg: "rgba(251,191,36,0.10)",
      border: "rgba(251,191,36,0.30)",
    };
  }
  return {
    color: "rgba(255,255,255,0.55)",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.10)",
  };
}

function ProgressBar({ fraction, achieved }: { fraction: number; achieved: boolean }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const fill = achieved
    ? "linear-gradient(90deg, rgba(74,222,128,0.85), rgba(34,197,94,0.95))"
    : `linear-gradient(90deg, rgba(${ACCENT_RGB},0.65), rgba(${ACCENT_RGB},0.95))`;
  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${clamped * 100}%`,
          borderRadius: 999,
          background: fill,
          transition: "width 200ms ease",
        }}
      />
    </div>
  );
}

function GoalCard({ insight }: { insight: GoalInsight }) {
  const status = statusTone(insight);
  const tone = toneStyle(status.tone);

  return (
    <Link
      href={insight.detailHref ?? "/goals"}
      style={{
        display: "grid",
        gap: 10,
        padding: "14px 16px",
        borderRadius: 14,
        border: `1px solid rgba(${ACCENT_RGB},0.20)`,
        background: `radial-gradient(circle at top left, rgba(${ACCENT_RGB},0.10), transparent 55%), linear-gradient(180deg, rgba(${ACCENT_RGB},0.04), rgba(255,255,255,0.02))`,
        color: "inherit",
        textDecoration: "none",
        transition: "border-color 120ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>{insight.goal.name}</span>
          <span style={{ fontSize: 11, opacity: 0.65, fontWeight: 700, lineHeight: 1.3 }}>
            {insight.goalTypeLabel} · {insight.targetLabel}
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: "3px 8px",
            borderRadius: 999,
            border: `1px solid ${tone.border}`,
            background: tone.bg,
            color: tone.color,
            letterSpacing: 0.4,
            whiteSpace: "nowrap",
            textTransform: "uppercase",
          }}
        >
          {status.label}
        </span>
      </div>

      <ProgressBar fraction={insight.fractionComplete} achieved={insight.isAchieved} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 12 }}>
        <span style={{ opacity: 0.85 }}>
          <span style={{ fontWeight: 900 }}>{insight.actualDisplay}</span>
          <span style={{ opacity: 0.6 }}> / {insight.targetDisplay}</span>
          <span style={{ opacity: 0.55, fontWeight: 700 }}> · {insight.metricLabel}</span>
        </span>
        <span style={{ opacity: 0.55, fontWeight: 700 }}>{insight.timeframeWindowLabel}</span>
      </div>
    </Link>
  );
}

function EmptyGoalsState({ activityLabel }: { activitySlug: string; activityLabel: string }) {
  // Goal creation lives at /goals?mode=new — the form doesn't currently
  // accept prefill query params, so we just send the user there and let them
  // pick a climbing routine or group target.
  const newHref = `/goals?mode=new`;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "14px 16px",
        borderRadius: 14,
        border: "1px dashed rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.78, lineHeight: 1.4 }}>
        No active {activityLabel.toLowerCase()} goals yet.
      </div>
      <Link
        href={newHref}
        style={{
          fontSize: 12,
          fontWeight: 800,
          padding: "7px 12px",
          borderRadius: 9,
          border: `1px solid rgba(${ACCENT_RGB},0.32)`,
          background: `rgba(${ACCENT_RGB},0.10)`,
          color: `rgba(${ACCENT_RGB},0.95)`,
          textDecoration: "none",
          letterSpacing: 0.3,
          whiteSpace: "nowrap",
        }}
      >
        + Set a goal
      </Link>
    </div>
  );
}

export default function ActivityGoalsSection({
  goals,
  activitySlug,
  activityLabel,
  showWhenEmpty = true,
}: {
  goals: GoalInsight[];
  activitySlug: string;
  activityLabel: string;
  showWhenEmpty?: boolean;
}) {
  if (goals.length === 0 && !showWhenEmpty) return null;

  // Surface "behind" goals first so what needs attention bubbles up. Achieved
  // goals sink to the bottom — they're celebratory but not actionable.
  const sortedGoals = [...goals].sort((left, right) => {
    if (left.isAchieved !== right.isAchieved) return left.isAchieved ? 1 : -1;
    return left.fractionComplete - right.fractionComplete;
  });

  return (
    <SectionCard
      title="Active Goals"
      subtitle={
        goals.length === 0
          ? `Targets you've set for ${activityLabel.toLowerCase()}.`
          : `${goals.length} active ${goals.length === 1 ? "goal" : "goals"} pointing at ${activityLabel.toLowerCase()}.`
      }
      actions={
        goals.length > 0 ? (
          <Link
            href="/goals"
            style={{
              fontSize: 12,
              fontWeight: 800,
              opacity: 0.75,
              textDecoration: "none",
              color: "inherit",
              padding: "4px 9px",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            All goals
          </Link>
        ) : undefined
      }
    >
      {goals.length === 0 ? (
        <EmptyGoalsState activitySlug={activitySlug} activityLabel={activityLabel} />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sortedGoals.map((insight) => (
            <GoalCard key={insight.goal.id} insight={insight} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
