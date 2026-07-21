// Plan — one scrolling surface: Goals on top, the month Schedule below, and
// the training Rotation last. The old Month / Goals / Cycles tab split is
// gone: goals shouldn't hide behind a click, and the three views read better
// stacked than siloed. Each section fetches its own data (server components),
// and the jump-nav anchors let you skip straight to one on a long page.

import Link from "next/link";
import PlanSection from "./PlanSection";
import MonthTab from "./month/MonthTab";
import YearTab from "./year/YearTab";
import GoalsTab from "./goals/GoalsTab";
import RotationTab from "./cycles/RotationTab";
import PackingListsTab from "./PackingListsTab";
import MarkTimeAwayButton from "./month/MarkTimeAwayButton";
import { NewRoutineDrawerButton, NewGoalDrawerButton } from "@/app/components/FormDrawerButtons";
import { todayAppYmd } from "@/lib/dates";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const JUMP_LINKS = [
  { href: "#year", label: "Year" },
  { href: "#goals", label: "Goals" },
  { href: "#schedule", label: "Schedule" },
  { href: "#rotation", label: "Rotation" },
  { href: "#packing", label: "Packing" },
];

export default async function PlanPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});

  return (
    <div className="mobilePageShell" style={pageStyle}>
      <header style={headerStyle}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <h1 className="mobilePageTitle" style={h1Style}>Plan</h1>
          <p className="mobilePageSubtitle" style={subStyle}>
            Your goals, schedule, and training rotation — all in one place.
          </p>
        </div>
        <nav aria-label="Jump to section" style={jumpNavStyle}>
          {JUMP_LINKS.map((l) => (
            <a key={l.href} href={l.href} style={jumpPillStyle}>
              {l.label}
            </a>
          ))}
        </nav>
      </header>

      <PlanSection
        id="year"
        title="Year"
        subtitle="Your focuses across the seasons. Tap a month to zoom in."
      >
        <YearTab />
      </PlanSection>

      <PlanSection
        id="goals"
        title="Goals"
        subtitle="Frequency, performance, volume, and completion targets."
        action={<NewGoalDrawerButton style={ctaStyle}>+ New Goal</NewGoalDrawerButton>}
      >
        <GoalsTab searchParams={searchParams} />
      </PlanSection>

      <PlanSection
        id="schedule"
        title="Schedule"
        subtitle="What's planned and logged this month. Tap any day for detail."
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <MarkTimeAwayButton today={todayAppYmd()} />
            <NewRoutineDrawerButton style={ctaStyle}>+ New Routine</NewRoutineDrawerButton>
          </div>
        }
      >
        <MonthTab searchParams={searchParams} />
      </PlanSection>

      <PlanSection
        id="rotation"
        title="Rotation"
        subtitle="Your training cycle — what you did last and what's up next."
      >
        <RotationTab />
      </PlanSection>

      <PlanSection
        id="packing"
        title="Packing lists"
        subtitle="Reusable kits — pack against one before a trip, apply it to a log."
        action={<Link href="/gear/lists" style={ctaStyle}>Open lists →</Link>}
      >
        <PackingListsTab />
      </PlanSection>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 4,
  display: "grid",
  gap: 16,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const h1Style: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  margin: 0,
};

const subStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  opacity: 0.7,
};

const jumpNavStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const jumpPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 13px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.2,
  textDecoration: "none",
  color: "inherit",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  minHeight: 34,
};

const ctaStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
  fontSize: 12.5,
  fontWeight: 800,
  letterSpacing: 0.2,
  cursor: "pointer",
  minHeight: 36,
  lineHeight: 1,
};
