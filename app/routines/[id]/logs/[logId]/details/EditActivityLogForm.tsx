"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { inputStyle, textareaStyle, MAX_SESSION_MINUTES } from "@/app/routines/[id]/log/form-ui";
import { EffortSlider } from "@/app/components/strain/EffortSlider";
import { updateActivityLogAction } from "@/app/log/activity-actions";
import { ACTIVITY_TAGS, BODY_PART_OPTIONS, DURATION_BUCKETS } from "@/lib/freeform-activity";

// Edit counterpart to ActivityLogSheet. Same fields in the same order —
// the freeform log's name, tags and body parts live in sportData, so the
// generic sport editor can't reach any of them.

const ACCENT_BORDER = "rgba(45,212,191,0.5)";
const ACCENT_BG = "rgba(45,212,191,0.13)";
const ACCENT_TEXT = "rgba(153,246,228,0.98)";

export default function EditActivityLogForm({
  logId,
  initialPerformedAt,
  initialTitle,
  initialTags,
  initialDurationSec,
  initialEffort,
  initialBodyParts,
  initialNotes,
  returnTo,
  onComplete,
  onCancel,
}: {
  logId: string;
  initialPerformedAt: Date;
  initialTitle: string;
  initialTags: string[];
  initialDurationSec: number | null;
  initialEffort: number | null;
  initialBodyParts: string[];
  initialNotes: string;
  returnTo: string;
  onComplete?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const totalInitialMinutes = initialDurationSec ? Math.round(initialDurationSec / 60) : 0;

  const [performedAt, setPerformedAt] = useState(formatLocalDateTime(initialPerformedAt));
  const [name, setName] = useState(initialTitle);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [hours, setHours] = useState(
    totalInitialMinutes >= 60 ? String(Math.floor(totalInitialMinutes / 60)) : ""
  );
  const [minutes, setMinutes] = useState(
    totalInitialMinutes % 60 ? String(totalInitialMinutes % 60) : ""
  );
  const [effort, setEffort] = useState<number | null>(initialEffort);
  const [bodyParts, setBodyParts] = useState<string[]>(initialBodyParts);
  const [notes, setNotes] = useState(initialNotes);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleTag(key: string) {
    setTags((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]));
  }

  function toggleBodyPart(key: string) {
    setBodyParts((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }

  function applyBucketMinutes(totalMin: number) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    setHours(h ? String(h) : "");
    setMinutes(m ? String(m) : "");
  }

  const totalMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  const activeBucket =
    totalMinutes > 0 ? DURATION_BUCKETS.find((b) => b.minutes === totalMinutes) : undefined;

  function save() {
    setError(null);
    const ms = Date.parse(performedAt);
    if (Number.isNaN(ms)) {
      setError("Invalid date/time.");
      return;
    }
    const h = hours.trim() === "" ? 0 : Number(hours);
    const m = minutes.trim() === "" ? 0 : Number(minutes);
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) {
      setError("Enter a valid duration.");
      return;
    }
    const totalMin = h * 60 + m;
    if (totalMin > MAX_SESSION_MINUTES) {
      setError("Enter a valid duration (under 24 hours).");
      return;
    }

    startTransition(async () => {
      try {
        await updateActivityLogAction({
          logId,
          performedAtIso: new Date(ms).toISOString(),
          title: name.trim() || undefined,
          tags,
          durationMinutes: totalMin > 0 ? totalMin : undefined,
          effort,
          bodyParts,
          notes: notes.trim() || undefined,
        });
        if (onComplete) {
          onComplete();
        } else {
          router.push(returnTo);
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save changes.");
      }
    });
  }

  return (
    <form
      style={formStyle}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label style={fieldLabel}>
        Name (optional)
        <input
          type="text"
          placeholder="e.g. Concert dancing, beach day"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          maxLength={80}
        />
      </label>

      <label style={fieldLabel}>
        When
        <input
          type="datetime-local"
          value={performedAt}
          onChange={(e) => setPerformedAt(e.target.value)}
          style={inputStyle}
        />
      </label>

      <div style={fieldGroup}>
        <span style={fieldLabelText}>What did you do?</span>
        <div style={chipWrap}>
          {ACTIVITY_TAGS.map((t) => {
            const on = tags.includes(t.key);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => toggleTag(t.key)}
                aria-pressed={on}
                style={on ? chipOn : chipOff}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={fieldGroup}>
        <span style={fieldLabelText}>How long?</span>
        <div style={chipWrap}>
          {DURATION_BUCKETS.map((b) => {
            const on = activeBucket?.key === b.key;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => applyBucketMinutes(on ? 0 : b.minutes)}
                aria-pressed={on}
                style={on ? chipOn : chipOff}
              >
                {b.label}
              </button>
            );
          })}
        </div>
        <div style={hmRow}>
          <div style={hmCol}>
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              style={inputStyle}
              aria-label="Hours"
            />
            <span style={hmLabel}>hours</span>
          </div>
          <div style={hmCol}>
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              style={inputStyle}
              aria-label="Minutes"
            />
            <span style={hmLabel}>minutes</span>
          </div>
        </div>
      </div>

      <div style={fieldGroup}>
        <span style={fieldLabelText}>How hard did it feel? (optional)</span>
        <EffortSlider value={effort} predicted={5} onChange={setEffort} />
      </div>

      <div style={fieldGroup}>
        <span style={fieldLabelText}>Anything feel worked? (optional)</span>
        <div style={chipWrap}>
          {BODY_PART_OPTIONS.map((p) => {
            const on = bodyParts.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => toggleBodyPart(p.key)}
                aria-pressed={on}
                style={on ? chipOn : chipOff}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <label style={fieldLabel}>
        Notes
        <textarea
          placeholder="Anything worth remembering?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={textareaStyle}
        />
      </label>

      {error ? <div style={errorTextStyle}>{error}</div> : null}

      <div style={footerRow}>
        <button
          type="button"
          onClick={() => (onCancel ? onCancel() : router.push(returnTo))}
          style={btnSecondary}
          disabled={pending}
        >
          Cancel
        </button>
        <button type="submit" style={btnPrimary} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const formStyle: CSSProperties = { display: "grid", gap: 14, maxWidth: 560 };
const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.75,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};
const fieldGroup: CSSProperties = { display: "grid", gap: 8 };
const fieldLabelText: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.75,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};
const errorTextStyle: CSSProperties = {
  fontSize: 12,
  color: "rgba(248,113,113,0.95)",
  fontWeight: 700,
};

const chipWrap: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const chipBase: CSSProperties = {
  minHeight: 40,
  padding: "8px 14px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  touchAction: "manipulation",
};
const chipOff: CSSProperties = {
  ...chipBase,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
};
const chipOn: CSSProperties = {
  ...chipBase,
  border: `1px solid ${ACCENT_BORDER}`,
  background: ACCENT_BG,
  color: ACCENT_TEXT,
};

const hmRow: CSSProperties = { display: "flex", gap: 10 };
const hmCol: CSSProperties = { flex: 1, display: "grid", gap: 4, minWidth: 0 };
const hmLabel: CSSProperties = { fontSize: 11, fontWeight: 700, opacity: 0.6, textAlign: "center" };

const footerRow: CSSProperties = { display: "flex", gap: 10, justifyContent: "flex-end" };
const btnPrimary: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};
const btnSecondary: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};
