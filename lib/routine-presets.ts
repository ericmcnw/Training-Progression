import type { RoutineKind } from "@/generated/prisma";
import type { RoutineDomain } from "./routines";

// An activity preset maps directly to a kind+subtype combo, organized under a training domain.
// Used to power the activity picker in the new routine creation flow.
export type ActivityPreset = {
  key: string;
  label: string;
  description: string;
  domain: Exclude<RoutineDomain, "skill" | "general" | "habit">;
  kind: RoutineKind;
  subtype: string;
  icon: string;
  /** When set, the new-routine form auto-selects this session template. */
  sessionTemplateKey?: string;
  /** Optional default name shown in the name input on the form. */
  defaultName?: string;
};

// Domain display metadata for the picker grid
export type DomainMeta = {
  domain: Exclude<RoutineDomain, "skill" | "general" | "habit">;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
};

export const DOMAIN_META: DomainMeta[] = [
  {
    domain: "strength",
    label: "Strength",
    description: "Lifting, gym, bodyweight, and resistance training",
    icon: "🏋️",
    color: "rgba(84,203,130,1)",
    bgColor: "rgba(84,203,130,0.08)",
    borderColor: "rgba(84,203,130,0.28)",
  },
  {
    domain: "cardio",
    label: "Cardio",
    description: "Running, walking, cycling, swimming, and endurance",
    icon: "🏃",
    color: "rgba(78,148,255,1)",
    bgColor: "rgba(78,148,255,0.08)",
    borderColor: "rgba(78,148,255,0.28)",
  },
  {
    domain: "mobility",
    label: "Mobility / Rehab",
    description: "Stretching, yoga flows, warmups, rehab, and breathwork",
    icon: "🧘",
    color: "rgba(192,132,252,1)",
    bgColor: "rgba(192,132,252,0.08)",
    borderColor: "rgba(192,132,252,0.28)",
  },
  {
    domain: "sport",
    label: "Sport",
    description: "Tennis, climbing, basketball, skiing, and other sports",
    icon: "⚡",
    color: "rgba(251,146,60,1)",
    bgColor: "rgba(251,146,60,0.08)",
    borderColor: "rgba(251,146,60,0.28)",
  },
  {
    domain: "lifestyle",
    label: "Lifestyle",
    description: "Daily habits, recovery (cold plunge, sauna, massage), supplements, journaling — anything not directly a training stimulus",
    icon: "✓",
    color: "rgba(251,191,36,1)",
    bgColor: "rgba(251,191,36,0.08)",
    borderColor: "rgba(251,191,36,0.28)",
  },
];

