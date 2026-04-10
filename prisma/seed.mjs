import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const metadataGroups = [
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
  { slug: "cardio", label: "All Cardio", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true },
  { slug: "run-walk", label: "Run + Walk", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "running", label: "Running", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["run-walk", "cardio"] },
  { slug: "walking", label: "Walking", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["run-walk", "cardio"] },
  { slug: "biking", label: "Biking", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "swimming", label: "Swimming", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "hiking", label: "Hiking", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "rowing", label: "Rowing", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "basketball", label: "Basketball", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "golf", label: "Golf", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true, parentSlugs: ["cardio"] },
  { slug: "strength", label: "Strength", kind: "ROUTINE_FOCUS", appliesToExercise: true, appliesToRoutine: true },
  { slug: "hypertrophy", label: "Hypertrophy", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
  { slug: "rehab", label: "Rehab", kind: "ROUTINE_FOCUS", appliesToExercise: true, appliesToRoutine: true },
  { slug: "skill-practice", label: "Skill Practice", kind: "ROUTINE_FOCUS", appliesToExercise: true, appliesToRoutine: true },
  { slug: "breathwork", label: "Breathwork", kind: "ROUTINE_FOCUS", appliesToExercise: true, appliesToRoutine: true },
  { slug: "recovery", label: "Recovery", kind: "ROUTINE_FOCUS", appliesToExercise: true, appliesToRoutine: true },
];

const stimulusCategories = [
  { slug: "push", label: "Push", sortOrder: 10 },
  { slug: "pull", label: "Pull", sortOrder: 20 },
  { slug: "squat", label: "Squat", sortOrder: 30 },
  { slug: "hinge", label: "Hinge", sortOrder: 40 },
  { slug: "core", label: "Core", sortOrder: 50 },
  { slug: "grip", label: "Grip", sortOrder: 60 },
  { slug: "cardio", label: "Cardio", sortOrder: 70 },
];

const metadataStimulusMappings = [
  { metadataGroupSlug: "push", stimulusSlug: "push", loadWeight: 1, stretchWeight: 0.1 },
  { metadataGroupSlug: "horizontal-push", stimulusSlug: "push", loadWeight: 1, stretchWeight: 0.12 },
  { metadataGroupSlug: "vertical-push", stimulusSlug: "push", loadWeight: 1, stretchWeight: 0.18 },
  { metadataGroupSlug: "chest", stimulusSlug: "push", loadWeight: 1, stretchWeight: 0.08 },
  { metadataGroupSlug: "triceps", stimulusSlug: "push", loadWeight: 1, stretchWeight: 0.06 },
  { metadataGroupSlug: "shoulders", stimulusSlug: "push", loadWeight: 0.9, stretchWeight: 0.18 },
  { metadataGroupSlug: "shoulders", stimulusSlug: "pull", loadWeight: 0.15, stretchWeight: 0.1 },

  { metadataGroupSlug: "pull", stimulusSlug: "pull", loadWeight: 1, stretchWeight: 0.1 },
  { metadataGroupSlug: "horizontal-pull", stimulusSlug: "pull", loadWeight: 1, stretchWeight: 0.1 },
  { metadataGroupSlug: "vertical-pull", stimulusSlug: "pull", loadWeight: 1, stretchWeight: 0.12 },
  { metadataGroupSlug: "back", stimulusSlug: "pull", loadWeight: 1, stretchWeight: 0.14 },
  { metadataGroupSlug: "biceps", stimulusSlug: "pull", loadWeight: 0.9, stretchWeight: 0.08 },
  { metadataGroupSlug: "grip", stimulusSlug: "grip", loadWeight: 1, stretchWeight: 0.05 },
  { metadataGroupSlug: "fingers", stimulusSlug: "grip", loadWeight: 1, stretchWeight: 0.08 },
  { metadataGroupSlug: "fingers", stimulusSlug: "pull", loadWeight: 0.45, stretchWeight: 0.04 },
  { metadataGroupSlug: "forearms", stimulusSlug: "grip", loadWeight: 1, stretchWeight: 0.08 },
  { metadataGroupSlug: "forearms", stimulusSlug: "pull", loadWeight: 0.25, stretchWeight: 0.04 },

  { metadataGroupSlug: "squat", stimulusSlug: "squat", loadWeight: 1, stretchWeight: 0.12 },
  { metadataGroupSlug: "quads", stimulusSlug: "squat", loadWeight: 1, stretchWeight: 0.25 },
  { metadataGroupSlug: "lunge", stimulusSlug: "squat", loadWeight: 0.85, stretchWeight: 0.18 },
  { metadataGroupSlug: "calves", stimulusSlug: "squat", loadWeight: 0.45, stretchWeight: 0.25 },
  { metadataGroupSlug: "legs", stimulusSlug: "squat", loadWeight: 0.55, stretchWeight: 0.15 },
  { metadataGroupSlug: "lower-body", stimulusSlug: "squat", loadWeight: 0.45, stretchWeight: 0.1 },

  { metadataGroupSlug: "hinge", stimulusSlug: "hinge", loadWeight: 1, stretchWeight: 0.2 },
  { metadataGroupSlug: "hamstrings", stimulusSlug: "hinge", loadWeight: 1, stretchWeight: 0.35 },
  { metadataGroupSlug: "glutes", stimulusSlug: "hinge", loadWeight: 0.8, stretchWeight: 0.18 },
  { metadataGroupSlug: "hip-flexors", stimulusSlug: "hinge", loadWeight: 0.15, stretchWeight: 0.45 },
  { metadataGroupSlug: "adductors", stimulusSlug: "hinge", loadWeight: 0.15, stretchWeight: 0.25 },
  { metadataGroupSlug: "abductors", stimulusSlug: "hinge", loadWeight: 0.15, stretchWeight: 0.22 },
  { metadataGroupSlug: "legs", stimulusSlug: "hinge", loadWeight: 0.45, stretchWeight: 0.12 },
  { metadataGroupSlug: "lower-body", stimulusSlug: "hinge", loadWeight: 0.45, stretchWeight: 0.1 },

  { metadataGroupSlug: "core", stimulusSlug: "core", loadWeight: 1, stretchWeight: 0.2 },
  { metadataGroupSlug: "rotation", stimulusSlug: "core", loadWeight: 0.7, stretchWeight: 0.22 },
  { metadataGroupSlug: "anti-extension", stimulusSlug: "core", loadWeight: 1, stretchWeight: 0.08 },
  { metadataGroupSlug: "anti-rotation", stimulusSlug: "core", loadWeight: 1, stretchWeight: 0.08 },
  { metadataGroupSlug: "anti-lateral-flexion", stimulusSlug: "core", loadWeight: 1, stretchWeight: 0.08 },
  { metadataGroupSlug: "carry", stimulusSlug: "core", loadWeight: 0.75, stretchWeight: 0.05 },
  { metadataGroupSlug: "carry", stimulusSlug: "grip", loadWeight: 0.65, stretchWeight: 0.02 },
  { metadataGroupSlug: "isometric", stimulusSlug: "core", loadWeight: 0.35, stretchWeight: 0.08 },

  { metadataGroupSlug: "cardio", stimulusSlug: "cardio", loadWeight: 1, stretchWeight: 0 },
  { metadataGroupSlug: "run-walk", stimulusSlug: "cardio", loadWeight: 1, stretchWeight: 0 },
  { metadataGroupSlug: "running", stimulusSlug: "cardio", loadWeight: 1, stretchWeight: 0 },
  { metadataGroupSlug: "running", stimulusSlug: "squat", loadWeight: 0.35, stretchWeight: 0 },
  { metadataGroupSlug: "running", stimulusSlug: "hinge", loadWeight: 0.2, stretchWeight: 0 },
  { metadataGroupSlug: "running", stimulusSlug: "core", loadWeight: 0.15, stretchWeight: 0 },
  { metadataGroupSlug: "walking", stimulusSlug: "cardio", loadWeight: 1, stretchWeight: 0 },
  { metadataGroupSlug: "walking", stimulusSlug: "squat", loadWeight: 0.18, stretchWeight: 0 },
  { metadataGroupSlug: "walking", stimulusSlug: "hinge", loadWeight: 0.08, stretchWeight: 0 },
  { metadataGroupSlug: "biking", stimulusSlug: "cardio", loadWeight: 1, stretchWeight: 0 },
  { metadataGroupSlug: "biking", stimulusSlug: "squat", loadWeight: 0.28, stretchWeight: 0 },
  { metadataGroupSlug: "swimming", stimulusSlug: "cardio", loadWeight: 1, stretchWeight: 0 },
  { metadataGroupSlug: "swimming", stimulusSlug: "pull", loadWeight: 0.4, stretchWeight: 0 },
  { metadataGroupSlug: "rowing", stimulusSlug: "cardio", loadWeight: 1, stretchWeight: 0 },
  { metadataGroupSlug: "rowing", stimulusSlug: "pull", loadWeight: 0.5, stretchWeight: 0 },
  { metadataGroupSlug: "rowing", stimulusSlug: "hinge", loadWeight: 0.25, stretchWeight: 0 },
  { metadataGroupSlug: "hiking", stimulusSlug: "cardio", loadWeight: 1, stretchWeight: 0 },
  { metadataGroupSlug: "hiking", stimulusSlug: "squat", loadWeight: 0.35, stretchWeight: 0 },
  { metadataGroupSlug: "hiking", stimulusSlug: "hinge", loadWeight: 0.2, stretchWeight: 0 },
  { metadataGroupSlug: "hiking", stimulusSlug: "core", loadWeight: 0.18, stretchWeight: 0 },
  { metadataGroupSlug: "climbing", stimulusSlug: "pull", loadWeight: 1, stretchWeight: 0.06 },
  { metadataGroupSlug: "climbing", stimulusSlug: "grip", loadWeight: 1, stretchWeight: 0.08 },
  { metadataGroupSlug: "climbing", stimulusSlug: "core", loadWeight: 0.45, stretchWeight: 0.05 },

  { metadataGroupSlug: "mobility", stimulusSlug: "hinge", loadWeight: 0.08, stretchWeight: 0.35 },
  { metadataGroupSlug: "mobility", stimulusSlug: "squat", loadWeight: 0.08, stretchWeight: 0.3 },
  { metadataGroupSlug: "mobility", stimulusSlug: "core", loadWeight: 0.06, stretchWeight: 0.22 },
  { metadataGroupSlug: "rehab", stimulusSlug: "core", loadWeight: 0.08, stretchWeight: 0.2 },
  { metadataGroupSlug: "recovery", stimulusSlug: "hinge", loadWeight: 0, stretchWeight: 0.18 },
  { metadataGroupSlug: "recovery", stimulusSlug: "core", loadWeight: 0, stretchWeight: 0.12 },
];

const boulderingGrades = ["V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10"];
const yosemiteGrades = ["5.6", "5.7", "5.8", "5.9", "5.10a", "5.10b", "5.10c", "5.10d", "5.11a", "5.11b", "5.11c", "5.11d", "5.12a", "5.12b", "5.12c", "5.12d", "5.13a", "5.13b", "5.13c", "5.13d"];
const climbingTemplateMetadata = ["climbing", "back", "biceps", "forearms", "fingers", "pull", "vertical-pull", "isometric", "core", "strength", "skill-practice"];
const climbingOutdoorTemplateMetadata = [...climbingTemplateMetadata, "outdoor"];
const hikingTemplateMetadata = ["hiking", "cardio", "endurance", "outdoor", "legs", "quads", "glutes", "calves", "core"];
const surfingTemplateMetadata = ["board-sports", "outdoor", "cardio", "skill-practice", "full-body", "upper-body", "core", "shoulders", "back"];
const snowboardingTemplateMetadata = ["board-sports", "outdoor", "legs", "quads", "glutes", "calves", "core", "skill-practice"];
const basketballPickupTemplateMetadata = ["basketball", "cardio", "full-body", "legs", "core", "skill-practice"];
const basketballShootingTemplateMetadata = ["basketball", "skill-practice", "upper-body", "core", "shoulders"];
const golfTemplateMetadata = ["golf", "outdoor", "skill-practice", "core", "rotation"];

function deriveExerciseLibraryKind({ name, metadata, unit }) {
  const normalizedName = String(name || "").trim().toLowerCase();
  const metadataSet = new Set((metadata ?? []).map((slug) => String(slug).trim().toLowerCase()).filter(Boolean));

  if (metadataSet.has("breathwork") || /\b(breath|breathing|inhale|exhale)\b/i.test(normalizedName)) {
    return "BREATHWORK";
  }
  if (
    /\b(stretch|pose|fold|opener|child'?s pose|downward dog|pigeon|figure four|butterfly)\b/i.test(normalizedName) ||
    (metadataSet.has("mobility") && (
      metadataSet.has("hinge") ||
      metadataSet.has("quads") ||
      metadataSet.has("hamstrings") ||
      metadataSet.has("calves") ||
      metadataSet.has("hip-flexors") ||
      metadataSet.has("glutes") ||
      metadataSet.has("shoulders")
    ))
  ) {
    return "STRETCH";
  }
  if (metadataSet.has("mobility") || metadataSet.has("rehab") || /\b(mobility|warmup|warm-up|cooldown|cool-down|glide|rotation)\b/i.test(normalizedName)) {
    return "MOBILITY";
  }
  if (
    metadataSet.has("cardio") ||
    metadataSet.has("running") ||
    metadataSet.has("walking") ||
    metadataSet.has("biking") ||
    metadataSet.has("swimming") ||
    metadataSet.has("rowing") ||
    metadataSet.has("hiking") ||
    metadataSet.has("endurance")
  ) {
    return "CONDITIONING";
  }
  if (metadataSet.has("skill-practice") || metadataSet.has("climbing") || /\b(climb|hangboard|fingerboard|hang|carry|handstand|lock-off)\b/i.test(normalizedName)) {
    return "SKILL";
  }
  if (unit === "TIME" && metadataSet.has("isometric")) {
    return "SKILL";
  }
  return "STRENGTH";
}

function normalizeMetricGradeKey(grade) {
  return grade.toLowerCase().replace(/\./g, "_").replace(/\+/g, "plus").replace(/[^a-z0-9_]/g, "");
}

function buildClimbingGradeMetrics({ grades, gradeSystem, doneKeySuffix, doneLabel, flashedLabel, sortStart }) {
  return grades.flatMap((grade, index) => {
    const gradeKey = normalizeMetricGradeKey(grade);
    return [
      {
        key: `${gradeKey}_${doneKeySuffix}`,
        label: `${grade} ${doneLabel}`,
        valueType: "INTEGER",
        sortOrder: sortStart + index * 2,
        unit: "climbs",
        showInProgress: false,
        showInGoals: true,
        config: { gradeBucket: grade, climbingColumn: "DONE", gradeSystem },
      },
      {
        key: `${gradeKey}_flashed_count`,
        label: `${grade} ${flashedLabel}`,
        valueType: "INTEGER",
        sortOrder: sortStart + index * 2 + 1,
        unit: "climbs",
        showInProgress: false,
        showInGoals: true,
        config: { gradeBucket: grade, climbingColumn: "FLASHED", gradeSystem },
      },
    ];
  });
}

const sessionTemplates = [
  {
    key: "indoor-bouldering",
    name: "Indoor Bouldering",
    description: "Track bouldering sessions with flash/send counts by grade and best grades.",
    sessionSubtype: "CLIMBING",
    sortOrder: 10,
    metadataSlugs: climbingTemplateMetadata,
    metrics: [
      { key: "gym", label: "Gym", valueType: "TEXT", sortOrder: 10, showInProgress: false, showInGoals: false },
      { key: "total_attempts", label: "Total Climbs Attempted", valueType: "INTEGER", sortOrder: 20, unit: "attempts", showInProgress: true, showInGoals: true },
      ...buildClimbingGradeMetrics({
        grades: boulderingGrades,
        gradeSystem: "BOULDER_V",
        doneKeySuffix: "sent_count",
        doneLabel: "Done",
        flashedLabel: "Flashed",
        sortStart: 30,
      }),
      { key: "highest_flash_grade", label: "Highest Flash Grade", valueType: "TEXT", sortOrder: 90, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "BOULDER_V" } },
      { key: "highest_send_grade", label: "Highest Send Grade", valueType: "TEXT", sortOrder: 91, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "BOULDER_V" } },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 100, showInProgress: false, showInGoals: false, config: { input: "textarea" } },
    ],
  },
  {
    key: "indoor-rope-climbing",
    name: "Indoor Top Rope Climbing",
    description: "Track indoor top rope sessions with route counts, flashes, and top sends.",
    sessionSubtype: "CLIMBING",
    sortOrder: 20,
    metadataSlugs: climbingTemplateMetadata,
    metrics: [
      { key: "gym", label: "Gym", valueType: "TEXT", sortOrder: 10, showInGoals: false },
      { key: "routes_climbed", label: "Routes Climbed", valueType: "INTEGER", sortOrder: 20, unit: "routes", showInProgress: true, showInGoals: true },
      ...buildClimbingGradeMetrics({
        grades: yosemiteGrades,
        gradeSystem: "YOSEMITE",
        doneKeySuffix: "done_count",
        doneLabel: "Done",
        flashedLabel: "Flashed",
        sortStart: 30,
      }),
      { key: "highest_flash_grade", label: "Highest Flash Grade", valueType: "TEXT", sortOrder: 90, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "YOSEMITE" } },
      { key: "highest_send_grade", label: "Highest Send Grade", valueType: "TEXT", sortOrder: 91, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "YOSEMITE" } },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 100, showInGoals: false, config: { input: "textarea" } },
    ],
  },
  {
    key: "indoor-sport-climbing",
    name: "Indoor Sport Climbing",
    description: "Track indoor sport climbing sessions with route counts, flashes, and top sends.",
    sessionSubtype: "CLIMBING",
    sortOrder: 21,
    metadataSlugs: climbingTemplateMetadata,
    metrics: [
      { key: "gym", label: "Gym", valueType: "TEXT", sortOrder: 10, showInGoals: false },
      { key: "routes_climbed", label: "Routes Climbed", valueType: "INTEGER", sortOrder: 20, unit: "routes", showInProgress: true, showInGoals: true },
      ...buildClimbingGradeMetrics({
        grades: yosemiteGrades,
        gradeSystem: "YOSEMITE",
        doneKeySuffix: "done_count",
        doneLabel: "Done",
        flashedLabel: "Flashed",
        sortStart: 30,
      }),
      { key: "highest_flash_grade", label: "Highest Flash Grade", valueType: "TEXT", sortOrder: 90, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "YOSEMITE" } },
      { key: "highest_send_grade", label: "Highest Send Grade", valueType: "TEXT", sortOrder: 91, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "YOSEMITE" } },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 100, showInGoals: false, config: { input: "textarea" } },
    ],
  },
  {
    key: "outdoor-bouldering",
    name: "Outdoor Bouldering",
    description: "Track outdoor bouldering days with flash/send counts by grade and best grades.",
    sessionSubtype: "CLIMBING",
    sortOrder: 24,
    metadataSlugs: climbingOutdoorTemplateMetadata,
    metrics: [
      { key: "crag", label: "Crag / Location", valueType: "TEXT", sortOrder: 10, showInProgress: false, showInGoals: false },
      { key: "total_attempts", label: "Total Climbs Attempted", valueType: "INTEGER", sortOrder: 20, unit: "attempts", showInProgress: true, showInGoals: true },
      ...buildClimbingGradeMetrics({
        grades: boulderingGrades,
        gradeSystem: "BOULDER_V",
        doneKeySuffix: "sent_count",
        doneLabel: "Done",
        flashedLabel: "Flashed",
        sortStart: 30,
      }),
      { key: "highest_flash_grade", label: "Highest Flash Grade", valueType: "TEXT", sortOrder: 90, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "BOULDER_V" } },
      { key: "highest_send_grade", label: "Highest Send Grade", valueType: "TEXT", sortOrder: 91, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "BOULDER_V" } },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 100, showInGoals: false, config: { input: "textarea" } },
    ],
  },
  {
    key: "outdoor-sport-climbing",
    name: "Outdoor Sport Climbing",
    description: "Track outdoor sport climbing days with grade rows, flashes, and top sends.",
    sessionSubtype: "CLIMBING",
    sortOrder: 25,
    metadataSlugs: climbingOutdoorTemplateMetadata,
    metrics: [
      { key: "crag", label: "Crag / Location", valueType: "TEXT", sortOrder: 10, showInGoals: false },
      { key: "routes_climbed", label: "Routes Climbed", valueType: "INTEGER", sortOrder: 20, unit: "routes", showInProgress: true, showInGoals: true },
      ...buildClimbingGradeMetrics({
        grades: yosemiteGrades,
        gradeSystem: "YOSEMITE",
        doneKeySuffix: "done_count",
        doneLabel: "Done",
        flashedLabel: "Flashed",
        sortStart: 30,
      }),
      { key: "highest_flash_grade", label: "Highest Flash Grade", valueType: "TEXT", sortOrder: 90, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "YOSEMITE" } },
      { key: "highest_send_grade", label: "Highest Send Grade", valueType: "TEXT", sortOrder: 91, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "YOSEMITE" } },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 100, showInGoals: false, config: { input: "textarea" } },
    ],
  },
  {
    key: "outdoor-trad-climbing",
    name: "Outdoor Trad Climbing",
    description: "Track outdoor trad climbing days with grade rows, flashes, and top sends.",
    sessionSubtype: "CLIMBING",
    sortOrder: 26,
    metadataSlugs: climbingOutdoorTemplateMetadata,
    metrics: [
      { key: "crag", label: "Crag / Location", valueType: "TEXT", sortOrder: 10, showInGoals: false },
      { key: "routes_climbed", label: "Routes Climbed", valueType: "INTEGER", sortOrder: 20, unit: "routes", showInProgress: true, showInGoals: true },
      ...buildClimbingGradeMetrics({
        grades: yosemiteGrades,
        gradeSystem: "YOSEMITE",
        doneKeySuffix: "done_count",
        doneLabel: "Done",
        flashedLabel: "Flashed",
        sortStart: 30,
      }),
      { key: "highest_flash_grade", label: "Highest Flash Grade", valueType: "TEXT", sortOrder: 90, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "YOSEMITE" } },
      { key: "highest_send_grade", label: "Highest Send Grade", valueType: "TEXT", sortOrder: 91, showInProgress: true, showInGoals: true, config: { input: "grade", gradeSystem: "YOSEMITE" } },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 100, showInGoals: false, config: { input: "textarea" } },
    ],
  },
  {
    key: "hiking",
    name: "Hiking",
    description: "Track trail, distance, elevation gain, and hike duration.",
    sessionSubtype: "HIKE_DAY",
    sortOrder: 30,
    metadataSlugs: hikingTemplateMetadata,
    metrics: [
      { key: "trail_name", label: "Trail / Location", valueType: "TEXT", sortOrder: 10, showInGoals: false },
      { key: "distance_mi", label: "Distance", valueType: "DECIMAL", sortOrder: 20, unit: "mi", showInProgress: true, showInGoals: true },
      { key: "elevation_gain_ft", label: "Elevation Gain", valueType: "INTEGER", sortOrder: 30, unit: "ft", showInProgress: true, showInGoals: true },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 40, showInGoals: false, config: { input: "textarea" } },
    ],
  },
  {
    key: "surfing",
    name: "Surfing",
    description: "Track surf sessions with location, waves, and board details.",
    sessionSubtype: "SURFING",
    sortOrder: 40,
    metadataSlugs: surfingTemplateMetadata,
    metrics: [
      { key: "break_name", label: "Break / Location", valueType: "TEXT", sortOrder: 10, showInGoals: false },
      { key: "wave_count", label: "Wave Count", valueType: "INTEGER", sortOrder: 20, unit: "waves", showInProgress: true, showInGoals: true },
      { key: "board_name", label: "Board", valueType: "TEXT", sortOrder: 30, showInGoals: false },
      { key: "conditions_notes", label: "Conditions", valueType: "TEXT", sortOrder: 40, showInGoals: false, config: { input: "textarea" } },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 50, showInGoals: false, config: { input: "textarea" } },
    ],
  },
  {
    key: "snowboarding",
    name: "Snowboarding",
    description: "Track mountain days with run count and time on snow.",
    sessionSubtype: "SNOWBOARDING",
    sortOrder: 50,
    metadataSlugs: snowboardingTemplateMetadata,
    metrics: [
      { key: "mountain_name", label: "Mountain / Location", valueType: "TEXT", sortOrder: 10, showInGoals: false },
      { key: "runs_completed", label: "Runs Completed", valueType: "INTEGER", sortOrder: 20, unit: "runs", showInProgress: true, showInGoals: true },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 30, showInGoals: false, config: { input: "textarea" } },
    ],
  },
  {
    key: "basketball-pickup",
    name: "Basketball Pickup",
    description: "Track pickup runs with court details, games, wins, and scoring.",
    sessionSubtype: "BASKETBALL",
    sortOrder: 60,
    metadataSlugs: basketballPickupTemplateMetadata,
    metrics: [
      { key: "court_name", label: "Court / Place", valueType: "TEXT", sortOrder: 10, showInGoals: false },
      { key: "games_played", label: "Games Played", valueType: "INTEGER", sortOrder: 20, unit: "games", showInProgress: true, showInGoals: true },
      { key: "wins", label: "Wins", valueType: "INTEGER", sortOrder: 30, unit: "wins", showInProgress: true, showInGoals: true },
      { key: "points_scored", label: "Points Scored", valueType: "INTEGER", sortOrder: 40, unit: "pts", showInProgress: true, showInGoals: true },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 50, showInGoals: false, config: { input: "textarea" } },
    ],
  },
  {
    key: "basketball-shooting",
    name: "Basketball Shooting",
    description: "Track shootarounds with court details and shot volume.",
    sessionSubtype: "BASKETBALL",
    sortOrder: 61,
    metadataSlugs: basketballShootingTemplateMetadata,
    metrics: [
      { key: "court_name", label: "Court / Place", valueType: "TEXT", sortOrder: 10, showInGoals: false },
      { key: "shots_made", label: "Shots Made", valueType: "INTEGER", sortOrder: 20, unit: "shots", showInProgress: true, showInGoals: true },
      { key: "shots_attempted", label: "Shots Attempted", valueType: "INTEGER", sortOrder: 30, unit: "shots", showInProgress: true, showInGoals: true },
      { key: "three_pt_made", label: "3PT Made", valueType: "INTEGER", sortOrder: 40, unit: "threes", showInProgress: true, showInGoals: true },
      { key: "free_throws_made", label: "Free Throws Made", valueType: "INTEGER", sortOrder: 50, unit: "fts", showInProgress: true, showInGoals: true },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 60, showInGoals: false, config: { input: "textarea" } },
    ],
  },
  {
    key: "golf",
    name: "Golf",
    description: "Track rounds with course details, holes played, total score, and score to par.",
    sessionSubtype: "GOLF",
    sortOrder: 70,
    metadataSlugs: golfTemplateMetadata,
    metrics: [
      { key: "course_name", label: "Course / Place", valueType: "TEXT", sortOrder: 10, showInGoals: false },
      { key: "holes_played", label: "Holes Played", valueType: "INTEGER", sortOrder: 20, unit: "holes", showInProgress: true, showInGoals: true },
      { key: "total_score", label: "Total Score", valueType: "INTEGER", sortOrder: 30, unit: "strokes", showInProgress: true, showInGoals: false },
      { key: "score_to_par", label: "Score to Par", valueType: "INTEGER", sortOrder: 40, unit: "to par", showInProgress: true, showInGoals: false },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 50, showInGoals: false, config: { input: "textarea" } },
    ],
  },
];

