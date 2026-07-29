"use client";

// Floating coach — a 🧠 button (bottom-left; the quick-log Fab owns
// bottom-right) that opens the chat in the shared .logDrawerSheet chrome.
// The chat stays mounted while minimized so the conversation survives
// closing the sheet; a page refresh still starts fresh (Slice 3 adds
// persistence).

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import CoachChat from "./CoachChat";

export default function CoachWidget() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  const sheet = everOpened ? (
    <div style={{ display: open ? "contents" : "none" }}>
      <div className="logDrawerBackdrop" onClick={() => setOpen(false)} />
      <div className="logDrawerSheet" role="dialog" aria-modal="true" aria-label="Coach">
        <div style={sheetHeader}>
          <span style={sheetTitle}>🧠 Coach</span>
          <button type="button" onClick={() => setOpen(false)} style={minimizeBtn} aria-label="Minimize coach">
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
        <CoachChat configured variant="fill" />
      </div>
    </div>
  ) : null;

  return createPortal(
    <>
      {!open ? (
        <button
          type="button"
          aria-label="Ask your coach"
          className="coachFab"
          onClick={() => {
            setEverOpened(true);
            setOpen(true);
          }}
        >
          🧠
        </button>
      ) : null}
      {sheet}
      <style>{`
        .coachFab {
          position: fixed;
          left: 18px;
          bottom: 24px;
          z-index: 45;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          font-size: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--panel);
          border: 1px solid rgba(251,191,36,0.45);
          box-shadow: 0 8px 26px rgba(0,0,0,0.5);
          cursor: pointer;
        }
        @media (max-width: 720px) {
          .coachFab {
            left: 16px;
            /* Lift above the mobile bottom nav bar (same offset as the Fab). */
            bottom: calc(104px + env(safe-area-inset-bottom, 0px));
          }
        }
      `}</style>
    </>,
    document.body
  );
}

const sheetHeader: CSSProperties = {
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

const sheetTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
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
