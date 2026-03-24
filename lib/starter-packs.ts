import type { RoutineKind } from "@/generated/prisma";

export type StarterPackFocus = "STRENGTH" | "CARDIO" | "CLIMBING" | "MIXED" | "RECOVERY";
export type StarterPackStructure = "MINIMAL" | "BALANCED" | "DETAILED";

export type StarterRoutineBlueprint = {
  name: string;
  category: string;
  kind: RoutineKind;
  subtype: string;
  timesPerWeek: number | null;
  sessionTemplateKey?: string;
};

export type StarterPackDefinition = {
  key: StarterPackFocus;
  label: string;
  description: string;
  bestFor: string;
};

export const STARTER_PACKS: StarterPackDefinition[] = [
  {
    key: "STRENGTH",
    label: "Strength Base",
    description: "Start with lifting structure first, then customize the actual exercise templates later.",
    bestFor: "Gym-first training with low setup overhead.",
  },
  {
    key: "CARDIO",
    label: "Cardio Base",
    description: "Set up recurring endurance sessions and one easier recovery slot.",
    bestFor: "Running, walking, biking, and general conditioning.",
  },
  {
    key: "CLIMBING",
    label: "Climbing Hybrid",
    description: "Mix climbing sessions with support work so progression lives in one system.",
    bestFor: "Indoor or outdoor climbers who also track strength and mobility.",
  },
  {
    key: "MIXED",
    label: "Mixed Training",
    description: "Blend strength, cardio, and recovery in a balanced starter setup.",
    bestFor: "Users who do more than one style of training most weeks.",
  },
  {
    key: "RECOVERY",
    label: "Recovery Reset",
    description: "Build a light structure around mobility, walks, and simple check-ins.",
    bestFor: "Low-friction recovery, rehab, and readiness tracking.",
  },
];

export const STARTER_STRUCTURES: Array<{
  key: StarterPackStructure;
  label: string;
  description: string;
}> = [
  {
    key: "MINIMAL",
    label: "Minimal",
    description: "Smallest useful setup with only the core routines.",
  },
  {
    key: "BALANCED",
    label: "Balanced",
    description: "Recommended starting point with enough structure to feel complete.",
  },
  {
    key: "DETAILED",
    label: "Detailed",
    description: "Adds extra support routines for people who want more structure up front.",
  },
];

