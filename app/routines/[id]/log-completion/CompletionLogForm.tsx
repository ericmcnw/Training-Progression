"use client";

import type React from "react";
import { useState } from "react";
import { createCompletionLog } from "../../actions";
import { Field, FormActions, FormError, FormSection, FormStack, OptionalDateSection, inputStyle, textareaStyle } from "../log/form-ui";

export default function CompletionLogForm({
  routineId,
  description,
}: {
  routineId: string;
  description?: string | null;
}) {
  const [completionCount, setCompletionCount] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAtLocal, setPerformedAtLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function quickSave() {
    setQuickSaving(true);
    setError(null);
    try {
      await createCompletionLog({ routineId, completionCount: null, notes: "", performedAtLocal: undefined });
      window.location.href = "/log";
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't save. Please try again.");
    } finally {
      setQuickSaving(false);
    }
  }

  async function onSave() {
    const parsedCount = completionCount.trim() ? Number(completionCount) : null;
    if (parsedCount !== null && (!Number.isFinite(parsedCount) || parsedCount <= 0)) {
      setError("Count must be greater than 0.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createCompletionLog({
        routineId,
        completionCount: parsedCount,
        notes,
        performedAtLocal: performedAtLocal || undefined,
      });
      window.location.href = "/log";
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const anyPending = saving || quickSaving;

  return (
    <FormStack maxWidth={560}>
      {description?.trim() && (
        <details style={{ border: "1px solid rgba(128,128,128,0.3)", borderRadius: 12, padding: "10px 12px" }}>
          <summary data-collapsible-summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, opacity: 0.8, minHeight: 44 }}>
            How I do this
          </summary>
          <div style={{ fontSize: 14, opacity: 0.88, lineHeight: 1.5, whiteSpace: "pre-wrap", paddingTop: 4 }}>
            {description.trim()}
          </div>
        </details>
      )}

      {/* Quick save — tap once and done */}
      <button type="button" onClick={quickSave} disabled={anyPending} style={quickSaveBtn}>
        {quickSaving ? "Saving..." : "✓ Mark Done"}
      </button>

      <FormError message={error} />

      {/* Detailed entry */}
      <FormSection title="Log with details" description="Add a count or notes when you want to track more than just completion.">
        <Field label="Count (optional)" hint="Leave blank for a simple done log.">
          <input
            style={inputStyle}
            value={completionCount}
            onChange={(event) => setCompletionCount(event.target.value)}
            inputMode="numeric"
            placeholder="e.g. 3"
          />
        </Field>

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
        primaryLabel="Save with Details"
        primaryPendingLabel="Saving..."
        saving={saving}
        onPrimary={onSave}
        backHref="/log"
      />
    </FormStack>
  );
}

const quickSaveBtn: React.CSSProperties = {
  width: "100%",
  padding: "18px 20px",
  border: "1px solid rgba(115,220,152,0.5)",
  borderRadius: 16,
  background: "rgba(115,220,152,0.12)",
  color: "inherit",
  fontWeight: 900,
  fontSize: 18,
  cursor: "pointer",
  letterSpacing: 0.3,
};
