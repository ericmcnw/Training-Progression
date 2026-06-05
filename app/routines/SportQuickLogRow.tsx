"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { loadSportLogContext, logSportAction, type SportLogContext } from "@/app/log/sport-actions";
import ClimbLogSheet from "./ClimbLogSheet";
import GolfLogSheet from "./GolfLogSheet";
import SportLogModal from "./SportLogModal";
import { useSportLogDraft } from "./useSportLogDraft";
import { getSportLogConfig, type ExtraFieldConfig } from "./sportLogConfig";
import SpotPicker from "@/app/components/log/SpotPicker";
import type { SpotPickerValue } from "@/lib/spot-picker-types";

// One row in the SPORT section, representing a user's selected sport.
// Tap → log sheet. Each sport has its own rich form when one exists,
// otherwise falls back to the minimal date / duration / notes form:
//   • Climbing → ClimbLogSheet (per-attempt discipline/grade/outcome)
//   • Golf     → GolfLogSheet (COURSE/RANGE mode with per-hole or per-club detail)
//   • Others   → LogSheet (basketball, snowboarding, surfing, etc.)
// Per-sport rich forms get added as each sport graduates.

export type SportRowData = {
  slug: string;
  label: string;
  eyebrow: string;
  /** Full-alpha accent color, used as the row's left stripe so the
   *  visual identity matches the chart palette on /activities/sports. */
  color: string;
};

export default function SportQuickLogRow({ sport }: { sport: SportRowData }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...rowStyle, borderLeft: `3px solid ${sport.color}` }}
      >
        <span style={textCol}>
          <span style={rowLabel}>{sport.label}</span>
          <span style={rowEyebrow}>{sport.eyebrow}</span>
        </span>
        <span style={rowAction}>Log →</span>
      </button>
      {open ? (
        sport.slug === "climbing" ? (
          <ClimbLogSheet onClose={() => setOpen(false)} />
        ) : sport.slug === "golf" ? (
          <GolfLogSheet onClose={() => setOpen(false)} />
        ) : (
          <LogSheet sport={sport} onClose={() => setOpen(false)} />
        )
      ) : null}
    </>
  );
}

type GenericDraft = {
  performedAt: string;
  duration: string;
  notes: string;
  sessionType: string;
  spot: SpotPickerValue;
  /** Per-sport extra fields by key — strings to keep the draft
   *  serializable; coerced to numbers at submit time. */
  extras: Record<string, string>;
};

