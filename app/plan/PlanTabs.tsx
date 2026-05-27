import Link from "next/link";
import type { CSSProperties } from "react";

// PlanTabs — pill row above the Plan page content. Server component, no
// client state needed: the active tab comes in via the page's searchParams.
// Each tab is a Next Link with `replace` so switching tabs doesn't pollute
// the browser back stack.

const TABS: Array<{ key: string; label: string }> = [
  { key: "month", label: "Month" },
  { key: "goals", label: "Goals" },
  { key: "cycles", label: "Cycles" },
];

export type PlanTabKey = (typeof TABS)[number]["key"];

export const PLAN_TABS = TABS;

export function isValidTab(value: string | undefined | null): value is PlanTabKey {
  return TABS.some((t) => t.key === value);
}

export default function PlanTabs({ current }: { current: PlanTabKey }) {
  return (
    <nav aria-label="Plan views" style={navStyle} className="planTabs">
      {TABS.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={`/plan?tab=${tab.key}`}
            replace
            aria-current={active ? "page" : undefined}
            style={active ? pillActive : pill}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

const navStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  padding: "2px 0 4px",
};

const pill: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 0.2,
  textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  minHeight: 36,
  display: "inline-flex",
  alignItems: "center",
  lineHeight: 1,
};

const pillActive: CSSProperties = {
  ...pill,
  border: "1px solid rgba(51,255,122,0.45)",
  background: "rgba(51,255,122,0.10)",
  color: "rgba(51,255,122,0.95)",
};