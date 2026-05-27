export type ClimbGradeSystem = "BOULDER_V" | "YOSEMITE";

export type ClimbOutcome = "FLASH" | "ONSIGHT" | "SEND" | "REDPOINT" | "FELL" | "PROJECT";

export type ClimbLocationType = "GYM" | "CRAG";

// Discipline drives terminology + outcome list. Two YDS-graded climbs can be
// either TOP_ROPE (uses Send) or SPORT_LEAD (uses Redpoint), so gradeSystem
// alone isn't enough — we derive discipline from the session template key.
export type ClimbingDiscipline = "BOULDER" | "TOP_ROPE" | "SPORT_LEAD";

export type ClimbLocationBasic = {
  id: string;
  name: string;
  type: ClimbLocationType;
  /** Optional broader region (city/state) — shown next to name in pickers
   *  so the user can disambiguate "Calico Tanks · Red Rock, NV" from a
   *  similarly-named local crag. */
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  /** OSM identity (osm_type + osm_id) — present when the location was
   *  picked from the OpenStreetMap autocomplete. Used by the picker to
   *  dedup OSM suggestions against already-saved spots. */
  osmType: string | null;
  osmId: string | null;
};

export type ClimbProblemBasic = {
  id: string;
  name: string;
  grade: string;
  gradeSystem: ClimbGradeSystem;
  notes: string | null;
};

export type ClimbAttemptInput = {
  grade: string;
  gradeSystem: ClimbGradeSystem;
  outcome: ClimbOutcome;
  area?: string | null;
  movesCompleted?: number;
  totalMoves?: number;
  /** Optional "how many tries" counter. Used for SEND/REDPOINT (how many it
   *  took to send) and PROJECT (how many tries so far). Null/undefined for
   *  FLASH/ONSIGHT (implicitly 1). */
  triesCount?: number | null;
  notes?: string;
  attemptOrder: number;
  problemId?: string | null;
  newProblemName?: string | null;
};

export type ClimbAttemptDraft = ClimbAttemptInput & {
  localId: string;
};

export function climbingDisciplineForTemplateKey(
  templateKey: string | null | undefined
): ClimbingDiscipline {
  if (templateKey === "indoor-bouldering" || templateKey === "outdoor-bouldering") {
    return "BOULDER";
  }
  if (
    templateKey === "indoor-rope-climbing" ||
    templateKey === "indoor-top-rope" ||
    templateKey === "outdoor-top-rope"
  ) {
    return "TOP_ROPE";
  }
  return "SPORT_LEAD";
}

export function climbingDisciplineLabel(discipline: ClimbingDiscipline): string {
  if (discipline === "BOULDER") return "Bouldering";
  if (discipline === "TOP_ROPE") return "Top Rope";
  return "Sport / Lead";
}

export function climbNounForDiscipline(discipline: ClimbingDiscipline): "Problem" | "Route" {
  return discipline === "BOULDER" ? "Problem" : "Route";
}

export function climbOutcomeLabel(
  outcome: ClimbOutcome,
  context?: ClimbingDiscipline | ClimbGradeSystem
): string {
  // Backward compat: callers may still pass a ClimbGradeSystem. Map it to a
  // sensible discipline default (V → BOULDER, YDS → SPORT_LEAD).
  const discipline: ClimbingDiscipline =
    context === "BOULDER_V"
      ? "BOULDER"
      : context === "YOSEMITE"
        ? "SPORT_LEAD"
        : (context ?? "BOULDER");

  if (outcome === "ONSIGHT") return "Onsight";
  if (outcome === "FLASH") return "Flash";
  if (outcome === "SEND") return "Send";
  if (outcome === "REDPOINT") return discipline === "SPORT_LEAD" ? "Redpoint" : "Send";
  if (outcome === "FELL") return discipline === "BOULDER" ? "Fell" : "Hang";
  if (outcome === "PROJECT") return "Project";
  return outcome;
}

export function climbOutcomesForDiscipline(discipline: ClimbingDiscipline): ClimbOutcome[] {
  // FELL is intentionally absent from the live logger — users log unsent
  // attempts as PROJECT instead, with an optional tries count. FELL stays
  // in the enum for back-compat with historical data only.
  if (discipline === "BOULDER") return ["FLASH", "SEND", "PROJECT"];
  if (discipline === "TOP_ROPE") return ["ONSIGHT", "FLASH", "SEND", "PROJECT"];
  return ["ONSIGHT", "FLASH", "REDPOINT", "PROJECT"];
}

// Outcomes that get an optional "tries" count next to them in the per-climb
// logger. Send/Redpoint count how many tries it took to clean it; Project
// counts how many tries you've put in so far on something you're still
// working. Flash/Onsight are implicitly 1, so no input shown.
export function outcomeUsesTriesCount(outcome: ClimbOutcome): boolean {
  return outcome === "SEND" || outcome === "REDPOINT" || outcome === "PROJECT";
}