export const ACTIVITY_PRESETS: ActivityPreset[] = [
  // ─── STRENGTH ────────────────────────────────────────────────────────────────
  {
    key: "STRENGTH_WORKOUT",
    label: "Strength Workout",
    description: "Sets, reps, and weight — barbell, dumbbell, or machine lifting",
    domain: "strength",
    kind: "WORKOUT",
    subtype: "STRENGTH",
    icon: "🏋️",
  },
  {
    key: "HYPERTROPHY_WORKOUT",
    label: "Hypertrophy Workout",
    description: "Higher-volume work focused on muscle growth",
    domain: "strength",
    kind: "WORKOUT",
    subtype: "HYPERTROPHY",
    icon: "💪",
  },
  {
    key: "REHAB_WORKOUT",
    label: "Rehab / Prehab",
    description: "Injury rehab, prehab, or therapeutic exercise",
    domain: "strength",
    kind: "WORKOUT",
    subtype: "REHAB",
    icon: "🩹",
  },

  // ─── CARDIO ──────────────────────────────────────────────────────────────────
  {
    key: "EASY_RUN",
    label: "Easy Run",
    description: "Comfortable conversational-pace run for base building",
    domain: "cardio",
    kind: "CARDIO",
    subtype: "EASY_RUN",
    icon: "🏃",
  },
  {
    key: "TEMPO_RUN",
    label: "Tempo Run",
    description: "Comfortably hard sustained effort to build lactate threshold",
    domain: "cardio",
    kind: "CARDIO",
    subtype: "TEMPO_RUN",
    icon: "⏱️",
  },
  {
    key: "LONG_RUN",
    label: "Long Run",
    description: "Weekly long run for endurance and aerobic development",
    domain: "cardio",
    kind: "CARDIO",
    subtype: "LONG_RUN",
    icon: "🗺️",
  },
  {
    key: "EASY_WALK",
    label: "Easy Walk",
    description: "Recovery walk or daily step goal",
    domain: "cardio",
    kind: "CARDIO",
    subtype: "EASY_WALK",
    icon: "🚶",
  },
  {
    key: "HIKE",
    label: "Hike",
    description: "Trail or outdoor hiking session",
    domain: "cardio",
    kind: "CARDIO",
    subtype: "HIKE",
    icon: "🥾",
  },
  {
    key: "BIKE",
    label: "Cycling",
    description: "Road, trail, or stationary biking",
    domain: "cardio",
    kind: "CARDIO",
    subtype: "BIKE",
    icon: "🚴",
  },
  {
    key: "SWIM",
    label: "Swimming",
    description: "Pool or open water swimming",
    domain: "cardio",
    kind: "CARDIO",
    subtype: "SWIM",
    icon: "🏊",
  },
  {
    key: "ROW",
    label: "Rowing",
    description: "Ergometer, on-water, or machine rowing",
    domain: "cardio",
    kind: "CARDIO",
    subtype: "ROW",
    icon: "🚣",
  },

  // ─── MOBILITY ────────────────────────────────────────────────────────────────
  {
    key: "MOBILITY_FLOW",
    label: "Mobility Flow",
    description: "Guided mobility or stretching routine with timed steps",
    domain: "mobility",
    kind: "GUIDED",
    subtype: "MOBILITY",
    icon: "🧘",
  },
  {
    key: "STRETCH_ROUTINE",
    label: "Stretch Routine",
    description: "Static or dynamic stretching session",
    domain: "mobility",
    kind: "GUIDED",
    subtype: "STRETCHING",
    icon: "🤸",
  },
  {
    key: "WARMUP_COOLDOWN",
    label: "Warmup / Cooldown",
    description: "Pre- or post-workout movement prep and wind-down",
    domain: "mobility",
    kind: "GUIDED",
    subtype: "WARMUP",
    icon: "🔥",
  },
  {
    key: "REHAB_FLOW",
    label: "Rehab Flow",
    description: "Guided rehab protocol with timed exercises and rest",
    domain: "mobility",
    kind: "GUIDED",
    subtype: "REHAB",
    icon: "🩹",
  },
  {
    key: "BREATHWORK",
    label: "Breathwork",
    description: "Breathing protocol, box breathing, or meditation",
    domain: "mobility",
    kind: "GUIDED",
    subtype: "BREATHWORK",
    icon: "🌬️",
  },
  {
    key: "YOGA_SESSION",
    label: "Yoga Session",
    description: "Yoga class or open yoga practice",
    domain: "mobility",
    kind: "SESSION",
    subtype: "YOGA_SESSION",
    icon: "☮️",
  },

  // ─── SPORT ───────────────────────────────────────────────────────────────────
  {
    key: "TENNIS",
    label: "Tennis",
    description: "Match, hitting session, or court training",
    domain: "sport",
    kind: "SESSION",
    subtype: "TENNIS",
    icon: "🎾",
  },
  {
    key: "INDOOR_BOULDERING",
    label: "Indoor Bouldering",
    description: "Gym bouldering — V-grades, problems, walls and zones",
    domain: "sport",
    kind: "SESSION",
    subtype: "CLIMBING",
    icon: "🧗",
    sessionTemplateKey: "indoor-bouldering",
    defaultName: "Indoor Bouldering",
  },
  {
    key: "OUTDOOR_BOULDERING",
    label: "Outdoor Bouldering",
    description: "Outdoor bouldering — V-grades, problems, crags and spots",
    domain: "sport",
    kind: "SESSION",
    subtype: "CLIMBING",
    icon: "🪨",
    sessionTemplateKey: "outdoor-bouldering",
    defaultName: "Outdoor Bouldering",
  },
  {
    key: "INDOOR_TOP_ROPE",
    label: "Indoor Top Rope",
    description: "Gym top rope — YDS routes, onsights, flashes, clean sends",
    domain: "sport",
    kind: "SESSION",
    subtype: "CLIMBING",
    icon: "🧗‍♀️",
    sessionTemplateKey: "indoor-rope-climbing",
    defaultName: "Indoor Top Rope",
  },
  {
    key: "INDOOR_SPORT_LEAD",
    label: "Indoor Sport / Lead",
    description: "Gym lead — YDS routes, onsights, flashes, redpoints",
    domain: "sport",
    kind: "SESSION",
    subtype: "CLIMBING",
    icon: "🧗‍♂️",
    sessionTemplateKey: "indoor-sport-climbing",
    defaultName: "Indoor Sport / Lead",
  },
  {
    key: "OUTDOOR_TOP_ROPE",
    label: "Outdoor Top Rope",
    description: "Outdoor top rope — YDS routes, onsights, flashes, clean sends",
    domain: "sport",
    kind: "SESSION",
    subtype: "CLIMBING",
    icon: "⛰️",
    sessionTemplateKey: "outdoor-top-rope",
    defaultName: "Outdoor Top Rope",
  },
  {
    key: "OUTDOOR_SPORT_LEAD",
    label: "Outdoor Sport / Lead",
    description: "Outdoor lead — YDS routes, onsights, flashes, redpoints",
    domain: "sport",
    kind: "SESSION",
    subtype: "CLIMBING",
    icon: "🪢",
    sessionTemplateKey: "outdoor-sport-climbing",
    defaultName: "Outdoor Sport / Lead",
  },
  {
    key: "SURFING",
    label: "Surfing",
    description: "Surf session in the ocean or surf park",
    domain: "sport",
    kind: "SESSION",
    subtype: "SURFING",
    icon: "🏄",
  },
  {
    key: "SNOWBOARDING",
    label: "Snowboarding / Skiing",
    description: "On-mountain skiing or snowboarding day",
    domain: "sport",
    kind: "SESSION",
    subtype: "SNOWBOARDING",
    icon: "🏔️",
  },
  {
    key: "BASKETBALL",
    label: "Basketball",
    description: "Pickup game, team practice, or drill work",
    domain: "sport",
    kind: "SESSION",
    subtype: "BASKETBALL",
    icon: "🏀",
  },
  {
    key: "GOLF",
    label: "Golf",
    description: "Round, range session, or short game practice",
    domain: "sport",
    kind: "SESSION",
    subtype: "GOLF",
    icon: "⛳",
  },
  {
    key: "HIKE_DAY",
    label: "Hike Day",
    description: "Full or half-day hiking trip",
    domain: "sport",
    kind: "SESSION",
    subtype: "HIKE_DAY",
    icon: "🥾",
  },
  {
    key: "TEAM_SPORT",
    label: "Team Sport",
    description: "Soccer, volleyball, flag football, and other team sports",
    domain: "sport",
    kind: "SESSION",
    subtype: "TEAM_SPORT",
    icon: "⚽",
  },
  {
    key: "SKILL_PRACTICE",
    label: "Skill Practice",
    description: "Open skill training session or drills",
    domain: "sport",
    kind: "SESSION",
    subtype: "SKILL_PRACTICE",
    icon: "🎯",
  },

  // ─── RECOVERY ────────────────────────────────────────────────────────────────
  {
    key: "COLD_PLUNGE",
    label: "Cold Plunge",
    description: "Ice bath or cold water immersion",
    domain: "lifestyle",
    kind: "COMPLETION",
    subtype: "COLD_PLUNGE",
    icon: "🧊",
  },
  {
    key: "SAUNA",
    label: "Sauna",
    description: "Dry sauna, steam room, or infrared session",
    domain: "lifestyle",
    kind: "COMPLETION",
    subtype: "SAUNA",
    icon: "🌡️",
  },
  {
    key: "FOAM_ROLLING",
    label: "Foam Rolling",
    description: "Self-myofascial release and soft tissue work",
    domain: "lifestyle",
    kind: "COMPLETION",
    subtype: "FOAM_ROLLING",
    icon: "🔵",
  },
  {
    key: "MASSAGE",
    label: "Massage",
    description: "Sports massage, deep tissue, or body work",
    domain: "lifestyle",
    kind: "COMPLETION",
    subtype: "MASSAGE",
    icon: "💆",
  },
  {
    key: "ACTIVE_RECOVERY",
    label: "Active Recovery",
    description: "Light movement session explicitly for recovery",
    domain: "lifestyle",
    kind: "COMPLETION",
    subtype: "ACTIVE_RECOVERY",
    icon: "🌀",
  },
  {
    key: "GUIDED_RECOVERY",
    label: "Recovery Flow",
    description: "Guided recovery sequence with timed rest and light movement",
    domain: "lifestyle",
    kind: "GUIDED",
    subtype: "RECOVERY",
    icon: "💤",
  },

  // ─── LIFESTYLE ────────────────────────────────────────────────────────────────
  {
    key: "DAILY_HABIT",
    label: "Daily Habit",
    description: "Done-or-not-done tracking for daily actions and routines",
    domain: "lifestyle",
    kind: "COMPLETION",
    subtype: "OTHER",
    icon: "✅",
  },
  {
    key: "HEALTH_CHECKIN",
    label: "Health Check-in",
    description: "General health habit like sleep, hydration, or supplements",
    domain: "lifestyle",
    kind: "COMPLETION",
    subtype: "HEALTH",
    icon: "🩺",
  },
];

