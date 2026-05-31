// NonFreqGoals — two parallel implementations of the Performance / Volume /
// Completion goal list. Plan's Goals tab passes `layout` (driven by a URL
// param so you can flip via a chip in the page) and we render either:
//
//   • UnifiedRows — one compact row format for every type, grouped under
//     type headers. Matches the visual language of frequency-goal rows.
//
//   • TypeTailoredCards — each card's body adapts to what the metric
//     measures: Performance gets current → target with delta text;
//     Volume + Completion get progress bars.
//
// Once you've picked one, delete the other.

import Link from "next/link";
import type { CSSProperties } from "react";
import type { GoalInsight } from "@/lib/goals";
import { GOAL_TYPE_ACCENT, GOAL_TYPE_CHIP_STYLE, GoalStatusBadge, chipStyle } from "@/app/goals/ui";
import DeleteGoalButton from "@/app/goals/DeleteGoalButton";

export type NonFreqLayout = "rows" | "cards";

type Props = {
  entries: GoalInsight[];
  layout: NonFreqLayout;
};

const TYPE_ORDER: Array<{ key: string; label: string }> = [
  { key: "PERFORMANCE", label: "Performance" },
  { key: "VOLUME", label: "Volume" },
  { key: "COMPLETION", label: "Completion" },
];

