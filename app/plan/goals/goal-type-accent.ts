// Type-accent palette shared by GoalRow (plan list) and GoalDetailPage so
// the same goal renders the same color across surfaces. Gentle-lens colors —
// no red anywhere; behind/at_risk states use amber, not alarm tones.

export type GoalTypeAccent = {
  color: string;
  bg: string;
  border: string;
  weak: string;
};

export const TYPE_ACCENT: Record<string, GoalTypeAccent> = {
  FREQUENCY:   { color: "rgb(129,140,248)", bg: "rgba(129,140,248,0.10)", border: "rgba(129,140,248,0.45)", weak: "rgba(129,140,248,0.18)" },
  VOLUME:      { color: "rgb(34,211,238)",  bg: "rgba(34,211,238,0.10)",  border: "rgba(34,211,238,0.45)",  weak: "rgba(34,211,238,0.18)"  },
  PERFORMANCE: { color: "rgb(251,191,36)",  bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.45)",  weak: "rgba(251,191,36,0.18)"  },
  COMPLETION:  { color: "rgb(74,222,128)",  bg: "rgba(74,222,128,0.10)",  border: "rgba(74,222,128,0.45)",  weak: "rgba(74,222,128,0.18)"  },
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
