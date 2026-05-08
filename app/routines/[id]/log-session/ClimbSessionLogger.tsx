"use client";

import React, { useState, useEffect } from "react";
import { nanoid } from "nanoid";
import {
  climbOutcomeLabel,
  climbOutcomesForDiscipline,
  climbOutcomeColor,
  climbOutcomeBg,
  climbingDisciplineForTemplateKey,
  climbNounForDiscipline,
  gradeSystemForTemplateKey,
  type ClimbAttemptDraft,
  type ClimbOutcome,
  type ClimbProblemBasic,
  type ClimbingDiscipline,
} from "@/lib/climb-types";
import { climbingGradeOptions } from "@/lib/session-templates";
import type { SessionMetricDefinitionWithConfig } from "@/lib/session-templates";
import type { SessionMetricDraftValue } from "./SessionMetricFields";

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

// ─── Quick Mode grade row ─────────────────────────────────────────────────────

function QuickGradeRow({
  grade,
  flashValue,
  sendValue,
  attemptedValue,
  flashDefId,
  sendDefId,
  onFlashChange,
  onSendChange,
  onAttemptedChange,
  onRemove,
}: {
  grade: string;
  flashValue: string;
  sendValue: string;
  attemptedValue: string;
  flashDefId: string | null;
  sendDefId: string | null;
  onFlashChange: (id: string, val: string) => void;
  onSendChange: (id: string, val: string) => void;
  onAttemptedChange: (grade: string, val: string) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <div style={quickCellLabelStyle}>{grade}</div>
      <input
        style={quickInputStyle}
        inputMode="numeric"
        placeholder="0"
        value={flashValue}
        onChange={(e) => flashDefId && onFlashChange(flashDefId, e.target.value)}
      />
      <input
        style={quickInputStyle}
        inputMode="numeric"
        placeholder="0"
        value={sendValue}
        onChange={(e) => sendDefId && onSendChange(sendDefId, e.target.value)}
      />
      <input
        style={quickInputStyle}
        inputMode="numeric"
        placeholder="0"
        value={attemptedValue}
        onChange={(e) => onAttemptedChange(grade, e.target.value)}
      />
      <button type="button" onClick={onRemove} style={quickRemoveButtonStyle}>×</button>
    </>
  );
}

// ─── Per-climb attempt row ────────────────────────────────────────────────────

