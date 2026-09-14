"use client";

// Per-session history for one climb problem, with the tries count editable
// in place. Shared by the tick-list bubble and the location page's problem
// library so there's one session view rather than two.
//
// Tries is the number the rollups actually want: a six-go project session
// and a one-go flash both store a single ClimbAttempt row, so counting rows
// undercounts the work. Editing it here avoids opening the whole session
// editor to change one number.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { formatAppDate } from "@/lib/dates";
import {
  climbOutcomeBg,
  climbOutcomeColor,
  climbOutcomeLabel,
  outcomeUsesTriesCount,
} from "@/lib/climb-types";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import {
  loadClimbProblemDetail,
  updateClimbAttemptTries,
  type ClimbProblemDetail,
  type ProblemSessionRow,
} from "./locations/[id]/actions";

export default function ProblemSessionHistory({ problemId }: { problemId: string }) {
  const [detail, setDetail] = useState<ClimbProblemDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setFailed(false);
    loadClimbProblemDetail(problemId)
      .then((next) => {
        if (!cancelled && next) setDetail(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [problemId]);

  if (failed) return <div style={hintStyle}>Could not load sessions.</div>;
  if (!detail) return <div style={hintStyle}>Loading sessions…</div>;
  return <ProblemSessionList sessions={detail.sessions} />;
}

/** Presentation half, so a caller that already has the detail (the tick-list
 *  sheet, which also needs it for the header and media) does not refetch. */
export function ProblemSessionList({ sessions }: { sessions: ProblemSessionRow[] }) {
  if (sessions.length === 0) return <div style={hintStyle}>No attempts logged yet.</div>;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {sessions.map((row) => (
        <SessionRow key={row.attemptId} row={row} />
      ))}
    </div>
  );
}

function SessionRow({ row }: { row: ProblemSessionRow }) {
  const [tries, setTries] = useState(row.triesCount != null ? String(row.triesCount) : "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function commit() {
    const next = tries.trim() ? Number(tries) : null;
    if (next === row.triesCount) return;
    if (next != null && !Number.isFinite(next)) return;
    startTransition(async () => {
      const result = await updateClimbAttemptTries({ attemptId: row.attemptId, triesCount: next });
      setTries(result.triesCount != null ? String(result.triesCount) : "");
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    });
  }

  return (
    <div style={rowStyle}>
      <Link href={`/routines/${row.routineId}/logs/${row.sessionLogId}/edit`} style={dateLinkStyle}>
        {formatAppDate(row.performedAt, { month: "short", day: "numeric", year: "numeric" })}
      </Link>
      <span
        style={{
          fontSize: 11,
          fontWeight: 900,
          padding: "3px 8px",
          borderRadius: 8,
          flexShrink: 0,
          background: climbOutcomeBg(row.outcome),
          color: climbOutcomeColor(row.outcome),
        }}
      >
        {climbOutcomeLabel(row.outcome, row.discipline)}
      </span>
      {outcomeUsesTriesCount(row.outcome) ? (
        <span style={triesWrapStyle}>
          <input
            style={triesInputStyle}
            inputMode="numeric"
            placeholder="—"
            value={tries}
            disabled={isPending}
            onChange={(e) => setTries(e.target.value)}
            onBlur={commit}
            aria-label={`Tries on ${formatAppDate(row.performedAt, { month: "short", day: "numeric" })}`}
          />
          <span style={triesLabelStyle}>{saved ? "saved" : "tries"}</span>
        </span>
      ) : (
        <span style={{ ...triesLabelStyle, minWidth: 72, textAlign: "right" }}>first go</span>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.02)",
  minHeight: 44,
};

const dateLinkStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "inherit",
  textDecoration: "none",
  borderBottom: "1px dotted rgba(255,255,255,0.3)",
  flex: 1,
  minWidth: 0,
};

const triesWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
};

const triesInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: 56,
  textAlign: "center",
  padding: "6px 4px",
};

const triesLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.55,
};

const hintStyle: React.CSSProperties = { fontSize: 12, opacity: 0.6, padding: "6px 2px" };
