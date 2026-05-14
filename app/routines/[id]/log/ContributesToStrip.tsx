// Banner above any log form showing what frequency goals this log will
// contribute to. Each pill: goal name, cadence, current progress, and a small
// preview of what one more log does ("→ 4/4 ✓" or "→ 3/4").
//
// Pure presentational — server-side data is fetched in the page and passed
// in. Hides itself when the routine has no frequency-goal memberships, so
// routines that aren't part of any goal pay no UI cost.

import type { CSSProperties } from "react";
import Link from "next/link";
import type { RoutineGoalContribution } from "@/lib/routine-frequency-context";

export default function ContributesToStrip({
  contributions,
}: {
  contributions: RoutineGoalContribution[];
}) {
  if (contributions.length === 0) return null;

  return (
    <div style={shell}>
      <div style={label}>Contributes to</div>
      <div style={pillRow}>
        {contributions.map((c) => (
          <ContributionPill key={c.goalId} contribution={c} />
        ))}
      </div>
    </div>
  );
}

function ContributionPill({ contribution }: { contribution: RoutineGoalContribution }) {
  const { goalId, goalName, role, isGroup, cadenceLabel, progress, target, hitToday } = contribution;
  // After this log lands, what does the count become? hitToday means today
  // already counted toward this goal — extra logs don't bump the day-counter
  // again (one log per day per goal). So projected = current.
  const projected = hitToday ? progress : Math.min(target, progress + 1);
  const willHit = projected >= target && progress < target;

  const tone = role === "SUBSTITUTE" ? toneSubstitute : willHit ? toneAchieving : toneInProgress;
  const href = `/goals/${encodeURIComponent(goalId.startsWith("fg_") || goalId.startsWith("group-frequency:") ? goalId : `group-frequency:${goalId}`)}`;

  return (
    <Link href={href} style={{ ...pill, ...tone.pillStyle }}>
      <span style={pillNameRow}>
        <span style={pillName}>{goalName}</span>
        {isGroup ? <span style={{ ...pillBadge, ...tone.badgeStyle }}>group</span> : null}
        {role === "SUBSTITUTE" ? (
          <span style={{ ...pillBadge, ...tone.badgeStyle }}>covers</span>
        ) : null}
      </span>
      <span style={pillCadenceRow}>
        <span style={pillCadence}>{cadenceLabel}</span>
        <span style={pillProgress}>
          <span style={{ ...progressNum, color: tone.numberColor }}>{progress}</span>
          <span style={progressSep}>/</span>
          <span style={progressTarget}>{target}</span>
          {!hitToday ? (
            <span style={{ ...projectionArrow, color: tone.numberColor }}>
              {willHit ? " → ✓" : ` → ${projected}`}
            </span>
          ) : (
            <span style={alreadyHitMark}>✓</span>
          )}
        </span>
      </span>
    </Link>
  );
}

const toneInProgress = {
  pillStyle: {
    borderColor: "rgba(132,204,255,0.45)",
    background: "rgba(132,204,255,0.05)",
  } as CSSProperties,
  badgeStyle: {
    background: "rgba(132,204,255,0.14)",
    borderColor: "rgba(132,204,255,0.4)",
    color: "rgba(199,228,255,1)",
  } as CSSProperties,
  numberColor: "rgba(132,204,255,1)",
};

const toneAchieving = {
  pillStyle: {
    borderColor: "rgba(74,222,128,0.55)",
    background: "rgba(74,222,128,0.07)",
  } as CSSProperties,
  badgeStyle: {
    background: "rgba(74,222,128,0.16)",
    borderColor: "rgba(74,222,128,0.45)",
    color: "rgba(180,242,200,1)",
  } as CSSProperties,
  numberColor: "rgba(74,222,128,1)",
};

const toneSubstitute = {
  pillStyle: {
    borderColor: "rgba(167,139,250,0.45)",
    background: "rgba(167,139,250,0.05)",
  } as CSSProperties,
  badgeStyle: {
    background: "rgba(167,139,250,0.16)",
    borderColor: "rgba(167,139,250,0.45)",
    color: "rgba(220,210,255,1)",
  } as CSSProperties,
  numberColor: "rgba(167,139,250,1)",
};

const shell: CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: 14,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.018)",
};

const label: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};

const pillRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const pill: CSSProperties = {
  display: "inline-grid",
  gap: 3,
  padding: "8px 12px",
  borderRadius: 12,
  borderWidth: 1,
  borderStyle: "solid",
  textDecoration: "none",
  color: "inherit",
  minWidth: 140,
  cursor: "pointer",
};

const pillNameRow: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
};

const pillName: CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const pillBadge: CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  padding: "1px 6px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  flexShrink: 0,
};

const pillCadenceRow: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 11,
};

const pillCadence: CSSProperties = {
  opacity: 0.6,
  fontWeight: 700,
};

const pillProgress: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 1,
  fontWeight: 800,
};

const progressNum: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
};

const progressSep: CSSProperties = {
  opacity: 0.4,
  fontSize: 10,
};

const progressTarget: CSSProperties = {
  opacity: 0.55,
  fontSize: 10,
};

const projectionArrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  marginLeft: 3,
};

const alreadyHitMark: CSSProperties = {
  marginLeft: 4,
  color: "rgba(74,222,128,1)",
  fontSize: 12,
  fontWeight: 900,
};
