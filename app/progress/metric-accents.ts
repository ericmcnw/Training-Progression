// Accent color palette for MetricLineChart instances. Picking the right color
// per metric makes a stack of charts navigable visually — the eye finds the
// right chart without reading every title.
//
// Conventions:
//   weight   amber   — "iron"
//   reps     blue    — work-volume signal
//   volume   green   — total work
//   distance cyan    — endurance
//   pace     orange  — effort
//   duration purple  — time
//   sessions teal    — frequency / completion
//   elevation yellow — climbing/hiking effort

const ACCENT_GREEN = "rgba(74,222,128,0.95)";
const ACCENT_AMBER = "rgba(251,191,36,0.95)";
const ACCENT_BLUE = "rgba(120,170,255,0.95)";
const ACCENT_CYAN = "rgba(94,234,212,0.95)";
const ACCENT_ORANGE = "rgba(251,146,60,0.95)";
const ACCENT_PURPLE = "rgba(192,132,252,0.95)";
const ACCENT_TEAL = "rgba(45,212,191,0.95)";
const ACCENT_YELLOW = "rgba(250,204,21,0.95)";

export type MetricAccentKey =
  | "weight"
  | "reps"
  | "sets"
  | "volume"
  | "distance"
  | "pace"
  | "duration"
  | "sessions"
  | "elevation"
  | "default";

export function metricAccent(key: MetricAccentKey): string {
  switch (key) {
    case "weight":    return ACCENT_AMBER;
    case "reps":      return ACCENT_BLUE;
    case "sets":      return ACCENT_GREEN;
    case "volume":    return ACCENT_GREEN;
    case "distance":  return ACCENT_CYAN;
    case "pace":      return ACCENT_ORANGE;
    case "duration":  return ACCENT_PURPLE;
    case "sessions":  return ACCENT_TEAL;
    case "elevation": return ACCENT_YELLOW;
    default:          return ACCENT_GREEN;
  }
}
