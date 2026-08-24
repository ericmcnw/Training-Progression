"use client";

// Problem library for a single ClimbLocation. Renders every named problem
// at this spot, grouped by grade descending. Tabs filter by status:
//   All       — every named problem
//   Sent      — at least one clean send (FLASH/ONSIGHT/SEND/REDPOINT)
//   Projects  — at least one PROJECT or FELL, never a clean send
//   Unsent    — no attempts yet (rare, requires problems created via merge
//               or future bulk-import; we still show the bucket for clarity)
//
// Each row expands inline (no new route) to show beta notes and inline
// rename. Mobile: rows are tall enough for thumb taps; expanded form
// inputs use the same chrome as other climbing UI.

import { useMemo, useState, useTransition } from "react";
import { formatAppDate } from "@/lib/dates";
import {
  climbOutcomeBg,
  climbOutcomeColor,
  climbOutcomeLabel,
  gradeSort,
  SENT_OUTCOMES,
  type ClimbGradeSystem,
  type ClimbOutcome,
} from "@/lib/climb-types";
import MediaGallery, { type GalleryMediaItem } from "@/app/components/climbing/MediaGallery";
import MediaUploader from "@/app/components/climbing/MediaUploader";
import { renameClimbProblem, setClimbProblemTickList, updateClimbProblemNotes } from "./actions";

export type ProblemLibraryEntry = {
  id: string;
  name: string;
  grade: string;
  gradeSystem: ClimbGradeSystem;
  notes: string | null;
  attemptCount: number;
  lastAttempt: Date | null;
  bestOutcome: ClimbOutcome | null;
  onTickList: boolean;
  /** Photos + links attached to this specific problem. Independent from
   *  the location-level gallery; persists across sessions just like notes. */
  media: GalleryMediaItem[];
};

type StatusFilter = "all" | "ticklist" | "sent" | "projects" | "unsent";

