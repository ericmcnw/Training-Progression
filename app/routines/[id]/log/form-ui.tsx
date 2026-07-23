"use client";

import Link from "next/link";
import type React from "react";

const borderColor = "rgba(128,128,128,0.35)";
const surfaceColor = "rgba(128,128,128,0.06)";
const inputBorderColor = "rgba(128,128,128,0.6)";
const inputBackground = "#111827";

export function FormStack({
  children,
  maxWidth = 640,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      className="mobileListStack"
      style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, width: "100%", maxWidth, minWidth: 0 }}
    >
      {children}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mobileCard" style={sectionStyle}>
      {title ? <div style={sectionTitleStyle}>{title}</div> : null}
      {description ? <div style={sectionDescriptionStyle}>{description}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, minWidth: 0 }}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint ? <div style={hintStyle}>{hint}</div> : null}
    </div>
  );
}

export function FieldGrid({
  children,
  minWidth = 180,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return <div className="mobileFormGrid" style={{ display: "grid", gap: 12, gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))` }}>{children}</div>;
}

// Separate Hours + Minutes inputs — so a 90-minute session is "1 h 30 m"
// instead of forcing the user to convert to total minutes in their head.
// Controlled: the parent owns the hours/minutes strings. Reusable across
// every session-style log form.
export function HoursMinutesField({
  hours,
  minutes,
  onHours,
  onMinutes,
  label = "How long?",
  hint,
}: {
  hours: string;
  minutes: string;
  onHours: (v: string) => void;
  onMinutes: (v: string) => void;
  label?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={hmColStyle}>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            min={0}
            max={24}
            value={hours}
            onChange={(e) => onHours(e.target.value)}
            style={inputStyle}
            aria-label="Hours"
          />
          <span style={hmSubStyle}>hours</span>
        </div>
        <div style={hmColStyle}>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={minutes}
            onChange={(e) => onMinutes(e.target.value)}
            style={inputStyle}
            aria-label="Minutes"
          />
          <span style={hmSubStyle}>minutes</span>
        </div>
      </div>
    </Field>
  );
}

// A single session over 24h is virtually always a fat-finger (e.g. "60" typed
// into hours = a 60-hour session that wrecks weekly-total stats). Reject it.
export const MAX_SESSION_MINUTES = 24 * 60;

// Parse the hours/minutes strings into total minutes. `valid` is false when a
// field holds a non-numeric / negative value OR the total exceeds a sane
// single-session ceiling; empty fields read as 0 and a 0 total returns
// `minutes: undefined` (no duration attached).
export function parseHoursMinutes(hours: string, minutes: string): { minutes: number | undefined; valid: boolean } {
  const h = hours.trim() === "" ? 0 : Number(hours);
  const m = minutes.trim() === "" ? 0 : Number(minutes);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) {
    return { minutes: undefined, valid: false };
  }
  const total = h * 60 + m;
  if (total > MAX_SESSION_MINUTES) {
    return { minutes: undefined, valid: false };
  }
  return { minutes: total > 0 ? total : undefined, valid: true };
}

const hmColStyle: React.CSSProperties = { flex: 1, display: "grid", gap: 4, minWidth: 0 };
const hmSubStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, opacity: 0.6, textAlign: "center" };

export function localDateTimeNow(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// Re-export from the server-safe helper so any existing client callers keep
// working unchanged. The implementation lives in ./date-helpers so the
// server log page can import it directly without crossing the
// "use client" boundary.
export { localDateTimeForYmd } from "./date-helpers";

export function DateTimeField({
  value,
  onChange,
  label = "Date & Time",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="datetime-local"
          style={{ ...inputStyle, flex: 1 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => onChange(localDateTimeNow())}
          style={nowButtonStyle}
          title="Reset to current time"
        >
          Now
        </button>
      </div>
    </Field>
  );
}

export function OptionalDateSection({
  value,
  onChange,
  summary = "Log with custom date/time (optional)",
}: {
  value: string;
  onChange: (value: string) => void;
  summary?: string;
}) {
  return (
    <details style={detailsStyle}>
      <summary data-collapsible-summary style={summaryStyle}>
        {summary}
      </summary>
      <div style={{ marginTop: 10 }}>
        <Field label="Performed at">
          <input type="datetime-local" style={inputStyle} value={value} onChange={(event) => onChange(event.target.value)} />
        </Field>
      </div>
    </details>
  );
}

export function FormActions({
  primaryLabel,
  primaryPendingLabel,
  saving,
  onPrimary,
  backHref,
  onBack,
}: {
  primaryLabel: string;
  primaryPendingLabel: string;
  saving: boolean;
  onPrimary: () => void;
  backHref: string;
  onBack?: () => void;
}) {
  return (
    <div className="mobileStickyActions mobileActionRow" style={actionsStyle}>
      <button onClick={onPrimary} disabled={saving} style={primaryButtonStyle}>
        {saving ? primaryPendingLabel : primaryLabel}
      </button>
      {onBack ? (
        <button type="button" onClick={onBack} style={secondaryButtonStyle}>Back</button>
      ) : (
        <Link href={backHref} style={secondaryButtonStyle}>Back</Link>
      )}
    </div>
  );
}

// Inline save/validation error. Replaces alert() across the log forms so a
// failed save (or a bad field) surfaces in-sheet instead of a modal dialog
// that loses the user's place. Renders nothing when message is falsy.
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" style={formErrorStyle}>
      {message}
    </div>
  );
}

const formErrorStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(252,165,165,0.98)",
  background: "rgba(248,113,113,0.1)",
  border: "1px solid rgba(248,113,113,0.32)",
  borderRadius: 10,
  padding: "8px 12px",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  // iOS Safari renders <input type="datetime-local"> at the intrinsic
  // width of its formatted value ("12/31/2024, 11:59 PM") and ignores
  // `width: 100%` when that intrinsic width is larger. minWidth: 0
  // lets the input shrink below intrinsic; maxWidth: 100% caps it at
  // the parent. Both required — together they get datetime inputs to
  // actually fit inside narrow modals.
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: `1px solid ${inputBorderColor}`,
  borderRadius: 12,
  background: inputBackground,
  color: "#ffffff",
  // 16px+ font-size on inputs prevents iOS Safari from auto-zooming the
  // viewport when the field receives focus. Critical for rapid logging
  // sessions where you tap inputs repeatedly.
  fontSize: 16,
};

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 96,
  resize: "vertical",
};

export const pillButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid rgba(128,128,128,0.7)",
  borderRadius: 12,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  fontWeight: 800,
};

const sectionStyle: React.CSSProperties = {
  border: `1px solid ${borderColor}`,
  borderRadius: 16,
  padding: 16,
  background: surfaceColor,
  minWidth: 0,
};

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  letterSpacing: 0.3,
  marginBottom: 6,
};

const sectionDescriptionStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 900,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.72,
};

export const helperTextStyle: React.CSSProperties = hintStyle;

const nowButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 12,
  background: "rgba(128,128,128,0.1)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const detailsStyle: React.CSSProperties = {
  border: `1px solid ${borderColor}`,
  borderRadius: 12,
  padding: "10px 12px",
  background: surfaceColor,
};

const summaryStyle: React.CSSProperties = {
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 13,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const primaryButtonStyle: React.CSSProperties = {
  ...pillButtonStyle,
  padding: "10px 14px",
  fontWeight: 900,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...pillButtonStyle,
  padding: "10px 14px",
  textDecoration: "none",
};
