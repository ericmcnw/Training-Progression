"use client";

import { useState, type ReactNode } from "react";

// Same header layout as the Activities page's FamilySection: toggle on the
// left (chevron, title, count), one action on the right. The action sits
// outside the toggle button so its taps never reach the toggle.
export default function RoutineSection({
  title,
  count,
  action,
  accentColor,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  /** Optional single button shown at the right of the header. */
  action?: ReactNode;
  accentColor?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <section
      className="mobileSectionCard"
      style={{
        border: "1px solid rgba(128,128,128,0.35)",
        borderLeft: accentColor ? `3px solid ${accentColor}` : "1px solid rgba(128,128,128,0.35)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: "rgba(128,128,128,0.14)",
          borderBottom: open ? "1px solid rgba(128,128,128,0.25)" : "0",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 48,
            padding: "8px 12px 8px 14px",
            border: 0,
            borderRadius: 0,
            background: "transparent",
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "inherit",
            cursor: "pointer",
            boxShadow: "none",
            textAlign: "left",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 12, opacity: 0.78, width: 12 }}>
            {open ? "▴" : "▾"}
          </span>
          <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.5, color: accentColor ?? "inherit" }}>{title}</span>
          <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>
            {count} {count === 1 ? "routine" : "routines"}
          </span>
        </button>

        {action ? (
          <div style={{ display: "flex", alignItems: "center", padding: "0 10px 0 0", flexShrink: 0 }}>
            {action}
          </div>
        ) : null}
      </div>

      {open ? <div className="mobileSectionBody" style={{ padding: 10, display: "grid", gap: 8 }}>{children}</div> : null}
    </section>
  );
}
