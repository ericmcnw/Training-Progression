"use client";

// Client roadmap — renders each track as a vertical stepper and handles the
// mark-met / reopen interactions. "Current" is derived (first ACTIVE in a
// track), so it's highlighted here rather than stored. Optimistic-ish: calls
// the server action then refreshes.

import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { markMilestoneMet, reopenMilestone } from "@/app/focus/actions";
import { formatUtcDateLabel } from "@/lib/dates";
import type { FocusTrackView, FocusMilestoneView, MilestoneGateView, TrackActivity } from "@/app/focus/data";

// Real logged activity for a routine track: a weekly-count sparkline + a
// "N× in 8wk · last Xd" summary. Makes the roadmap reactive to what you've
// actually been doing, not just the plan.
function TrackActivityChip({ activity, accent }: { activity: TrackActivity; accent: string }) {
  const max = Math.max(1, ...activity.weeklyCounts);
  const lastLabel =
    activity.daysSinceLast == null
      ? "none logged"
      : activity.daysSinceLast === 0
        ? "today"
        : activity.daysSinceLast === 1
          ? "yesterday"
          : `${activity.daysSinceLast}d ago`;
  return (
    <div style={activityWrap} title="Sessions per week, last 8 weeks (oldest → newest)">
      <span style={activitySpark} aria-hidden>
        {activity.weeklyCounts.map((c, i) => (
          <span
            key={i}
            style={{
              ...activityBar,
              height: `${Math.max(14, (c / max) * 100)}%`,
              background: c > 0 ? accent : "rgba(255,255,255,0.12)",
              opacity: c > 0 ? 0.45 + 0.55 * (c / max) : 1,
            }}
          />
        ))}
      </span>
      <span style={activityText}>
        {activity.totalSessions} sessions · 8wk &nbsp;·&nbsp; last {lastLabel}
      </span>
    </div>
  );
}

