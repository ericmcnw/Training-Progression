"use client";

import { useState } from "react";
import { updateCompletionLog } from "../../../actions";
import { Field, FormActions, FormSection, FormStack, inputStyle, textareaStyle } from "../../log/form-ui";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export default function EditCompletionLogForm({
  routineId,
  logId,
  returnTo,
  initialCompletionCount,
  initialNotes,
  initialPerformedAt,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialCompletionCount: number | null;
  initialNotes: string;
  initialPerformedAt: Date;
}) {
  const [completionCount, setCompletionCount] = useState(initialCompletionCount ? String(initialCompletionCount) : "");
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const parsedCount = completionCount.trim() ? Number(completionCount) : null;
    if (parsedCount !== null && (!Number.isFinite(parsedCount) || parsedCount <= 0)) {
      alert("Count must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await updateCompletionLog({
        routineId,
        logId,
        notes,
        completionCount: parsedCount,
        performedAtLocal,
      });
      window.location.href = returnTo;
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormStack maxWidth={560}>
      <FormSection title="Completion details">
        <Field label="Performed at">
          <input type="datetime-local" style={inputStyle} value={performedAtLocal} onChange={(e) => setPerformedAtLocal(e.target.value)} />
        </Field>

        <Field label="Count (optional)" hint="Leave blank for a simple done log.">
          <input
            style={inputStyle}
            value={completionCount}
            onChange={(event) => setCompletionCount(event.target.value)}
            inputMode="numeric"
            placeholder="Leave blank for a simple done log"
          />
        </Field>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Session notes (optional)">
          <textarea style={textareaStyle} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
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
