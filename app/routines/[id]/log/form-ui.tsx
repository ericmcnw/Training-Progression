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
  return <div style={{ display: "grid", gap: 14, width: "100%", maxWidth }}>{children}</div>;
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
    <section style={sectionStyle}>
      {title ? <div style={sectionTitleStyle}>{title}</div> : null}
      {description ? <div style={sectionDescriptionStyle}>{description}</div> : null}
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
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
  return <div style={{ display: "grid", gap: 12, gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))` }}>{children}</div>;
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
}: {
  primaryLabel: string;
  primaryPendingLabel: string;
  saving: boolean;
  onPrimary: () => void;
  backHref: string;
}) {
  return (
    <div style={actionsStyle}>
      <button onClick={onPrimary} disabled={saving} style={primaryButtonStyle}>
        {saving ? primaryPendingLabel : primaryLabel}
      </button>
      <Link href={backHref} style={secondaryButtonStyle}>
        Back
      </Link>
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${inputBorderColor}`,
  borderRadius: 12,
  background: inputBackground,
  color: "#ffffff",
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
  padding: 14,
  background: surfaceColor,
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