export default function ProblemLibrary({ entries }: { entries: ProblemLibraryEntry[] }) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    let sent = 0;
    let projects = 0;
    let unsent = 0;
    let ticklist = 0;
    for (const e of entries) {
      if (e.onTickList) ticklist += 1;
      if (e.bestOutcome !== null && SENT_OUTCOMES.has(e.bestOutcome)) sent += 1;
      else if (e.bestOutcome !== null) projects += 1;
      else unsent += 1;
    }
    return { all: entries.length, ticklist, sent, projects, unsent };
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filter === "all") return true;
      if (filter === "ticklist") return e.onTickList;
      if (filter === "sent") return e.bestOutcome !== null && SENT_OUTCOMES.has(e.bestOutcome);
      if (filter === "projects") return e.bestOutcome !== null && !SENT_OUTCOMES.has(e.bestOutcome);
      // unsent
      return e.bestOutcome === null;
    });
  }, [entries, filter]);

  // Group by grade descending.
  const grouped = useMemo(() => {
    const map = new Map<string, ProblemLibraryEntry[]>();
    for (const e of filtered) {
      const key = `${e.gradeSystem}::${e.grade}`;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return [...map.entries()]
      .map(([key, items]) => ({ key, grade: items[0].grade, system: items[0].gradeSystem, items }))
      .sort((a, b) => gradeSort(b.grade, b.system) - gradeSort(a.grade, a.system));
  }, [filtered]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Filter tabs */}
      <div style={tabRowStyle}>
        {([
          { value: "all", label: `All (${counts.all})` },
          ...(counts.ticklist > 0 ? [{ value: "ticklist" as const, label: `★ Tick list (${counts.ticklist})` }] : []),
          { value: "sent", label: `Sent (${counts.sent})` },
          { value: "projects", label: `Projects (${counts.projects})` },
          ...(counts.unsent > 0 ? [{ value: "unsent", label: `Unsent (${counts.unsent})` }] : []),
        ] as Array<{ value: StatusFilter; label: string }>).map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            style={filter === tab.value ? tabActiveStyle : tabStyle}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Groups */}
      {grouped.length === 0 ? (
        <div style={emptyStyle}>No problems match this filter.</div>
      ) : (
        grouped.map((group) => (
          <div key={group.key} style={{ display: "grid", gap: 4 }}>
            <div style={gradeHeaderStyle}>
              {group.grade}
              <span style={{ opacity: 0.5, fontWeight: 700, marginLeft: 6 }}>
                {group.items.length} problem{group.items.length === 1 ? "" : "s"}
              </span>
            </div>
            {group.items.map((problem) => (
              <ProblemRow
                key={problem.id}
                problem={problem}
                expanded={expandedId === problem.id}
                onToggle={() => setExpandedId((cur) => (cur === problem.id ? null : problem.id))}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function ProblemRow({
  problem,
  expanded,
  onToggle,
}: {
  problem: ProblemLibraryEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(problem.name);
  const [notesDraft, setNotesDraft] = useState(problem.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [ticked, setTicked] = useState(problem.onTickList);
  const [error, setError] = useState<string | null>(null);

  function toggleTick() {
    const next = !ticked;
    setTicked(next);
    setError(null);
    startTransition(async () => {
      try {
        await setClimbProblemTickList({ id: problem.id, onTickList: next });
      } catch {
        setTicked(!next);
        setError("Couldn't update tick list");
      }
    });
  }

  function saveName() {
    if (!nameDraft.trim()) {
      setError("Name can't be empty");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await renameClimbProblem({ id: problem.id, name: nameDraft });
        setEditingName(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't rename");
      }
    });
  }

  function saveNotes() {
    setError(null);
    startTransition(async () => {
      try {
        await updateClimbProblemNotes({ id: problem.id, notes: notesDraft || null });
        setEditingNotes(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save notes");
      }
    });
  }

  return (
    <div
      style={{
        ...rowStyle,
        ...(expanded ? rowExpandedStyle : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          type="button"
          onClick={toggleTick}
          style={ticked ? starOnStyle : starOffStyle}
          aria-pressed={ticked}
          aria-label={ticked ? `Remove ${problem.name} from tick list` : `Add ${problem.name} to tick list`}
          title={ticked ? "On your tick list" : "Add to tick list"}
        >
          {ticked ? "★" : "☆"}
        </button>
        <button type="button" onClick={onToggle} style={rowMainStyle} aria-expanded={expanded}>
          <span style={gradeChipStyle(problem.bestOutcome)}>{problem.grade}</span>
          <span style={{ display: "grid", gap: 1, minWidth: 0, flex: 1, textAlign: "left" }}>
            <span style={nameStyle}>{problem.name}</span>
            <span style={metaStyle}>
              {problem.attemptCount > 0
                ? `${problem.attemptCount} attempt${problem.attemptCount === 1 ? "" : "s"}`
                : "Not yet attempted"}
              {problem.lastAttempt
                ? ` · last ${formatAppDate(problem.lastAttempt, { month: "short", day: "numeric" })}`
                : ""}
            </span>
          </span>
          {problem.bestOutcome && (
            <span style={outcomeChipStyle(problem.bestOutcome, problem.gradeSystem)}>
              {climbOutcomeLabel(problem.bestOutcome, problem.gradeSystem)}
            </span>
          )}
          <span style={{ fontSize: 11, opacity: 0.4 }}>{expanded ? "▴" : "▾"}</span>
        </button>
      </div>

      {expanded && (
        <div style={expandedBody}>
          {/* Name editor */}
          <div style={editRow}>
            <div style={editLabel}>Name</div>
            {editingName ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  style={inputStyle}
                  autoFocus
                />
                <button type="button" onClick={saveName} disabled={isPending} style={primaryBtn}>
                  {isPending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(problem.name);
                    setEditingName(false);
                  }}
                  style={ghostBtn}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{problem.name}</span>
                <button type="button" onClick={() => setEditingName(true)} style={ghostBtn}>
                  ✎ Rename
                </button>
              </div>
            )}
          </div>

          {/* Notes editor (beta) */}
          <div style={editRow}>
            <div style={editLabel}>Beta / notes</div>
            {editingNotes ? (
              <div style={{ display: "grid", gap: 6 }}>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                  placeholder="Sequences, holds to remember, conditions to look for…"
                  autoFocus
                />
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setNotesDraft(problem.notes ?? "");
                      setEditingNotes(false);
                    }}
                    style={ghostBtn}
                  >
                    Cancel
                  </button>
                  <button type="button" onClick={saveNotes} disabled={isPending} style={primaryBtn}>
                    {isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <p
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.45,
                    flex: 1,
                    opacity: problem.notes ? 0.9 : 0.5,
                    fontStyle: problem.notes ? undefined : "italic",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {problem.notes || "No notes yet."}
                </p>
                <button type="button" onClick={() => setEditingNotes(true)} style={ghostBtn}>
                  ✎ Edit
                </button>
              </div>
            )}
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          {/* Per-problem photos & links. Scoped via target.problemId so
              uploads land on this problem (not the parent location). The
              gallery + uploader share the responsive grid CSS from
              globals.css so both PC and mobile breakpoints just work. */}
          <div style={editRow}>
            <div style={editLabel}>
              Photos & links
              {problem.media.length > 0 ? ` (${problem.media.length})` : ""}
            </div>
            <MediaUploader target={{ kind: "problem", problemId: problem.id }} />
            <MediaGallery
              items={problem.media}
              emptyHint="No photos for this problem yet — add a topo, beta shot, or send video above."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const tabRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const tabStyle: React.CSSProperties = {
  padding: "6px 11px",
  borderRadius: 999,
  // Split into long-hand so `tabActiveStyle` can override `borderColor`
  // without React's "removing borderColor with shorthand border set"
  // warning when toggling between active/inactive on the same button.
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.78)",
  fontSize: 11.5,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const tabActiveStyle: React.CSSProperties = {
  ...tabStyle,
  background: "rgba(120,190,255,0.15)",
  borderColor: "rgba(120,190,255,0.45)",
  color: "rgba(191,219,254,0.98)",
};

const gradeHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.4,
  opacity: 0.7,
  paddingTop: 6,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.02)",
};

const rowExpandedStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const rowMainStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 10px 9px 2px",
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  minHeight: 44,
  flex: 1,
  minWidth: 0,
};

const starBaseStyle: React.CSSProperties = {
  width: 40,
  minHeight: 44,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 17,
  lineHeight: 1,
  padding: 0,
  touchAction: "manipulation",
};

const starOnStyle: React.CSSProperties = { ...starBaseStyle, color: "#fbbf24" };

const starOffStyle: React.CSSProperties = { ...starBaseStyle, color: "rgba(255,255,255,0.26)" };

const nameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const metaStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
};

function gradeChipStyle(outcome: ClimbOutcome | null): React.CSSProperties {
  const color = outcome === null ? "rgba(255,255,255,0.55)" : climbOutcomeColor(outcome);
  const bg = outcome === null ? "rgba(255,255,255,0.05)" : climbOutcomeBg(outcome);
  return {
    fontSize: 12,
    fontWeight: 900,
    padding: "3px 8px",
    borderRadius: 8,
    color,
    background: bg,
    border: `1px solid ${color.replace("0.9)", "0.32)").replace("0.95)", "0.32)").replace("0.55)", "0.22)")}`,
    minWidth: 38,
    textAlign: "center",
    flexShrink: 0,
  };
}

function outcomeChipStyle(outcome: ClimbOutcome, system: ClimbGradeSystem): React.CSSProperties {
  const _label = climbOutcomeLabel(outcome, system);
  void _label;
  return {
    fontSize: 10,
    fontWeight: 900,
    padding: "3px 7px",
    borderRadius: 6,
    color: climbOutcomeColor(outcome),
    background: climbOutcomeBg(outcome),
    border: `1px solid ${climbOutcomeColor(outcome).replace("0.9)", "0.3)").replace("0.95)", "0.3)")}`,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    flexShrink: 0,
  };
}

const expandedBody: React.CSSProperties = {
  padding: "10px 12px 12px",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  display: "grid",
  gap: 12,
};

const editRow: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const editLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  opacity: 0.55,
  textTransform: "uppercase",
};

// fontSize: 16 — iOS Safari auto-zooms on focus when < 16; see CLAUDE.md rule 3a.
const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 600,
  outline: "none",
  width: "100%",
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(120,190,255,0.45)",
  background: "rgba(120,190,255,0.18)",
  color: "rgba(191,219,254,0.98)",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "7px 11px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "transparent",
  color: "rgba(255,255,255,0.85)",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const errorStyle: React.CSSProperties = {
  fontSize: 11.5,
  padding: "7px 10px",
  borderRadius: 8,
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.32)",
  color: "rgba(248,113,113,0.95)",
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.55,
  padding: "12px 4px",
  textAlign: "center",
};
