// Server component that lays out the home-v2 sections. On desktop the four
// content sections sit in two flex columns side-by-side; each column stacks
// its cards tightly so a tall card (WaG) doesn't open a gap under a short
// neighbor (Habits). On mobile they collapse to a single column.

import type { CSSProperties } from "react";
import type { HomeV2Data } from "./types";
import { COLOR, SECTION_GAP } from "./tokens";
import AmbientStatusRow from "./AmbientStatusRow";
import HabitGridV2 from "./HabitGridV2";
import DomainSparklinesV2 from "./DomainSparklinesV2";
import MovementPatternsCard from "./MovementPatternsCard";
import Fab from "./Fab";
import WeekAtGlanceV3 from "./WeekAtGlanceV3";

export default function HomeShell({ data }: { data: HomeV2Data }) {
  return (
    <div style={pageRoot} className="homeV2Root">
      <AmbientStatusRow
        body={data.bodyChip}
        habit={data.habitChip}
        week={data.weekChip}
      />

      {/* Two columns side-by-side on desktop. Each column flows its cards
          top-to-bottom with no inter-card whitespace beyond the gap, so an
          imbalance in row heights doesn't open an awkward void mid-column. */}
      <div className="homeV2Cols">
        <div className="homeV2Col">
          <WeekAtGlanceV3
            days={data.legacyGlanceDays}
            today={data.today}
            currentWeekStart={data.currentWeekStart}
          />
          <MovementPatternsCard data={data.movementPatterns} />
        </div>
        <div className="homeV2Col">
          <HabitGridV2
            rows={data.habitRows}
            today={data.today}
          />
          <DomainSparklinesV2 series={data.domainSeries} />
        </div>
      </div>

      <Fab routines={data.quickPickRoutines} today={data.today} />

      <style>{`
        .homeV2Root {
          --homeV2-edge: clamp(12px, 3vw, 22px);
        }
        .homeV2Cols {
          display: grid;
          grid-template-columns: 1fr;
          gap: ${SECTION_GAP}px;
          align-items: start;
        }
        .homeV2Col {
          display: grid;
          gap: ${SECTION_GAP}px;
          align-content: start;
          min-width: 0;
        }
        @media (min-width: 980px) {
          .homeV2Cols {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 720px) {
          .homeV2Root {
            --homeV2-edge: 0;
            gap: 14px !important;
          }
        }
        .homeV2Root *:focus-visible {
          outline: 2px solid rgba(51,255,122,0.55);
          outline-offset: 2px;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}

const pageRoot: CSSProperties = {
  display: "grid",
  gap: SECTION_GAP,
  color: COLOR.text,
  paddingInline: "var(--homeV2-edge, 0px)",
  paddingBlock: 4,
  position: "relative",
};
