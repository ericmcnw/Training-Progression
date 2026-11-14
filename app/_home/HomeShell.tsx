// Server component that lays out the home dashboard.
//
// With nothing logged in the last 8 weeks a Getting started card leads the
// page and the cards that would render empty are omitted.
//
// Layout (top → bottom), wide desktop (≥1180px):
//   • Week at a Glance → Programs (cards stacked) beside a side column of
//     Last 7 days → Clients (admin's own account only) → Injuries
//   • Plan / Progressions bands — full width
//   • Three independent columns: Goals | Rotation → Domain volume | Movement
//     Each column stacks with align-content:start so expanding a card in
//     one column never shifts the others.
// Below 1180px the top split flattens; below 980px every wrapper flattens to
// one stream, and `order` keeps the mobile sequence: Last 7 days, WaG,
// Clients, Plan, Progressions, Programs, Injuries, Goals, Rotation, Domain
// volume, Movement.
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
import WeekAtGlance from "./WeekAtGlance";
import Last7DaysStrip from "./Last7DaysStrip";
import LocationPingCapture from "./LocationPingCapture";
import HomeInjuriesSection from "./HomeInjuriesSection";
import HomeRotationSection from "./HomeRotationSection";
import HomeFocusSection from "./HomeFocusSection";
import HomeProgressionsSection from "./HomeProgressionsSection";
import type { ReadyRung } from "@/app/progressions/data";
import type { HomeInjury } from "@/lib/home-injuries";
import type { HomeOtherGoal } from "@/lib/home-goals";
import type { HomeRotation } from "@/lib/home-rotation";
import type { FocusBandItem } from "@/app/focus/shared";
import HomePlanSection from "./HomePlanSection";
import type { HomePlanGroup } from "./plan-data";
import HomeClientsSection from "./HomeClientsSection";
import type { HomeClient } from "./clients-data";
import HomeGettingStarted from "./HomeGettingStarted";

export default function HomeShell({
  data,
  injuries,
  factorSuggestions,
  zones,
  otherGoals,
  rotation,
  focuses,
  readyRungs,
  planGroups,
  clients,
}: {
  data: HomeData;
  injuries: HomeInjury[];
  factorSuggestions: string[];
  zones: { slug: string; label: string }[];
  otherGoals: HomeOtherGoal[];
  rotation: HomeRotation | null;
  focuses: FocusBandItem[];
  readyRungs: ReadyRung[];
  planGroups: HomePlanGroup[];
  clients: HomeClient[];
}) {
  const noRecentSessions = data.domainSeries.length === 0;
  const hasGoals = data.habitRows.length + otherGoals.length > 0;
  const showGoals = hasGoals || !noRecentSessions;
  const showMovement = data.movementPatterns.patterns.length > 0;
  const showCols = showGoals || !!rotation || !noRecentSessions || showMovement;

  return (
    <div style={pageRoot} className="homeRoot">
      <LocationPingCapture />
      {noRecentSessions ? (
        <div className="homeStart">
          <HomeGettingStarted hasGoals={hasGoals} />
        </div>
      ) : null}
      <div className="homeTop">
        <div className="homeTopMain">
          <WeekAtGlance
            days={data.legacyGlanceDays}
            today={data.today}
            currentWeekStart={data.currentWeekStart}
            schedulableRoutines={data.quickPickRoutines}
            scheduleActivityTypes={data.scheduleActivityTypes}
            scheduleSports={data.scheduleSports}
          />
          <div className="homeFocus">
            <HomeFocusSection focuses={focuses} />
          </div>
        </div>
        <div className="homeTopSide">
          <div className="homeLast7">
            <Last7DaysStrip stats={data.last7Days} homeWeather={data.homeWeather} />
          </div>
          {clients.length > 0 ? (
            <div className="homeClients">
              <HomeClientsSection clients={clients} today={data.today} />
            </div>
          ) : null}
          <div className="homeInjuries">
            <HomeInjuriesSection injuries={injuries} factorSuggestions={factorSuggestions} zones={zones} />
          </div>
        </div>
      </div>

      <HomePlanSection groups={planGroups} />

      <HomeProgressionsSection ready={readyRungs} />

      {showCols ? (
        <div className="homeCols">
          <div className="homeCol">
            {/* Phase 2: Goals section (frequency + other goals). To revert to
                the plain frequency grid, swap this back to:
                <HabitGrid rows={data.habitRows} today={data.today} /> */}
            {showGoals ? (
              <HomeGoalsSection
                habitRows={data.habitRows}
                today={data.today}
                otherGoals={otherGoals}
              />
            ) : null}
          </div>
          <div className="homeCol">
            {/* Rotation sits atop the right column — omitted entirely when the
                user has no active rotation. */}
            {rotation ? <HomeRotationSection rotation={rotation} /> : null}
            {noRecentSessions ? null : <DomainSparklines series={data.domainSeries} />}
          </div>
          <div className="homeCol homeMovementPatterns">
            {showMovement ? <MovementPatternsCard data={data.movementPatterns} /> : null}
          </div>
        </div>
      ) : null}

      <style>{`
        .homeRoot {
          --home-edge: clamp(12px, 3vw, 22px);
        }
        .homeTop, .homeCols {
          display: grid;
          grid-template-columns: 1fr;
          gap: ${SECTION_GAP}px;
          align-items: start;
        }
        .homeInjuries:empty, .homeFocus:empty { display: none; }
        .homeTopMain, .homeTopSide, .homeCol {
          display: grid;
          gap: ${SECTION_GAP}px;
          align-content: start;
          min-width: 0;
        }
        @media (min-width: 1180px) {
          .homeTop {
            grid-template-columns: minmax(0, 1.65fr) minmax(360px, 1fr);
          }
          .homeCols {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .homeFocusGrid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 1179px) {
          .homeTop, .homeTopMain, .homeTopSide { display: contents; }
          .homeStart { order: -5; }
          .homeLast7 { order: -4; }
          .homeTopMain > :first-child { order: -3; }
          .homeClients { order: -2; }
          .homeFocus { order: 1; }
          .homeInjuries { order: 2; }
          .homeCols { order: 3; }
        }
        @media (min-width: 980px) and (max-width: 1179px) {
          .homeCols {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 979px) {
          .homeCols, .homeCol { display: contents; }
          .homeCol > * { order: 3; }
          .homeMovementPatterns > * {
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

