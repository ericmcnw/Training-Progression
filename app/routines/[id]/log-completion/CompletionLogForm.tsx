"use client";

import { useState } from "react";
import { createCompletionLog } from "../../actions";
import { Field, FormActions, FormSection, FormStack, OptionalDateSection, inputStyle, textareaStyle } from "../log/form-ui";

export default function CompletionLogForm({ routineId }: { routineId: string }) {
  const [completionCount, setCompletionCount] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const parsedCount = completionCount.trim() ? Number(completionCount) : null;
    if (parsedCount !== null && (!Number.isFinite(parsedCount) || parsedCount <= 0)) {
      alert("Count must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await createCompletionLog({
        routineId,
        completionCount: parsedCount,
        notes,
        performedAtLocal: performedAtLocal || undefined,
      });
      window.location.href = "/routines";
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormStack maxWidth={560}>
      <FormSection title="Completion details" description="Keep this lightweight. Add a count only when the routine benefits from one.">
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
          <textarea
            style={textareaStyle}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Any context worth keeping?"
          />
        </Field>
      </FormSection>

      <OptionalDateSection value={performedAtLocal} onChange={setPerformedAtLocal} />

      <FormActions
        primaryLabel="Save Completion"
        primaryPendingLabel="Saving..."
        saving={saving}
        onPrimary={onSave}
        backHref="/routines"
      />
    </FormStack>
  );
}
