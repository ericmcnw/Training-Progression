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
  { slug: "core", label: "Core", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["upper-body", "lower-body"] },
  { slug: "push", label: "Push", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true, parentSlugs: ["upper-body"] },
  { slug: "pull", label: "Pull", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true, parentSlugs: ["upper-body"] },
  { slug: "legs", label: "Legs", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true, parentSlugs: ["lower-body"] },
  { slug: "upper-body", label: "Upper Body", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },
  { slug: "lower-body", label: "Lower Body", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },
  { slug: "full-body", label: "Full Body", kind: "TRAINING_GROUP", appliesToExercise: true, appliesToRoutine: true },
  { slug: "endurance", label: "Endurance", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true },
  { slug: "outdoor", label: "Outdoor", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true },
  { slug: "board-sports", label: "Board Sports", kind: "TRAINING_GROUP", appliesToExercise: false, appliesToRoutine: true },
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
  { slug: "climbing", label: "Climbing", kind: "CARDIO_ACTIVITY", appliesToExercise: false, appliesToRoutine: true },
  { slug: "strength", label: "Strength", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
  { slug: "hypertrophy", label: "Hypertrophy", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
  { slug: "rehab", label: "Rehab", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
  { slug: "skill-practice", label: "Skill Practice", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
  { slug: "recovery", label: "Recovery", kind: "ROUTINE_FOCUS", appliesToExercise: false, appliesToRoutine: true },
];

const boulderingGrades = ["V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10"];
const yosemiteGrades = ["5.6", "5.7", "5.8", "5.9", "5.10a", "5.10b", "5.10c", "5.10d", "5.11a", "5.11b", "5.11c", "5.11d", "5.12a", "5.12b", "5.12c", "5.12d", "5.13a", "5.13b", "5.13c", "5.13d"];

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
    metadataSlugs: ["climbing", "pull", "fingers", "skill-practice"],
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
    metadataSlugs: ["climbing", "pull", "fingers", "skill-practice"],
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
    metadataSlugs: ["climbing", "pull", "fingers", "skill-practice"],
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
    metadataSlugs: ["climbing", "pull", "fingers", "skill-practice", "outdoor"],
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
    metadataSlugs: ["climbing", "pull", "fingers", "skill-practice", "outdoor"],
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
    metadataSlugs: ["climbing", "pull", "fingers", "skill-practice", "outdoor"],
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
    metadataSlugs: ["hiking", "cardio", "endurance", "outdoor", "legs"],
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
    metadataSlugs: ["board-sports", "outdoor", "skill-practice", "upper-body", "full-body"],
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
    metadataSlugs: ["board-sports", "outdoor", "legs", "skill-practice"],
    metrics: [
      { key: "mountain_name", label: "Mountain / Location", valueType: "TEXT", sortOrder: 10, showInGoals: false },
      { key: "runs_completed", label: "Runs Completed", valueType: "INTEGER", sortOrder: 20, unit: "runs", showInProgress: true, showInGoals: true },
      { key: "template_notes", label: "Session Notes", valueType: "TEXT", sortOrder: 30, showInGoals: false, config: { input: "textarea" } },
    ],
  },
];

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
  { name: "Glute Bridge Hold", unit: "TIME", supportsWeight: false, metadata: ["glutes", "hamstrings", "legs", "lower-body", "hinge", "isometric"] },
  { name: "Dead Hang", unit: "TIME", supportsWeight: false, metadata: ["back", "forearms", "fingers", "pull", "upper-body", "isometric"] },
  { name: "Active Hang", unit: "TIME", supportsWeight: false, metadata: ["back", "shoulders", "forearms", "fingers", "pull", "upper-body", "isometric"] },
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
      },
      create: {
        name: exercise.name,
        unit: exercise.unit,
        supportsWeight: exercise.supportsWeight,
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
  await seedExercises(groupMap);
  await seedSessionTemplates(groupMap);

  console.log(`Seeded ${metadataGroups.length} metadata groups, ${starterExercises.length} starter exercises, and ${sessionTemplates.length} session templates.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