function detailHrefFor(entry: GoalInsight): string {
  // Mirror the same /plan/goals/<id> canonical the frequency rows use.
  // Falls back to the existing detailHref if upstream produced one but
  // re-points it to /plan/goals/.
  if (entry.detailHref) {
    return entry.detailHref.replace(/^\/goals\//, "/plan/goals/");
  }
  return `/plan/goals/${encodeURIComponent(entry.goal.id)}`;
}

export default function NonFreqGoals({ entries, layout }: Props) {
  if (entries.length === 0) return null;

  // Group by type so both layouts can show section headers consistently.
  const byType = new Map<string, GoalInsight[]>();
  for (const entry of entries) {
    const k = entry.goal.goalType;
    if (!byType.has(k)) byType.set(k, []);
    byType.get(k)!.push(entry);
  }
  const sections = TYPE_ORDER
    .filter((t) => byType.has(t.key))
    .map((t) => ({ key: t.key, label: t.label, items: byType.get(t.key)! }));

  return (
    <div style={shell}>
      {sections.map((section) => (
        <div key={section.key} style={sectionBlock}>
          <div style={sectionLabel}>{section.label}</div>
          {layout === "rows" ? (
            <div style={rowList}>
              {section.items.map((entry) => (
                <UnifiedRow key={entry.goal.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div style={cardGrid}>
              {section.items.map((entry) => (
                <TypeTailoredCard key={entry.goal.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────── Unified compact row

function UnifiedRow({ entry }: { entry: GoalInsight }) {
  const accent = GOAL_TYPE_ACCENT[entry.goal.goalType] ?? "rgba(255,255,255,0.3)";
  const status = statusTone(entry);
  const detail = detailHrefFor(entry);
  return (
    <Link href={detail} style={{ ...rowShell, borderLeft: `3px solid ${accent}` }} aria-label={`Open ${entry.goal.name}`}>
      <div style={rowName}>{entry.goal.name}</div>
      <div style={rowBarRow}>
        <ProgressBar fraction={entry.fractionComplete} tone={status.tone} />
        <div style={rowValues}>{entry.actualDisplay} / {entry.targetDisplay}</div>
      </div>
      <div style={rowMetaRow}>
        <span style={{ ...rowStatusPill, color: status.color, borderColor: status.color, background: status.softBg }}>
          {entry.timeframeStatusLabel}
        </span>
        <span style={rowTimeframe}>{entry.timeframeLabel}</span>
        {!entry.goal.isActive ? <span style={chipStyle}>Inactive</span> : null}
        <span style={rowArrow} aria-hidden>→</span>
      </div>
    </Link>
  );
}

// ───────────────────────────────────────────── Type-tailored card

function TypeTailoredCard({ entry }: { entry: GoalInsight }) {
  const accent = GOAL_TYPE_ACCENT[entry.goal.goalType] ?? "rgba(255,255,255,0.3)";
  const typeChip = { ...chipStyle, ...(GOAL_TYPE_CHIP_STYLE[entry.goal.goalType] ?? {}) };
  const detail = detailHrefFor(entry);

  return (
    <div style={{ ...cardShell, borderLeft: `3px solid ${accent}` }}>
      <Link href={detail} aria-label={`Open ${entry.goal.name}`} style={stretchedLink} />
      <div style={cardActions}>
        {entry.editHref ? (
          <Link href={entry.editHref} style={smallActionLink}>Edit</Link>
        ) : null}
        <DeleteGoalButton goalId={entry.goal.id} />
      </div>
      <div style={cardInner}>
        <div style={cardHeader}>
          <div style={cardName}>{entry.goal.name}</div>
          <span style={typeChip}>{entry.goalTypeLabel}</span>
        </div>

        <TypeTailoredBody entry={entry} />

        <div style={cardFooter}>
          <span style={cardFooterMeta}>{entry.timeframeLabel} · </span>
          <GoalStatusBadge label={entry.timeframeStatusLabel} achieved={entry.isAchieved} />
          {!entry.goal.isActive ? <span style={chipStyle}>Inactive</span> : null}
        </div>
      </div>
    </div>
  );
}

function TypeTailoredBody({ entry }: { entry: GoalInsight }) {
  if (entry.goal.goalType === "PERFORMANCE") {
    return <PerformanceBody entry={entry} />;
  }
  // Volume + Completion both render a progress bar with %.
  // Completion goals with small targets (≤10) get dot indicators instead
  // of a bar — easier to read "4 of 10 sent" at a glance.
  if (entry.goal.goalType === "COMPLETION" && entry.targetValue > 0 && entry.targetValue <= 10) {
    return <CompletionDots entry={entry} />;
  }
  return <VolumeBody entry={entry} />;
}

// Performance: current value → target with delta text underneath. A 0→225
// bar would be 80% full for a user already lifting 215 — visually useless.
// The delta ("10 lb to PR") tells you what you actually want to know.
function PerformanceBody({ entry }: { entry: GoalInsight }) {
  const unit = sharedUnit(entry.actualDisplay, entry.targetDisplay);
  const currentAmount = stripUnit(entry.actualDisplay);
  const targetAmount = stripUnit(entry.targetDisplay);
  const delta = entry.targetValue - entry.actualValue;
  const deltaPositive = delta > 0;
  const deltaLabel = entry.isAchieved
    ? "Goal hit"
    : deltaPositive
    ? `${formatDelta(delta)}${unit ? ` ${unit}` : ""} to ${entry.goal.goalType === "PERFORMANCE" ? "PR" : "goal"}`
    : `${formatDelta(Math.abs(delta))}${unit ? ` ${unit}` : ""} past`;

  return (
    <div style={perfRow}>
      <div style={perfNum}>{currentAmount}</div>
      <div style={perfArrowCol}>
        <div style={perfArrow}>──►</div>
        <div style={perfDelta}>{deltaLabel}</div>
      </div>
      <div style={perfNum}>{targetAmount}</div>
      {unit ? <div style={perfUnit}>{unit}</div> : null}
    </div>
  );
}

function VolumeBody({ entry }: { entry: GoalInsight }) {
  const tone = statusTone(entry);
  const pct = Math.round(Math.max(0, Math.min(1, entry.fractionComplete)) * 100);
  return (
    <div style={volStack}>
      <div style={volBarRow}>
        <ProgressBar fraction={entry.fractionComplete} tone={tone.tone} fullHeight />
        <div style={volPct}>{pct}%</div>
      </div>
      <div style={volCount}>
        {entry.actualDisplay} of {entry.targetDisplay}
      </div>
    </div>
  );
}

function CompletionDots({ entry }: { entry: GoalInsight }) {
  const target = Math.round(entry.targetValue);
  const filled = Math.min(target, Math.round(entry.actualValue));
  const tone = statusTone(entry);
  return (
    <div style={compStack}>
      <div style={dotRow}>
        {Array.from({ length: target }, (_, i) => (
          <span
            key={i}
            style={{
              ...completionDot,
              background: i < filled ? tone.color : "transparent",
              borderColor: i < filled ? tone.color : "rgba(255,255,255,0.18)",
            }}
            aria-hidden
          />
        ))}
      </div>
      <div style={volCount}>{filled} of {target}</div>
    </div>
  );
}

// ───────────────────────────────────────────── shared bits

function ProgressBar({ fraction, tone, fullHeight }: { fraction: number; tone: StatusTone; fullHeight?: boolean }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const color = STATUS_COLOR[tone];
  return (
    <div style={{ ...barTrack, height: fullHeight ? 10 : 6 }}>
      <div style={{ ...barFill, width: `${clamped * 100}%`, background: color }} />
    </div>
  );
}

type StatusTone = "achieved" | "ontrack" | "behind" | "neutral";

const STATUS_COLOR: Record<StatusTone, string> = {
  achieved: "rgba(34,197,94,0.95)",
  ontrack: "rgba(100,180,255,0.95)",
  behind: "rgba(251,191,36,0.95)",
  neutral: "rgba(180,180,180,0.6)",
};

const STATUS_SOFT_BG: Record<StatusTone, string> = {
  achieved: "rgba(34,197,94,0.10)",
  ontrack: "rgba(100,180,255,0.10)",
  behind: "rgba(251,191,36,0.10)",
  neutral: "rgba(180,180,180,0.08)",
};

function statusTone(entry: GoalInsight): { tone: StatusTone; color: string; softBg: string } {
  let tone: StatusTone = "neutral";
  if (entry.isAchieved) tone = "achieved";
  else if (/behind/i.test(entry.timeframeStatusLabel)) tone = "behind";
  else if (/on track|on pace|ahead/i.test(entry.timeframeStatusLabel)) tone = "ontrack";
  return { tone, color: STATUS_COLOR[tone], softBg: STATUS_SOFT_BG[tone] };
}

function stripUnit(display: string): string {
  // Split "215 lb" → "215", "7,200" → "7,200". If no unit, returns whole.
  const m = display.trim().match(/^(.+?)(?:\s+([A-Za-z%][A-Za-z0-9%./-]*))?$/);
  return m?.[1] ?? display;
}

function sharedUnit(a: string, b: string): string {
  const ua = a.trim().match(/\s+([A-Za-z%][A-Za-z0-9%./-]*)$/)?.[1];
  const ub = b.trim().match(/\s+([A-Za-z%][A-Za-z0-9%./-]*)$/)?.[1];
  return ua && ua === ub ? ua : "";
}

function formatDelta(value: number): string {
  // Compact: 1234 → "1,234"; 12.3 → "12.3"; 12 → "12"
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toFixed(1);
}

// ─────────────────────────────────────── styles

const shell: CSSProperties = {
  display: "grid",
  gap: 18,
};

const sectionBlock: CSSProperties = {
  display: "grid",
  gap: 8,
};

const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.55)",
  paddingInline: 2,
};

const rowList: CSSProperties = {
  display: "grid",
  gap: 6,
};

const cardGrid: CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

// ─────────── unified row styles

const rowShell: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
  color: "inherit",
  textDecoration: "none",
  cursor: "pointer",
};

const rowName: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "rgba(255,255,255,0.95)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};

const rowBarRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const rowValues: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(255,255,255,0.85)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const rowMetaRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const rowStatusPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid",
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};

const rowTimeframe: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.55)",
};

const rowArrow: CSSProperties = {
  marginLeft: "auto",
  fontSize: 14,
  color: "rgba(255,255,255,0.4)",
  fontWeight: 800,
};

// ─────────── card styles

const cardShell: CSSProperties = {
  position: "relative",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))",
  padding: 12,
  display: "grid",
  gap: 0,
};

const cardInner: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gap: 10,
};

const stretchedLink: CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: 14,
  zIndex: 0,
};

const cardActions: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  zIndex: 2,
  display: "flex",
  gap: 6,
  alignItems: "center",
};

const smallActionLink: CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 9px",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 11,
  fontWeight: 800,
};

const cardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  // leave room for the absolutely-positioned actions
  paddingRight: 80,
  flexWrap: "wrap",
};

const cardName: CSSProperties = {
  flex: 1,
  fontSize: 15,
  fontWeight: 900,
  color: "rgba(255,255,255,0.95)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
};

const cardFooter: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const cardFooterMeta: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "rgba(255,255,255,0.55)",
};

// ─────────── performance body

const perfRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "6px 4px",
};

const perfNum: CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  lineHeight: 1,
  color: "rgba(255,255,255,0.95)",
};

const perfArrowCol: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 3,
};

const perfArrow: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "rgba(255,255,255,0.5)",
  letterSpacing: -2,
};

const perfDelta: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.65)",
  whiteSpace: "nowrap",
};

const perfUnit: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,0.55)",
  alignSelf: "flex-end",
  paddingBottom: 3,
};

// ─────────── volume / completion bodies

const volStack: CSSProperties = {
  display: "grid",
  gap: 4,
};

const volBarRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const volPct: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "rgba(255,255,255,0.92)",
  whiteSpace: "nowrap",
};

const volCount: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "rgba(255,255,255,0.55)",
  textAlign: "center",
};

const compStack: CSSProperties = {
  display: "grid",
  gap: 6,
  justifyItems: "center",
};

const dotRow: CSSProperties = {
  display: "flex",
  gap: 5,
  flexWrap: "wrap",
  justifyContent: "center",
};

const completionDot: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  border: "1.5px solid",
};

// ─────────── shared bar

const barTrack: CSSProperties = {
  flex: 1,
  background: "rgba(255,255,255,0.08)",
  borderRadius: 999,
  overflow: "hidden",
  minWidth: 0,
};

const barFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 220ms ease",
};
