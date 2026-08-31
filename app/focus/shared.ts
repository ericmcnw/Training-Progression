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
  availableWork: Array<{ id: string; label: string; routineId: string; targetPerWeek: number | null }>;
};
