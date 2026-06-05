// Per-sport rich-form configuration consumed by the generic sport
// LogSheet (everything except climbing and golf, which have their
// own dedicated sheets).
//
// Each sport can declare:
//   • sessionType options — dropdown surfaced at the top of the form
//     (e.g. Basketball: Game / Pickup / Shoot around / Drills).
//     Null/missing → no dropdown rendered.
//   • extras — additional fields beyond date/duration/notes/location.
//     Persisted into RoutineLog.sportData.extras as a JSON blob.
//
// To add a new sport's rich form, edit this file. The LogSheet UI
// reads the config and renders accordingly — no JSX changes needed.

export type ExtraFieldType = "text" | "number" | "textarea";

export type ExtraFieldConfig = {
  key: string;
  label: string;
  type: ExtraFieldType;
  placeholder?: string;
  /** For number fields — passed through to inputMode/min/etc. */
  numericHint?: "integer" | "decimal";
};

export type SportLogConfig = {
  /** Optional placeholder for the universal "Where" field. */
  locationPlaceholder?: string;
  /** Dropdown shown at the top of the form. Empty array / undefined →
   *  no dropdown rendered for this sport. */
  sessionTypeOptions?: Array<{ value: string; label: string }>;
  sessionTypeLabel?: string; // e.g. "Mode" / "Type"
  extras?: ExtraFieldConfig[];
};

export const SPORT_LOG_CONFIG: Record<string, SportLogConfig> = {
  basketball: {
    locationPlaceholder: "Court / gym",
    sessionTypeLabel: "Mode",
    sessionTypeOptions: [
      { value: "pickup", label: "Pickup" },
      { value: "shoot-around", label: "Shoot around" },
      { value: "game", label: "Game" },
      { value: "drills", label: "Drills" },
    ],
    extras: [
      { key: "pointsFor", label: "Points (you)", type: "number", numericHint: "integer" },
      { key: "pointsAgainst", label: "Points (them)", type: "number", numericHint: "integer" },
      { key: "opponent", label: "Opponent / team", type: "text" },
    ],
  },
  surfing: {
    locationPlaceholder: "Spot",
    extras: [
      { key: "waveCount", label: "Wave count", type: "number", numericHint: "integer" },
      { key: "swellHeight", label: "Swell (ft)", type: "number", numericHint: "decimal" },
      { key: "conditions", label: "Conditions", type: "text", placeholder: "e.g. clean head-high, glassy" },
      { key: "board", label: "Board", type: "text", placeholder: "e.g. 5'10 shortboard" },
    ],
  },
  snowboarding: {
    locationPlaceholder: "Mountain / resort",
    sessionTypeLabel: "Terrain",
    sessionTypeOptions: [
      { value: "resort", label: "Resort" },
      { value: "park", label: "Park" },
      { value: "backcountry", label: "Backcountry" },
    ],
    extras: [
      { key: "runs", label: "Runs", type: "number", numericHint: "integer" },
      { key: "conditions", label: "Conditions", type: "text", placeholder: "e.g. groomers, fresh pow, icy" },
    ],
  },
  skiing: {
    locationPlaceholder: "Mountain / resort",
    sessionTypeLabel: "Terrain",
    sessionTypeOptions: [
      { value: "resort", label: "Resort" },
      { value: "park", label: "Park" },
      { value: "backcountry", label: "Backcountry" },
    ],
    extras: [
      { key: "runs", label: "Runs", type: "number", numericHint: "integer" },
      { key: "conditions", label: "Conditions", type: "text", placeholder: "e.g. groomers, fresh pow, icy" },
    ],
  },
  skateboarding: {
    locationPlaceholder: "Park / spot",
    sessionTypeLabel: "Style",
    sessionTypeOptions: [
      { value: "park", label: "Park" },
      { value: "street", label: "Street" },
      { value: "bowl", label: "Bowl" },
      { value: "vert", label: "Vert" },
    ],
    extras: [
      { key: "tricksLanded", label: "Tricks landed", type: "text", placeholder: "kickflip, 50-50, …" },
    ],
  },
  tennis: {
    locationPlaceholder: "Court",
    sessionTypeLabel: "Mode",
    sessionTypeOptions: [
      { value: "match", label: "Match" },
      { value: "practice", label: "Practice" },
      { value: "drills", label: "Drills" },
      { value: "rally", label: "Rally" },
    ],
    extras: [
      { key: "opponent", label: "Opponent", type: "text" },
      { key: "score", label: "Score", type: "text", placeholder: "e.g. 6-4, 6-3" },
    ],
  },
};

export function getSportLogConfig(slug: string): SportLogConfig {
  return SPORT_LOG_CONFIG[slug] ?? {};
}
