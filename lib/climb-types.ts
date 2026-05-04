export type ClimbGradeSystem = "BOULDER_V" | "YOSEMITE";

export type ClimbOutcome = "FLASH" | "ONSIGHT" | "SEND" | "REDPOINT" | "FELL" | "PROJECT";

export type ClimbLocationType = "GYM" | "CRAG";

export type ClimbLocationBasic = {
  id: string;
  name: string;
  type: ClimbLocationType;
};

export type ClimbAttemptInput = {
  grade: string;
  gradeSystem: ClimbGradeSystem;
  outcome: ClimbOutcome;
  movesCompleted?: number;
  totalMoves?: number;
  notes?: string;
  attemptOrder: number;
};

export type ClimbAttemptDraft = ClimbAttemptInput & {
  localId: string;
};

export function climbOutcomeLabel(
  outcome: ClimbOutcome,
  gradeSystem: ClimbGradeSystem
): string {
  if (gradeSystem === "BOULDER_V") {
    if (outcome === "FLASH") return "Flash";
    if (outcome === "SEND") return "Send";
    if (outcome === "FELL") return "Fell";
    if (outcome === "PROJECT") return "Project";
  }
  if (outcome === "FLASH" || outcome === "ONSIGHT") return "Onsight";
  if (outcome === "SEND" || outcome === "REDPOINT") return "Send";
  if (outcome === "FELL") return "Fell";
  if (outcome === "PROJECT") return "Project";
  return outcome;
}

export function climbOutcomesForSystem(gradeSystem: ClimbGradeSystem): ClimbOutcome[] {
  if (gradeSystem === "BOULDER_V") return ["FLASH", "SEND", "FELL", "PROJECT"];
  return ["ONSIGHT", "SEND", "FELL", "PROJECT"];
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