export function getActivitiesForDomain(
  domain: Exclude<RoutineDomain, "skill" | "general" | "habit">
): ActivityPreset[] {
  return ACTIVITY_PRESETS.filter((p) => p.domain === domain);
}

export function getActivityPreset(key: string): ActivityPreset | undefined {
  return ACTIVITY_PRESETS.find((p) => p.key === key);
}

export function getDomainMeta(
  domain: Exclude<RoutineDomain, "skill" | "general" | "habit">
): DomainMeta {
  return DOMAIN_META.find((m) => m.domain === domain) ?? DOMAIN_META[DOMAIN_META.length - 1];
}

// Legacy compat — used by older code that called getRoutinePreset / inferRoutinePreset
export type RoutinePresetKey = string;

export function inferRoutinePreset(
  kind: string | null | undefined,
  subtype: string | null | undefined
): string {
  if (!kind) return "DAILY_HABIT";
  const k = String(kind).toUpperCase();
  const s = String(subtype ?? "").toUpperCase();
  if (k === "WORKOUT") return s === "HYPERTROPHY" ? "HYPERTROPHY_WORKOUT" : s === "REHAB" ? "REHAB_WORKOUT" : "STRENGTH_WORKOUT";
  if (k === "CARDIO") {
    if (s === "EASY_RUN") return "EASY_RUN";
    if (s === "TEMPO_RUN") return "TEMPO_RUN";
    if (s === "LONG_RUN") return "LONG_RUN";
    if (s === "WALK" || s === "EASY_WALK") return "EASY_WALK";
    if (s === "BIKE") return "BIKE";
    if (s === "SWIM") return "SWIM";
    if (s === "HIKE") return "HIKE";
    if (s === "ROW") return "ROW";
    return "EASY_RUN";
  }
  if (k === "GUIDED") {
    if (s === "STRETCHING") return "STRETCH_ROUTINE";
    if (s === "WARMUP" || s === "COOLDOWN") return "WARMUP_COOLDOWN";
    if (s === "REHAB") return "REHAB_FLOW";
    if (s === "BREATHWORK") return "BREATHWORK";
    if (s === "RECOVERY") return "GUIDED_RECOVERY";
    return "MOBILITY_FLOW";
  }
  if (k === "SESSION") {
    if (s === "TENNIS") return "TENNIS";
    if (s === "CLIMBING") return "INDOOR_BOULDERING";
    if (s === "SURFING") return "SURFING";
    if (s === "SNOWBOARDING") return "SNOWBOARDING";
    if (s === "BASKETBALL") return "BASKETBALL";
    if (s === "GOLF") return "GOLF";
    if (s === "HIKE_DAY") return "HIKE_DAY";
    if (s === "TEAM_SPORT") return "TEAM_SPORT";
    if (s === "YOGA_SESSION") return "YOGA_SESSION";
    return "SKILL_PRACTICE";
  }
  // COMPLETION
  if (s === "COLD_PLUNGE") return "COLD_PLUNGE";
  if (s === "SAUNA") return "SAUNA";
  if (s === "FOAM_ROLLING") return "FOAM_ROLLING";
  if (s === "MASSAGE") return "MASSAGE";
  if (s === "ACTIVE_RECOVERY") return "ACTIVE_RECOVERY";
  if (s === "HEALTH") return "HEALTH_CHECKIN";
  return "DAILY_HABIT";
}