const STARTER_ROUTINES: Record<StarterPackFocus, Record<StarterPackStructure, StarterRoutineBlueprint[]>> = {
  STRENGTH: {
    MINIMAL: [
      { name: "Full Body A", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 2 },
      { name: "Full Body B", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 2 },
    ],
    BALANCED: [
      { name: "Upper A", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 2 },
      { name: "Lower A", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 2 },
      { name: "Upper B", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 1 },
      { name: "Mobility Reset", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 2 },
    ],
    DETAILED: [
      { name: "Push Day", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 1 },
      { name: "Pull Day", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 1 },
      { name: "Leg Day", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 1 },
      { name: "Conditioning Walk", category: "Running", kind: "CARDIO", subtype: "WALK", timesPerWeek: 2 },
      { name: "Mobility Reset", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 3 },
    ],
  },
  CARDIO: {
    MINIMAL: [
      { name: "Easy Cardio", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 2 },
      { name: "Long Cardio", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 1 },
    ],
    BALANCED: [
      { name: "Easy Run", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 2 },
      { name: "Long Run", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 1 },
      { name: "Tempo / Intervals", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 1 },
      { name: "Recovery Walk", category: "Running", kind: "CARDIO", subtype: "WALK", timesPerWeek: 2 },
    ],
    DETAILED: [
      { name: "Easy Run", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 2 },
      { name: "Long Run", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 1 },
      { name: "Tempo Run", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 1 },
      { name: "Intervals", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 1 },
      { name: "Mobility Reset", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 2 },
    ],
  },
  CLIMBING: {
    MINIMAL: [
      { name: "Indoor Bouldering", category: "Climbing", kind: "SESSION", subtype: "CLIMBING", timesPerWeek: 2, sessionTemplateKey: "indoor-bouldering" },
      { name: "Climbing Mobility", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 2 },
    ],
    BALANCED: [
      { name: "Indoor Bouldering", category: "Climbing", kind: "SESSION", subtype: "CLIMBING", timesPerWeek: 2, sessionTemplateKey: "indoor-bouldering" },
      { name: "Strength Support", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 2 },
      { name: "Hangboard / Finger Work", category: "Climbing", kind: "COMPLETION", subtype: "SKILL_PRACTICE", timesPerWeek: 2 },
      { name: "Climbing Mobility", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 2 },
    ],
    DETAILED: [
      { name: "Indoor Bouldering", category: "Climbing", kind: "SESSION", subtype: "CLIMBING", timesPerWeek: 2, sessionTemplateKey: "indoor-bouldering" },
      { name: "Rope Session", category: "Climbing", kind: "SESSION", subtype: "CLIMBING", timesPerWeek: 1, sessionTemplateKey: "indoor-rope-climbing" },
      { name: "Pull Strength", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 1 },
      { name: "Leg Strength", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 1 },
      { name: "Climbing Mobility", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 2 },
    ],
  },
  MIXED: {
    MINIMAL: [
      { name: "Strength Session", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 2 },
      { name: "Cardio Session", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 2 },
      { name: "Mobility Reset", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 2 },
    ],
    BALANCED: [
      { name: "Strength A", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 2 },
      { name: "Strength B", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 1 },
      { name: "Cardio Session", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 2 },
      { name: "Sports / Skill Session", category: "General", kind: "SESSION", subtype: "SKILL_PRACTICE", timesPerWeek: 1 },
      { name: "Mobility Reset", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 2 },
    ],
    DETAILED: [
      { name: "Upper Strength", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 1 },
      { name: "Lower Strength", category: "Strength", kind: "WORKOUT", subtype: "STRENGTH", timesPerWeek: 1 },
      { name: "Run / Cardio", category: "Running", kind: "CARDIO", subtype: "RUN", timesPerWeek: 2 },
      { name: "Climb / Skill Session", category: "Climbing", kind: "SESSION", subtype: "CLIMBING", timesPerWeek: 1, sessionTemplateKey: "indoor-bouldering" },
      { name: "Recovery Walk", category: "Running", kind: "CARDIO", subtype: "WALK", timesPerWeek: 1 },
      { name: "Mobility Reset", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 2 },
    ],
  },
  RECOVERY: {
    MINIMAL: [
      { name: "Daily Mobility", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 3 },
      { name: "Walk", category: "Daily", kind: "CARDIO", subtype: "WALK", timesPerWeek: 3 },
    ],
    BALANCED: [
      { name: "Daily Mobility", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 4 },
      { name: "Walk", category: "Daily", kind: "CARDIO", subtype: "WALK", timesPerWeek: 4 },
      { name: "Recovery Check-in", category: "Daily", kind: "COMPLETION", subtype: "RECOVERY", timesPerWeek: 5 },
    ],
    DETAILED: [
      { name: "Daily Mobility", category: "Mobility", kind: "GUIDED", subtype: "MOBILITY", timesPerWeek: 5 },
      { name: "Walk", category: "Daily", kind: "CARDIO", subtype: "WALK", timesPerWeek: 4 },
      { name: "Rehab Session", category: "Mobility", kind: "GUIDED", subtype: "REHAB", timesPerWeek: 2 },
      { name: "Recovery Check-in", category: "Daily", kind: "COMPLETION", subtype: "RECOVERY", timesPerWeek: 5 },
    ],
  },
};

export function getStarterPackDefinition(key: string | null | undefined) {
  return STARTER_PACKS.find((pack) => pack.key === key) ?? STARTER_PACKS[0];
}

export function getStarterStructureDefinition(key: string | null | undefined) {
  return STARTER_STRUCTURES.find((structure) => structure.key === key) ?? STARTER_STRUCTURES[1];
}

export function buildStarterPackPlan(focus: StarterPackFocus, structure: StarterPackStructure) {
  return STARTER_ROUTINES[focus][structure];
}
