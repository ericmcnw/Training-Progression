"use client";

import { useState, type ReactNode } from "react";

export default function RoutineSection({
  title,
  count,
  quickLogSlot,
  accentColor,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  /** Optional small button shown in the section header (e.g. "Quick Log"). */
  quickLogSlot?: ReactNode;
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
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mobileRoutinesHeader mobileSectionHeader"
          style={{
            width: "100%",
            minHeight: 0,
            padding: "10px 14px",
            border: 0,
            borderBottom: open ? "1px solid rgba(128,128,128,0.25)" : "0",
            borderRadius: 0,
            background: "rgba(128,128,128,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "inherit",
            cursor: "pointer",
            boxShadow: "none",
            position: "relative",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              opacity: 0.78,
            }}
          >
            {open ? "▴" : "▾"}
          </span>
          <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.5, color: accentColor ?? "inherit" }}>{title}</span>
        </button>

        {quickLogSlot ? (
          <div
            style={{
              position: "absolute",
              left: 34,
              top: "50%",
              transform: "translateY(-50%)",
              // The slot sits on top of the section header button.
              // Without explicit z-index, mobile Safari can route the
              // tap to the header button underneath even though the
              // slot is later in DOM order. zIndex + auto pointer
              // events lock the tap to the slot.
              zIndex: 5,
              pointerEvents: "auto",
            }}
          >
            {quickLogSlot}
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>{count} routines</span>
        </div>
      </div>

      {open ? <div className="mobileSectionBody" style={{ padding: 10, display: "grid", gap: 8 }}>{children}</div> : null}
    </section>
  );
}
