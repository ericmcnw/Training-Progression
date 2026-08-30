"use client";

import { useState } from "react";
import { updateCompletionLog } from "../../../actions";
import { DateTimeField, Field, FormActions, FormError, FormSection, FormStack, inputStyle, textareaStyle } from "../../log/form-ui";

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
  onComplete,
  onCancel,
}: {
  routineId: string;
  logId: string;
  returnTo: string;
  initialCompletionCount: number | null;
  initialNotes: string;
  initialPerformedAt: Date;
  onComplete?: () => void;
  onCancel?: () => void;
}) {
  const [completionCount, setCompletionCount] = useState(initialCompletionCount ? String(initialCompletionCount) : "");
  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(toLocalInputValue(initialPerformedAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    const parsedCount = completionCount.trim() ? Number(completionCount) : null;
    if (parsedCount !== null && (!Number.isFinite(parsedCount) || parsedCount <= 0)) {
      setError("Count must be greater than 0.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateCompletionLog({
        routineId,
        logId,
        notes,
        completionCount: parsedCount,
        performedAtLocal,
      });
      if (onComplete) onComplete();
      else window.location.href = returnTo;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormStack>
      <FormSection title="Completion details">
        <DateTimeField value={performedAtLocal} onChange={setPerformedAtLocal} />

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

      <FormError message={error} />

      <FormActions
        primaryLabel="Save Changes"
        primaryPendingLabel="Saving…"
        saving={saving}
        onPrimary={onSave}
        backHref={returnTo}
        onBack={onCancel}
      />
    </FormStack>
  );
}
