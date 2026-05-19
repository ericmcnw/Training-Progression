// AmbientStatusRow — 3 equal-width chips. Body / Habits / Week.
//
// Each chip is 2 lines: a primary signal on line 1, a secondary context line
// on line 2. The Habits chip uses both lines for data (best streak +
// at-risk). All chips are <Link>s so the whole surface is tap-able.

import Link from "next/link";
import type { CSSProperties } from "react";
import type { BodyChipStatus, HabitChipStatus, WeekChipStatus } from "./types";
import { COLOR, RADIUS } from "./tokens";

type Props = {
  body: BodyChipStatus;
  habit: HabitChipStatus;
  week: WeekChipStatus;
};

export default function AmbientStatusRow({ body, habit, week }: Props) {
  return (
    <div style={row} className="homeV2Chips">
      <Link href="/body" style={chipShell(bodyTone(body.tone))} aria-label="Body status">
        <BodyGlyph tone={body.tone} />
        <div style={chipContent}>
          <div style={chipPrimary}>{body.primaryLabel}</div>
          <div style={chipSecondary}>{body.secondaryLabel}</div>
        </div>
      </Link>

      <Link
        href={habit.atRiskName ? "#habits-grid" : "#habits-grid"}
        scroll
        style={chipShell({ accent: COLOR.amber, soft: COLOR.amberSoft })}
        aria-label="Habit streaks"
      >
        <FlameGlyph />
        <div style={chipContent}>
          {habit.bestStreakLabel ? (
            <div style={chipPrimary}>
              <span style={chipStrong}>{habit.bestStreakLabel}</span>
              <span style={chipName}>{habit.bestStreakName}</span>
            </div>
          ) : (
            <div style={chipPrimaryMuted}>no streaks yet</div>
          )}
          {habit.atRiskLabel && habit.atRiskName ? (
            <div style={chipSecondaryWarn}>
              <span style={chipWarnIcon}>!</span>
              <span style={chipName}>{habit.atRiskName}</span>
              <span style={chipFractionDim}>{habit.atRiskLabel}</span>
            </div>
          ) : (
            <div style={chipSecondary}>all on track</div>
          )}
        </div>
      </Link>

      <Link href="/plan" style={chipShell(weekTone(week.paceLabel))} aria-label="This week">
        <RingGlyph fillPercent={week.fillPercent} accent={weekTone(week.paceLabel).accent} />
        <div style={chipContent}>
          <div style={chipPrimary}>
            <span style={chipStrong}>{week.done}</span>
            <span style={chipSep}>/</span>
            <span style={chipTarget}>{week.planned}</span>
            <span style={chipName}>this wk</span>
          </div>
          <div style={chipSecondary}>{week.paceLabel}</div>
        </div>
      </Link>

      <style>{`
        .homeV2Chips {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        @media (max-width: 480px) {
          .homeV2Chips {
            gap: 6px;
          }
        }
      `}</style>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── helpers

function bodyTone(tone: BodyChipStatus["tone"]): { accent: string; soft: string } {
  if (tone === "injured") return { accent: COLOR.red, soft: COLOR.redSoft };
  if (tone === "recovering") return { accent: COLOR.amber, soft: COLOR.amberSoft };
  return { accent: "rgba(132,204,255,0.85)", soft: "rgba(132,204,255,0.10)" };
}

function weekTone(pace: WeekChipStatus["paceLabel"]): { accent: string; soft: string } {
  if (pace === "complete") return { accent: COLOR.success, soft: COLOR.successSoft };
  if (pace === "ahead") return { accent: COLOR.blue, soft: COLOR.blueSoft };
  if (pace === "behind") return { accent: COLOR.amber, soft: COLOR.amberSoft };
  return { accent: "rgba(132,204,255,0.85)", soft: "rgba(132,204,255,0.10)" };
}

function chipShell({ accent, soft }: { accent: string; soft: string }): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 10,
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: RADIUS.card,
    border: `1px solid ${COLOR.border}`,
    background: `linear-gradient(180deg, ${soft}, rgba(255,255,255,0.012))`,
    boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02), 0 6px 14px rgba(0,0,0,0.18)`,
    color: COLOR.text,
    textDecoration: "none",
    minHeight: 60,
    position: "relative",
    overflow: "hidden",
    transition: "transform 140ms ease, border-color 140ms ease",
    // accent dot accessible via CSS var if needed later
    ["--chip-accent" as never]: accent,
  };
}

// ─────────────────────────────────── glyphs (small inline SVGs, ~24px)

function BodyGlyph({ tone }: { tone: BodyChipStatus["tone"] }) {
  const stroke = tone === "injured" ? COLOR.red : tone === "recovering" ? COLOR.amber : "rgba(132,204,255,0.85)";
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="4" r="3" fill="none" stroke={stroke} strokeWidth="1.6" />
      <path
        d="M11 8 L11 17 M11 8 L5 13 M11 8 L17 13 M11 17 L7 24 M11 17 L15 24"
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FlameGlyph() {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" style={{ flexShrink: 0 }}>
      <path
        d="M11 2c2 4-1 6 1 9 1 1.5 3 2 3 5a5 5 0 0 1-10 0c0-2 1-3 2-4-.5 2 .5 3 1.5 3 0-3 1-5 2.5-13z"
        fill={COLOR.amberSoft}
        stroke={COLOR.amber}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RingGlyph({ fillPercent, accent }: { fillPercent: number; accent: string }) {
  const size = 26;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, fillPercent)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ─────────────────────────────────── inline styles

const row: CSSProperties = { width: "100%" };

const chipContent: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const chipPrimary: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  display: "flex",
  alignItems: "baseline",
  gap: 4,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const chipPrimaryMuted: CSSProperties = {
  ...chipPrimary,
  color: COLOR.textDim,
  fontWeight: 700,
};

const chipSecondary: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.textDim,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const chipSecondaryWarn: CSSProperties = {
  ...chipSecondary,
  color: COLOR.red,
  display: "flex",
  alignItems: "center",
  gap: 5,
  minWidth: 0,
};

const chipWarnIcon: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  background: COLOR.redSoft,
  border: `1px solid ${COLOR.red}`,
  color: COLOR.red,
  fontSize: 9,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const chipStrong: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: 0.3,
};

const chipTarget: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: COLOR.textDim,
};

const chipSep: CSSProperties = {
  fontSize: 12,
  color: COLOR.textFaint,
  margin: "0 2px",
};

const chipName: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: COLOR.textDim,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const chipFractionDim: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  color: COLOR.textFaint,
  marginLeft: "auto",
};
