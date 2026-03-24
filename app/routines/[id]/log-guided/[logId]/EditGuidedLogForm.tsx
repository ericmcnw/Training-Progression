"use client";

import { useState } from "react";
import { updateGuidedLog } from "../../../actions";
import { formatGuidedRepSetSummary, formatGuidedSeconds, formatGuidedStepLabel } from "@/lib/guided";
import type { GuidedStepKind } from "@/generated/prisma";
import { Field, FormActions, FormSection, FormStack, inputStyle, textareaStyle } from "../../log/form-ui";

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type Step = {
  guidedStepId: string | null;
  kind: GuidedStepKind;
  title: string;
  exerciseId: string | null;
  exerciseName: string | null;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount?: number | null;
  setCount?: number | null;
  weightLb?: number | null;
  sortOrder: number;
};

export default function EditGuidedLogForm({
  routineId,
  logId,
  returnTo,
  initialDurationSec,
  initialNotes,
  initialPerformedAt,
  steps,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialDurationSec: number;
  initialNotes: string;
  initialPerformedAt: Date;
  steps: Step[];
}) {
  const [durationMin, setDurationMin] = useState(initialDurationSec > 0 ? String(Math.round(initialDurationSec / 60)) : "");
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const durationSec = durationMin.trim() ? Number(durationMin) * 60 : null;
    if (durationSec !== null && (!Number.isFinite(durationSec) || durationSec <= 0)) {
      alert("Duration must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await updateGuidedLog({
        routineId,
        logId,
        durationSec,
        notes,
        performedAtLocal,
        steps,
      });
      window.location.href = returnTo;
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormStack maxWidth={640}>
      <FormSection title="Guided log details">
        <Field label="Duration (minutes)">
          <input style={inputStyle} value={durationMin} onChange={(event) => setDurationMin(event.target.value)} inputMode="decimal" />
        </Field>

        <Field label="Performed at">
          <input type="datetime-local" style={inputStyle} value={performedAtLocal} onChange={(event) => setPerformedAtLocal(event.target.value)} />
        </Field>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Session notes">
          <textarea style={textareaStyle} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </FormSection>

      <FormSection title="Saved steps">
        <div style={{ fontWeight: 900, fontSize: 13 }}>Saved steps</div>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {steps.map((step, index) => (
            <div key={`${step.guidedStepId ?? "step"}-${index}`} style={styles.stepRow}>
              <div style={{ fontWeight: 800 }}>{index + 1}. {formatGuidedStepLabel({ kind: step.kind, title: step.title, exerciseName: step.exerciseName })}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {step.kind === "EXERCISE" ? "Exercise" : "Step"} | {formatGuidedSeconds(step.durationSec)} work
                {step.restSec ? ` | ${formatGuidedSeconds(step.restSec)} rest` : ""}
                {formatGuidedRepSetSummary(step) ? ` | ${formatGuidedRepSetSummary(step)}` : ""}
                {step.weightLb !== null && step.weightLb !== undefined ? ` | ${step.weightLb} lb` : ""}
              </div>
            </div>
          ))}
        </div>
      </FormSection>

      <FormActions
        primaryLabel="Save Changes"
        primaryPendingLabel="Saving..."
        saving={saving}
        onPrimary={onSave}
        backHref={returnTo}
      />
    </FormStack>
  );
}

const styles = {
  stepRow: {
    border: "1px solid rgba(128,128,128,0.24)",
    borderRadius: 10,
    padding: 8,
    background: "rgba(128,128,128,0.05)",
  },
};
