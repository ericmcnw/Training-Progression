"use client";

import { useState, useTransition, type CSSProperties } from "react";
import SportLogModal from "./SportLogModal";
import { useSportLogDraft } from "./useSportLogDraft";
import { inputStyle, textareaStyle, MAX_SESSION_MINUTES } from "@/app/routines/[id]/log/form-ui";
import { EffortSlider } from "@/app/components/strain/EffortSlider";
import { logActivityAction } from "@/app/log/activity-actions";
import { ACTIVITY_TAGS, BODY_PART_OPTIONS, DURATION_BUCKETS } from "@/lib/freeform-activity";

// Freeform "Activity" capture — the catch-all for movement that fits no
// structured sport/workout/endurance type. Pinned tile on /log + a FAB
// item open this sheet. Rides the same SportLogModal chrome + draft
// persistence as the sport sheets so it feels native.
//
// Teal accent gives the feature its own identity (distinct from the five
// domain colors) without inventing a sixth domain.

const ACCENT = "rgba(45,212,191,0.95)";
const ACCENT_BORDER = "rgba(45,212,191,0.5)";
const ACCENT_BG = "rgba(45,212,191,0.13)";
const ACCENT_TEXT = "rgba(153,246,228,0.98)";

type ActivityDraft = {
  performedAt: string;
  name: string;
  tags: string[];
  hours: string;
  minutes: string;
  effort: number | null;
  bodyParts: string[];
  notes: string;
};

