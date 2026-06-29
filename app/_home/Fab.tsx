"use client";

// Fab — single floating action button bottom-right. Tap → QuickAddMenu.
// Persistent across scroll; respects mobile bottom-nav safe area so it
// doesn't get hidden under the nav bar.

import { useState, type CSSProperties } from "react";
import type { QuickPickRoutine } from "./types";
import { SHADOW } from "./tokens";
import QuickAddMenu from "./QuickAddMenu";
import type { ScheduleActivityType, ScheduleSport } from "./SchedulePicker";
import ClimbLogSheet from "@/app/routines/ClimbLogSheet";
import GolfLogSheet from "@/app/routines/GolfLogSheet";
import BackpackingLogSheet from "@/app/routines/BackpackingLogSheet";
import { GenericSportLogSheet } from "@/app/routines/SportQuickLogRow";
import { ActivityLogSheet } from "@/app/routines/ActivityLogSheet";

type Props = {
  routines: QuickPickRoutine[];
  activityTypes?: ScheduleActivityType[];
  sports?: ScheduleSport[];
  today: string;
};

export default function Fab({ routines, activityTypes, sports, today }: Props) {
  const [open, setOpen] = useState(false);
  // Active sport sheet — set when the user picks a sport tile in the
  // FAB menu. Renders the right sport-specific log form (climbing,
  // golf, or the generic per-sport sheet). Same sheets the /log SPORT
  // section uses — single source of truth for sport logging UX.
  const [activeSport, setActiveSport] = useState<ScheduleSport | null>(null);
  // Freeform "Activity" sheet — opened from the QuickAddMenu item.
  const [activityOpen, setActivityOpen] = useState(false);
  // Backpacking trip sheet — endurance pursuit with its own direct entry
  // (no "add it as a sport" hop), opened straight from the QuickAddMenu.
  const [backpackingOpen, setBackpackingOpen] = useState(false);

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

      <QuickAddMenu
        open={open}
        onClose={() => setOpen(false)}
        routines={routines}
        activityTypes={activityTypes}
        sports={sports}
        onSportSelected={(sport) => setActiveSport(sport)}
        onLogActivity={() => setActivityOpen(true)}
        onLogBackpacking={() => setBackpackingOpen(true)}
        today={today}
      />

      {/* Sport log sheets mount at the FAB level so they portal to
          document.body and overlay correctly. Each sheet handles its
          own form chrome via SportLogModal. */}
      {activeSport?.slug === "climbing" ? (
        <ClimbLogSheet onClose={() => setActiveSport(null)} />
      ) : activeSport?.slug === "golf" ? (
        <GolfLogSheet onClose={() => setActiveSport(null)} />
      ) : activeSport ? (
        <GenericSportLogSheet sport={activeSport} onClose={() => setActiveSport(null)} />
      ) : null}

      {activityOpen ? <ActivityLogSheet onClose={() => setActivityOpen(false)} /> : null}
      {backpackingOpen ? <BackpackingLogSheet onClose={() => setBackpackingOpen(false)} /> : null}

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
