// One vocabulary for the program builder, shared by creation and by re-entry
// so the rail reads the same on both. Creation can only complete the setup
// substeps; everything after needs a saved Program, but it stays visible so
// the builder never looks like it ends at save.

export type BuilderStageId = "setup" | "phases" | "work" | "schedule" | "targets";

export type BuilderStage = {
  id: BuilderStageId;
  number: string;
  label: string;
  meta: string;
  /** Skipping this costs nothing structural — never shown as outstanding debt. */
  optional: boolean;
};

export const BUILDER_STAGES: BuilderStage[] = [
  { id: "setup", number: "1", label: "Program setup", meta: "Purpose, details, goal, starting routines", optional: false },
  { id: "phases", number: "2", label: "Phases", meta: "When the work changes", optional: true },
  { id: "work", number: "3", label: "Work and prescriptions", meta: "What you do, and how it is set up", optional: true },
  { id: "schedule", number: "4", label: "Schedule", meta: "Dates for work you already chose", optional: true },
  { id: "targets", number: "5", label: "Named targets", meta: "Tick lists and named goals", optional: true },
];

export type BuilderSubstepId = "purpose" | "details" | "goal" | "routines";

export const SETUP_SUBSTEPS: Array<{ id: BuilderSubstepId; number: string; label: string }> = [
  { id: "purpose", number: "1", label: "Purpose" },
  { id: "details", number: "2", label: "Details and timeline" },
  { id: "goal", number: "3", label: "Goal or target" },
  { id: "routines", number: "4", label: "Starting routines" },
];

export function setupSubstepDomId(id: BuilderSubstepId) {
  return `setup-${id}`;
}

export function builderStageDomId(id: BuilderStageId) {
  return `program-builder-${id}`;
}
