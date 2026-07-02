// Server component that lays out the home dashboard.
//
// Layout (top → bottom):
//   • Last 7 days strip — full width
//   • Week at a Glance — full width (the scrollable rail wants the room)
//   • Two independent columns on desktop:
//       left:  Injuries → Frequency goals (HabitGrid)
//       right: Domain volume → Movement patterns
//     Each column stacks with align-content:start so expanding a card in
//     one column never shifts the other column — only pushes its own
//     column's cards down. On mobile the columns flatten to one stream.
//
// The Ambient status row was removed (2026-06-16): its Body chip is now the
// Injuries section, its Habits chip lives in the frequency rows, and its
// Week chip duplicates Week at a Glance.

import type { CSSProperties } from "react";
import type { HomeData } from "./types";
import { COLOR, SECTION_GAP } from "./tokens";
import HomeGoalsSection from "./HomeGoalsSection";
import DomainSparklines from "./DomainSparklines";
import MovementPatternsCard from "./MovementPatternsCard";
import Fab from "./Fab";
import WeekAtGlance from "./WeekAtGlance";
import Last7DaysStrip from "./Last7DaysStrip";
import LocationPingCapture from "./LocationPingCapture";
import HomeInjuriesSection from "./HomeInjuriesSection";
import HomeRotationSection from "./HomeRotationSection";
import type { HomeInjury } from "@/lib/home-injuries";
import type { HomeOtherGoal } from "@/lib/home-goals";
import type { HomeRotation } from "@/lib/home-rotation";

export default function HomeShell({
  data,
  injuries,
  factorSuggestions,
  zones,
  otherGoals,
  rotation,
}: {
  data: HomeData;
  injuries: HomeInjury[];
  factorSuggestions: string[];
  zones: { slug: string; label: string }[];
  otherGoals: HomeOtherGoal[];
  rotation: HomeRotation | null;
}) {
  return (
    <div style={pageRoot} className="homeRoot">
      <LocationPingCapture />
      <Last7DaysStrip stats={data.last7Days} homeWeather={data.homeWeather} />

      <WeekAtGlance
        days={data.legacyGlanceDays}
        today={data.today}
        currentWeekStart={data.currentWeekStart}
        schedulableRoutines={data.quickPickRoutines}
        scheduleActivityTypes={data.scheduleActivityTypes}
        scheduleSports={data.scheduleSports}
      />

      {/* Two independent columns on desktop. Each column flows its cards
          top-to-bottom with align-content:start, so expanding a collapsible
          in one column pushes only that column's lower cards down — the
          other column stays put. */}
      <div className="homeCols">
        <div className="homeCol">
          <HomeInjuriesSection injuries={injuries} factorSuggestions={factorSuggestions} zones={zones} />
          {/* Phase 2: Goals section (frequency + other goals). To revert to
              the plain frequency grid, swap this back to:
              <HabitGrid rows={data.habitRows} today={data.today} /> */}
          <HomeGoalsSection
            habitRows={data.habitRows}
            today={data.today}
            otherGoals={otherGoals}
          />
        </div>
        <div className="homeCol">
          {/* Rotation sits atop the right column — omitted entirely when the
              user has no active rotation. */}
          {rotation ? <HomeRotationSection rotation={rotation} /> : null}
          <DomainSparklines series={data.domainSeries} />
          <div className="homeMovementPatterns">
            <MovementPatternsCard data={data.movementPatterns} />
          </div>
        </div>
      </div>

      <Fab />

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