function AttemptRow({
  attempt,
  discipline,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  savedProblems,
  onUpdateProblemNotes,
}: {
  attempt: ClimbAttemptDraft;
  discipline: ClimbingDiscipline;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<ClimbAttemptDraft>) => void;
  onRemove: () => void;
  savedProblems: ClimbProblemBasic[];
  onUpdateProblemNotes?: (id: string, notes: string | null) => void;
}) {
  const color = climbOutcomeColor(attempt.outcome);
  const bg = climbOutcomeBg(attempt.outcome);
  const label = climbOutcomeLabel(attempt.outcome, discipline);
  const linkedProblem = savedProblems.find((p) => p.id === attempt.problemId);
  const gradeProblems = savedProblems.filter((p) => p.grade === attempt.grade);

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
              placeholder="e.g. Cave Wall, Sector 3, Hidden Valley"
              value={attempt.area ?? ""}
              onChange={(e) => onUpdate({ area: e.target.value || null })}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: 4, flex: 1 }}>
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
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClimbSessionLogger({
  templateKey,
  climbMode,
  onModeChange,
  attempts,
  onAttemptsChange,
  definitions,
  quickValues,
  quickAttemptedValues,
  selectedGrades,
  savedProblems = [],
  onQuickValuesChange,
  onQuickAttemptedChange,
  onSelectedGradesChange,
  onMarkDirty,
  onUpdateProblemNotes,
}: {
  templateKey: string;
  climbMode: "quick" | "per-climb";
  onModeChange: (mode: "quick" | "per-climb") => void;
  attempts: ClimbAttemptDraft[];
  onAttemptsChange: (attempts: ClimbAttemptDraft[]) => void;
  definitions: SessionMetricDefinitionWithConfig[];
  quickValues: Record<string, SessionMetricDraftValue>;
  quickAttemptedValues: Record<string, string>;
  selectedGrades: string[];
  savedProblems?: ClimbProblemBasic[];
  onQuickValuesChange: (id: string, value: SessionMetricDraftValue) => void;
  onQuickAttemptedChange: (grade: string, value: string) => void;
  onSelectedGradesChange: (grades: string[]) => void;
  onMarkDirty: () => void;
  onUpdateProblemNotes?: (id: string, notes: string | null) => void;
}) {
  const gradeSystem = gradeSystemForTemplateKey(templateKey);
  const discipline = climbingDisciplineForTemplateKey(templateKey);
  const allGrades = climbingGradeOptions(templateKey);
  const outcomes = climbOutcomesForDiscipline(discipline);
  const noun = climbNounForDiscipline(discipline);
  const nounPlural = noun === "Problem" ? "problems" : "routes";

  // Per-climb mode local UI state
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [activeName, setActiveName] = useState("");
  const [activeArea, setActiveArea] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // ── Per-climb: add attempt ──────────────────────────────────────────────────
  function addAttempt(outcome: ClimbOutcome) {
    if (!selectedGrade) return;
    const draft: ClimbAttemptDraft = {
      localId: nanoid(),
      grade: selectedGrade,
      gradeSystem,
      outcome,
      attemptOrder: attempts.length,
      problemId: selectedProblemId ?? null,
      newProblemName:
        !selectedProblemId && activeName.trim() ? activeName.trim() : null,
      area: activeArea.trim() || null,
    };
    onAttemptsChange([draft, ...attempts]);
    onMarkDirty();
    // Keep grade/name/area/problemId selected so the user can rapidly add more
    // attempts to the same climb (e.g. Project → Fell → Fell → Send).
  }

  function clearActiveClimb() {
    setSelectedGrade(null);
    setSelectedProblemId(null);
    setActiveName("");
    setActiveArea("");
  }

  function selectSavedProblem(problem: ClimbProblemBasic) {
    if (selectedProblemId === problem.id) {
      clearActiveClimb();
      return;
    }
    setSelectedProblemId(problem.id);
    setSelectedGrade(problem.grade);
    setActiveName(problem.name);
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
  const gradeRows = (() => {
    const gradeMap = new Map<
      string,
      { grade: string; flashDefId: string | null; sendDefId: string | null }
    >();
    for (const def of definitions) {
      const config = def.config;
      if (!config?.gradeBucket || !config?.climbingColumn) continue;
      const grade = config.gradeBucket as string;
      const current = gradeMap.get(grade) ?? { grade, flashDefId: null, sendDefId: null };
      if (config.climbingColumn === "FLASHED") current.flashDefId = def.id;
      else current.sendDefId = def.id;
      gradeMap.set(grade, current);
    }
    return Array.from(gradeMap.values()).filter((r) => selectedGrades.includes(r.grade));
  })();

  const availableGradesForQuick = allGrades.filter((g) => !selectedGrades.includes(g));

  // ── Summary ─────────────────────────────────────────────────────────────────
  const summary = (() => {
    if (climbMode === "per-climb") {
      let flashes = 0, sends = 0, fells = 0, projects = 0;
      for (const a of attempts) {
        if (a.outcome === "FLASH" || a.outcome === "ONSIGHT") flashes++;
        else if (a.outcome === "SEND" || a.outcome === "REDPOINT") sends++;
        else if (a.outcome === "FELL") fells++;
        else if (a.outcome === "PROJECT") projects++;
      }
      return { flashes, sends, fells, projects, total: attempts.length };
    }
    // Quick mode summary
    let flashes = 0, sends = 0, fells = 0;
    for (const row of gradeRows) {
      flashes += parseInt(quickValues[row.flashDefId ?? ""]?.numberValue ?? "0") || 0;
      sends += parseInt(quickValues[row.sendDefId ?? ""]?.numberValue ?? "0") || 0;
      fells += parseInt(quickAttemptedValues[row.grade] ?? "0") || 0;
    }
    return { flashes, sends, fells, projects: 0, total: flashes + sends + fells };
  })();

  const flashLabel = discipline === "BOULDER" ? "Flash" : "Onsight";
  const sendLabel = discipline === "SPORT_LEAD" ? "Redpoint" : "Send";
  const fellLabel = discipline === "BOULDER" ? "Fell" : "Hang";

  return (
    <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
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

      {/* ─── Per Climb mode ─────────────────────────────────────────────────── */}
      {climbMode === "per-climb" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, minWidth: 0 }}>
          {/* Saved problems at this location */}
          {savedProblems.length > 0 && (
            <div>
              <div style={sectionLabelStyle}>Known {nounPlural} at this location</div>
              <div style={gradeChipsScrollStyle}>
                {savedProblems.map((problem) => {
                  const isSelected = selectedProblemId === problem.id;
                  return (
                    <button
                      key={problem.id}
                      type="button"
                      onClick={() => selectSavedProblem(problem)}
                      style={problemChipStyle(isSelected)}
                    >
                      <span style={{ fontSize: 10, opacity: 0.7 }}>{problem.grade}</span>
                      <span>{problem.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                      ? `${activeProblemName} · ${activeAttemptCount} attempt${activeAttemptCount !== 1 ? "s" : ""}`
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
                placeholder={isOutdoorTemplate(templateKey) ? "Area (optional, e.g. Hidden Valley)" : "Area / Wall (optional, e.g. Cave Wall)"}
                value={activeArea}
                onChange={(e) => { setActiveArea(e.target.value); onMarkDirty(); }}
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
                  discipline={discipline}
                  expanded={expandedId === attempt.localId}
                  onToggleExpand={() =>
                    setExpandedId(expandedId === attempt.localId ? null : attempt.localId)
                  }
                  onUpdate={(patch) => updateAttempt(attempt.localId, patch)}
                  onRemove={() => removeAttempt(attempt.localId)}
                  savedProblems={savedProblems}
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
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={sectionLabelStyle}>Grades</div>
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                onSelectedGradesChange(Array.from(new Set([...selectedGrades, e.target.value])));
                onMarkDirty();
              }}
              style={addGradeSelectStyle}
            >
              <option value="">+ Add grade…</option>
              {availableGradesForQuick.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {gradeRows.length > 0 ? (
            <div style={quickTableScrollStyle}>
              <div style={quickTableStyle}>
                <div style={quickHeaderStyle}>Grade</div>
                <div style={quickHeaderStyle}>{flashLabel}</div>
                <div style={quickHeaderStyle}>{sendLabel}</div>
                <div style={quickHeaderStyle}>{fellLabel}</div>
                <div />
                {gradeRows.map((row) => (
                  <QuickGradeRow
                    key={row.grade}
                    grade={row.grade}
                    flashValue={quickValues[row.flashDefId ?? ""]?.numberValue ?? ""}
                    sendValue={quickValues[row.sendDefId ?? ""]?.numberValue ?? ""}
                    attemptedValue={quickAttemptedValues[row.grade] ?? ""}
                    flashDefId={row.flashDefId}
                    sendDefId={row.sendDefId}
                    onFlashChange={(id, val) => { onQuickValuesChange(id, { numberValue: val }); onMarkDirty(); }}
                    onSendChange={(id, val) => { onQuickValuesChange(id, { numberValue: val }); onMarkDirty(); }}
                    onAttemptedChange={(grade, val) => { onQuickAttemptedChange(grade, val); onMarkDirty(); }}
                    onRemove={() => { onSelectedGradesChange(selectedGrades.filter((g) => g !== row.grade)); onMarkDirty(); }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.5, padding: "12px 0" }}>
              Use the dropdown to add the grades you climbed today.
            </div>
          )}
        </div>
      )}

      {/* Summary strip */}
      {summary.total > 0 && (
        <div style={summaryStripStyle}>
          {summary.flashes > 0 && (
            <span style={summaryChipStyle(climbOutcomeColor("FLASH"), climbOutcomeBg("FLASH"))}>
              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>
                {flashLabel.toUpperCase()}
              </span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{summary.flashes}</span>
            </span>
          )}
          {summary.sends > 0 && (
            <span style={summaryChipStyle(climbOutcomeColor("SEND"), climbOutcomeBg("SEND"))}>
              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>{sendLabel.toUpperCase()}</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{summary.sends}</span>
            </span>
          )}
          {summary.fells > 0 && (
            <span style={summaryChipStyle(climbOutcomeColor("FELL"), climbOutcomeBg("FELL"))}>
              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>{fellLabel.toUpperCase()}</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{summary.fells}</span>
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

const addGradeSelectStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
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
