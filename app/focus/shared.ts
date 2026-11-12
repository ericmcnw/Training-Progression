// Display-only Focus helpers shared by server and client components.
// Keep this module free of database, auth, and Next.js server imports.

export function phaseLabel(phase: string | null): string | null {
  switch (phase) {
    case "BUILD": return "Build";
    case "PEAK": return "In season";
    case "OFFSEASON": return "Offseason";
    case "MAINTAIN": return "Maintain";
    default: return null;
  }
}

export function seasonPhaseLabel(season: string | null, phase: string | null): string | null {
  const label = phaseLabel(phase);
  if (season && label) return `${season} \u00b7 ${label}`;
  return season || label || null;
}

export type ProgramPhaseStep = {
  id: string;
  label: string;
  targetText: string | null;
  done: boolean;
};

export type ProgramPhaseView = {
  id: string;
  name: string;
  /** 1-based position among the program's phases. */
  index: number;
  total: number;
  targetEndYmd: string | null;
  steps: ProgramPhaseStep[];
  doneCount: number;
};

/** The phase after the current one, and the condition that unlocks it. */
export type ProgramNextPhaseView = {
  name: string;
  gateLabel: string | null;
  gateSummary: string | null;
  /** null when the gate is self-assessed or absent. */
  gateMet: boolean | null;
};

export type FocusBandItem = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  status: string;
  season: string | null;
  phase: string | null;
  milestonesDone: number;
  milestonesTotal: number;
  currentAims: string[];
  /** null when the program has no phases — it then reads as one open stretch. */
  currentPhase: ProgramPhaseView | null;
  nextPhase: ProgramNextPhaseView | null;
  availableWork: Array<{ id: string; label: string; routineId: string; targetPerWeek: number | null }>;
};