const fingerPullExercises = [
  "Crimp",
  "Half Crimp",
  "Open Hand",
  "3 Finger Drag",
  "2 Finger Drag (Front Two)",
  "2 Finger Drag (Middle Two)",
  "1 Finger Drag",
  "3 Finger Crimp",
  "2 Finger Crimp",
  "1 Finger Crimp",
].map((name) => ({
  name: `${name} Pull`,
  unit: "REPS",
  supportsWeight: true,
  metadata: ["fingers", "forearms", "pull", "strength"],
}));

const fingerTimedPullExercises = [
  "Crimp",
  "Half Crimp",
  "Open Hand",
  "3 Finger Drag",
  "2 Finger Drag (Front Two)",
  "2 Finger Drag (Middle Two)",
  "1 Finger Drag",
  "3 Finger Crimp",
  "2 Finger Crimp",
  "1 Finger Crimp",
].map((name) => ({
  name: `${name} Pull (Time)`,
  unit: "TIME",
  supportsWeight: true,
  metadata: ["fingers", "forearms", "pull", "strength"],
}));

const fingerHangExercises = [
  "Crimp",
  "Half Crimp",
  "Open Hand",
  "3 Finger Drag",
  "2 Finger Drag (Front Two)",
  "2 Finger Drag (Middle Two)",
  "1 Finger Drag",
  "3 Finger Crimp",
  "2 Finger Crimp",
  "1 Finger Crimp",
].map((name) => ({
  name: `${name} Hang`,
  unit: "TIME",
  supportsWeight: true,
  metadata: ["fingers", "forearms", "pull", "strength", "isometric"],
}));

