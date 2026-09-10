// Starter ladders. A preset is just an ordered list of rungs — applying one
// writes Progression + ProgressionMilestone rows and is then fully editable,
// so nothing here is a template the user stays tied to.
//
// modifier is how a rung is made easier or harder WITHOUT changing the
// movement ("green band", "+25 lb"). That slot is what lets one flat list hold
// a mixed ladder: pull-up-from-zero goes variation -> assist -> load in order.

export type PresetGroup = "SKILL" | "STRENGTH" | "RETURN" | "ENDURANCE";

export type PresetRung = {
  label: string;
  modifier?: string;
  targetText?: string;
};

export type ProgressionPreset = {
  key: string;
  name: string;
  blurb: string;
  group: PresetGroup;
  rungs: PresetRung[];
};

export const PRESET_GROUPS: { key: PresetGroup; label: string }[] = [
  { key: "SKILL", label: "Skills" },
  { key: "STRENGTH", label: "Strength" },
  { key: "RETURN", label: "Return to load" },
  { key: "ENDURANCE", label: "Endurance" },
];

export const PROGRESSION_PRESETS: ProgressionPreset[] = [
  {
    key: "front-lever",
    name: "Front lever",
    blurb: "Hollow hold to full lever, with banded reps bridging the hardest shapes.",
    group: "SKILL",
    rungs: [
      { label: "Hollow hold", targetText: "30s" },
      { label: "Tuck front lever", targetText: "10s" },
      { label: "Advanced tuck", targetText: "10s" },
      { label: "Straddle", modifier: "with band" },
      { label: "Full front lever", modifier: "with band" },
      { label: "Full front lever", targetText: "5s" },
    ],
  },
  {
    key: "pistol-squat",
    name: "Pistol squat",
    blurb: "Build the single-leg squat from a box down to full depth.",
    group: "SKILL",
    rungs: [
      { label: "Box squat", targetText: "3x8" },
      { label: "Pistol squat", modifier: "holding rail" },
      { label: "Pistol squat", modifier: "to bench" },
      { label: "Pistol squat", targetText: "3x5 / side" },
    ],
  },
  {
    key: "handstand",
    name: "Handstand",
    blurb: "Wall work to a freestanding hold.",
    group: "SKILL",
    rungs: [
      { label: "Wall plank", targetText: "45s" },
      { label: "Chest-to-wall hold", targetText: "60s" },
      { label: "Freestanding kick-up" },
      { label: "Freestanding hold", targetText: "10s" },
    ],
  },
  {
    key: "pull-up-from-zero",
    name: "Pull-up from zero",
    blurb: "Scap work to a weighted pull-up — shape first, then assistance, then load.",
    group: "STRENGTH",
    rungs: [
      { label: "Scap pull-ups", targetText: "3x8" },
      { label: "Eccentric lowers", targetText: "5s down" },
      { label: "Pull-up", modifier: "with heavy band" },
      { label: "Pull-up", modifier: "with light band" },
      { label: "Pull-up", targetText: "3x5" },
      { label: "Pull-up", modifier: "plus +25 lb" },
    ],
  },
  {
    key: "weighted-pull-up",
    name: "Weighted pull-up",
    blurb: "Add load to a pull-up you already own.",
    group: "STRENGTH",
    rungs: [
      { label: "Pull-up", targetText: "3x5" },
      { label: "Pull-up", modifier: "plus +10 lb" },
      { label: "Pull-up", modifier: "plus +25 lb" },
      { label: "Pull-up", modifier: "plus +45 lb" },
    ],
  },
  {
    key: "fingers-return",
    name: "Fingers — return to loading",
    blurb: "Restart hangs after time off, then build to max hangs.",
    group: "RETURN",
    rungs: [
      { label: "Restart hangs", targetText: "easy edges, short holds" },
      { label: "Progress load" },
      { label: "Max hangs" },
    ],
  },
  {
    key: "hamstring-return",
    name: "Hamstring — return from strain",
    blurb: "Reload, then curls, then hinge, then Nordics.",
    group: "RETURN",
    rungs: [
      { label: "Restart loading", targetText: "isometrics, pain-free" },
      { label: "Single-leg curls" },
      { label: "Hinge / RDL" },
      { label: "Nordics", modifier: "with band" },
      { label: "Nordics" },
    ],
  },
  {
    key: "return-to-jumping",
    name: "Return to jumping",
    blurb: "Absorb before you produce, both legs before one, reactive work last.",
    group: "RETURN",
    rungs: [
      { label: "Pogos", targetText: "3x20" },
      { label: "A-skips", targetText: "2x20 m" },
      { label: "Countermovement jump", modifier: "submax", targetText: "3x5" },
      { label: "Drop landing", modifier: "from 12 in box", targetText: "3x5 absorb only" },
      { label: "Broad jump", modifier: "max", targetText: "4x3" },
      { label: "Single-leg pogos", targetText: "3x15 / side" },
      { label: "Linear bounds", targetText: "4x20 m" },
      { label: "Depth jump", modifier: "from 18 in box", targetText: "3x5" },
    ],
  },
  {
    key: "running-base",
    name: "Running base",
    blurb: "Rebuild continuous mileage one long run at a time.",
    group: "ENDURANCE",
    rungs: [
      { label: "Base — run/walk" },
      { label: "Long session to 3 mi" },
      { label: "Long session to 4-5 mi" },
      { label: "Long session to 6 mi+" },
    ],
  },
];

export function findPreset(key: string): ProgressionPreset | undefined {
  return PROGRESSION_PRESETS.find((p) => p.key === key);
}
