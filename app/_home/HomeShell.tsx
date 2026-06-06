// Server component that lays out the home dashboard. On desktop the four
// content sections sit in two flex columns side-by-side; each column stacks
// its cards tightly so a tall card (WaG) doesn't open a gap under a short
// neighbor (Habits). On mobile they collapse to a single column.

import type { CSSProperties } from "react";
import type { HomeData } from "./types";
import { COLOR, SECTION_GAP } from "./tokens";
import AmbientStatusRow from "./AmbientStatusRow";
import HabitGrid from "./HabitGrid";
import DomainSparklines from "./DomainSparklines";
import MovementPatternsCard from "./MovementPatternsCard";
import Fab from "./Fab";
import WeekAtGlance from "./WeekAtGlance";
import Last7DaysStrip from "./Last7DaysStrip";

export default function HomeShell({ data }: { data: HomeData }) {
  return (
    <div style={pageRoot} className="homeRoot">
      <AmbientStatusRow
        body={data.bodyChip}
        habit={data.habitChip}
        week={data.weekChip}
      />

      <Last7DaysStrip stats={data.last7Days} />

      {/* Two columns side-by-side on desktop. Each column flows its cards
          top-to-bottom with no inter-card whitespace beyond the gap, so an
          imbalance in row heights doesn't open an awkward void mid-column. */}
      <div className="homeCols">
        <div className="homeCol">
          <WeekAtGlance
            days={data.legacyGlanceDays}
            today={data.today}
            currentWeekStart={data.currentWeekStart}
            schedulableRoutines={data.quickPickRoutines}
            scheduleActivityTypes={data.scheduleActivityTypes}
            scheduleSports={data.scheduleSports}
          />
          <div className="homeMovementPatterns">
            <MovementPatternsCard data={data.movementPatterns} />
          </div>
        </div>
        <div className="homeCol">
          <HabitGrid
            rows={data.habitRows}
            today={data.today}
          />
          <DomainSparklines series={data.domainSeries} />
        </div>
      </div>

      <Fab
        routines={data.quickPickRoutines}
        activityTypes={data.scheduleActivityTypes}
        sports={data.scheduleSports}
        today={data.today}
      />

      <style>{`
        .homeRoot {
          --home-edge: clamp(12px, 3vw, 22px);
        }
        .homeCols {
          display: grid;
          grid-template-columns: 1fr;
          gap: ${SECTION_GAP}px;
          align-items: start;
        }
        .homeCol {
          display: grid;
          gap: ${SECTION_GAP}px;
          align-content: start;
          min-width: 0;
        }
        @media (min-width: 980px) {
          .homeCols {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 979px) {
          /* Single-column mobile/tablet — flatten the column wrappers so
             every card becomes a direct grid item of .homeCols. That lets
             us reorder Movement Patterns to the very bottom without
             changing desktop's left-column grouping. */
          .homeCol {
            display: contents;
          }
          .homeMovementPatterns {
            order: 99;
          }
        }
        @media (max-width: 720px) {
          .homeRoot {
            --home-edge: 0;
            gap: 14px !important;
          }
        }
        .homeRoot *:focus-visible {
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
  paddingInline: "var(--home-edge, 0px)",
  paddingBlock: 4,
  position: "relative",
};
