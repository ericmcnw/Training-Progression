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
  if (discipline === "BOULDER") return ["FLASH", "SEND", "FELL", "PROJECT"];
  if (discipline === "TOP_ROPE") return ["ONSIGHT", "FLASH", "SEND", "FELL", "PROJECT"];
  return ["ONSIGHT", "FLASH", "REDPOINT", "FELL", "PROJECT"];
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