const starterExercises = [
  { name: "Back Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "squat"] },
  { name: "Front Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "core", "legs", "lower-body", "squat"] },
  { name: "Goblet Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "core", "legs", "lower-body", "squat"] },
  { name: "Zercher Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "core", "upper-body", "lower-body", "squat"] },
  { name: "Hack Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "squat"] },
  { name: "Deadlift", unit: "REPS", supportsWeight: true, metadata: ["hamstrings", "glutes", "back", "legs", "lower-body", "hinge"] },
  { name: "Romanian Deadlift", unit: "REPS", supportsWeight: true, metadata: ["hamstrings", "glutes", "legs", "lower-body", "hinge"] },
  { name: "Single-Leg Romanian Deadlift", unit: "REPS", supportsWeight: true, metadata: ["hamstrings", "glutes", "legs", "lower-body", "hinge"] },
  { name: "Good Morning", unit: "REPS", supportsWeight: true, metadata: ["hamstrings", "glutes", "back", "legs", "lower-body", "hinge"] },
  { name: "Hip Thrust", unit: "REPS", supportsWeight: true, metadata: ["glutes", "hamstrings", "legs", "lower-body", "hinge"] },
  { name: "Barbell Hip Thrust", unit: "REPS", supportsWeight: true, metadata: ["glutes", "hamstrings", "legs", "lower-body", "hinge"] },
  { name: "Kettlebell Swing", unit: "REPS", supportsWeight: true, metadata: ["glutes", "hamstrings", "core", "legs", "lower-body", "hinge"] },
  { name: "Cable Pull-Through", unit: "REPS", supportsWeight: true, metadata: ["glutes", "hamstrings", "legs", "lower-body", "hinge"] },
  { name: "Bench Press", unit: "REPS", supportsWeight: true, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Incline Bench Press", unit: "REPS", supportsWeight: true, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Dumbbell Bench Press", unit: "REPS", supportsWeight: true, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Incline Dumbbell Bench Press", unit: "REPS", supportsWeight: true, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Machine Chest Press", unit: "REPS", supportsWeight: true, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Cable Fly", unit: "REPS", supportsWeight: true, metadata: ["chest", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Dumbbell Fly", unit: "REPS", supportsWeight: true, metadata: ["chest", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Overhead Press", unit: "REPS", supportsWeight: true, metadata: ["shoulders", "triceps", "push", "upper-body", "vertical-push"] },
  { name: "Dumbbell Overhead Press", unit: "REPS", supportsWeight: true, metadata: ["shoulders", "triceps", "push", "upper-body", "vertical-push"] },
  { name: "Arnold Press", unit: "REPS", supportsWeight: true, metadata: ["shoulders", "triceps", "push", "upper-body", "vertical-push"] },
  { name: "Pike Push-Up", unit: "REPS", supportsWeight: false, metadata: ["shoulders", "triceps", "push", "upper-body", "vertical-push"] },
  { name: "Handstand Push-Up", unit: "REPS", supportsWeight: false, metadata: ["shoulders", "triceps", "push", "upper-body", "vertical-push"] },
  { name: "Barbell Row", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "horizontal-pull"] },
  { name: "Dumbbell Row", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "horizontal-pull"] },
  { name: "Single-Arm Dumbbell Row", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "horizontal-pull"] },
  { name: "Chest-Supported Row", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "horizontal-pull"] },
  { name: "T-Bar Row", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "horizontal-pull"] },
  { name: "Inverted Row", unit: "REPS", supportsWeight: false, metadata: ["back", "biceps", "pull", "upper-body", "horizontal-pull"] },
  { name: "Pull-Up", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "vertical-pull"] },
  { name: "Chin-Up", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "vertical-pull"] },
  { name: "Assisted Pull-Up", unit: "REPS", supportsWeight: false, metadata: ["back", "biceps", "pull", "upper-body", "vertical-pull"] },
  { name: "Lat Pulldown", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "vertical-pull"] },
  { name: "Seated Cable Row", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "horizontal-pull"] },
  { name: "Face Pull", unit: "REPS", supportsWeight: true, metadata: ["back", "shoulders", "pull", "upper-body", "horizontal-pull"] },
  { name: "Straight-Arm Pulldown", unit: "REPS", supportsWeight: true, metadata: ["back", "pull", "upper-body", "vertical-pull"] },
  { name: "Dip", unit: "REPS", supportsWeight: true, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "vertical-push"] },
  { name: "Push-Up", unit: "REPS", supportsWeight: false, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Decline Push-Up", unit: "REPS", supportsWeight: false, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Ring Push-Up", unit: "REPS", supportsWeight: false, metadata: ["chest", "triceps", "shoulders", "core", "push", "upper-body", "horizontal-push"] },
  { name: "Lunge", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "lunge"] },
  { name: "Reverse Lunge", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "lunge"] },
  { name: "Walking Lunge", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "lunge"] },
  { name: "Split Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "lunge"] },
  { name: "Dumbbell Lunge", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "lunge"] },
  { name: "Step-Up", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "lunge"] },
  { name: "Dumbbell Step-Up", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "lunge"] },
  { name: "Barbell Step-Up", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "lunge"] },
  { name: "Bulgarian Split Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "lunge"] },
  { name: "Dumbbell Bulgarian Split Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "lunge"] },
  { name: "Single-Leg Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "squat"] },
  { name: "Cossack Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "squat"] },
  { name: "Goblet Cossack Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "squat"] },
  { name: "Goku Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "squat"] },
  { name: "Leg Press", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "squat"] },
  { name: "Hamstring Curl", unit: "REPS", supportsWeight: true, metadata: ["hamstrings", "legs", "lower-body"] },
  { name: "Nordic Curl", unit: "REPS", supportsWeight: false, metadata: ["hamstrings", "legs", "lower-body"] },
  { name: "Yoga Ball Hamstring Curl", unit: "REPS", supportsWeight: false, metadata: ["hamstrings", "legs", "lower-body"] },
  { name: "Glute Bridge", unit: "REPS", supportsWeight: true, metadata: ["glutes", "hamstrings", "legs", "lower-body", "hinge"] },
  { name: "Single-Leg Bridge", unit: "REPS", supportsWeight: true, metadata: ["glutes", "hamstrings", "legs", "lower-body", "hinge"] },
  { name: "Hip Abduction", unit: "REPS", supportsWeight: true, metadata: ["glutes", "abductors", "legs", "lower-body"] },
  { name: "Hip Adduction", unit: "REPS", supportsWeight: true, metadata: ["adductors", "legs", "lower-body"] },
  { name: "Neural Glide", unit: "TIME", supportsWeight: false, metadata: ["mobility"] },
  { name: "Couch Stretch", unit: "TIME", supportsWeight: false, metadata: ["quads", "hip-flexors", "mobility"] },
  { name: "Forward Fold", unit: "TIME", supportsWeight: false, metadata: ["hamstrings", "hinge", "mobility", "recovery"] },
  { name: "Seated Forward Fold", unit: "TIME", supportsWeight: false, metadata: ["hamstrings", "calves", "hinge", "mobility", "recovery"] },
  { name: "Downward Dog", unit: "TIME", supportsWeight: false, metadata: ["hamstrings", "calves", "shoulders", "mobility", "recovery"] },
  { name: "Pigeon Stretch", unit: "TIME", supportsWeight: false, metadata: ["glutes", "hip-flexors", "mobility", "recovery"] },
  { name: "Figure Four Stretch", unit: "TIME", supportsWeight: false, metadata: ["glutes", "mobility", "recovery"] },
  { name: "Butterfly Stretch", unit: "TIME", supportsWeight: false, metadata: ["adductors", "mobility", "recovery"] },
  { name: "Child's Pose", unit: "TIME", supportsWeight: false, metadata: ["mobility", "recovery"] },
  { name: "Standing Quad Stretch", unit: "TIME", supportsWeight: false, metadata: ["quads", "hip-flexors", "mobility", "recovery"] },
  { name: "Calf Stretch", unit: "TIME", supportsWeight: false, metadata: ["calves", "mobility", "recovery"] },
  { name: "Hip Flexor Stretch", unit: "TIME", supportsWeight: false, metadata: ["hip-flexors", "quads", "mobility", "recovery"] },
  { name: "Thoracic Rotation Stretch", unit: "TIME", supportsWeight: false, metadata: ["rotation", "mobility", "recovery"] },
  { name: "Box Breathing", unit: "TIME", supportsWeight: false, metadata: ["breathwork", "recovery", "skill-practice"] },
  { name: "4-7-8 Breathing", unit: "TIME", supportsWeight: false, metadata: ["breathwork", "recovery", "skill-practice"] },
  { name: "Nasal Breathing", unit: "TIME", supportsWeight: false, metadata: ["breathwork", "recovery", "skill-practice"] },
  { name: "Inhale Hold", unit: "TIME", supportsWeight: false, metadata: ["breathwork", "recovery", "skill-practice"] },
  { name: "Exhale Hold", unit: "TIME", supportsWeight: false, metadata: ["breathwork", "recovery", "skill-practice"] },
  { name: "Leg Extension", unit: "REPS", supportsWeight: true, metadata: ["quads", "legs", "lower-body"] },
  { name: "Calf Raise", unit: "REPS", supportsWeight: true, metadata: ["calves", "legs", "lower-body"] },
  { name: "Seated Calf Raise", unit: "REPS", supportsWeight: true, metadata: ["calves", "legs", "lower-body"] },
  { name: "Biceps Curl", unit: "REPS", supportsWeight: true, metadata: ["biceps", "pull", "upper-body"] },
  { name: "Dumbbell Biceps Curl", unit: "REPS", supportsWeight: true, metadata: ["biceps", "pull", "upper-body"] },
  { name: "Hammer Curl", unit: "REPS", supportsWeight: true, metadata: ["biceps", "forearms", "pull", "upper-body"] },
  { name: "Incline Dumbbell Curl", unit: "REPS", supportsWeight: true, metadata: ["biceps", "pull", "upper-body"] },
  { name: "Triceps Pressdown", unit: "REPS", supportsWeight: true, metadata: ["triceps", "push", "upper-body"] },
  { name: "Overhead Triceps Extension", unit: "REPS", supportsWeight: true, metadata: ["triceps", "push", "upper-body"] },
  { name: "Skull Crusher", unit: "REPS", supportsWeight: true, metadata: ["triceps", "push", "upper-body"] },
  { name: "Lateral Raise", unit: "REPS", supportsWeight: true, metadata: ["shoulders", "push", "upper-body"] },
  { name: "Dumbbell Lateral Raise", unit: "REPS", supportsWeight: true, metadata: ["shoulders", "push", "upper-body"] },
  { name: "Rear Delt Fly", unit: "REPS", supportsWeight: true, metadata: ["shoulders", "back", "pull", "upper-body"] },
  { name: "Dumbbell Romanian Deadlift", unit: "REPS", supportsWeight: true, metadata: ["hamstrings", "glutes", "legs", "lower-body", "hinge"] },
  { name: "Dumbbell Front Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "core", "legs", "lower-body", "squat"] },
  { name: "Plank", unit: "TIME", supportsWeight: false, metadata: ["core"] },
  { name: "Side Plank", unit: "TIME", supportsWeight: false, metadata: ["core"] },
  { name: "Hollow Hold", unit: "TIME", supportsWeight: false, metadata: ["core"] },
  { name: "Wall Sit", unit: "TIME", supportsWeight: false, metadata: ["quads", "glutes", "legs", "lower-body", "isometric"] },
  { name: "Isometric Squat", unit: "TIME", supportsWeight: false, metadata: ["quads", "glutes", "legs", "lower-body", "squat", "isometric"] },
  { name: "Isometric Lunge", unit: "TIME", supportsWeight: false, metadata: ["quads", "glutes", "legs", "lower-body", "lunge", "isometric"] },
  { name: "Isometric Split Squat", unit: "TIME", supportsWeight: false, metadata: ["quads", "glutes", "legs", "lower-body", "lunge", "isometric"] },
  { name: "Spanish Squat Hold", unit: "TIME", supportsWeight: false, metadata: ["quads", "legs", "lower-body", "squat", "isometric", "rehab"] },
  { name: "Isometric Hamstring Curl", unit: "TIME", supportsWeight: false, metadata: ["hamstrings", "legs", "lower-body", "hinge", "isometric"] },
  { name: "Hamstring Bridge Hold", unit: "TIME", supportsWeight: false, metadata: ["hamstrings", "glutes", "legs", "lower-body", "hinge", "isometric"] },
  { name: "Glute Bridge Hold", unit: "TIME", supportsWeight: false, metadata: ["glutes", "hamstrings", "legs", "lower-body", "hinge", "isometric"] },
  { name: "Single-Leg Glute Bridge Hold", unit: "TIME", supportsWeight: false, metadata: ["glutes", "hamstrings", "legs", "lower-body", "hinge", "isometric"] },
  { name: "Isometric Calf Raise Hold", unit: "TIME", supportsWeight: false, metadata: ["calves", "legs", "lower-body", "squat", "isometric"] },
  { name: "Side-Lying Leg Lift", unit: "REPS", supportsWeight: false, metadata: ["glutes", "abductors", "legs", "lower-body"] },
  { name: "Side-Lying Hip Abduction", unit: "REPS", supportsWeight: false, metadata: ["glutes", "abductors", "legs", "lower-body"] },
  { name: "Isometric Side-Lying Leg Lift", unit: "TIME", supportsWeight: false, metadata: ["glutes", "abductors", "legs", "lower-body", "isometric"] },
  { name: "Isometric Hip Abduction", unit: "TIME", supportsWeight: false, metadata: ["glutes", "abductors", "legs", "lower-body", "isometric"] },
  { name: "Isometric Hip Adduction", unit: "TIME", supportsWeight: false, metadata: ["adductors", "legs", "lower-body", "isometric"] },
  { name: "Dead Hang", unit: "TIME", supportsWeight: false, metadata: ["back", "forearms", "fingers", "pull", "upper-body", "isometric"] },
  { name: "Active Hang", unit: "TIME", supportsWeight: false, metadata: ["back", "shoulders", "forearms", "fingers", "pull", "upper-body", "isometric"] },
  ...fingerPullExercises,
  ...fingerTimedPullExercises,
  ...fingerHangExercises,
  { name: "Flexed-Arm Hang", unit: "TIME", supportsWeight: false, metadata: ["back", "biceps", "forearms", "pull", "upper-body", "vertical-pull", "isometric"] },
  { name: "Support Hold", unit: "TIME", supportsWeight: false, metadata: ["chest", "shoulders", "triceps", "core", "push", "upper-body", "isometric"] },
  { name: "Ring Support Hold", unit: "TIME", supportsWeight: false, metadata: ["chest", "shoulders", "triceps", "core", "push", "upper-body", "isometric"] },
  { name: "Handstand Hold", unit: "TIME", supportsWeight: false, metadata: ["shoulders", "triceps", "core", "push", "upper-body", "vertical-push", "isometric"] },
  { name: "L-Sit", unit: "TIME", supportsWeight: false, metadata: ["core", "hip-flexors", "isometric"] },
  { name: "Copenhagen Plank", unit: "TIME", supportsWeight: false, metadata: ["core", "adductors", "legs", "lower-body", "isometric", "anti-lateral-flexion"] },
  { name: "Pallof Press Hold", unit: "TIME", supportsWeight: false, metadata: ["core", "isometric", "anti-rotation"] },
  { name: "Farmer Carry", unit: "TIME", supportsWeight: true, metadata: ["core", "forearms", "upper-body", "lower-body", "carry"] },
  { name: "Suitcase Carry", unit: "TIME", supportsWeight: true, metadata: ["core", "forearms", "upper-body", "lower-body", "carry", "anti-lateral-flexion"] },
  { name: "Overhead Carry", unit: "TIME", supportsWeight: true, metadata: ["shoulders", "core", "upper-body", "lower-body", "carry", "isometric"] },
  { name: "Waiter Carry", unit: "TIME", supportsWeight: true, metadata: ["shoulders", "core", "upper-body", "carry", "isometric"] },
  { name: "Dead Bug", unit: "REPS", supportsWeight: false, metadata: ["core", "anti-extension"] },
  { name: "Bird Dog", unit: "REPS", supportsWeight: false, metadata: ["core", "glutes", "anti-rotation"] },
  { name: "Pallof Press", unit: "REPS", supportsWeight: true, metadata: ["core", "anti-rotation"] },
  { name: "Ab Wheel Rollout", unit: "REPS", supportsWeight: false, metadata: ["core", "anti-extension"] },
  { name: "Hanging Knee Raise", unit: "REPS", supportsWeight: false, metadata: ["core", "hip-flexors", "upper-body"] },
  { name: "Hanging Leg Raise", unit: "REPS", supportsWeight: false, metadata: ["core", "hip-flexors", "upper-body"] },
];

async function seedMetadataGroups() {
  for (const group of metadataGroups) {
    await prisma.metadataGroup.upsert({
      where: { slug: group.slug },
      update: {
        label: group.label,
        kind: group.kind,
        appliesToExercise: group.appliesToExercise,
        appliesToRoutine: group.appliesToRoutine,
      },
      create: {
        slug: group.slug,
        label: group.label,
        kind: group.kind,
        appliesToExercise: group.appliesToExercise,
        appliesToRoutine: group.appliesToRoutine,
      },
    });
  }

  const groupMap = new Map(
    (await prisma.metadataGroup.findMany({ select: { id: true, slug: true } })).map((group) => [group.slug, group.id])
  );

  for (const group of metadataGroups) {
    for (const parentSlug of group.parentSlugs ?? []) {
      const parentGroupId = groupMap.get(parentSlug);
      const childGroupId = groupMap.get(group.slug);
      if (!parentGroupId || !childGroupId) continue;

      await prisma.metadataGroupRelation.upsert({
        where: {
          parentGroupId_childGroupId: {
            parentGroupId,
            childGroupId,
          },
        },
        update: {},
        create: {
          parentGroupId,
          childGroupId,
        },
      });
    }
  }

  return groupMap;
}

async function seedExercises(groupMap) {
  for (const exercise of starterExercises) {
    const record = await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: {
        unit: exercise.unit,
        supportsWeight: exercise.supportsWeight,
        libraryKind: deriveExerciseLibraryKind(exercise),
      },
      create: {
        name: exercise.name,
        unit: exercise.unit,
        supportsWeight: exercise.supportsWeight,
        libraryKind: deriveExerciseLibraryKind(exercise),
      },
      select: { id: true },
    });

    const groupIds = exercise.metadata.map((slug) => groupMap.get(slug)).filter(Boolean);
    await prisma.exerciseMetadataGroup.deleteMany({ where: { exerciseId: record.id } });
    if (groupIds.length > 0) {
      await prisma.exerciseMetadataGroup.createMany({
        data: groupIds.map((groupId) => ({
          exerciseId: record.id,
          groupId,
        })),
        skipDuplicates: true,
      });
    }
  }
}

async function seedStimulusCategories() {
  for (const category of stimulusCategories) {
    await prisma.stimulusCategory.upsert({
      where: { slug: category.slug },
      update: {
        label: category.label,
        sortOrder: category.sortOrder,
      },
      create: category,
    });
  }

  return new Map(
    (await prisma.stimulusCategory.findMany({ select: { id: true, slug: true } })).map((category) => [category.slug, category.id])
  );
}

async function seedMetadataStimulusMappings(groupMap, stimulusMap) {
  for (const mapping of metadataStimulusMappings) {
    const metadataGroupId = groupMap.get(mapping.metadataGroupSlug);
    const stimulusCategoryId = stimulusMap.get(mapping.stimulusSlug);
    if (!metadataGroupId || !stimulusCategoryId) continue;

    await prisma.metadataStimulusMapping.upsert({
      where: {
        metadataGroupId_stimulusCategoryId: {
          metadataGroupId,
          stimulusCategoryId,
        },
      },
      update: {
        loadWeight: mapping.loadWeight,
        stretchWeight: mapping.stretchWeight,
      },
      create: {
        metadataGroupId,
        stimulusCategoryId,
        loadWeight: mapping.loadWeight,
        stretchWeight: mapping.stretchWeight,
      },
    });
  }
}

async function seedSessionTemplates(groupMap) {
  for (const template of sessionTemplates) {
    const templateRecord = await prisma.sessionTemplate.upsert({
      where: { key: template.key },
      update: {
        name: template.name,
        description: template.description,
        sessionSubtype: template.sessionSubtype,
        isSystem: true,
        sortOrder: template.sortOrder,
      },
      create: {
        key: template.key,
        name: template.name,
        description: template.description,
        sessionSubtype: template.sessionSubtype,
        isSystem: true,
        sortOrder: template.sortOrder,
      },
      select: { id: true },
    });

    await prisma.sessionMetricDefinition.deleteMany({
      where: {
        templateId: templateRecord.id,
        key: { notIn: template.metrics.map((metric) => metric.key) },
      },
    });

    for (const metric of template.metrics) {
      await prisma.sessionMetricDefinition.upsert({
        where: {
          templateId_key: {
            templateId: templateRecord.id,
            key: metric.key,
          },
        },
        update: {
          label: metric.label,
          valueType: metric.valueType,
          unit: metric.unit ?? null,
          sortOrder: metric.sortOrder,
          isRequired: Boolean(metric.isRequired),
          showInProgress: Boolean(metric.showInProgress),
          showInGoals: Boolean(metric.showInGoals),
          config: metric.config ?? undefined,
        },
        create: {
          templateId: templateRecord.id,
          key: metric.key,
          label: metric.label,
          valueType: metric.valueType,
          unit: metric.unit ?? null,
          sortOrder: metric.sortOrder,
          isRequired: Boolean(metric.isRequired),
          showInProgress: Boolean(metric.showInProgress),
          showInGoals: Boolean(metric.showInGoals),
          config: metric.config ?? undefined,
        },
      });
    }

    const groupIds = template.metadataSlugs.map((slug) => groupMap.get(slug)).filter(Boolean);
    await prisma.sessionTemplateMetadataGroup.deleteMany({ where: { templateId: templateRecord.id } });
    if (groupIds.length > 0) {
      await prisma.sessionTemplateMetadataGroup.createMany({
        data: groupIds.map((groupId) => ({
          templateId: templateRecord.id,
          groupId,
        })),
        skipDuplicates: true,
      });
    }
  }
}

async function main() {
  const groupMap = await seedMetadataGroups();
  const stimulusMap = await seedStimulusCategories();
  await seedExercises(groupMap);
  await seedSessionTemplates(groupMap);
  await seedMetadataStimulusMappings(groupMap, stimulusMap);

  console.log(`Seeded ${metadataGroups.length} metadata groups, ${stimulusCategories.length} stimulus categories, ${starterExercises.length} starter exercises, and ${sessionTemplates.length} session templates.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
