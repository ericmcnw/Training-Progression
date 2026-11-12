"use client";

// Dashboard Focus band — the strategic layer. One card per active focus:
// name + icon, milestone progress, and the current aim(s) ("what I'm working
// on right now"). Taps through to the focus detail page. Collapsible, matching
// the other home sections. Responsive: cards stack on mobile, flow 2-up on
// wide screens via a min-width grid.

import Link from "next/link";
import type { CSSProperties } from "react";
import CollapsibleSection from "./CollapsibleSection";
import { COLOR, withAlpha } from "./tokens";
import {
  seasonPhaseLabel,
  type FocusBandItem,
  type ProgramPhaseView,
  type ProgramNextPhaseView,
} from "@/app/focus/shared";

export default function HomeFocusSection({ focuses }: { focuses: FocusBandItem[] }) {
  if (focuses.length === 0) return null;

  return (
    <CollapsibleSection
      title="Programs"
      count={focuses.length}
      countTone="accent"
      hint="tap a program"
      storageKey="home:focus:open"
      defaultOpen
    >
      <div style={grid}>
        {focuses.map((f) => (
          <FocusCard key={f.id} focus={f} />
        ))}
      </div>
      <Link href="/programs" style={newLink}>All programs →</Link>
    </CollapsibleSection>
  );
}

function FocusCard({ focus }: { focus: FocusBandItem }) {
  const accent = focus.color?.trim() || COLOR.success;
  const pct =
    focus.milestonesTotal > 0
      ? Math.round((focus.milestonesDone / focus.milestonesTotal) * 100)
      : 0;

  return (
    <div style={{ ...cardShell, borderColor: withAlpha(accent, 0.28) }}>
      <div style={topRow}>
        <Link href={`/programs/${focus.id}`} style={nameWrap}>
          {focus.icon ? <span aria-hidden style={iconStyle}>{focus.icon}</span> : null}
          <span style={nameStyle}>{focus.name}</span>
        </Link>
        {focus.milestonesTotal > 0 ? (
          <span style={{ ...progressPill, color: accent, borderColor: withAlpha(accent, 0.35), background: withAlpha(accent, 0.12) }}>
            {focus.milestonesDone}/{focus.milestonesTotal}
          </span>
        ) : null}
      </div>

      {seasonPhaseLabel(focus.season, focus.phase) ? (
        <span style={{ ...seasonChip, color: withAlpha(accent, 0.95), borderColor: withAlpha(accent, 0.3) }}>
          {seasonPhaseLabel(focus.season, focus.phase)}
        </span>
      ) : null}

      {focus.milestonesTotal > 0 ? (
        <div style={track} aria-hidden>
          <div style={{ ...trackFill, width: `${pct}%`, background: accent }} />
        </div>
      ) : null}

      {focus.currentPhase ? (
        <PhasePanel phase={focus.currentPhase} next={focus.nextPhase} accent={accent} />
      ) : focus.currentAims.length > 0 ? (
        <div style={aimsWrap}>
          {focus.currentAims.slice(0, 3).map((aim, i) => (
            <span key={i} style={aimChip}>
              <span aria-hidden style={{ ...aimDot, background: accent }} />
              {aim}
            </span>
          ))}
          {focus.currentAims.length > 3 ? (
            <span style={moreAims}>+{focus.currentAims.length - 3}</span>
          ) : null}
        </div>
      ) : (
        <span style={emptyAim}>No active outcomes yet</span>
      )}
      {focus.availableWork.length > 0 ? (
        <div style={workList}>
          <span style={workLabel}>Available now</span>
          {focus.availableWork.map((work) => (
            <Link key={work.id} href={`/routines/${work.routineId}/log?programId=${encodeURIComponent(focus.id)}&blockItemId=${encodeURIComponent(work.id)}`} style={workRow}>
              <span>{work.label}</span>
              <strong>{work.targetPerWeek ? `${work.targetPerWeek}x/wk` : "Log"}</strong>
            </Link>
          ))}
        </div>
      ) : <Link href={`/programs/${focus.id}/edit`} style={planLink}>Add current work →</Link>}
    </div>
  );
}