// Pinned tile shown at the top of the SPORT section on /log.
export default function ActivityQuickLogRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={tileStyle}>
        <span style={tileIcon} aria-hidden>
          🤸
        </span>
        <span style={tileTextCol}>
          <span style={tileLabel}>Activity</span>
          <span style={tileEyebrow}>Anything you did — counts as active</span>
        </span>
        <span style={tileAction}>Log →</span>
      </button>
      {open ? <ActivityLogSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// Exported so the home FAB can mount the sheet directly.
export function ActivityLogSheet({ onClose }: { onClose: () => void }) {
  const [draft, setDraft, clearDraft] = useSportLogDraft<ActivityDraft>("activity-log-draft", {
    performedAt: formatLocalDateTime(new Date()),
    name: "",
    tags: [],
    hours: "",
    minutes: "",
    effort: null,
    bodyParts: [],
    notes: "",
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleTag(key: string) {
    setDraft((d) => ({
      ...d,
      tags: d.tags.includes(key) ? d.tags.filter((t) => t !== key) : [...d.tags, key],
    }));
  }

  function applyBucketMinutes(totalMin: number) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    setDraft((d) => ({ ...d, hours: h ? String(h) : "", minutes: m ? String(m) : "" }));
  }

  function toggleBodyPart(key: string) {
    setDraft((d) => ({
      ...d,
      bodyParts: d.bodyParts.includes(key)
        ? d.bodyParts.filter((p) => p !== key)
        : [...d.bodyParts, key],
    }));
  }

  function submit() {
    setError(null);
    const ms = Date.parse(draft.performedAt);
    if (Number.isNaN(ms)) {
      setError("Invalid date/time.");
      return;
    }
    const h = draft.hours.trim() === "" ? 0 : Number(draft.hours);
    const m = draft.minutes.trim() === "" ? 0 : Number(draft.minutes);
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) {
      setError("Enter a valid duration.");
      return;
    }
    const totalMin = h * 60 + m;
    if (totalMin > MAX_SESSION_MINUTES) {
      setError("Enter a valid duration (under 24 hours).");
      return;
    }
    const minutes = totalMin > 0 ? totalMin : undefined;

    startTransition(async () => {
      try {
        await logActivityAction({
          performedAtIso: new Date(ms).toISOString(),
          title: draft.name.trim() || undefined,
          tags: draft.tags,
          durationMinutes: minutes,
          effort: draft.effort,
          bodyParts: draft.bodyParts,
          notes: draft.notes.trim() || undefined,
        });
        clearDraft();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to log activity.");
      }
    });
  }

  const totalMinutes = (Number(draft.hours) || 0) * 60 + (Number(draft.minutes) || 0);
  const activeBucket = totalMinutes > 0 ? DURATION_BUCKETS.find((b) => b.minutes === totalMinutes) : undefined;

  return (
    <SportLogModal
      title="Log activity"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} style={btnSecondary} disabled={pending}>
            Cancel
          </button>
          <button type="button" onClick={submit} style={btnPrimary} disabled={pending}>
            {pending ? "Saving…" : "Save activity"}
          </button>
        </>
      }
    >
      <div style={introNote}>
        Capture anything that got you moving — a beach day, the pool, a long walk. It counts as an
        active day even without a structured workout.
      </div>

      <label style={fieldLabel}>
        Name (optional)
        <input
          type="text"
          placeholder="e.g. Concert dancing, beach day"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          style={inputStyle}
          maxLength={80}
        />
      </label>

      <label style={fieldLabel}>
        When
        <input
          type="datetime-local"
          value={draft.performedAt}
          onChange={(e) => setDraft((d) => ({ ...d, performedAt: e.target.value }))}
          style={inputStyle}
        />
      </label>

      <div style={fieldGroup}>
        <span style={fieldLabelText}>What did you do?</span>
        <div style={chipWrap}>
          {ACTIVITY_TAGS.map((t) => {
            const on = draft.tags.includes(t.key);
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
        <span style={hintText}>Tap all that apply — mix as many as you like.</span>
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
              value={draft.hours}
              onChange={(e) => setDraft((d) => ({ ...d, hours: e.target.value }))}
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
              value={draft.minutes}
              onChange={(e) => setDraft((d) => ({ ...d, minutes: e.target.value }))}
              style={inputStyle}
              aria-label="Minutes"
            />
            <span style={hmLabel}>minutes</span>
          </div>
        </div>
      </div>

      <div style={fieldGroup}>
        <span style={fieldLabelText}>How hard did it feel? (optional)</span>
        <EffortSlider
          value={draft.effort}
          predicted={5}
          onChange={(next) => setDraft((d) => ({ ...d, effort: next }))}
        />
      </div>

      <div style={fieldGroup}>
        <span style={fieldLabelText}>Anything feel worked? (optional)</span>
        <div style={chipWrap}>
          {BODY_PART_OPTIONS.map((p) => {
            const on = draft.bodyParts.includes(p.key);
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
        <span style={hintText}>Tap parts that got worked — they light up your body map.</span>
      </div>

      <label style={fieldLabel}>
        Notes
        <textarea
          placeholder="Anything worth remembering?"
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          style={textareaStyle}
        />
      </label>
      {error ? <div style={errorTextStyle}>{error}</div> : null}
    </SportLogModal>
  );
}

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Tile (on /log) ───────────────────────────────────────────────────────────
const tileStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${ACCENT_BORDER}`,
  borderLeft: `3px solid ${ACCENT}`,
  background: ACCENT_BG,
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  minHeight: 52,
  width: "100%",
};
const tileIcon: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 17,
  background: "rgba(45,212,191,0.16)",
  border: `1px solid ${ACCENT_BORDER}`,
  flexShrink: 0,
};
const tileTextCol: CSSProperties = { display: "grid", gap: 2, minWidth: 0, flex: 1 };
const tileLabel: CSSProperties = { fontSize: 14, fontWeight: 900, lineHeight: 1.2 };
const tileEyebrow: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  opacity: 0.7,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const tileAction: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: ACCENT_TEXT,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

// ── Sheet fields ─────────────────────────────────────────────────────────────
const introNote: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  fontWeight: 600,
  color: "rgba(255,255,255,0.62)",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${ACCENT_BORDER}`,
  background: ACCENT_BG,
};
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
const hintText: CSSProperties = { fontSize: 11.5, fontWeight: 600, opacity: 0.6 };
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
  transition: "background 0.12s, border-color 0.12s, color 0.12s",
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
