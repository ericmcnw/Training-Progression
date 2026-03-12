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

async function main() {
  const groupMap = await seedMetadataGroups();
  await seedExercises(groupMap);

  console.log(`Seeded ${metadataGroups.length} metadata groups and ${starterExercises.length} starter exercises.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
