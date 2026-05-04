"use client";

import React, { useState } from "react";
import { nanoid } from "nanoid";
import {
  climbOutcomeLabel,
  climbOutcomesForSystem,
  climbOutcomeColor,
  climbOutcomeBg,
  gradeSystemForTemplateKey,
  type ClimbAttemptDraft,
  type ClimbOutcome,
  type ClimbGradeSystem,
} from "@/lib/climb-types";
import { climbingGradeOptions } from "@/lib/session-templates";
import type { SessionMetricDefinitionWithConfig } from "@/lib/session-templates";
import type { SessionMetricDraftValue } from "./SessionMetricFields";

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
      <button type="button" onClick={onRemove} style={removeButtonStyle}>×</button>
    </>
  );
}

// ─── Per-climb attempt row ────────────────────────────────────────────────────

function AttemptRow({
  attempt,
  gradeSystem,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: {
  attempt: ClimbAttemptDraft;
  gradeSystem: ClimbGradeSystem;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<ClimbAttemptDraft>) => void;
  onRemove: () => void;
}) {
  const color = climbOutcomeColor(attempt.outcome);
  const bg = climbOutcomeBg(attempt.outcome);
  const label = climbOutcomeLabel(attempt.outcome, gradeSystem);

  return (
    <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "rgba(255,255,255,0.03)",
          cursor: "pointer",
        }}
        onClick={onToggleExpand}
      >
        <span style={{ ...gradePillStyle }}>{attempt.grade}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color, padding: "2px 8px", borderRadius: 999, background: bg, flexShrink: 0 }}>
          {label}
        </span>
        {attempt.movesCompleted != null && (
          <span style={{ fontSize: 11, opacity: 0.55, flexShrink: 0 }}>
            {attempt.movesCompleted}{attempt.totalMoves != null ? `/${attempt.totalMoves}` : ""} moves
          </span>
        )}
        {attempt.notes && (
          <span style={{ fontSize: 11, opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {attempt.notes}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={removeButtonStyle}
          aria-label="Remove attempt"
        >×</button>
        <span style={{ fontSize: 16, opacity: 0.4, flexShrink: 0, transition: "transform 120ms", transform: expanded ? "rotate(180deg)" : "none" }}>
          ▾
        </span>
      </div>

      {expanded && (
        <div style={{ padding: "10px 12px", display: "grid", gap: 10, borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "grid", gap: 4, flex: 1 }}>
              <div style={expandLabelStyle}>Moves completed (optional)</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  style={{ ...expandInputStyle, width: 72, textAlign: "center" }}
                  inputMode="numeric"
                  placeholder="—"
                  value={attempt.movesCompleted ?? ""}
                  onChange={(e) => onUpdate({ movesCompleted: e.target.value ? Number(e.target.value) : undefined })}
                />
                <span style={{ opacity: 0.4 }}>/</span>
                <input
                  style={{ ...expandInputStyle, width: 72, textAlign: "center" }}
                  inputMode="numeric"
                  placeholder="total"
                  value={attempt.totalMoves ?? ""}
                  onChange={(e) => onUpdate({ totalMoves: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={expandLabelStyle}>Notes / beta (optional)</div>
            <textarea
              style={expandTextareaStyle}
              placeholder="e.g. left-hand sidepull on the crux, drop knee..."
              value={attempt.notes ?? ""}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              rows={2}
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
  onQuickValuesChange,
  onQuickAttemptedChange,
  onSelectedGradesChange,
  onMarkDirty,
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
  onQuickValuesChange: (id: string, value: SessionMetricDraftValue) => void;
  onQuickAttemptedChange: (grade: string, value: string) => void;
  onSelectedGradesChange: (grades: string[]) => void;
  onMarkDirty: () => void;
}) {
  const gradeSystem = gradeSystemForTemplateKey(templateKey);
  const allGrades = climbingGradeOptions(templateKey);
  const outcomes = climbOutcomesForSystem(gradeSystem);

  // Per-climb mode local UI state
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Per-climb: add attempt ──────────────────────────────────────────────────
  function addAttempt(grade: string, outcome: ClimbOutcome) {
    const draft: ClimbAttemptDraft = {
      localId: nanoid(),
      grade,
      gradeSystem,
      outcome,
      attemptOrder: attempts.length,
    };
    onAttemptsChange([draft, ...attempts]);
    onMarkDirty();
    setSelectedGrade(null);
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

  const flashLabel = gradeSystem === "BOULDER_V" ? "Flash" : "Onsight";
  const sendLabel = "Send";

  return (
    <div style={{ display: "grid", gap: 14 }}>
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
        <div style={{ display: "grid", gap: 12 }}>
          {/* Grade chip row */}
          <div>
            <div style={sectionLabelStyle}>Grade</div>
            <div style={gradeChipsScrollStyle}>
              {allGrades.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setSelectedGrade(selectedGrade === grade ? null : grade)}
                  style={gradeChipStyle(selectedGrade === grade)}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* Outcome buttons — only shown when grade is selected */}
          {selectedGrade && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={sectionLabelStyle}>
                {selectedGrade} — tap outcome to log
              </div>
              <div style={outcomeRowStyle}>
                {outcomes.map((outcome) => {
                  const color = climbOutcomeColor(outcome);
                  const bg = climbOutcomeBg(outcome);
                  return (
                    <button
                      key={outcome}
                      type="button"
                      onClick={() => addAttempt(selectedGrade, outcome)}
                      style={outcomeBtnStyle(color, bg)}
                    >
                      <span style={{ fontSize: 18 }}>{outcomeEmoji(outcome)}</span>
                      <span style={{ fontSize: 12, fontWeight: 800 }}>
                        {climbOutcomeLabel(outcome, gradeSystem)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Attempt list */}
          {attempts.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={sectionLabelStyle}>
                This session · {attempts.length} climb{attempts.length !== 1 ? "s" : ""}
              </div>
              {attempts.map((attempt) => (
                <AttemptRow
                  key={attempt.localId}
                  attempt={attempt}
                  gradeSystem={gradeSystem}
                  expanded={expandedId === attempt.localId}
                  onToggleExpand={() =>
                    setExpandedId(expandedId === attempt.localId ? null : attempt.localId)
                  }
                  onUpdate={(patch) => updateAttempt(attempt.localId, patch)}
                  onRemove={() => removeAttempt(attempt.localId)}
                />
              ))}
            </div>
          )}

          {attempts.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.5, textAlign: "center", padding: "16px 0" }}>
              Tap a grade, then tap the outcome to start logging.
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
            <div style={quickTableStyle}>
              <div style={quickHeaderStyle}>Grade</div>
              <div style={quickHeaderStyle}>{flashLabel}</div>
              <div style={quickHeaderStyle}>{sendLabel}</div>
              <div style={quickHeaderStyle}>Fell</div>
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
                {gradeSystem === "BOULDER_V" ? "FLASH" : "ONSIGHT"}
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
          {summary.fells > 0 && (
            <span style={summaryChipStyle(climbOutcomeColor("FELL"), climbOutcomeBg("FELL"))}>
              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>FELL</span>
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
  paddingBottom: 4,
  WebkitOverflowScrolling: "touch",
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

const outcomeRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

function outcomeBtnStyle(color: string, bg: string): React.CSSProperties {
  return {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "14px 8px",
    borderRadius: 12,
    border: `1px solid ${color.replace("0.9", "0.35")}`,
    background: bg,
    color: "inherit",
    cursor: "pointer",
    fontSize: 12,
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

const expandLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.65,
};

const expandInputStyle: React.CSSProperties = {
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

const quickTableStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(60px, 1fr) 68px 68px 68px 36px",
  gap: 6,
  alignItems: "center",
};

const quickHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.6,
  textAlign: "center" as const,
};

const quickCellLabelStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
};

const quickInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 4px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 8,
  background: "#111827",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 700,
  textAlign: "center" as const,
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
