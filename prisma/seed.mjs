import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const metadataGroups = [
  { slug: "chest", label: "Chest", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "triceps", label: "Triceps", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "shoulders", label: "Shoulders", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["push", "upper-body"] },
  { slug: "back", label: "Back", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "biceps", label: "Biceps", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["pull", "upper-body"] },
  { slug: "quads", label: "Quads", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "hamstrings", label: "Hamstrings", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
  { slug: "glutes", label: "Glutes", kind: "MUSCLE_GROUP", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["legs", "lower-body"] },
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
  { slug: "rotation", label: "Rotation", kind: "MOVEMENT_PATTERN", appliesToExercise: true, appliesToRoutine: false, parentSlugs: ["core"] },
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
  { name: "Deadlift", unit: "REPS", supportsWeight: true, metadata: ["hamstrings", "glutes", "back", "legs", "lower-body", "hinge"] },
  { name: "Romanian Deadlift", unit: "REPS", supportsWeight: true, metadata: ["hamstrings", "glutes", "legs", "lower-body", "hinge"] },
  { name: "Single-Leg Romanian Deadlift", unit: "REPS", supportsWeight: true, metadata: ["hamstrings", "glutes", "legs", "lower-body", "hinge"] },
  { name: "Bench Press", unit: "REPS", supportsWeight: true, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Dumbbell Bench Press", unit: "REPS", supportsWeight: true, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Incline Dumbbell Bench Press", unit: "REPS", supportsWeight: true, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Overhead Press", unit: "REPS", supportsWeight: true, metadata: ["shoulders", "triceps", "push", "upper-body", "vertical-push"] },
  { name: "Dumbbell Overhead Press", unit: "REPS", supportsWeight: true, metadata: ["shoulders", "triceps", "push", "upper-body", "vertical-push"] },
  { name: "Barbell Row", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "horizontal-pull"] },
  { name: "Dumbbell Row", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "horizontal-pull"] },
  { name: "Single-Arm Dumbbell Row", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "horizontal-pull"] },
  { name: "Pull-Up", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "vertical-pull"] },
  { name: "Chin-Up", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "vertical-pull"] },
  { name: "Lat Pulldown", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "vertical-pull"] },
  { name: "Seated Cable Row", unit: "REPS", supportsWeight: true, metadata: ["back", "biceps", "pull", "upper-body", "horizontal-pull"] },
  { name: "Dip", unit: "REPS", supportsWeight: true, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "vertical-push"] },
  { name: "Push-Up", unit: "REPS", supportsWeight: false, metadata: ["chest", "triceps", "shoulders", "push", "upper-body", "horizontal-push"] },
  { name: "Lunge", unit: "REPS", supportsWeight: true, metadata: ["quads", "glutes", "legs", "lower-body", "lunge"] },
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
  { name: "Yoga Ball Hamstring Curl", unit: "REPS", supportsWeight: false, metadata: ["hamstrings", "legs", "lower-body"] },
  { name: "Glute Bridge", unit: "REPS", supportsWeight: true, metadata: ["glutes", "hamstrings", "legs", "lower-body", "hinge"] },
  { name: "Single-Leg Bridge", unit: "REPS", supportsWeight: true, metadata: ["glutes", "hamstrings", "legs", "lower-body", "hinge"] },
  { name: "Neural Glide", unit: "TIME", supportsWeight: false, metadata: ["mobility"] },
  { name: "Leg Extension", unit: "REPS", supportsWeight: true, metadata: ["quads", "legs", "lower-body"] },
  { name: "Calf Raise", unit: "REPS", supportsWeight: true, metadata: ["calves", "legs", "lower-body"] },
  { name: "Biceps Curl", unit: "REPS", supportsWeight: true, metadata: ["biceps", "pull", "upper-body"] },
  { name: "Dumbbell Biceps Curl", unit: "REPS", supportsWeight: true, metadata: ["biceps", "pull", "upper-body"] },
  { name: "Triceps Pressdown", unit: "REPS", supportsWeight: true, metadata: ["triceps", "push", "upper-body"] },
  { name: "Lateral Raise", unit: "REPS", supportsWeight: true, metadata: ["shoulders", "push", "upper-body"] },
  { name: "Dumbbell Lateral Raise", unit: "REPS", supportsWeight: true, metadata: ["shoulders", "push", "upper-body"] },
  { name: "Dumbbell Romanian Deadlift", unit: "REPS", supportsWeight: true, metadata: ["hamstrings", "glutes", "legs", "lower-body", "hinge"] },
  { name: "Dumbbell Front Squat", unit: "REPS", supportsWeight: true, metadata: ["quads", "core", "legs", "lower-body", "squat"] },
  { name: "Plank", unit: "TIME", supportsWeight: false, metadata: ["core"] },
  { name: "Side Plank", unit: "TIME", supportsWeight: false, metadata: ["core"] },
  { name: "Hollow Hold", unit: "TIME", supportsWeight: false, metadata: ["core"] },
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
