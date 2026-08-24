export type AssessmentDirection = "HIGHER" | "LOWER" | "TARGET" | "INFORMATIONAL";

export const ASSESSMENT_DIRECTIONS: Array<{ id: AssessmentDirection; label: string; hint: string }> = [
  { id: "HIGHER", label: "↑ Increase", hint: "Progress means a bigger number" },
  { id: "LOWER", label: "↓ Decrease", hint: "Progress means a smaller number" },
  { id: "TARGET", label: "→ Hold", hint: "Progress means staying at the target" },
  { id: "INFORMATIONAL", label: "Just tracking", hint: "No direction — you only want the history" },
];