function LogSheet({ sport, onClose }: { sport: SportRowData; onClose: () => void }) {
  const config = getSportLogConfig(sport.slug);
  const [draft, setDraft, clearDraft] = useSportLogDraft<GenericDraft>(
    `sport-log-draft-${sport.slug}`,
    {
      performedAt: formatLocalDateTime(new Date()),
      duration: "",
      notes: "",
      sessionType: "",
      spot: null,
      extras: {},
    }
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Spot picker context (config + saved/recent spots) — loaded once
  // when the sheet opens. Sport with no spot support (config null)
  // skips the picker entirely.
  const [spotCtx, setSpotCtx] = useState<SportLogContext | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadSportLogContext(sport.slug)
      .then((ctx) => {
        if (!cancelled) setSpotCtx(ctx);
      })
      .catch(() => {
        /* non-fatal — picker just won't render */
      });
    return () => {
      cancelled = true;
    };
  }, [sport.slug]);

  function setExtra(key: string, value: string) {
    setDraft((d) => ({ ...d, extras: { ...d.extras, [key]: value } }));
  }

  function submit() {
    setError(null);
    const ms = Date.parse(draft.performedAt);
    if (Number.isNaN(ms)) {
      setError("Invalid date/time.");
      return;
    }
    const minutes = draft.duration.trim() === "" ? undefined : Number(draft.duration);
    if (minutes !== undefined && (Number.isNaN(minutes) || minutes < 0)) {
      setError("Duration must be a positive number.");
      return;
    }

    // Coerce number-typed extras from string state. Empty stays
    // undefined so the field isn't persisted at all.
    const extrasOut: Record<string, string | number | undefined> = {};
    for (const f of config.extras ?? []) {
      const raw = (draft.extras[f.key] ?? "").trim();
      if (raw === "") continue;
      extrasOut[f.key] = f.type === "number" ? Number(raw) : raw;
    }

    startTransition(async () => {
      try {
        await logSportAction({
          sportSlug: sport.slug,
          performedAtIso: new Date(ms).toISOString(),
          durationMinutes: minutes,
          notes: draft.notes.trim() || undefined,
          spotValue: draft.spot,
          sessionType: draft.sessionType.trim() || undefined,
          extras: extrasOut,
        });
        clearDraft();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to log session.");
      }
    });
  }

  return (
    <SportLogModal
      title={`Log ${sport.label}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} style={btnSecondary} disabled={pending}>
            Cancel
          </button>
          <button type="button" onClick={submit} style={btnPrimary} disabled={pending}>
            {pending ? "Saving…" : "Save log"}
          </button>
        </>
      }
    >
      <label style={fieldLabel}>
        When
        <input
          type="datetime-local"
          value={draft.performedAt}
          onChange={(e) => setDraft((d) => ({ ...d, performedAt: e.target.value }))}
          style={fieldInput}
        />
      </label>

      {/* Per-sport "Mode" / "Type" / "Terrain" dropdown if the config
          defines options. */}
      {config.sessionTypeOptions && config.sessionTypeOptions.length > 0 ? (
        <label style={fieldLabel}>
          {config.sessionTypeLabel ?? "Type"}
          <select
            value={draft.sessionType}
            onChange={(e) => setDraft((d) => ({ ...d, sessionType: e.target.value }))}
            style={fieldInput}
          >
            <option value="">— select —</option>
            {config.sessionTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Spot picker — same component cardio/climbing use. Falls
          back gracefully to nothing if this sport has no spot
          config (unlikely for registered sports today). */}
      {spotCtx?.config ? (
        <div style={fieldGroup}>
          <span style={fieldLabelText}>Where</span>
          <SpotPicker
            config={spotCtx.config}
            spotNoun={spotCtx.spotNoun}
            savedSpots={spotCtx.savedSpots}
            recentSpots={spotCtx.recentSpots}
            value={draft.spot}
            onChange={(next) => setDraft((d) => ({ ...d, spot: next }))}
          />
        </div>
      ) : null}

      <label style={fieldLabel}>
        Duration (minutes)
        <input
          type="number"
          inputMode="numeric"
          placeholder="optional"
          value={draft.duration}
          onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))}
          style={fieldInput}
        />
      </label>

      {/* Per-sport extra fields — surfing wave count, basketball
          score, snowboarding runs, etc. */}
      {config.extras && config.extras.length > 0 ? (
        <div style={extrasGrid}>
          {config.extras.map((f) => (
            <ExtraField
              key={f.key}
              field={f}
              value={draft.extras[f.key] ?? ""}
              onChange={(v) => setExtra(f.key, v)}
            />
          ))}
        </div>
      ) : null}

      <label style={fieldLabel}>
        Notes
        <textarea
          placeholder="How'd it go?"
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          style={{ ...fieldInput, minHeight: 100, resize: "vertical" as const }}
        />
      </label>
      {error ? <div style={errorTextStyle}>{error}</div> : null}
    </SportLogModal>
  );
}

function ExtraField({
  field,
  value,
  onChange,
}: {
  field: ExtraFieldConfig;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <label style={{ ...fieldLabel, gridColumn: "1 / -1" }}>
        {field.label}
        <textarea
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...fieldInput, minHeight: 70, resize: "vertical" as const }}
        />
      </label>
    );
  }
  return (
    <label style={fieldLabel}>
      {field.label}
      <input
        type={field.type === "number" ? "number" : "text"}
        inputMode={
          field.type === "number"
            ? field.numericHint === "decimal"
              ? "decimal"
              : "numeric"
            : undefined
        }
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={fieldInput}
      />
    </label>
  );
}

function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.28)",
  background: "rgba(128,128,128,0.05)",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  minHeight: 52,
};
const textCol: CSSProperties = { display: "grid", gap: 2, minWidth: 0 };
const rowLabel: CSSProperties = { fontSize: 14, fontWeight: 900, lineHeight: 1.2 };
const rowEyebrow: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};
const rowAction: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.7,
  whiteSpace: "nowrap",
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
const fieldGroup: CSSProperties = {
  display: "grid",
  gap: 8,
};
const fieldLabelText: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.75,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};
const fieldInput: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 600,
  textTransform: "none",
  letterSpacing: 0,
  opacity: 1,
  minHeight: 44,
  boxSizing: "border-box",
};
const errorTextStyle: CSSProperties = {
  fontSize: 12,
  color: "rgba(248,113,113,0.95)",
  fontWeight: 700,
};

// Two-column grid for per-sport extras so paired numeric fields
// (basketball points-for/against, snow runs + conditions) sit side
// by side on wider screens and stack on narrow mobile.
const extrasGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
};
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
