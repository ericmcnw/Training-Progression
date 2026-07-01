"use client";

import type React from "react";
import { useState } from "react";
import { createCompletionLog } from "../../actions";
import { Field, FormActions, FormSection, FormStack, OptionalDateSection, inputStyle, textareaStyle } from "../log/form-ui";

export default function CompletionLogForm({ routineId }: { routineId: string }) {
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
      {/* Quick save — tap once and done */}
      <button type="button" onClick={quickSave} disabled={anyPending} style={quickSaveBtn}>
        {quickSaving ? "Saving..." : "✓ Mark Done"}
      </button>

      {error ? (
        <div role="alert" style={errorStyle}>{error}</div>
      ) : null}

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

const errorStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(252,165,165,0.98)",
  background: "rgba(248,113,113,0.1)",
  border: "1px solid rgba(248,113,113,0.32)",
  borderRadius: 10,
  padding: "8px 12px",
};
