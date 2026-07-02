"use client";

// Fab — single floating action button, bottom-right. One tap opens the
// quick-log workout drawer directly (no menu). The old grab-bag QuickAddMenu
// duplicated the Log tab and buried planning actions; those moved to /log and
// /plan respectively. Persistent across scroll; respects the mobile bottom-nav
// safe area so it doesn't hide under the nav bar.

import type { CSSProperties } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import { QUICK_LOG_ROUTINE_ID } from "@/app/components/LogDrawer";
import { SHADOW } from "./tokens";

export default function Fab() {
  const { openDrawer } = useLogDrawer();

  return (
    <>
      <button
        type="button"
        aria-label="Log a quick workout"
        onClick={() => openDrawer(QUICK_LOG_ROUTINE_ID)}
        style={fabButton}
        className="homeV2Fab"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <path d="M11 4v14M4 11h14" stroke="#0b1220" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>

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
