"use client";

import React, { useState, useEffect } from "react";
import { nanoid } from "nanoid";
import {
  climbOutcomeLabel,
  climbOutcomesForDiscipline,
  climbOutcomeColor,
  climbOutcomeBg,
  climbingDisciplineForTemplateKey,
  climbingDisciplineLabel,
  outcomeUsesTriesCount,
  climbNounForDiscipline,
  gradeSystemForDiscipline,
  gradeSystemForTemplateKey,
  type ClimbAreaBasic,
  type ClimbAttemptDraft,
  type ClimbOutcome,
  type ClimbProblemBasic,
  type ClimbingDiscipline,
  type QuickClimbRow,
} from "@/lib/climb-types";
import { climbingGradeOptionsForDiscipline } from "@/lib/session-templates";
import MediaUploader from "@/app/components/climbing/MediaUploader";

type AttemptHistoryItem = {
  id: string;
  outcome: ClimbOutcome;
  movesCompleted: number | null;
  totalMoves: number | null;
  notes: string | null;
  routineLog: { performedAt: string };
};

const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));

function isOutdoorTemplate(templateKey: string | null | undefined): boolean {
  return (templateKey ?? "").startsWith("outdoor-");
}

// ─── Quick Mode body ──────────────────────────────────────────────────────────
//
// Discipline-grouped grade tracker. Each row = N climbs at a specific
// discipline+grade, with flash / send / project counts. Rows are added
// individually (pick discipline → pick grade → tap +), so a single session
// can mix bouldering + rope work cleanly.

