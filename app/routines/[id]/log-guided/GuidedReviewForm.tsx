"use client";

import { useState, type ReactNode } from "react";
import type { GuidedStepKind } from "@/generated/prisma";
import { formatGuidedRepSetSummary, formatGuidedSeconds, formatGuidedStepLabel } from "@/lib/guided";
import { FormError, clampToNow, localDateTimeNow } from "../log/form-ui";

export type ReviewTemplateStep = {
  id: string;
  kind: GuidedStepKind;
  title: string;
  exerciseId: string | null;
  exerciseName: string | null;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount?: number | null;
  setCount?: number | null;
};

export type ReviewSaveData = {
  reviewMap: Map<string, { skipped: boolean; weightLb: string }>;
  notes: string;
  performedAtLocal: string;
  durationOverrideMin: string;
};

function toLocalInputValue(date: Date) {
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function stepSummary(step: ReviewTemplateStep) {
  const parts: string[] = [];
  if (step.durationSec) parts.push(`${formatGuidedSeconds(step.durationSec)} work`);
  if (step.restSec) parts.push(`${formatGuidedSeconds(step.restSec)} rest`);
  const repSet = formatGuidedRepSetSummary({
    repeatCount: step.repeatCount,
    repCount: step.repCount,
    setCount: step.setCount,
  });
  if (repSet) parts.push(repSet);
  return parts.join("  ·  ");
}

export default function GuidedReviewForm({
  steps,
  initialSkippedStepIds,
  initialPerformedAtLocal,
  completedDurationSec,
  mode,
  saving,
  error,
  onSave,
  onBack,
  bottomSlot,
}: {
  steps: ReviewTemplateStep[];
  initialSkippedStepIds: Set<string>;
  initialPerformedAtLocal?: string;
  completedDurationSec: number;
  mode: "review" | "log-after";
  saving: boolean;
  error?: string | null;
  onSave: (data: ReviewSaveData) => void;
  onBack: () => void;
  bottomSlot?: ReactNode;
}) {
  const [reviewMap, setReviewMap] = useState<Map<string, { skipped: boolean; weightLb: string }>>(
    () => {
      const map = new Map<string, { skipped: boolean; weightLb: string }>();
      for (const step of steps) {
        map.set(step.id, {
          skipped: initialSkippedStepIds.has(step.id),
          weightLb: "",
        });
      }
      return map;
    }
  );
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState(
    initialPerformedAtLocal ?? toLocalInputValue(new Date())
  );
  const [durationOverrideMin, setDurationOverrideMin] = useState(
    completedDurationSec > 0 ? String(Math.round(completedDurationSec / 60)) : ""
  );

  function updateStep(
    stepId: string,
    updater: (prev: { skipped: boolean; weightLb: string }) => { skipped: boolean; weightLb: string }
  ) {
    setReviewMap((prev) => {
      const current = prev.get(stepId) ?? { skipped: false, weightLb: "" };
      const next = new Map(prev);
      next.set(stepId, updater(current));
      return next;
    });
  }

  const completedCount = steps.filter((s) => !reviewMap.get(s.id)?.skipped).length;
  const skippedCount = steps.length - completedCount;

  function handleSave() {
    onSave({ reviewMap, notes, performedAtLocal, durationOverrideMin });
  }

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: "var(--app-width-form)", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={onBack} style={backBtnStyle}>
          ← Back
        </button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>
            {mode === "review" ? "Review Session" : "Log After"}
          </div>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 3 }}>
            {completedCount} completed
            {skippedCount > 0 ? `, ${skippedCount} skipped` : ""}
          </div>
        </div>
      </div>

      {/* Date / time */}
      <div style={sectionCard}>
        <div style={sectionLabel}>When</div>
        <input
          type="datetime-local"
          value={performedAtLocal}
          max={localDateTimeNow()}
          onChange={(e) => setPerformedAtLocal(clampToNow(e.target.value))}
          style={inputStyle}
        />
      </div>

      {/* Steps */}
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.55, letterSpacing: 1, textTransform: "uppercase" }}>
          Steps
        </div>
        {steps.map((step) => {
          const state = reviewMap.get(step.id) ?? { skipped: false, weightLb: "" };
          const label = formatGuidedStepLabel({
            kind: step.kind,
            title: step.title,
            exerciseName: step.exerciseName,
          });
          const summary = stepSummary(step);
          const isExercise = step.kind === "EXERCISE";

          return (
            <div
              key={step.id}
              style={{
                ...stepCard,
                opacity: state.skipped ? 0.5 : 1,
                borderColor: state.skipped
                  ? "rgba(128,128,128,0.2)"
                  : "rgba(128,128,128,0.28)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                {/* Left: step info */}
                <div style={{ display: "grid", gap: 5, flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {state.skipped && (
                      <span style={skippedBadge}>Skipped</span>
                    )}
                    <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.25 }}>{label}</div>
                  </div>
                  {summary ? (
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{summary}</div>
                  ) : null}
                  {/* Weight input for exercise steps */}
                  {isExercise && !state.skipped ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, whiteSpace: "nowrap" }}>
                        Weight
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={state.weightLb}
                        onChange={(e) =>
                          updateStep(step.id, (prev) => ({ ...prev, weightLb: e.target.value }))
                        }
                        placeholder="lb (optional)"
                        style={weightInputStyle}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Right: skip toggle */}
                <button
                  type="button"
                  onClick={() =>
                    updateStep(step.id, (prev) => ({ ...prev, skipped: !prev.skipped }))
                  }
                  style={state.skipped ? unskipBtn : skipBtn}
                >
                  {state.skipped ? "Undo" : "Skip"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Duration */}
      <div style={sectionCard}>
        <div style={sectionLabel}>Duration (minutes)</div>
        <input
          type="text"
          inputMode="decimal"
          value={durationOverrideMin}
          onChange={(e) => setDurationOverrideMin(e.target.value)}
          placeholder={completedDurationSec > 0 ? `${Math.round(completedDurationSec / 60)}` : "Optional"}
          style={inputStyle}
        />
        {completedDurationSec > 0 && (
          <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>
            Timer recorded {formatGuidedSeconds(completedDurationSec)}
          </div>
        )}
      </div>

      {/* Notes */}
      <div style={sectionCard}>
        <div style={sectionLabel}>Notes (optional)</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it feel? Anything to note..."
          style={textareaStyle}
        />
      </div>

      {bottomSlot}

      <FormError message={error} />

      {/* Save */}
      <div className="mobileStickyActions guidedStickyActions" style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={saveBtn}
        >
          {saving ? "Saving…" : "Save Log"}
        </button>
        <button type="button" onClick={onBack} style={cancelBtn}>
          Back
        </button>
      </div>
    </div>
  );
}

// Styles

const backBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.4)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
  flexShrink: 0,
};

const sectionCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.25)",
  borderRadius: 16,
  padding: "14px 16px",
  background: "rgba(128,128,128,0.04)",
  display: "grid",
  gap: 8,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.6,
  letterSpacing: 0.4,
};

const stepCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 16,
  padding: "14px 16px",
  background: "rgba(128,128,128,0.04)",
  transition: "opacity 0.15s",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid rgba(128,128,128,0.45)",
  borderRadius: 12,
  background: "#111827",
  color: "#fff",
  // 16px min — iOS Safari auto-zooms on focus below this. See CLAUDE.md §3a.
  fontSize: 16,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 88,
  resize: "vertical",
};

const weightInputStyle: React.CSSProperties = {
  width: 120,
  padding: "7px 10px",
  border: "1px solid rgba(128,128,128,0.4)",
  borderRadius: 10,
  background: "#111827",
  color: "#fff",
  // 16px min — iOS Safari auto-zooms on focus below this. See CLAUDE.md §3a.
  fontSize: 16,
};

const skipBtn: React.CSSProperties = {
  padding: "7px 12px",
  border: "1px solid rgba(255,80,80,0.3)",
  borderRadius: 10,
  background: "rgba(255,80,80,0.06)",
  color: "rgba(255,120,120,1)",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

const unskipBtn: React.CSSProperties = {
  padding: "7px 12px",
  border: "1px solid rgba(128,128,128,0.4)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.1)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

const skippedBadge: React.CSSProperties = {
  padding: "2px 8px",
  border: "1px solid rgba(128,128,128,0.3)",
  borderRadius: 99,
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.7,
};

const saveBtn: React.CSSProperties = {
  flex: 2,
  padding: "13px 16px",
  border: "none",
  borderRadius: 14,
  background: "rgba(34,197,94,0.88)",
  color: "#000",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
};

const cancelBtn: React.CSSProperties = {
  flex: 1,
  padding: "13px 16px",
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 14,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};