// Compat shim — old callers used grade system to derive outcome list.
export function climbOutcomesForSystem(gradeSystem: ClimbGradeSystem): ClimbOutcome[] {
  return climbOutcomesForDiscipline(gradeSystem === "BOULDER_V" ? "BOULDER" : "SPORT_LEAD");
}

export function climbOutcomeColor(outcome: ClimbOutcome): string {
  if (outcome === "FLASH" || outcome === "ONSIGHT") return "rgba(251,191,36,0.9)";
  if (outcome === "SEND" || outcome === "REDPOINT") return "rgba(74,222,128,0.9)";
  if (outcome === "FELL") return "rgba(248,113,113,0.9)";
  if (outcome === "PROJECT") return "rgba(167,139,250,0.9)";
  return "rgba(255,255,255,0.6)";
}

export function climbOutcomeBg(outcome: ClimbOutcome): string {
  if (outcome === "FLASH" || outcome === "ONSIGHT") return "rgba(251,191,36,0.12)";
  if (outcome === "SEND" || outcome === "REDPOINT") return "rgba(74,222,128,0.12)";
  if (outcome === "FELL") return "rgba(248,113,113,0.1)";
  if (outcome === "PROJECT") return "rgba(167,139,250,0.12)";
  return "rgba(255,255,255,0.06)";
}

export function gradeSystemForTemplateKey(templateKey: string | null | undefined): ClimbGradeSystem {
  if (templateKey === "indoor-bouldering" || templateKey === "outdoor-bouldering") {
    return "BOULDER_V";
  }
  return "YOSEMITE";
}

// Outcomes that count as a successful "send" for pyramid display. Falls and
// projects are intentionally excluded — the pyramid shows what you climbed
// clean.
export function isSendOutcome(outcome: ClimbOutcome): boolean {
  return outcome === "FLASH" || outcome === "ONSIGHT" || outcome === "SEND" || outcome === "REDPOINT";
}

export const SENT_OUTCOMES: ReadonlySet<ClimbOutcome> = new Set<ClimbOutcome>([
  "FLASH",
  "ONSIGHT",
  "SEND",
  "REDPOINT",
]);

// Stacking order for pyramid bars. Falls are intentionally excluded — the
// pyramid celebrates clean climbs, not attempts. Projects stay so you can see
// what you're working on without it counting as a send.
export const PYRAMID_OUTCOMES: readonly ClimbOutcome[] = [
  "FLASH",
  "ONSIGHT",
  "SEND",
  "REDPOINT",
  "PROJECT",
];

// All outcomes in ascending "good to bad" order — used when searching for the
// hardest grade meeting some criteria.
export const ORDERED_OUTCOMES: readonly ClimbOutcome[] = [
  "FLASH",
  "ONSIGHT",
  "SEND",
  "REDPOINT",
  "FELL",
  "PROJECT",
];

// Numeric ranking so grades sort correctly regardless of system.
//   V2 < V2+ < V3
//   5.10a < 5.10a+ < 5.10b
//   5.10b < 5.10c < 5.11a
// Returns 0 for unrecognized inputs (shouldn't happen in practice —
// session templates constrain the grade list).
export function gradeSort(grade: string, system: ClimbGradeSystem): number {
  if (system === "BOULDER_V") {
    const m = grade.match(/^V(\d+)(\+?)$/i);
    if (!m) return 0;
    return parseInt(m[1], 10) + (m[2] === "+" ? 0.5 : 0);
  }
  const m = grade.match(/^5\.(\d+)([abcd]?)(\+?)$/i);
  if (!m) return 0;
  const sub = ({ "": 0, a: 0, b: 1, c: 2, d: 3 } as Record<string, number>)[m[2].toLowerCase()] ?? 0;
  // Four letter-slots per integer (a/b/c/d), then 0.5 extra for the +
  // suffix so 5.10a+ slots between 5.10a and 5.10b.
  return parseInt(m[1], 10) * 4 + sub + (m[3] === "+" ? 0.5 : 0);
}

// Derive indoor/outdoor from a session template key OR a location type.
// Template wins when both are present (we trust the user's labeled intent over
// inferred location category). Returns null when neither signal is available.
export function venueOf(
  templateKey: string | null | undefined,
  locationType: ClimbLocationType | null | undefined
): ClimbLocationType | null {
  if (templateKey?.startsWith("indoor-")) return "GYM";
  if (templateKey?.startsWith("outdoor-")) return "CRAG";
  if (locationType === "GYM") return "GYM";
  if (locationType === "CRAG") return "CRAG";
  return null;
}
