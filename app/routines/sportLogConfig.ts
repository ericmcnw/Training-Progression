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

export type ExtraFieldType = "text" | "number" | "textarea" | "select" | "person";

export type ExtraFieldConfig = {
  key: string;
  label: string;
  type: ExtraFieldType;
  placeholder?: string;
  /** For number fields — passed through to inputMode/min/etc. */
  numericHint?: "integer" | "decimal";
  /** For `select` fields — dropdown choices. */
  options?: Array<{ value: string; label: string }>;
  /** Conditional visibility: only render when another extra's current
   *  value is one of `in`. Used by Spikeball to show teammate + 2nd
   *  opponent only when Format is 2v2. */
  showIf?: { key: string; in: string[] };
};

// How a log's win/loss is derived for the People & Records block:
//   • gamesWonOfPlayed — a session aggregates N games, M won (Spikeball).
//   • resultField — one match with a Win/Loss select (Tennis).
export type PeopleStatsRecord =
  | { kind: "gamesWonOfPlayed"; playedKey: string; wonKey: string }
  | { kind: "resultField"; key: string; winValue: string };

// Declares that a sport tracks people (teammates / opponents) so the world
// page can render a win-rate ring + with/against leaderboards from sportData.
export type PeopleStatsSpec = {
  /** Person extra keys whose value is a teammate (your side). */
  teammateKeys?: string[];
  /** Person extra keys whose value is an opponent. */
  opponentKeys?: string[];
  /** How to read win/loss from a log. Omit → only counts appearances. */
  record?: PeopleStatsRecord;
  /** Singular noun for the ring context, e.g. "game" / "match". */
  unit?: string;
};

export type SportLogConfig = {
  /** Optional placeholder for the universal "Where" field. */
  locationPlaceholder?: string;
  /** Dropdown shown at the top of the form. Empty array / undefined →
   *  no dropdown rendered for this sport. */
  sessionTypeOptions?: Array<{ value: string; label: string }>;
  sessionTypeLabel?: string; // e.g. "Mode" / "Type"
  extras?: ExtraFieldConfig[];
  /** When set, the world page renders a People & Records block. */
  peopleStats?: PeopleStatsSpec;
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
  bodysurfing: {
    locationPlaceholder: "Spot",
    extras: [
      { key: "waveCount", label: "Wave count", type: "number", numericHint: "integer" },
      { key: "swellHeight", label: "Swell (ft)", type: "number", numericHint: "decimal" },
      { key: "conditions", label: "Conditions", type: "text", placeholder: "e.g. clean head-high, glassy" },
      { key: "gear", label: "Fins / handplane", type: "text", placeholder: "e.g. DaFin swim fins, handplane" },
    ],
  },
  wakesurfing: {
    locationPlaceholder: "Lake / river",
    extras: [
      { key: "rides", label: "Rides / sets", type: "number", numericHint: "integer" },
      { key: "board", label: "Board", type: "text", placeholder: "e.g. 4'6 surf-style" },
      { key: "boat", label: "Boat", type: "text", placeholder: "e.g. Malibu, Axis" },
      { key: "conditions", label: "Conditions", type: "text", placeholder: "e.g. clean wake, glassy" },
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
      {
        key: "result",
        label: "Result",
        type: "select",
        options: [
          { value: "win", label: "Win" },
          { value: "loss", label: "Loss" },
        ],
      },
      { key: "opponent", label: "Opponent", type: "person" },
      { key: "score", label: "Score", type: "text", placeholder: "e.g. 6-4, 6-3" },
    ],
    peopleStats: {
      opponentKeys: ["opponent"],
      record: { kind: "resultField", key: "result", winValue: "win" },
      unit: "match",
    },
  },
  spikeball: {
    locationPlaceholder: "Park / yard / court",
    sessionTypeLabel: "Mode",
    sessionTypeOptions: [
      { value: "casual", label: "Casual" },
      { value: "competitive", label: "Competitive" },
      { value: "tournament", label: "Tournament" },
    ],
    extras: [
      {
        key: "format",
        label: "Format",
        type: "select",
        options: [
          { value: "1v1", label: "1v1" },
          { value: "2v2", label: "2v2" },
        ],
      },
      // Teammate + 2nd opponent only apply to 2v2. All three pull from the
      // same shared people pool so you can track who you play with/against.
      { key: "teammate", label: "Teammate", type: "person", showIf: { key: "format", in: ["2v2"] } },
      { key: "opponent1", label: "Opponent", type: "person" },
      { key: "opponent2", label: "Opponent 2", type: "person", showIf: { key: "format", in: ["2v2"] } },
      { key: "gamesPlayed", label: "Games played", type: "number", numericHint: "integer" },
      { key: "gamesWon", label: "Games won", type: "number", numericHint: "integer" },
    ],
    peopleStats: {
      teammateKeys: ["teammate"],
      opponentKeys: ["opponent1", "opponent2"],
      record: { kind: "gamesWonOfPlayed", playedKey: "gamesPlayed", wonKey: "gamesWon" },
      unit: "game",
    },
  },
};

export function getSportLogConfig(slug: string): SportLogConfig {
  return SPORT_LOG_CONFIG[slug] ?? {};
}

/** Whether an extra field should render given the current extra values
 *  (evaluates its optional `showIf` condition). Fields with no condition
 *  always show. */
export function isExtraVisible(field: ExtraFieldConfig, extras: Record<string, string>): boolean {
  if (!field.showIf) return true;
  return field.showIf.in.includes((extras[field.showIf.key] ?? "").trim());
}

/** Extra keys that hold a person's name, across every sport (plus legacy
 *  free-text keys). Used to build the shared people pool. */
export function personExtraKeys(): Set<string> {
  const keys = new Set<string>(["opponent", "opponents"]); // legacy free-text
  for (const cfg of Object.values(SPORT_LOG_CONFIG)) {
    for (const f of cfg.extras ?? []) {
      if (f.type === "person") keys.add(f.key);
    }
  }
  return keys;
}