// Its own quiet row under the track title — sparkline + summary, room to
// breathe instead of fighting the title for header space.
const activityWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "2px 0 8px",
  minWidth: 0,
};
const activitySpark: CSSProperties = { display: "flex", alignItems: "flex-end", gap: 2, height: 18, flexShrink: 0 };
const activityBar: CSSProperties = { width: 4, borderRadius: 1.5, flexShrink: 0 };
const activityText: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.5)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// Gate chip: green "ready" when an auto-evaluated pain gate is met, amber while
// pending, neutral for a self-assessed free-text gate.
function GateChip({ gate }: { gate: MilestoneGateView }) {
  if (gate.kind === "PAIN" || gate.kind === "FREQUENCY") {
    const met = gate.met === true;
    return (
      <span
        style={{
          ...gateChipBase,
          color: met ? "#7ce8aa" : "rgba(253,224,150,0.95)",
          background: met ? "rgba(51,255,122,0.12)" : "rgba(251,191,36,0.1)",
          borderColor: met ? "rgba(51,255,122,0.4)" : "rgba(251,191,36,0.32)",
        }}
        title={met ? "Gate met — ready to advance" : "Advance gate"}
      >
        {met ? "✓ ready to advance" : `🔒 ${gate.summary}`}
      </span>
    );
  }
  // FREE_TEXT
  return (
    <span style={{ ...gateChipBase, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.14)" }} title="Self-assessed gate">
      🔒 {gate.note || "gate"}
    </span>
  );
}

const gateChipBase: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  padding: "1px 8px",
  borderRadius: 999,
  border: "1px solid",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export default function FocusRoadmap({
  tracks,
  accent,
}: {
  tracks: FocusTrackView[];
  accent: string;
}) {
  if (tracks.length === 0) {
    return (
      <div style={emptyBox}>
        No milestones yet. Tap <strong>Edit</strong> to add the first step of the plan.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {tracks.map((track) => (
        <Track key={track.key} track={track} accent={accent} />
      ))}
    </div>
  );
}

function Track({ track, accent }: { track: FocusTrackView; accent: string }) {
  // First ACTIVE milestone = the current aim for this track.
  const currentId = track.milestones.find((m) => m.status === "ACTIVE")?.id ?? null;

  return (
    <section style={trackCard}>
      <div style={trackHead}>
        <span style={trackTitle}>{track.title}</span>
        <span style={trackScope}>{track.scopeKind.toLowerCase()}</span>
      </div>
      {track.activity ? <TrackActivityChip activity={track.activity} accent={accent} /> : null}
      <div style={{ display: "grid", gap: 2 }}>
        {track.milestones.map((m, i) => (
          <MilestoneRow
            key={m.id}
            milestone={m}
            accent={accent}
            isCurrent={m.id === currentId}
            isLast={i === track.milestones.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function MilestoneRow({
  milestone,
  accent,
  isCurrent,
  isLast,
}: {
  milestone: FocusMilestoneView;
  accent: string;
  isCurrent: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState(false);
  const done = milestone.status === "ACHIEVED";
  const skipped = milestone.status === "SKIPPED";

  function toggle() {
    setErr(false);
    startTransition(async () => {
      try {
        if (done) await reopenMilestone(milestone.id);
        else await markMilestoneMet(milestone.id);
        router.refresh();
      } catch {
        setErr(true);
      }
    });
  }

  const dotColor = done ? accent : isCurrent ? accent : "rgba(255,255,255,0.28)";

  return (
    <div style={row(isCurrent)}>
      {/* connector rail + node */}
      <div style={railCol}>
        <span
          style={{
            ...node,
            borderColor: dotColor,
            background: done ? accent : "transparent",
          }}
          aria-hidden
        >
          {done ? <span style={check}>✓</span> : null}
        </span>
        {!isLast ? <span style={{ ...rail, background: done ? accent : "rgba(255,255,255,0.12)" }} aria-hidden /> : null}
      </div>

      <div style={textCol}>
        <span style={labelStyle(done, skipped, isCurrent)}>
          {milestone.label}
          {isCurrent ? <span style={{ ...currentTag, color: accent, borderColor: accent }}>now</span> : null}
        </span>
        {milestone.targetText ? <span style={target}>{milestone.targetText}</span> : null}
        {/* Status chips only on the CURRENT milestone — that's the only place
            "am I ready?" and "when?" are live questions. Upcoming milestones
            stay clean; the timeline chart carries their dates. */}
        {isCurrent && !done && !skipped && (milestone.gate.kind !== "NONE" || milestone.projectedEndYmd) ? (
          <span style={metaLine}>
            {milestone.gate.kind !== "NONE" ? <GateChip gate={milestone.gate} /> : null}
            {milestone.projectedEndYmd ? (
              <span style={projChip} title="Projected finish at current pace">
                ~{formatUtcDateLabel(milestone.projectedEndYmd, { month: "short", day: "numeric" })}
              </span>
            ) : null}
          </span>
        ) : null}
        {err ? <span style={errText}>Couldn&apos;t update — tap again</span> : null}
      </div>

      {!skipped ? (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          style={done ? undoBtn : { ...doneBtn, borderColor: accent, color: accent }}
          aria-label={done ? "Reopen milestone" : "Mark milestone done"}
        >
          {pending ? "…" : done ? "Undo" : "Done"}
        </button>
      ) : (
        <span style={skippedTag}>skipped</span>
      )}
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

const emptyBox: CSSProperties = {
  padding: "22px 16px",
  borderRadius: 14,
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.02)",
  color: "rgba(255,255,255,0.6)",
  fontSize: 13,
  textAlign: "center",
};

const trackCard: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.022)",
  padding: "12px 14px 6px",
};

const trackHead: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 8,
};

const trackTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "rgba(255,255,255,0.92)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const trackScope: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.34)",
  flexShrink: 0,
};

function row(isCurrent: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "22px 1fr auto",
    gap: 10,
    alignItems: "start",
    padding: "8px 6px",
    borderRadius: 10,
    background: isCurrent ? "rgba(255,255,255,0.035)" : "transparent",
  };
}

const railCol: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 0,
  height: "100%",
};

const node: CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 999,
  border: "2px solid",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  marginTop: 1,
};

const check: CSSProperties = { fontSize: 9, fontWeight: 900, color: "#0b1220", lineHeight: 1 };

const rail: CSSProperties = {
  width: 2,
  flex: 1,
  minHeight: 14,
  marginTop: 2,
  borderRadius: 2,
};

const textCol: CSSProperties = { display: "grid", gap: 2, minWidth: 0, paddingTop: 0 };

function labelStyle(done: boolean, skipped: boolean, isCurrent: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
    fontSize: 13.5,
    fontWeight: isCurrent ? 900 : 700,
    color: done
      ? "rgba(255,255,255,0.5)"
      : skipped
        ? "rgba(255,255,255,0.4)"
        : "rgba(255,255,255,0.9)",
    textDecoration: done ? "line-through" : "none",
  };
}

const currentTag: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  padding: "1px 6px",
  borderRadius: 999,
  border: "1px solid",
};

const metaLine: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const target: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "rgba(255,255,255,0.5)",
};

const projChip: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  color: "rgba(191,219,254,0.9)",
  background: "rgba(96,165,250,0.1)",
  border: "1px solid rgba(96,165,250,0.28)",
  borderRadius: 999,
  padding: "1px 7px",
};

const errText: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(248,140,140,0.95)",
};

const doneBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "5px 12px",
  borderRadius: 9,
  border: "1px solid",
  background: "rgba(51,255,122,0.08)",
  fontSize: 11.5,
  fontWeight: 900,
  textAlign: "center",
  minWidth: 44,
  flexShrink: 0,
};

const undoBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "5px 12px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.6)",
  fontSize: 11.5,
  fontWeight: 800,
  textAlign: "center",
  minWidth: 44,
  flexShrink: 0,
};

const skippedTag: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  color: "rgba(255,255,255,0.38)",
  flexShrink: 0,
  alignSelf: "center",
};
