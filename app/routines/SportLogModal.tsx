"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Shared chrome for all sport-log sheets (Climb, Golf, generic).
// Matches the existing LogDrawer look: full-screen modal, dark
// background, sticky header with a Minimize button that uses the
// same chevron + text treatment users already know.
//
// Sheet bodies stay agnostic of the chrome — they just render their
// form fields inside this wrapper. State persistence is the form's
// responsibility (localStorage drafts in each sheet); Minimize just
// closes, the next open re-mounts with restored state.

export default function SportLogModal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional sticky footer — typically the Save/Cancel button row.
   *  Floats above the body's scroll so the save action stays in
   *  reach when a long climb session pushes the form off-screen. */
  footer?: ReactNode;
}) {
  // Portal to document.body so the modal escapes any transformed
  // ancestor. The SportsAddButton renders inside RoutineSection's
  // quickLogSlot wrapper which has `transform: translateY(-50%)` —
  // that creates a containing block for `position: fixed`, so the
  // sheet would otherwise render at the size/position of the tiny
  // slot wrapper instead of the viewport. The portal escapes it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  const content = (
    <>
      {/* Backdrop only visible on desktop via .logDrawerBackdrop's
          media query; mobile is full-screen so the backdrop is hidden
          to avoid double-rendering. Click closes (same pattern as the
          existing LogDrawer). */}
      <div className="logDrawerBackdrop" onClick={onClose} />
      <div
        className="logDrawerSheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div style={drawerHeader}>
        <span style={drawerTitle}>{title}</span>
        <button
          type="button"
          onClick={onClose}
          style={minimizeBtn}
          aria-label="Minimize log"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            width={16}
            height={16}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          Minimize
        </button>
      </div>
        <div style={drawerBody}>{children}</div>
        {footer ? <div style={drawerFooter}>{footer}</div> : null}
      </div>
    </>
  );

  return createPortal(content, document.body);
}

const drawerHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "0 16px",
  height: 52,
  borderBottom: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.03)",
  flexShrink: 0,
};

const drawerTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const minimizeBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 12px",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  color: "rgba(255,255,255,0.7)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 0,
  flexShrink: 0,
};

const drawerBody: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "18px 18px 22px",
  display: "grid",
  gap: 18,
};

const drawerFooter: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
  flexShrink: 0,
};