function QuickModeBody({
  activeDiscipline,
  onSelectDiscipline,
  rowsByDiscipline,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
}: {
  activeDiscipline: ClimbingDiscipline;
  onSelectDiscipline: (d: ClimbingDiscipline) => void;
  rowsByDiscipline: Map<ClimbingDiscipline, QuickClimbRow[]>;
  onAddRow: (discipline: ClimbingDiscipline, grade: string) => void;
  onUpdateRow: (localId: string, patch: Partial<QuickClimbRow>) => void;
  onRemoveRow: (localId: string) => void;
}) {
  const [pickerGrade, setPickerGrade] = useState<string>("");
  const allGrades = climbingGradeOptionsForDiscipline(activeDiscipline);
  const existing = new Set(
    (rowsByDiscipline.get(activeDiscipline) ?? []).map((r) => r.grade)
  );
  const available = allGrades.filter((g) => !existing.has(g));

  function commitAdd() {
    if (!pickerGrade) return;
    onAddRow(activeDiscipline, pickerGrade);
    setPickerGrade("");
  }

  // Render order: Boulder, Top Rope, Sport Lead. Empty disciplines hide so
  // the page stays compact for single-discipline sessions.
  const disciplineOrder: ClimbingDiscipline[] = ["BOULDER", "TOP_ROPE", "SPORT_LEAD"];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Discipline picker — shared with per-climb mode via parent state. */}
      <div>
        <div style={sectionLabelStyle}>Discipline</div>
        <div style={disciplineRowStyle}>
          {disciplineOrder.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onSelectDiscipline(d)}
              style={disciplinePillStyle(activeDiscipline === d)}
              aria-pressed={activeDiscipline === d}
            >
              {climbingDisciplineLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {/* Add row: grade dropdown + add button, filtered to the active discipline. */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ ...sectionLabelStyle, marginBottom: 0 }}>Add grade</div>
        <select
          value={pickerGrade}
          onChange={(e) => setPickerGrade(e.target.value)}
          style={quickPickerSelectStyle}
          disabled={available.length === 0}
        >
          <option value="">
            {available.length === 0 ? "All grades added" : "Pick a grade…"}
          </option>
          {available.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={commitAdd}
          disabled={!pickerGrade}
          style={pickerGrade ? quickAddButtonStyleActive : quickAddButtonStyle}
        >
          + Add
        </button>
      </div>

      {/* Discipline-grouped row tables */}
      {disciplineOrder.map((d) => {
        const rows = rowsByDiscipline.get(d) ?? [];
        if (rows.length === 0) return null;
        const flashLabel = d === "BOULDER" ? "Flash" : "Onsight";
        const sendLabel = d === "SPORT_LEAD" ? "Redpoint" : "Send";
        return (
          <div key={d} style={{ display: "grid", gap: 6 }}>
            <div style={quickDisciplineHeaderStyle}>{climbingDisciplineLabel(d)}</div>
            <div style={quickTableScrollStyle}>
              <div style={quickTableStyle}>
                <div style={quickHeaderStyle}>Grade</div>
                <div style={quickHeaderStyle}>{flashLabel}</div>
                <div style={quickHeaderStyle}>{sendLabel}</div>
                <div style={quickHeaderStyle}>Project</div>
                <div />
                {rows.map((row) => (
                  <React.Fragment key={row.localId}>
                    <div style={quickCellLabelStyle}>{row.grade}</div>
                    <input
                      style={quickInputStyle}
                      inputMode="numeric"
                      placeholder="0"
                      value={row.flashCount}
                      onChange={(e) => onUpdateRow(row.localId, { flashCount: e.target.value })}
                    />
                    <input
                      style={quickInputStyle}
                      inputMode="numeric"
                      placeholder="0"
                      value={row.sendCount}
                      onChange={(e) => onUpdateRow(row.localId, { sendCount: e.target.value })}
                    />
                    <input
                      style={quickInputStyle}
                      inputMode="numeric"
                      placeholder="0"
                      value={row.projectCount}
                      onChange={(e) => onUpdateRow(row.localId, { projectCount: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row.localId)}
                      style={quickRemoveButtonStyle}
                      aria-label={`Remove ${row.grade}`}
                    >
                      ×
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {Array.from(rowsByDiscipline.values()).every((rs) => rs.length === 0) && (
        <div style={{ fontSize: 12, opacity: 0.5, padding: "12px 0" }}>
          Pick a discipline + grade above to start logging climbs.
        </div>
      )}
    </div>
  );
}

// ─── Per-climb attempt row ────────────────────────────────────────────────────

function AttemptRow({
  attempt,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  savedProblems,
  savedAreas,
  areaDatalistId,
  onUpdateProblemNotes,
}: {
  attempt: ClimbAttemptDraft;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<ClimbAttemptDraft>) => void;
  onRemove: () => void;
  savedProblems: ClimbProblemBasic[];
  savedAreas: ClimbAreaBasic[];
  areaDatalistId: string;
  onUpdateProblemNotes?: (id: string, notes: string | null) => void;
}) {
  // Per-row discipline. Each climb logged in a mixed session keeps its own
  // discipline so the label, outcome list, and grade system stay correct
  // regardless of what the active picker currently shows.
  const discipline = attempt.discipline;
  const color = climbOutcomeColor(attempt.outcome);
  const bg = climbOutcomeBg(attempt.outcome);
  const label = climbOutcomeLabel(attempt.outcome, discipline);
  const linkedProblem = savedProblems.find((p) => p.id === attempt.problemId);
  const gradeProblems = savedProblems.filter((p) => p.grade === attempt.grade);
  // Repeat = a send-outcome attempt on a saved problem that already has at
  // least one prior send. Shown inline next to the outcome chip so the row
  // reads "Send · ↻ Repeat" at a glance.
  const isRepeat =
    attempt.isRepeat === true ||
    (!!linkedProblem &&
      (linkedProblem.priorSendCount ?? 0) > 0 &&
      (attempt.outcome === "SEND" ||
        attempt.outcome === "REDPOINT" ||
        attempt.outcome === "FLASH" ||
        attempt.outcome === "ONSIGHT"));

  const [history, setHistory] = useState<AttemptHistoryItem[] | null>(null);
  const [localBeta, setLocalBeta] = useState(linkedProblem?.notes ?? "");

  useEffect(() => {
    setLocalBeta(linkedProblem?.notes ?? "");
  }, [linkedProblem?.id, linkedProblem?.notes]);

  useEffect(() => {
    if (!expanded || !attempt.problemId) { setHistory(null); return; }
    fetch(`/api/climb-problems/${attempt.problemId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setHistory(data?.attempts ?? []))
      .catch(() => setHistory([]));
  }, [expanded, attempt.problemId]);

  const saveBeta = () => {
    if (!attempt.problemId) return;
    const trimmed = localBeta.trim() || null;
    fetch(`/api/climb-problems/${attempt.problemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: trimmed }),
    });
    onUpdateProblemNotes?.(attempt.problemId, trimmed);
  };

  return (
    <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 10px",
          background: "rgba(255,255,255,0.03)",
          cursor: "pointer",
          minWidth: 0,
        }}
        onClick={onToggleExpand}
      >
        <span style={{ ...gradePillStyle }}>{attempt.grade}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color, padding: "2px 7px", borderRadius: 999, background: bg, flexShrink: 0, whiteSpace: "nowrap" }}>
          {label}
        </span>
        {isRepeat && (
          <span style={repeatBadgeStyle} title={`Repeat — previously sent ${linkedProblem!.priorSendCount}×`}>
            ↻ Repeat
          </span>
        )}
        {(linkedProblem || attempt.newProblemName) && (
          <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
            {linkedProblem?.name ?? attempt.newProblemName}
          </span>
        )}
        {attempt.area && (
          <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.55, padding: "2px 6px", borderRadius: 6, background: "rgba(255,255,255,0.05)", flexShrink: 0, whiteSpace: "nowrap" }}>
            {attempt.area}
          </span>
        )}
        {!linkedProblem && !attempt.newProblemName && !attempt.area && attempt.movesCompleted != null && (
          <span style={{ fontSize: 11, opacity: 0.55, flexShrink: 0 }}>
            {attempt.movesCompleted}{attempt.totalMoves != null ? `/${attempt.totalMoves}` : ""} mvs
          </span>
        )}
        {!linkedProblem && !attempt.newProblemName && !attempt.area && !attempt.movesCompleted && attempt.notes && (
          <span style={{ fontSize: 11, opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
            {attempt.notes}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={attemptRemoveButtonStyle}
          aria-label="Remove attempt"
        >×</button>
        <span style={{ fontSize: 14, opacity: 0.4, flexShrink: 0, transition: "transform 120ms", transform: expanded ? "rotate(180deg)" : "none" }}>
          ▾
        </span>
      </div>

      {expanded && (
        <div style={{ padding: "10px 12px", display: "grid", gap: 10, borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)" }}>
          {/* Name this climb */}
          <div style={{ display: "grid", gap: 4 }}>
            <div style={expandLabelStyle}>{climbNounForDiscipline(discipline)} name (optional — saved for future visits)</div>
            {gradeProblems.length > 0 ? (
              <select
                style={expandSelectStyle}
                value={attempt.problemId ?? (attempt.newProblemName ? "__new__" : "")}
                onChange={(e) => {
                  if (e.target.value === "") {
                    onUpdate({ problemId: null, newProblemName: null });
                  } else if (e.target.value === "__new__") {
                    onUpdate({ problemId: null, newProblemName: attempt.newProblemName ?? "" });
                  } else {
                    onUpdate({ problemId: e.target.value, newProblemName: null });
                  }
                }}
              >
                <option value="">No name</option>
                {gradeProblems.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value="__new__">+ New name…</option>
              </select>
            ) : null}
            {(gradeProblems.length === 0 || attempt.problemId === null && attempt.newProblemName !== null && attempt.newProblemName !== undefined || (gradeProblems.length > 0 && !attempt.problemId && attempt.newProblemName !== null && attempt.newProblemName !== undefined)) && (
              <input
                style={expandInputStyle}
                placeholder={discipline === "BOULDER" ? "e.g. The Scoop, Pinch Crimp Right..." : "e.g. Crimson Cruiser, The Diagonal..."}
                value={attempt.newProblemName ?? ""}
                onChange={(e) => onUpdate({ newProblemName: e.target.value || null, problemId: null })}
              />
            )}
            {attempt.problemId && (
              <div style={{ display: "grid", gap: 4 }}>
                <div style={expandLabelStyle}>Beta notes (saved to problem)</div>
                <textarea
                  style={{ ...expandTextareaStyle, borderColor: "rgba(167,139,250,0.4)" }}
                  placeholder="Persistent beta for this climb…"
                  value={localBeta}
                  rows={2}
                  onChange={(e) => setLocalBeta(e.target.value)}
                  onBlur={saveBeta}
                />
              </div>
            )}
            {!attempt.problemId && linkedProblem?.notes && (
              <div style={{ fontSize: 11, opacity: 0.65, padding: "6px 8px", borderRadius: 6, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                Beta: {linkedProblem.notes}
              </div>
            )}
            {history && history.length > 0 && (
              <div style={{ display: "grid", gap: 4 }}>
                <div style={expandLabelStyle}>Previous attempts ({history.length})</div>
                <div style={{ display: "grid", gap: 4 }}>
                  {history.map((h) => {
                    const hColor = climbOutcomeColor(h.outcome);
                    const hBg = climbOutcomeBg(h.outcome);
                    return (
                      <div key={h.id} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: hColor, padding: "2px 7px", borderRadius: 999, background: hBg, flexShrink: 0 }}>
                          {climbOutcomeLabel(h.outcome, discipline)}
                        </span>
                        <span style={{ fontSize: 11, opacity: 0.55, flexShrink: 0 }}>
                          {dateLabel(h.routineLog.performedAt)}
                        </span>
                        {h.movesCompleted != null && (
                          <span style={{ fontSize: 11, opacity: 0.5, flexShrink: 0 }}>
                            {h.movesCompleted}{h.totalMoves != null ? `/${h.totalMoves}` : ""} mvs
                          </span>
                        )}
                        {h.notes && (
                          <span style={{ fontSize: 11, opacity: 0.6, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {h.notes}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {history !== null && history.length === 0 && attempt.problemId && (
              <div style={{ fontSize: 11, opacity: 0.45 }}>No previous attempts logged.</div>
            )}
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={expandLabelStyle}>Area / Wall (optional)</div>
            <input
              style={expandInputStyle}
              list={areaDatalistId}
              placeholder="e.g. Cave Wall, Sector 3, Hidden Valley"
              value={attempt.area ?? ""}
              onChange={(e) => {
                const next = e.target.value;
                // Match against saved areas case-insensitively. Matching →
                // link by areaId; new text → clear the id and let the
                // server materialize the row on save via newAreaName.
                const match = savedAreas.find(
                  (a) => a.name.toLowerCase() === next.trim().toLowerCase()
                );
                onUpdate({
                  area: next || null,
                  areaId: match?.id ?? null,
                  newAreaName: match ? null : next.trim() || null,
                });
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4, flex: "1 1 140px", minWidth: 140 }}>
              <div style={expandLabelStyle}>Moves (optional)</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  style={{ ...expandInputStyle, width: 60, textAlign: "center" }}
                  inputMode="numeric"
                  placeholder="—"
                  value={attempt.movesCompleted ?? ""}
                  onChange={(e) => onUpdate({ movesCompleted: e.target.value ? Number(e.target.value) : undefined })}
                />
                <span style={{ opacity: 0.4 }}>/</span>
                <input
                  style={{ ...expandInputStyle, width: 60, textAlign: "center" }}
                  inputMode="numeric"
                  placeholder="total"
                  value={attempt.totalMoves ?? ""}
                  onChange={(e) => onUpdate({ totalMoves: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>
            {/* Tries — only shown for outcomes where it matters. For SEND/
                REDPOINT this is "how many tries it took"; for PROJECT it's
                "how many tries so far." Flash/Onsight are implicitly 1, so
                we hide the input entirely. */}
            {outcomeUsesTriesCount(attempt.outcome) && (
              <div style={{ display: "grid", gap: 4, flex: "1 1 110px", minWidth: 110 }}>
                <div style={expandLabelStyle}>
                  {attempt.outcome === "PROJECT" ? "Tries so far (optional)" : "Tries to send (optional)"}
                </div>
                <input
                  style={{ ...expandInputStyle, width: 80, textAlign: "center" }}
                  inputMode="numeric"
                  placeholder="—"
                  value={attempt.triesCount ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      triesCount: e.target.value ? Math.max(1, Number(e.target.value)) : null,
                    })
                  }
                />
              </div>
            )}
            {/* Declared repeat — the badge above is otherwise derived from a
                saved problem's prior sends, which cannot cover a climb that
                was never saved. */}
            <div style={{ display: "grid", gap: 4, flex: "1 1 110px", minWidth: 110 }}>
              <div style={expandLabelStyle}>Climbed before?</div>
              <button
                type="button"
                onClick={() => onUpdate({ isRepeat: !attempt.isRepeat })}
                aria-pressed={attempt.isRepeat === true}
                style={attempt.isRepeat ? repeatToggleOnStyle : repeatToggleOffStyle}
              >
                ↻ Repeat
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={expandLabelStyle}>Beta notes & video link (optional)</div>
            <textarea
              style={expandTextareaStyle}
              placeholder={
                discipline === "BOULDER"
                  ? "Beta: left-hand sidepull at the crux, drop knee. Paste a video URL here too if you have one."
                  : "Beta: clip stance at bolt 4, knee scum at the crux. Paste a video URL here too if you have one."
              }
              value={attempt.notes ?? ""}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Per-climb photo button. Active only when this climb is linked
              to a saved problem — uploads attach there. Until then, the
              hint nudges naming + saving the row's problem first. */}
          <div style={{ display: "grid", gap: 4 }}>
            <div style={expandLabelStyle}>Photo / video link (optional)</div>
            {attempt.problemId ? (
              <MediaUploader target={{ kind: "problem", problemId: attempt.problemId }} />
            ) : (
              <div style={photoHintStyle}>
                {attempt.newProblemName
                  ? "Save the session first — photos for new climbs land on the problem page once it's stored."
                  : `Name this ${climbNounForDiscipline(discipline).toLowerCase()} above to attach photos to it.`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClimbSessionLogger({
  templateKey,
  defaultDiscipline,
  climbMode,
  onModeChange,
  attempts,
  onAttemptsChange,
  quickClimbRows,
  onQuickClimbRowsChange,
  savedProblems = [],
  climbLocationId,
  onMarkDirty,
  onUpdateProblemNotes,
}: {
  /** Session template key when the routine has one; null for synthetic
   *  quick-log routines. Drives indoor/outdoor labels only —
   *  `defaultDiscipline` wins for the discipline seed. */
  templateKey: string | null;
  /** Explicit starting discipline. Template-less climbing logs pass the
   *  discipline of what was actually climbed. */
  defaultDiscipline?: ClimbingDiscipline;
  climbMode: "quick" | "per-climb";
  onModeChange: (mode: "quick" | "per-climb") => void;
  attempts: ClimbAttemptDraft[];
  onAttemptsChange: (attempts: ClimbAttemptDraft[]) => void;
  quickClimbRows: QuickClimbRow[];
  onQuickClimbRowsChange: (rows: QuickClimbRow[]) => void;
  savedProblems?: ClimbProblemBasic[];
  /** Resolved id of the saved ClimbLocation tied to this session, when one
   *  exists. New (unsaved) locations don't have an id yet — the session-
   *  level photo button hides in that case, since photos need a parent. */
  climbLocationId?: string | null;
  onMarkDirty: () => void;
  onUpdateProblemNotes?: (id: string, notes: string | null) => void;
}) {
  const templateDiscipline = defaultDiscipline ?? climbingDisciplineForTemplateKey(templateKey);
  const templateGradeSystem = gradeSystemForTemplateKey(templateKey);

  // Per-climb mode local UI state. activeDiscipline starts from the session
  // template (so single-discipline sessions feel unchanged) but is sticky to
  // whatever the user last picked — supporting mixed-discipline sessions
  // without re-selecting on every climb.
  const [activeDiscipline, setActiveDiscipline] = useState<ClimbingDiscipline>(templateDiscipline);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [activeName, setActiveName] = useState("");
  // Active area pair — text plus matched saved-area id. Text drives the
  // input + datalist; the id is what we attach to the next ClimbAttempt
  // (null = new name, server materializes it via `newAreaName` on save).
  const [activeArea, setActiveArea] = useState("");
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Known-problems chip filter. Disjoint buckets by best outcome:
  // "flashed" (⚡ FLASH/ONSIGHT), "sent" (↻ clean send, never flashed),
  // "projects" (◌ attempted, never cleanly sent). Only rendered when the
  // location has enough problems that scrolling the chip strip gets slow.
  const [problemFilter, setProblemFilter] = useState<"all" | "flashed" | "sent" | "projects">("all");

  // Saved areas for this location — feeds the datalist on both the active
  // climb panel and each expanded attempt row. Refetched when the parent
  // location changes; cleared when the session has no saved location.
  const [savedAreas, setSavedAreas] = useState<ClimbAreaBasic[]>([]);
  useEffect(() => {
    if (!climbLocationId) { setSavedAreas([]); return; }
    let cancelled = false;
    fetch(`/api/climb-areas?locationId=${climbLocationId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setSavedAreas(data); })
      .catch(() => { if (!cancelled) setSavedAreas([]); });
    return () => { cancelled = true; };
  }, [climbLocationId]);
  const areaDatalistId = "climb-areas-datalist";

  const gradeSystem = gradeSystemForDiscipline(activeDiscipline);
  const allGrades = climbingGradeOptionsForDiscipline(activeDiscipline);
  const outcomes = climbOutcomesForDiscipline(activeDiscipline);
  const noun = climbNounForDiscipline(activeDiscipline);
  const nounPlural = noun === "Problem" ? "problems" : "routes";
  // Legacy alias — the rest of the file still reads `discipline` for labels.
  const discipline = activeDiscipline;
  // Suppress unused warning during the gradual refactor — templateGradeSystem
  // is reserved for routine-default behavior if we add it later.
  void templateGradeSystem;

  const activeProblem = selectedProblemId
    ? savedProblems.find((p) => p.id === selectedProblemId) ?? null
    : null;
  const activeProblemName = activeProblem?.name ?? activeName.trim();
  const activeAttemptCount = (() => {
    if (selectedProblemId) {
      return attempts.filter((a) => a.problemId === selectedProblemId).length;
    }
    if (activeName.trim() && selectedGrade) {
      const trimmed = activeName.trim().toLowerCase();
      return attempts.filter(
        (a) =>
          !a.problemId &&
          a.grade === selectedGrade &&
          (a.newProblemName ?? "").trim().toLowerCase() === trimmed
      ).length;
    }
    return 0;
  })();

  // ── Per-climb: add climb ────────────────────────────────────────────────────
  // Tapping an outcome COMMITS the climb (adds the row) AND auto-closes the
  // active climb panel. Discipline + area persist (likely to log another in
  // the same wall/discipline); grade, name, and saved-problem selection
  // clear so the next climb starts fresh. Re-tap or re-pick to log another.
  function addAttempt(outcome: ClimbOutcome) {
    if (!selectedGrade) return;
    const trimmedArea = activeArea.trim();
    const draft: ClimbAttemptDraft = {
      localId: nanoid(),
      discipline: activeDiscipline,
      grade: selectedGrade,
      gradeSystem,
      outcome,
      attemptOrder: attempts.length,
      problemId: selectedProblemId ?? null,
      newProblemName:
        !selectedProblemId && activeName.trim() ? activeName.trim() : null,
      area: trimmedArea || null,
      areaId: activeAreaId,
      // Only carry newAreaName when the typed text didn't match a saved
      // area. The server materializes it into a ClimbArea row on save.
      newAreaName: !activeAreaId && trimmedArea ? trimmedArea : null,
    };
    onAttemptsChange([draft, ...attempts]);
    onMarkDirty();
    // Auto-close: clear the stage so the user moves on. Keeps area + the
    // discipline so consecutive climbs in the same wall flow fast.
    setSelectedGrade(null);
    setSelectedProblemId(null);
    setActiveName("");
  }

  function clearActiveClimb() {
    setSelectedGrade(null);
    setSelectedProblemId(null);
    setActiveName("");
    setActiveArea("");
    setActiveAreaId(null);
    // Keep activeDiscipline — it's the sticky choice for the session.
  }

  // Switching discipline mid-session is a meaningful action — clear the
  // grade since grade systems differ (V vs YDS) and a stray V5 would be
  // invalid for top-rope. Name + area + problemId all clear too because
  // those reference a specific climb that doesn't carry across disciplines.
  function selectDiscipline(next: ClimbingDiscipline) {
    if (next === activeDiscipline) return;
    setActiveDiscipline(next);
    setSelectedGrade(null);
    setSelectedProblemId(null);
    setActiveName("");
  }

  function selectSavedProblem(problem: ClimbProblemBasic) {
    if (selectedProblemId === problem.id) {
      clearActiveClimb();
      return;
    }
    setSelectedProblemId(problem.id);
    setSelectedGrade(problem.grade);
    setActiveName(problem.name);
    // Picking a known problem carries its area along — the next attempt
    // lands in the right sector without retyping. Only when the problem
    // actually has area history; otherwise keep whatever the user picked.
    if (problem.areaId || problem.areaName) {
      setActiveArea(problem.areaName ?? "");
      setActiveAreaId(problem.areaId ?? null);
    }
  }

  function selectGrade(grade: string) {
    if (selectedGrade === grade && !selectedProblemId) {
      clearActiveClimb();
      return;
    }
    setSelectedGrade(grade);
    setSelectedProblemId(null);
    setActiveName("");
    // keep activeArea — likely climbing in the same area across multiple climbs
  }

  function updateAttempt(localId: string, patch: Partial<ClimbAttemptDraft>) {
    onAttemptsChange(attempts.map((a) => (a.localId === localId ? { ...a, ...patch } : a)));
    onMarkDirty();
  }

  function removeAttempt(localId: string) {
    onAttemptsChange(attempts.filter((a) => a.localId !== localId));
    onMarkDirty();
  }

  // ── Quick mode helpers ──────────────────────────────────────────────────────
  // ── Quick mode row helpers ──────────────────────────────────────────────────
  // Group rows by discipline so the UI can render a sub-grid per discipline.
  // Order: Boulder → Top Rope → Sport Lead, matching the picker.
  const rowsByDiscipline = (() => {
    const map = new Map<ClimbingDiscipline, QuickClimbRow[]>([
      ["BOULDER", []],
      ["TOP_ROPE", []],
      ["SPORT_LEAD", []],
    ]);
    for (const row of quickClimbRows) {
      const list = map.get(row.discipline) ?? [];
      list.push(row);
      map.set(row.discipline, list);
    }
    return map;
  })();

  function addQuickRow(targetDiscipline: ClimbingDiscipline, grade: string) {
    // Prevent duplicate discipline+grade combos — extra rows for the same
    // cell would split the counts confusingly. If the user picks an
    // existing combo, focus stays on the existing row.
    const exists = quickClimbRows.some(
      (r) => r.discipline === targetDiscipline && r.grade === grade
    );
    if (exists) return;
    const next: QuickClimbRow = {
      localId: nanoid(),
      discipline: targetDiscipline,
      grade,
      gradeSystem: gradeSystemForDiscipline(targetDiscipline),
      flashCount: "",
      sendCount: "",
      projectCount: "",
    };
    onQuickClimbRowsChange([...quickClimbRows, next]);
    onMarkDirty();
  }

  function updateQuickRow(localId: string, patch: Partial<QuickClimbRow>) {
    onQuickClimbRowsChange(quickClimbRows.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
    onMarkDirty();
  }

  function removeQuickRow(localId: string) {
    onQuickClimbRowsChange(quickClimbRows.filter((r) => r.localId !== localId));
    onMarkDirty();
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const summary = (() => {
    if (climbMode === "per-climb") {
      let flashes = 0, sends = 0, projects = 0;
      for (const a of attempts) {
        if (a.outcome === "FLASH" || a.outcome === "ONSIGHT") flashes++;
        else if (a.outcome === "SEND" || a.outcome === "REDPOINT") sends++;
        else if (a.outcome === "PROJECT") projects++;
        // FELL is no longer producible — historical FELL data sits in DB
        // but the live logger never creates it.
      }
      return { flashes, sends, projects, total: attempts.length };
    }
    // Quick mode summary aggregates across all discipline rows.
    let flashes = 0, sends = 0, projects = 0;
    for (const row of quickClimbRows) {
      flashes += parseInt(row.flashCount || "0") || 0;
      sends += parseInt(row.sendCount || "0") || 0;
      projects += parseInt(row.projectCount || "0") || 0;
    }
    return { flashes, sends, projects, total: flashes + sends + projects };
  })();

  return (
    <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
      {/* Shared area datalist — feeds both the active climb panel input
          and every expanded attempt row. Only rendered once per logger
          mount so duplicate ids don't pile up across attempts. */}
      <datalist id={areaDatalistId}>
        {savedAreas.map((a) => (
          <option key={a.id} value={a.name} />
        ))}
      </datalist>

      {/* Mode toggle */}
      <div style={modeToggleStyle}>
        <button
          type="button"
          onClick={() => onModeChange("per-climb")}
          style={modeToggleBtnStyle(climbMode === "per-climb")}
        >
          Per Climb
        </button>
        <button
          type="button"
          onClick={() => onModeChange("quick")}
          style={modeToggleBtnStyle(climbMode === "quick")}
        >
          Quick Log
        </button>
      </div>

      {/* Session-level photo uploader. Only shown when the location is
          already saved — photos need a parent FK. For new (unsaved) spots
          users add photos via the location detail page after first save. */}
      {climbLocationId ? (
        <details style={sessionPhotoSummaryStyle}>
          <summary style={sessionPhotoTriggerStyle}>
            <span>📷 Session photos</span>
            <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>
              (gym shot, parking, conditions…)
            </span>
          </summary>
          <div style={{ paddingTop: 8 }}>
            <MediaUploader target={{ kind: "location", locationId: climbLocationId }} />
          </div>
        </details>
      ) : null}

      {/* ─── Per Climb mode ─────────────────────────────────────────────────── */}
      {climbMode === "per-climb" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, minWidth: 0 }}>
          {/* Discipline picker — sticky for the session. Default from
              template; switching swaps grade system + outcome options. */}
          <div>
            <div style={sectionLabelStyle}>Discipline</div>
            <div style={disciplineRowStyle}>
              {(["BOULDER", "TOP_ROPE", "SPORT_LEAD"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => selectDiscipline(d)}
                  style={disciplinePillStyle(activeDiscipline === d)}
                  aria-pressed={activeDiscipline === d}
                >
                  {climbingDisciplineLabel(d)}
                </button>
              ))}
            </div>
          </div>

          {/* Saved problems at this location, filtered to the current
              discipline's grade system. Each chip carries an outcome badge
              (⚡ flashed · ↻ sent · ◌ project) colored from the climb-
              outcome palette so what-you-did-on-it reads at a glance.
              Filter pills (gated behind >6 problems so small lists stay
              clean) bucket by outcome. Area-aware: when the active climb
              panel has an area picked, the list narrows to that area's
              problems; with no area, each chip shows a dim area tag. */}
          {(() => {
            const systemProblems = savedProblems.filter((p) => p.gradeSystem === gradeSystem);
            if (systemProblems.length === 0) return null;

            const isFlashed = (p: ClimbProblemBasic) =>
              p.bestOutcome === "FLASH" || p.bestOutcome === "ONSIGHT";
            const isSent = (p: ClimbProblemBasic) =>
              p.bestOutcome === "SEND" || p.bestOutcome === "REDPOINT";
            const isProject = (p: ClimbProblemBasic) =>
              (p.priorSendCount ?? 0) === 0 && (p.priorAttemptCount ?? 0) > 0;

            const flashedProblems = systemProblems.filter(isFlashed);
            const sentProblems = systemProblems.filter(isSent);
            const projectProblems = systemProblems.filter(isProject);

            // Area narrowing — matches by structured id first, then by the
            // typed text (legacy free-text areas). Falls back to all areas
            // when nothing matches so the list never strands the user.
            const areaText = activeArea.trim().toLowerCase();
            const areaFilterOn = !!activeAreaId || areaText.length > 0;
            const matchesArea = (p: ClimbProblemBasic) => {
              if (activeAreaId && p.areaId === activeAreaId) return true;
              if (areaText && (p.areaName ?? "").trim().toLowerCase() === areaText) return true;
              return false;
            };

            const showFilter =
              systemProblems.length > 6 &&
              (flashedProblems.length > 0 || sentProblems.length > 0 || projectProblems.length > 0);

            // Filter only applies while its pills are visible — a stale
            // filter from a bigger location must not silently empty the
            // chip list at a location too small to render the pills.
            const bucketProblems =
              !showFilter ? systemProblems :
              problemFilter === "flashed" ? flashedProblems :
              problemFilter === "sent" ? sentProblems :
              problemFilter === "projects" ? projectProblems :
              systemProblems;
            const areaScoped = areaFilterOn ? bucketProblems.filter(matchesArea) : bucketProblems;
            const areaFallback = areaFilterOn && areaScoped.length === 0;
            const visibleProblems = areaFallback ? bucketProblems : areaScoped;
            // Show per-chip area tags whenever the list spans areas.
            const showAreaTags = !areaFilterOn || areaFallback;

            return (
              <div>
                <div style={sectionLabelStyle}>
                  Known {nounPlural}
                  {areaFilterOn && !areaFallback ? ` · ${activeArea.trim() || "this area"}` : " at this location"}
                </div>
                {showFilter && (
                  <div style={problemFilterRowStyle}>
                    {([
                      { value: "all" as const, label: `All (${systemProblems.length})` },
                      ...(flashedProblems.length > 0
                        ? [{ value: "flashed" as const, label: `⚡ Flashed (${flashedProblems.length})` }]
                        : []),
                      ...(sentProblems.length > 0
                        ? [{ value: "sent" as const, label: `↻ Sent (${sentProblems.length})` }]
                        : []),
                      ...(projectProblems.length > 0
                        ? [{ value: "projects" as const, label: `◌ Projects (${projectProblems.length})` }]
                        : []),
                    ]).map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setProblemFilter(tab.value)}
                        style={problemFilterPillStyle(problemFilter === tab.value)}
                        aria-pressed={problemFilter === tab.value}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
                {areaFallback && (
                  <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 6 }}>
                    Nothing recorded in {activeArea.trim() || "this area"} yet — showing all areas.
                  </div>
                )}
                <div style={gradeChipsScrollStyle}>
                  {visibleProblems.map((problem) => {
                    const isSelected = selectedProblemId === problem.id;
                    const priorSends = problem.priorSendCount ?? 0;
                    const badge = problemOutcomeBadge(problem);
                    return (
                      <button
                        key={problem.id}
                        type="button"
                        onClick={() => selectSavedProblem(problem)}
                        style={problemChipStyle(isSelected)}
                        title={badge?.title}
                      >
                        <span style={{ fontSize: 10, opacity: 0.7 }}>{problem.grade}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                          {problem.name}
                          {badge && (
                            <span style={outcomeBadgeStyle(badge.color, badge.bg)}>
                              {badge.glyph}
                              {priorSends > 1 ? `×${priorSends}` : ""}
                            </span>
                          )}
                          {showAreaTags && problem.areaName ? (
                            <span style={chipAreaTagStyle}>{problem.areaName}</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                  {visibleProblems.length === 0 && (
                    <span style={{ fontSize: 11, opacity: 0.5, padding: "6px 2px" }}>
                      Nothing in this bucket yet.
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Grade chip row */}
          <div>
            <div style={sectionLabelStyle}>Grade</div>
            <div style={gradeChipsScrollStyle}>
              {allGrades.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => selectGrade(grade)}
                  style={gradeChipStyle(selectedGrade === grade && !selectedProblemId)}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* Active climb panel — name, area, outcome buttons */}
          {selectedGrade && (
            <div style={activeClimbPanelStyle}>
              <div style={activeClimbHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                  <span style={activeClimbGradePillStyle}>{selectedGrade}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.65, letterSpacing: 0.3 }}>
                    {selectedProblemId
                      ? `${activeProblemName} · ${activeAttemptCount} attempt${activeAttemptCount !== 1 ? "s" : ""}${
                          (activeProblem?.priorSendCount ?? 0) > 0
                            ? ` · ↻ sent ${activeProblem!.priorSendCount}× before`
                            : ""
                        }`
                      : activeName.trim()
                        ? `${activeName.trim()} · ${activeAttemptCount} attempt${activeAttemptCount !== 1 ? "s" : ""}`
                        : "Tap an outcome to log a quick climb"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearActiveClimb}
                  style={activeClimbDoneBtnStyle}
                  aria-label="Clear active climb"
                >
                  Done
                </button>
              </div>

              {!selectedProblemId && (
                <div style={{ display: "grid", gap: 6 }}>
                  <input
                    style={activeInputStyle}
                    placeholder={`${noun} name (optional, e.g. ${discipline === "BOULDER" ? "The Scoop" : "Crimson Cruiser"})`}
                    value={activeName}
                    onChange={(e) => { setActiveName(e.target.value); onMarkDirty(); }}
                  />
                </div>
              )}

              <input
                style={activeInputStyle}
                list={areaDatalistId}
                placeholder={isOutdoorTemplate(templateKey) ? "Area (optional, e.g. Hidden Valley)" : "Area / Wall (optional, e.g. Cave Wall)"}
                value={activeArea}
                onChange={(e) => {
                  const next = e.target.value;
                  setActiveArea(next);
                  // Same matching trick used in AttemptRow — keeps the
                  // active area paired with a saved-area id when the user
                  // picks (or types) an existing area name.
                  const match = savedAreas.find(
                    (a) => a.name.toLowerCase() === next.trim().toLowerCase()
                  );
                  setActiveAreaId(match?.id ?? null);
                  onMarkDirty();
                }}
              />

              {activeProblem?.notes && (
                <div style={{ fontSize: 11, opacity: 0.7, padding: "6px 8px", borderRadius: 6, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                  Beta: {activeProblem.notes}
                </div>
              )}

              <div style={outcomeRowStyle}>
                {outcomes.map((outcome) => {
                  const color = climbOutcomeColor(outcome);
                  const bg = climbOutcomeBg(outcome);
                  return (
                    <button
                      key={outcome}
                      type="button"
                      onClick={() => addAttempt(outcome)}
                      style={outcomeBtnStyle(color, bg)}
                    >
                      <span style={{ fontSize: 18 }}>{outcomeEmoji(outcome)}</span>
                      <span style={{ fontSize: 12, fontWeight: 800 }}>
                        {climbOutcomeLabel(outcome, discipline)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: 11, opacity: 0.55, textAlign: "center" }}>
                Tap any outcome to log it. Keep tapping to add more attempts on the same climb.
              </div>
            </div>
          )}

          {/* Attempt list */}
          {attempts.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6, minWidth: 0 }}>
              <div style={sectionLabelStyle}>
                This session · {attempts.length} {attempts.length !== 1 ? nounPlural : noun.toLowerCase()}
              </div>
              {attempts.map((attempt) => (
                <AttemptRow
                  key={attempt.localId}
                  attempt={attempt}
                  expanded={expandedId === attempt.localId}
                  onToggleExpand={() =>
                    setExpandedId(expandedId === attempt.localId ? null : attempt.localId)
                  }
                  onUpdate={(patch) => updateAttempt(attempt.localId, patch)}
                  onRemove={() => removeAttempt(attempt.localId)}
                  savedProblems={savedProblems}
                  savedAreas={savedAreas}
                  areaDatalistId={areaDatalistId}
                  onUpdateProblemNotes={onUpdateProblemNotes}
                />
              ))}
            </div>
          )}

          {attempts.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.5, textAlign: "center", padding: "16px 0" }}>
              Tap a grade, then tap the outcome to log a {noun.toLowerCase()}.
            </div>
          )}
        </div>
      )}

      {/* ─── Quick mode ─────────────────────────────────────────────────────── */}
      {climbMode === "quick" && (
        <QuickModeBody
          activeDiscipline={activeDiscipline}
          onSelectDiscipline={selectDiscipline}
          rowsByDiscipline={rowsByDiscipline}
          onAddRow={addQuickRow}
          onUpdateRow={updateQuickRow}
          onRemoveRow={removeQuickRow}
        />
      )}

      {/* Summary strip — generic labels (FLASH/SEND) since mixed sessions
          can include onsight + flash and send + redpoint together. */}
      {summary.total > 0 && (
        <div style={summaryStripStyle}>
          {summary.flashes > 0 && (
            <span style={summaryChipStyle(climbOutcomeColor("FLASH"), climbOutcomeBg("FLASH"))}>
              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>
                FLASH
              </span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{summary.flashes}</span>
            </span>
          )}
          {summary.sends > 0 && (
            <span style={summaryChipStyle(climbOutcomeColor("SEND"), climbOutcomeBg("SEND"))}>
              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>SEND</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{summary.sends}</span>
            </span>
          )}
          {summary.projects > 0 && (
            <span style={summaryChipStyle(climbOutcomeColor("PROJECT"), climbOutcomeBg("PROJECT"))}>
              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>PROJECT</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{summary.projects}</span>
            </span>
          )}
          <span style={summaryChipStyle("rgba(255,255,255,0.6)", "rgba(255,255,255,0.05)")}>
            <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>TOTAL</span>
            <span style={{ fontSize: 18, fontWeight: 900 }}>{summary.total}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function outcomeEmoji(outcome: ClimbOutcome): string {
  if (outcome === "FLASH" || outcome === "ONSIGHT") return "⚡";
  if (outcome === "SEND" || outcome === "REDPOINT") return "✓";
  if (outcome === "FELL") return "✗";
  if (outcome === "PROJECT") return "🎯";
  return "·";
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const modeToggleStyle: React.CSSProperties = {
  display: "flex",
  border: "1px solid rgba(128,128,128,0.4)",
  borderRadius: 10,
  overflow: "hidden",
  alignSelf: "start",
};

function modeToggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    border: "none",
    background: active ? "rgba(120,190,255,0.18)" : "transparent",
    color: active ? "rgba(120,190,255,1)" : "rgba(255,255,255,0.5)",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  };
}

const activeClimbPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(120,190,255,0.35)",
  background: "rgba(120,190,255,0.06)",
  minWidth: 0,
};

const activeClimbHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const activeClimbGradePillStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  padding: "3px 10px",
  borderRadius: 8,
  background: "rgba(120,190,255,0.18)",
  border: "1px solid rgba(120,190,255,0.35)",
  color: "rgba(120,190,255,1)",
  flexShrink: 0,
};

const activeClimbDoneBtnStyle: React.CSSProperties = {
  padding: "5px 12px",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
  flexShrink: 0,
};

const activeInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "9px 11px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
  fontSize: 14,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.65,
  marginBottom: 6,
  letterSpacing: 0.3,
};

const gradeChipsScrollStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  overflowX: "auto",
  overflowY: "hidden",
  paddingBottom: 4,
};

// Discipline pill row — tight 3-button group, sticky in scroll on mobile.
const disciplineRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

function disciplinePillStyle(active: boolean): React.CSSProperties {
  return {
    flex: "1 1 90px",
    minHeight: 40,
    padding: "8px 14px",
    borderRadius: 10,
    border: active ? "1px solid rgba(120,190,255,0.55)" : "1px solid rgba(128,128,128,0.35)",
    background: active ? "rgba(120,190,255,0.16)" : "rgba(128,128,128,0.06)",
    color: active ? "rgba(120,190,255,1)" : "rgba(255,255,255,0.85)",
    fontWeight: 800,
    fontSize: 12.5,
    letterSpacing: 0.2,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function gradeChipStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    padding: "8px 14px",
    borderRadius: 10,
    border: active ? "1px solid rgba(120,190,255,0.6)" : "1px solid rgba(128,128,128,0.4)",
    background: active ? "rgba(120,190,255,0.18)" : "rgba(128,128,128,0.07)",
    color: active ? "rgba(120,190,255,1)" : "inherit",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    minWidth: 44,
    textAlign: "center" as const,
  };
}

function problemChipStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    padding: "6px 12px",
    borderRadius: 10,
    border: active ? "1px solid rgba(167,139,250,0.6)" : "1px solid rgba(128,128,128,0.4)",
    background: active ? "rgba(167,139,250,0.18)" : "rgba(128,128,128,0.07)",
    color: active ? "rgba(167,139,250,1)" : "inherit",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  };
}

const outcomeRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

function outcomeBtnStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "14px 6px",
    borderRadius: 12,
    border: `1px solid ${color.replace("0.9", "0.35")}`,
    background: bg,
    color: "inherit",
    cursor: "pointer",
    fontSize: 12,
    minWidth: 0,
    overflow: "hidden",
    textAlign: "center" as const,
  };
}

const gradePillStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  padding: "2px 8px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  flexShrink: 0,
};

const removeButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.55)",
  fontWeight: 900,
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const attemptRemoveButtonStyle: React.CSSProperties = {
  ...removeButtonStyle,
  width: 26,
  height: 26,
  fontSize: 16,
};

const expandLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.65,
};

const expandSelectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  fontSize: 13,
  cursor: "pointer",
};

const expandInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "8px 10px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  fontSize: 14,
};

const expandTextareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  fontSize: 13,
  resize: "vertical" as const,
  fontFamily: "inherit",
};

const quickTableScrollStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
};

const quickTableStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(28px, 1fr) minmax(40px, 56px) minmax(40px, 56px) minmax(40px, 56px) 28px",
  gap: 4,
  alignItems: "center",
  minWidth: 0,
};

const quickHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.6,
  textAlign: "center" as const,
  minWidth: 0,
};

const quickCellLabelStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const quickInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "8px 2px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 700,
  textAlign: "center" as const,
  boxSizing: "border-box",
};

const quickRemoveButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.55)",
  fontWeight: 900,
  fontSize: 16,
  lineHeight: 1,
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// Quick-mode grade picker dropdown (paired with the + Add button).
const quickPickerSelectStyle: React.CSSProperties = {
  flex: "1 1 140px",
  minHeight: 40,
  padding: "8px 10px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const quickAddButtonStyle: React.CSSProperties = {
  minHeight: 40,
  padding: "8px 14px",
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.06)",
  color: "rgba(255,255,255,0.5)",
  fontSize: 13,
  fontWeight: 900,
  cursor: "not-allowed",
};

const quickAddButtonStyleActive: React.CSSProperties = {
  ...quickAddButtonStyle,
  border: "1px solid rgba(120,190,255,0.55)",
  background: "rgba(120,190,255,0.16)",
  color: "rgba(120,190,255,1)",
  cursor: "pointer",
};

// Sub-header above each discipline's grade table in quick mode.
const quickDisciplineHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  opacity: 0.65,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  paddingTop: 2,
};

// Session-level photo uploader collapsed by default — keeps the climb
// logger above-the-fold clean; expanded with one tap when the user wants
// to add a gym/crag photo.
const sessionPhotoSummaryStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
};

const sessionPhotoTriggerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
  listStyle: "none",
};

// Hint shown in the per-climb photo slot when the climb isn't linked to a
// saved problem yet. Two distinct messages depending on whether the user
// has typed a name or not.
const photoHintStyle: React.CSSProperties = {
  fontSize: 11.5,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.02)",
  color: "rgba(255,255,255,0.6)",
  lineHeight: 1.4,
};

const summaryStripStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

function summaryChipStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    flex: "1 1 60px",
    padding: "8px 10px",
    border: `1px solid ${color.replace("0.9", "0.25")}`,
    borderRadius: 10,
    background: bg,
    color,
  };
}

// Small ↻ marker shown on saved-problem chips (and per-climb attempt rows)
// when the underlying problem has prior sends — visual cue that a tap on
// this chip is logging a repeat send, not a first ascent.
const repeatToggleOnStyle: React.CSSProperties = {
  minHeight: 34,
  padding: "0 10px",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  background: "rgba(74,222,128,0.16)",
  border: "1px solid rgba(74,222,128,0.5)",
  color: "rgba(74,222,128,0.95)",
};
const repeatToggleOffStyle: React.CSSProperties = {
  ...repeatToggleOnStyle,
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.16)",
  color: "rgba(255,255,255,0.5)",
};
const repeatBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  padding: "1px 5px",
  borderRadius: 6,
  background: "rgba(74,222,128,0.12)",
  border: "1px solid rgba(74,222,128,0.35)",
  color: "rgba(74,222,128,0.95)",
  whiteSpace: "nowrap",
  lineHeight: 1,
};

// Outcome badge for known-problem chips. Colors come from the canonical
// climb-outcome palette (lib/climb-types) so flash amber / send green /
// project violet match every other climbing surface.
function problemOutcomeBadge(problem: ClimbProblemBasic): {
  glyph: string;
  color: string;
  bg: string;
  title: string;
} | null {
  const best = problem.bestOutcome ?? null;
  const sends = problem.priorSendCount ?? 0;
  const attemptsCount = problem.priorAttemptCount ?? 0;
  if (best === "FLASH" || best === "ONSIGHT") {
    return {
      glyph: "⚡",
      color: climbOutcomeColor(best),
      bg: climbOutcomeBg(best),
      title: `${best === "FLASH" ? "Flashed" : "Onsighted"}${sends > 1 ? ` · ${sends} clean sends total` : ""} — tap to log a repeat`,
    };
  }
  if (best === "SEND" || best === "REDPOINT") {
    return {
      glyph: "↻",
      color: climbOutcomeColor(best),
      bg: climbOutcomeBg(best),
      title: `Sent ${sends}× before — tap to log a repeat`,
    };
  }
  if (attemptsCount > 0) {
    return {
      glyph: "◌",
      color: climbOutcomeColor("PROJECT"),
      bg: climbOutcomeBg("PROJECT"),
      title: `Project — ${attemptsCount} attempt${attemptsCount === 1 ? "" : "s"}, no clean send yet`,
    };
  }
  return null;
}

function outcomeBadgeStyle(color: string, bg: string): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 900,
    padding: "1px 5px",
    borderRadius: 6,
    background: bg,
    border: `1px solid ${color}`,
    color,
    whiteSpace: "nowrap",
    lineHeight: 1,
    flexShrink: 0,
  };
}

const chipAreaTagStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  opacity: 0.5,
  padding: "1px 5px",
  borderRadius: 5,
  background: "rgba(255,255,255,0.05)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 90,
  flexShrink: 0,
};

const problemFilterRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginBottom: 8,
};

function problemFilterPillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: active ? "rgba(120,190,255,0.45)" : "rgba(255,255,255,0.12)",
    background: active ? "rgba(120,190,255,0.15)" : "rgba(255,255,255,0.04)",
    color: active ? "rgba(191,219,254,0.98)" : "rgba(255,255,255,0.78)",
    fontSize: 11.5,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
