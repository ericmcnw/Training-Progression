// Single source of truth for goal-type accent colors. Used by:
//   - app/plan/goals/GoalRow.tsx        (plan/goals list rows)
//   - app/goals/details/GoalDetailPage  (goal detail hero)
//   - app/goals/ui.tsx                  (GoalCardShell borderLeft strip)
//   - app/goals/GoalsPageContent.tsx    (other-goals chip)
//   - app/goals/FrequencyGoalRow.tsx    (single-color borderLeft strip)
//   - app/goals/GoalForm.tsx            (goal-type tile picker)
//
// Gentle-lens palette — no red anywhere. PERFORMANCE was moved off
// amber to rose so it doesn't collide with the lifestyle domain color
// or the `behind` status; everything that consumed the type accent
// reads from this file so the change propagates everywhere.

export type GoalTypeAccent = {
  /** Solid base color — text, strokes, fully-opaque chips. */
  color: string;
  /** Subtle section-card background (~0.10 alpha). */
  bg: string;
  /** Slightly stronger chip background (~0.13 alpha). */
  chipBg: string;
  /** Border + outline (~0.45 alpha). */
  border: string;
  /** Disabled / empty / faint state (~0.18 alpha). */
  weak: string;
  /** borderLeft strip / row-edge color (~0.65 alpha). */
  softColor: string;
  /** Light pastel chip text — pairs with chipBg + border. */
  chipText: string;
};

export const TYPE_ACCENT: Record<string, GoalTypeAccent> = {
  FREQUENCY: {
    color:     "rgb(129,140,248)",
    bg:        "rgba(129,140,248,0.10)",
    chipBg:    "rgba(129,140,248,0.14)",
    border:    "rgba(129,140,248,0.45)",
    weak:      "rgba(129,140,248,0.18)",
    softColor: "rgba(129,140,248,0.65)",
    chipText:  "#e0e7ff",
  },
  VOLUME: {
    color:     "rgb(34,211,238)",
    bg:        "rgba(34,211,238,0.10)",
    chipBg:    "rgba(34,211,238,0.13)",
    border:    "rgba(34,211,238,0.45)",
    weak:      "rgba(34,211,238,0.18)",
    softColor: "rgba(34,211,238,0.65)",
    chipText:  "#cffafe",
  },
  PERFORMANCE: {
    color:     "rgb(251,113,133)",
    bg:        "rgba(251,113,133,0.10)",
    chipBg:    "rgba(251,113,133,0.13)",
    border:    "rgba(251,113,133,0.45)",
    weak:      "rgba(251,113,133,0.18)",
    softColor: "rgba(251,113,133,0.65)",
    chipText:  "#ffe4e6",
  },
  COMPLETION: {
    color:     "rgb(74,222,128)",
    bg:        "rgba(74,222,128,0.10)",
    chipBg:    "rgba(74,222,128,0.13)",
    border:    "rgba(74,222,128,0.45)",
    weak:      "rgba(74,222,128,0.18)",
    softColor: "rgba(74,222,128,0.65)",
    chipText:  "#dcfce7",
  },
};

export const TYPE_ICON: Record<string, string> = {
  FREQUENCY: "↻",
  VOLUME: "∑",
  PERFORMANCE: "◆",
  COMPLETION: "✓",
};

export function getTypeAccent(type: string): GoalTypeAccent {
  return TYPE_ACCENT[type] ?? TYPE_ACCENT.FREQUENCY;
}
