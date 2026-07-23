import type { MetadataGroupKind } from "@/generated/prisma";

export const METADATA_GROUP_KIND_LABELS: Record<MetadataGroupKind, string> = {
  MUSCLE_GROUP: "Muscle Groups",
  MOVEMENT_PATTERN: "Movement Patterns",
  TRAINING_GROUP: "Training Groups",
  CARDIO_ACTIVITY: "Cardio / Activity",
  ROUTINE_FOCUS: "Routine Focus",
};

export const ROUTINE_METADATA_SELECTABLE_KINDS: MetadataGroupKind[] = [
  "MUSCLE_GROUP",
  "MOVEMENT_PATTERN",
  "TRAINING_GROUP",
  "CARDIO_ACTIVITY",
  "ROUTINE_FOCUS",
];

export type MetadataSeedGroup = {
  slug: string;
  label: string;
  kind: MetadataGroupKind;
  appliesToRoutine: boolean;
  appliesToExercise: boolean;
  description?: string;
  parentSlugs?: string[];
};

export const METADATA_GROUP_SEEDS: MetadataSeedGroup[] = [
  { slug: "chest", label: "Chest", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "triceps", label: "Triceps", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "shoulders", label: "Shoulders", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "back", label: "Back", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "biceps", label: "Biceps", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "fingers", label: "Fingers", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "forearms", label: "Forearms", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "neck", label: "Neck", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["upper-body"] },
  { slug: "quads", label: "Quads", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "hamstrings", label: "Hamstrings", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "glutes", label: "Glutes", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "hip-flexors", label: "Hip Flexors", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "adductors", label: "Adductors", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "abductors", label: "Abductors", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "calves", label: "Calves", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "core", label: "Core", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },

  { slug: "push", label: "Push", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true, parentSlugs: ["upper-body"] },
  { slug: "pull", label: "Pull", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true, parentSlugs: ["upper-body"] },
  { slug: "legs", label: "Legs", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true, parentSlugs: ["lower-body"] },
  { slug: "upper-body", label: "Upper Body", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },
  { slug: "lower-body", label: "Lower Body", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },
  { slug: "full-body", label: "Full Body", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },
  { slug: "endurance", label: "Endurance", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true },
  { slug: "outdoor", label: "Outdoor", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true },
  { slug: "board-sports", label: "Board Sports", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true },
  { slug: "climbing", label: "Climbing", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true },
  { slug: "grip", label: "Grip", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },
  { slug: "mobility", label: "Mobility", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },

  { slug: "squat", label: "Squat", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "hinge", label: "Hinge", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "lunge", label: "Lunge", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "horizontal-push", label: "Horizontal Push", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "vertical-push", label: "Vertical Push", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "horizontal-pull", label: "Horizontal Pull", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "vertical-pull", label: "Vertical Pull", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "carry", label: "Carry", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core", "upper-body", "lower-body"] },
  { slug: "isometric", label: "Isometric", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core", "upper-body", "lower-body"] },
  { slug: "rotation", label: "Rotation", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core"] },
  { slug: "anti-extension", label: "Anti-Extension", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core", "isometric"] },
  { slug: "anti-rotation", label: "Anti-Rotation", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core", "isometric"] },
  { slug: "anti-lateral-flexion", label: "Anti-Lateral Flexion", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core", "isometric"] },

  // CARDIO_ACTIVITY: an "activity type" tagging system. Despite the name, it covers all
  // identifiable activities, not just heart-rate-driven cardio (e.g., golf, basketball).
  // Hierarchy: cardio (root) → run-walk → running/walking → variants. Each level can be tagged.
  { slug: "cardio", label: "All Cardio", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true },
  { slug: "run-walk", label: "Run + Walk", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "running", label: "Running", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["run-walk", "cardio"] },
  { slug: "trail-running", label: "Trail Running", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["running", "run-walk", "cardio", "outdoor"] },
  { slug: "road-running", label: "Road Running", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["running", "run-walk", "cardio"] },
  { slug: "easy-run", label: "Easy Run", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["running", "run-walk", "cardio"] },
  { slug: "tempo-run", label: "Tempo Run", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["running", "run-walk", "cardio", "endurance"] },
  { slug: "long-run", label: "Long Run", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["running", "run-walk", "cardio", "endurance"] },
  { slug: "walking", label: "Walking", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["run-walk", "cardio"] },
  { slug: "easy-walk", label: "Easy Walk", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["walking", "run-walk", "cardio"] },
  { slug: "biking", label: "Biking", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "road-cycling", label: "Road Cycling", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["biking", "cardio"] },
  { slug: "mountain-biking", label: "Mountain Biking", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["biking", "cardio", "outdoor"] },
  { slug: "gravel-cycling", label: "Gravel Cycling", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["biking", "cardio", "outdoor"] },
  { slug: "swimming", label: "Swimming", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "pool-swimming", label: "Pool Swimming", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["swimming", "cardio"] },
  { slug: "open-water-swimming", label: "Open Water Swimming", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["swimming", "cardio", "outdoor"] },
  { slug: "hiking", label: "Hiking", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio", "outdoor"] },
  { slug: "rowing", label: "Rowing", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "basketball", label: "Basketball", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "spikeball", label: "Spikeball", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio", "outdoor"] },
  { slug: "tennis", label: "Tennis", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "golf", label: "Golf", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "surfing", label: "Surfing", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["board-sports", "cardio", "outdoor"] },
  { slug: "bodysurfing", label: "Bodysurfing", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio", "outdoor"] },
  { slug: "wakesurfing", label: "Wake Surfing", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["board-sports", "cardio", "outdoor"] },
  { slug: "snowboarding", label: "Snowboarding", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["board-sports", "cardio", "outdoor"] },
  { slug: "skiing", label: "Skiing", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["board-sports", "cardio", "outdoor"] },
  { slug: "skateboarding", label: "Skateboarding", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["board-sports", "cardio"] },

  // Specialty training tags — structural workout types that overlay an activity.
  // E.g. a "Trail intervals" routine could be tagged: trail-running + intervals.
  // These are separate from the activity-type tags above; both can apply.
  { slug: "intervals", label: "Intervals", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "hill-repeats", label: "Hill Repeats", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio", "endurance"] },
  { slug: "sprint-workout", label: "Sprint Workout", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "fartlek", label: "Fartlek", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["running", "run-walk", "cardio"] },
  { slug: "tempo-effort", label: "Tempo Effort", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio", "endurance"] },
  { slug: "recovery-effort", label: "Recovery Effort", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },

  // Climbing-specific specialty training — methodology overlays for climbing sessions.
  { slug: "climbing-endurance", label: "Climbing Endurance (ARC)", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["climbing"] },
  { slug: "climbing-4x4s", label: "Climbing 4x4s", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["climbing"] },
  { slug: "climbing-pyramid", label: "Climbing Pyramid", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["climbing"] },
  { slug: "climbing-link-ups", label: "Link-ups / Laps", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["climbing"] },
  { slug: "climbing-projecting", label: "Projecting", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["climbing"] },
  { slug: "climbing-power", label: "Power / Limit Bouldering", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["climbing"] },
  { slug: "climbing-power-endurance", label: "Power Endurance", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["climbing"] },

  { slug: "strength", label: "Strength", kind: "ROUTINE_FOCUS", appliesToExercise: true, appliesToRoutine: true },
  { slug: "hypertrophy", label: "Hypertrophy", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
  { slug: "rehab", label: "Rehab", kind: "ROUTINE_FOCUS", appliesToExercise: true, appliesToRoutine: true },
  { slug: "skill-practice", label: "Skill Practice", kind: "ROUTINE_FOCUS", appliesToExercise: true, appliesToRoutine: true },
  { slug: "breathwork", label: "Breathwork", kind: "ROUTINE_FOCUS", appliesToExercise: true, appliesToRoutine: true },
  { slug: "recovery", label: "Recovery", kind: "ROUTINE_FOCUS", appliesToExercise: true, appliesToRoutine: true },
];

// Subtype → metadata defaults. Used to auto-assign metadata when a routine is created
// with a particular subtype. As of Phase 1 of the restructure, cardio activity types
// (running, biking, etc.) are first-class metadata tags — the subtype is being demoted
// in favor of metadata. Style sub-tags (easy-run, tempo-run, long-run, easy-walk) are
// also metadata so they're discoverable and filterable.
export const ROUTINE_SUBTYPE_GROUP_DEFAULTS: Record<string, string[]> = {
  // Cardio variants — primary activity tag plus style/parent rollups
  RUN: ["running", "run-walk"],
  EASY_RUN: ["easy-run", "running", "run-walk"],
  TEMPO_RUN: ["tempo-run", "running", "run-walk", "endurance"],
  LONG_RUN: ["long-run", "running", "run-walk", "endurance"],
  WALK: ["walking", "run-walk"],
  EASY_WALK: ["easy-walk", "walking", "run-walk"],
  BIKE: ["biking"],
  SWIM: ["swimming"],
  HIKE: ["hiking", "outdoor"],
  ROW: ["rowing"],
  // Guided styles
  MOBILITY: ["mobility"],
  STRETCHING: ["mobility"],
  WARMUP: ["mobility"],
  COOLDOWN: ["mobility", "recovery"],
  REHAB: ["rehab"],
  BREATHWORK: ["breathwork", "recovery", "skill-practice"],
  RECOVERY: ["recovery"],
  // Workout focuses
  STRENGTH: ["strength"],
  HYPERTROPHY: ["hypertrophy"],
  // Sessions / sports — sport activities now have first-class CARDIO_ACTIVITY tags
  CLIMBING: ["climbing", "skill-practice", "strength", "pull", "back", "shoulders", "biceps", "forearms", "fingers", "core", "abs"],
  SURFING: ["surfing", "board-sports", "cardio", "core", "grip", "outdoor"],
  SNOWBOARDING: ["snowboarding", "board-sports", "cardio", "core", "outdoor"],
  BASKETBALL: ["basketball", "cardio", "core", "skill-practice"],
  TENNIS: ["tennis", "cardio", "core", "skill-practice"],
  GOLF: ["golf", "outdoor", "core", "skill-practice"],
  TEAM_SPORT: ["cardio", "core"],
  SKILL_PRACTICE: ["skill-practice", "core"],
  YOGA_SESSION: ["mobility"],
  HIKE_DAY: ["hiking", "cardio", "outdoor"],
};

const EXERCISE_METADATA_INFERENCE_RULES: Array<{ pattern: RegExp; slugs: string[] }> = [
  { pattern: /\b(pull[\s-]?up|chin[\s-]?up|lat pulldown|pulldown)\b/i, slugs: ["vertical-pull", "pull", "back", "biceps"] },
  { pattern: /\b(muscle[\s-]?up)\b/i, slugs: ["vertical-pull", "vertical-push", "pull", "push", "back", "chest", "shoulders", "triceps", "biceps", "core", "full-body", "skill-practice", "strength"] },
  { pattern: /\b(front lever|scapular pull[\s-]?up|archer pull[\s-]?up)\b/i, slugs: ["vertical-pull", "pull", "back", "shoulders", "core", "skill-practice"] },
  { pattern: /\b(row|seal row|t-bar row|inverted row)\b/i, slugs: ["horizontal-pull", "pull", "back", "biceps"] },
  { pattern: /\b(face pull|rear delt)\b/i, slugs: ["horizontal-pull", "pull", "back", "shoulders"] },
  { pattern: /\b(bench|push[\s-]?up|chest press|chest fly)\b/i, slugs: ["horizontal-push", "push", "chest", "triceps", "shoulders"] },
  { pattern: /\b(ring dip)\b/i, slugs: ["vertical-push", "push", "chest", "triceps", "shoulders", "core", "skill-practice"] },
  { pattern: /\b(dip)\b/i, slugs: ["vertical-push", "push", "chest", "triceps", "shoulders"] },
  { pattern: /\b(overhead press|shoulder press|arnold press|pike push[\s-]?up|handstand push[\s-]?up)\b/i, slugs: ["vertical-push", "push", "shoulders", "triceps"] },
  { pattern: /\b(planche|planche lean)\b/i, slugs: ["push", "chest", "shoulders", "triceps", "core", "isometric", "skill-practice"] },
  { pattern: /\b(squat|leg press|wall sit)\b/i, slugs: ["squat", "legs", "lower-body", "quads", "glutes"] },
  { pattern: /\b(deadlift|romanian deadlift|rdl|good morning|hip thrust|bridge|swing|pull-through)\b/i, slugs: ["hinge", "legs", "lower-body", "hamstrings", "glutes"] },
  { pattern: /\b(lunge|split squat|step-up)\b/i, slugs: ["lunge", "legs", "lower-body", "quads", "glutes"] },
  // Negative lookbehind: don't tag biceps for hamstring/leg/nordic/wrist curls.
  { pattern: /\b(?<!hamstring |leg |nordic |wrist )curl\b/i, slugs: ["pull", "biceps"] },
  { pattern: /\b(hamstring curl|leg curl|nordic curl)\b/i, slugs: ["hinge", "hamstrings", "legs", "lower-body"] },
  { pattern: /\b(leg extension)\b/i, slugs: ["squat", "quads", "legs", "lower-body"] },
  { pattern: /\b(side[\s-]?lying leg lift|side[\s-]?lying leg raise|side[\s-]?lying hip abduction|hip abduction)\b/i, slugs: ["glutes", "abductors", "legs", "lower-body"] },
  { pattern: /\b(hip adduction|adductor squeeze|ball adductor squeeze)\b/i, slugs: ["adductors", "legs", "lower-body"] },
  { pattern: /\b(calf raise)\b/i, slugs: ["squat", "calves", "legs", "lower-body"] },
  { pattern: /\b(spanish squat)\b/i, slugs: ["squat", "legs", "lower-body", "quads", "rehab"] },
  { pattern: /\b(triceps|pressdown|skull crusher|extension)\b/i, slugs: ["push", "triceps"] },
  { pattern: /\b(plank|hollow|dead bug|ab wheel|sit-up|crunch|leg raise|knee raise|l-sit)\b/i, slugs: ["core"] },
  { pattern: /\b(side plank|copenhagen|suitcase carry)\b/i, slugs: ["core", "anti-lateral-flexion", "isometric"] },
  { pattern: /\b(pallof)\b/i, slugs: ["core", "anti-rotation"] },
  { pattern: /\b(bird dog)\b/i, slugs: ["core", "anti-rotation", "glutes"] },
  { pattern: /\b(dead bug|ab wheel)\b/i, slugs: ["core", "anti-extension"] },
  { pattern: /\b(carry|farmer|waiter|overhead carry)\b/i, slugs: ["carry", "core"] },
  { pattern: /\b(hang|hangboard|fingerboard|lock-off|support hold|handstand hold|isometric)\b/i, slugs: ["isometric"] },
  { pattern: /\b(hangboard|fingerboard|crimp|pinch)\b/i, slugs: ["fingers", "forearms", "pull", "strength"] },
  { pattern: /\b(hamstring|pike|forward fold)\b.*\b(stretch|mobility|opener)\b|\b(stretch|mobility|opener)\b.*\b(hamstring|pike|forward fold)\b/i, slugs: ["hamstrings", "mobility", "recovery"] },
  { pattern: /\b(hip flexor|couch stretch|lunge stretch)\b/i, slugs: ["hip-flexors", "quads", "mobility", "recovery"] },
  { pattern: /\b(quad|quadriceps)\b.*\b(stretch|mobility)\b|\b(stretch|mobility)\b.*\b(quad|quadriceps)\b/i, slugs: ["quads", "mobility", "recovery"] },
  { pattern: /\b(calf|achilles)\b.*\b(stretch|mobility)\b|\b(stretch|mobility)\b.*\b(calf|achilles)\b/i, slugs: ["calves", "mobility", "recovery"] },
  { pattern: /\b(glute|piriformis|figure four|pigeon)\b.*\b(stretch|mobility|opener)\b|\b(stretch|mobility|opener)\b.*\b(glute|piriformis|figure four|pigeon)\b/i, slugs: ["glutes", "mobility", "recovery"] },
  { pattern: /\b(adductor|groin|copenhagen)\b.*\b(stretch|mobility)\b|\b(stretch|mobility)\b.*\b(adductor|groin|copenhagen)\b/i, slugs: ["adductors", "mobility", "recovery"] },
  { pattern: /\b(chest|pec)\b.*\b(stretch|mobility|opener)\b|\b(stretch|mobility|opener)\b.*\b(chest|pec)\b/i, slugs: ["chest", "mobility", "recovery"] },
  { pattern: /\b(shoulder|lat|thoracic|t-spine)\b.*\b(stretch|mobility|opener)\b|\b(stretch|mobility|opener)\b.*\b(shoulder|lat|thoracic|t-spine)\b/i, slugs: ["shoulders", "lats", "upper-back", "mobility", "recovery"] },
  { pattern: /\b(stretch|mobility|neural glide|yoga|opener)\b/i, slugs: ["mobility", "recovery"] },
  { pattern: /\b(breath|breathing|nasal|box breathing|breathwork|inhale|exhale)\b/i, slugs: ["breathwork", "recovery", "skill-practice"] },
  { pattern: /\b(rehab|prehab|therapy)\b/i, slugs: ["rehab", "recovery"] },
];

const GUIDED_STEP_METADATA_INFERENCE_RULES: Array<{ pattern: RegExp; slugs: string[] }> = [
  { pattern: /\b(stretch|mobility|opener|flow|yoga)\b/i, slugs: ["mobility", "recovery"] },
  { pattern: /\b(breath|breathing|nasal|box breathing|breathwork|inhale|exhale)\b/i, slugs: ["breathwork", "recovery", "skill-practice"] },
  { pattern: /\b(hangboard|fingerboard|finger|crimp|pinch)\b/i, slugs: ["fingers", "pull", "strength"] },
  { pattern: /\b(pull-up|pull up|chin-up|chin up|pulldown|lat pulldown|face pull|scap|scapular|shoulder blade|lock-off)\b/i, slugs: ["pull", "strength"] },
  { pattern: /\b(plank|hollow|dead bug|bird dog|pallof|carry|rotation|anti-rotation|anti-extension|core)\b/i, slugs: ["core"] },
  { pattern: /\b(warmup|warm-up)\b/i, slugs: ["mobility", "recovery"] },
  { pattern: /\b(cooldown|cool-down)\b/i, slugs: ["recovery", "mobility"] },
  { pattern: /\b(rehab|prehab|therapy|nerve glide)\b/i, slugs: ["rehab", "recovery", "mobility"] },
];

export function inferExerciseMetadataSlugs(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return [];

  const slugs = new Set<string>();
  for (const rule of EXERCISE_METADATA_INFERENCE_RULES) {
    if (!rule.pattern.test(normalized)) continue;
    for (const slug of rule.slugs) slugs.add(slug);
  }
  return Array.from(slugs);
}

export function inferGuidedStepMetadataSlugs(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return [];

  const slugs = new Set<string>();
  for (const rule of GUIDED_STEP_METADATA_INFERENCE_RULES) {
    if (!rule.pattern.test(normalized)) continue;
    for (const slug of rule.slugs) slugs.add(slug);
  }
  return Array.from(slugs);
}

export function inferRoutineMetadataSlugs(subtype: string | null | undefined) {
  const normalized = String(subtype ?? "").trim().toUpperCase();
  if (!normalized) return [];
  return ROUTINE_SUBTYPE_GROUP_DEFAULTS[normalized] ?? [];
}

export function formatMetadataGroupKind(kind: MetadataGroupKind) {
  return METADATA_GROUP_KIND_LABELS[kind] ?? kind;
}

export function normalizeTagName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function parseTagNames(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => normalizeTagName(entry))
        .filter((entry) => entry.length > 0)
    )
  );
}
