"use client";

import { useState, type CSSProperties } from "react";
import ClimbLogSheet from "@/app/routines/ClimbLogSheet";
import GolfLogSheet from "@/app/routines/GolfLogSheet";
import BackpackingLogSheet from "@/app/routines/BackpackingLogSheet";
import { GenericSportLogSheet } from "@/app/routines/SportQuickLogRow";

// Context-aware "Log" button for activity world pages: opens THAT sport's
// log sheet directly instead of routing through /log and making the user
// find the sport again. Same sheet dispatch the home FAB uses.
export default function LogSessionCTA({
  slug,
  label,
  eyebrow = "Sport",
  color = "rgba(251,146,60,0.9)",
  buttonLabel = "📋 Log",
  style,
}: {
  slug: string;
  label: string;
  eyebrow?: string;
  color?: string;
  buttonLabel?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ cursor: "pointer", fontFamily: "inherit", ...style }}>
        {buttonLabel}
      </button>
      {open ? (
        slug === "climbing" ? (
          <ClimbLogSheet onClose={() => setOpen(false)} />
        ) : slug === "golf" ? (
          <GolfLogSheet onClose={() => setOpen(false)} />
        ) : slug === "backpacking" ? (
          <BackpackingLogSheet onClose={() => setOpen(false)} />
        ) : (
          <GenericSportLogSheet sport={{ slug, label, eyebrow, color }} onClose={() => setOpen(false)} />
        )
      ) : null}
    </>
  );
}