// The phase a program is in, the steps inside it, and the condition that
// unlocks the next one. The gate line is the point of the whole panel — it is
// the only place in the app that says *why* you aren't moving on yet.
function PhasePanel({
  phase,
  next,
  accent,
}: {
  phase: ProgramPhaseView;
  next: ProgramNextPhaseView | null;
  accent: string;
}) {
  const remaining = phase.steps.filter((s) => !s.done);
  const shown = remaining.length > 0 ? remaining : phase.steps;

  return (
    <div style={phaseWrap}>
      <div style={phaseHead}>
        <span style={{ ...phaseName, color: accent }}>{phase.name}</span>
        <span style={phaseCount}>
          Phase {phase.index}/{phase.total}
          {phase.targetEndYmd ? ` · thru ${shortYmd(phase.targetEndYmd)}` : ""}
        </span>
      </div>

      <div style={stepList}>
        {shown.slice(0, 4).map((step) => (
          <div key={step.id} style={stepRow}>
            <span aria-hidden style={step.done ? { ...stepMark, color: accent } : stepMarkOpen}>
              {step.done ? "✓" : "○"}
            </span>
            <span style={stepBody}>
              <span style={step.done ? stepLabelDone : stepLabel}>{step.label}</span>
              {step.targetText && !step.done ? (
                <span style={stepTarget}>{step.targetText}</span>
              ) : null}
            </span>
          </div>
        ))}
        {shown.length > 4 ? <span style={moreSteps}>+{shown.length - 4} more</span> : null}
      </div>

      {next ? (
        <div
          style={{
            ...gateWrap,
            borderColor: next.gateMet ? withAlpha(COLOR.green, 0.35) : COLOR.border,
            background: next.gateMet ? COLOR.greenSoft : "rgba(255,255,255,0.025)",
          }}
        >
          <span style={gateHead}>
            {next.gateMet ? "Ready for" : "Next"} · {next.name}
          </span>
          {next.gateSummary ? (
            <span style={{ ...gateSummary, color: next.gateMet ? COLOR.green : COLOR.amber }}>
              {next.gateLabel ? `${next.gateLabel} — ` : ""}
              {next.gateSummary}
            </span>
          ) : (
            <span style={gateSummaryMuted}>Advance when you decide</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

// "2026-11-15" → "Nov 15". Parsed by parts rather than through Date so the
// label can't shift a day from a timezone offset.
function shortYmd(ymd: string): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [, m, d] = ymd.split("-");
  const month = MONTHS[Number(m) - 1];
  if (!month) return ymd;
  return `${month} ${Number(d)}`;
}

// ── styles ────────────────────────────────────────────────────────────────

const phaseWrap: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "9px 10px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${COLOR.border}`,
};

const phaseHead: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

const phaseName: CSSProperties = { fontSize: 12.5, fontWeight: 900 };

const phaseCount: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: COLOR.textFaint,
  whiteSpace: "nowrap",
};

const stepList: CSSProperties = { display: "grid", gap: 6 };

const stepRow: CSSProperties = { display: "flex", gap: 7, alignItems: "flex-start" };

const stepMark: CSSProperties = { fontSize: 11, fontWeight: 900, lineHeight: 1.45, flexShrink: 0 };
const stepMarkOpen: CSSProperties = { ...stepMark, color: COLOR.textFaint };

const stepBody: CSSProperties = { display: "grid", gap: 1, minWidth: 0 };

const stepLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: COLOR.textDim,
  lineHeight: 1.35,
};

const stepLabelDone: CSSProperties = {
  ...stepLabel,
  color: COLOR.textFaint,
  textDecoration: "line-through",
};

const stepTarget: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: COLOR.textFaint,
  lineHeight: 1.3,
};

const moreSteps: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  color: COLOR.textFaint,
  paddingLeft: 18,
};

const gateWrap: CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "7px 9px",
  borderRadius: 9,
  border: "1px solid",
};

const gateHead: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: COLOR.textFaint,
};

const gateSummary: CSSProperties = { fontSize: 11.5, fontWeight: 800, lineHeight: 1.35 };

const gateSummaryMuted: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: COLOR.textFaint,
  fontStyle: "italic",
};

// Auto-fit grid: single column on phones, two columns once there's room.
const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const cardShell: CSSProperties = {
  display: "grid",
  gap: 9,
  padding: "12px 13px",
  borderRadius: 13,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.022)",
  textDecoration: "none",
  color: "inherit",
};

const topRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const nameWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  color: "inherit",
  textDecoration: "none",
};

const workList: CSSProperties = { display: "grid", gap: 5, paddingTop: 3, borderTop: `1px solid ${COLOR.border}` };
const workLabel: CSSProperties = { fontSize: 9.5, fontWeight: 900, textTransform: "uppercase", color: COLOR.textFaint };
const workRow: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 8px", borderRadius: 8, background: "rgba(255,255,255,0.035)", color: COLOR.textDim, textDecoration: "none", fontSize: 11.5 };
const planLink: CSSProperties = { fontSize: 11.5, fontWeight: 800, color: COLOR.textDim, textDecoration: "none" };

const iconStyle: CSSProperties = { fontSize: 16, lineHeight: 1, flexShrink: 0 };

const seasonChip: CSSProperties = {
  justifySelf: "start",
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid",
  background: "rgba(255,255,255,0.03)",
};

const nameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: COLOR.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const progressPill: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid transparent",
  flexShrink: 0,
};

const track: CSSProperties = {
  height: 5,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const trackFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 220ms ease",
};

const aimsWrap: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const aimChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  maxWidth: "100%",
  fontSize: 11.5,
  fontWeight: 700,
  color: COLOR.textDim,
  padding: "3px 9px 3px 7px",
  borderRadius: 999,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.03)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const aimDot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  flexShrink: 0,
};

const moreAims: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: COLOR.textFaint,
  alignSelf: "center",
};

const emptyAim: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: COLOR.textFaint,
  fontStyle: "italic",
};

const newLink: CSSProperties = {
  justifySelf: "start",
  fontSize: 12,
  fontWeight: 800,
  color: COLOR.textDim,
  textDecoration: "none",
  padding: "6px 12px",
  borderRadius: 9,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.03)",
};
