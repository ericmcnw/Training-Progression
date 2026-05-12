"use client";

// Fab — single floating action button bottom-right. Tap → QuickAddMenu.
// Persistent across scroll; respects mobile bottom-nav safe area so it
// doesn't get hidden under the nav bar.

import { useState, type CSSProperties } from "react";
import type { QuickPickRoutine } from "./types";
import { COLOR, RADIUS, SHADOW } from "./tokens";
import QuickAddMenu from "./QuickAddMenu";

type Props = {
  routines: QuickPickRoutine[];
  today: string;
};

export default function Fab({ routines, today }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Quick add"
        onClick={() => setOpen(true)}
        style={fabButton}
        className="homeV2Fab"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <path d="M11 4v14M4 11h14" stroke="#0b1220" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>

      <QuickAddMenu open={open} onClose={() => setOpen(false)} routines={routines} today={today} />

      <style>{`
        .homeV2Fab {
          position: fixed;
          right: 18px;
          bottom: 24px;
          z-index: 45;
        }
        @media (max-width: 720px) {
          .homeV2Fab {
            right: 16px;
            /* Lift above the mobile bottom nav bar (which sits ~90px + safe-area). */
            bottom: calc(104px + env(safe-area-inset-bottom, 0px));
          }
        }
      `}</style>
    </>
  );
}

const fabButton: CSSProperties = {
  width: 56,
  height: 56,
  minHeight: 56,
  padding: 0,
  borderRadius: 999,
  border: `1px solid rgba(51,255,122,0.45)`,
  background: `radial-gradient(circle at 30% 25%, #62ff97, #18d96b 60%, #0fa551)`,
  color: "#0b1220",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: SHADOW.fab,
  transition: "transform 140ms ease, box-shadow 140ms ease",
};
