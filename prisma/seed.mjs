import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const starterExercises = [
  { name: "Back Squat", unit: "REPS", supportsWeight: true },
  { name: "Front Squat", unit: "REPS", supportsWeight: true },
  { name: "Deadlift", unit: "REPS", supportsWeight: true },
  { name: "Romanian Deadlift", unit: "REPS", supportsWeight: true },
  { name: "Single-Leg Romanian Deadlift", unit: "REPS", supportsWeight: true },
  { name: "Bench Press", unit: "REPS", supportsWeight: true },
  { name: "Dumbbell Bench Press", unit: "REPS", supportsWeight: true },
  { name: "Incline Dumbbell Bench Press", unit: "REPS", supportsWeight: true },
  { name: "Overhead Press", unit: "REPS", supportsWeight: true },
  { name: "Dumbbell Overhead Press", unit: "REPS", supportsWeight: true },
  { name: "Barbell Row", unit: "REPS", supportsWeight: true },
  { name: "Dumbbell Row", unit: "REPS", supportsWeight: true },
  { name: "Single-Arm Dumbbell Row", unit: "REPS", supportsWeight: true },
  { name: "Pull-Up", unit: "REPS", supportsWeight: true },
  { name: "Chin-Up", unit: "REPS", supportsWeight: true },
  { name: "Lat Pulldown", unit: "REPS", supportsWeight: true },
  { name: "Seated Cable Row", unit: "REPS", supportsWeight: true },
  { name: "Dip", unit: "REPS", supportsWeight: true },
  { name: "Push-Up", unit: "REPS", supportsWeight: false },
  { name: "Lunge", unit: "REPS", supportsWeight: true },
  { name: "Dumbbell Lunge", unit: "REPS", supportsWeight: true },
  { name: "Step-Up", unit: "REPS", supportsWeight: true },
  { name: "Dumbbell Step-Up", unit: "REPS", supportsWeight: true },
  { name: "Barbell Step-Up", unit: "REPS", supportsWeight: true },
  { name: "Bulgarian Split Squat", unit: "REPS", supportsWeight: true },
  { name: "Dumbbell Bulgarian Split Squat", unit: "REPS", supportsWeight: true },
  { name: "Single-Leg Squat", unit: "REPS", supportsWeight: true },
  { name: "Cossack Squat", unit: "REPS", supportsWeight: true },
  { name: "Goblet Cossack Squat", unit: "REPS", supportsWeight: true },
  { name: "Goku Squat", unit: "REPS", supportsWeight: true },
  { name: "Leg Press", unit: "REPS", supportsWeight: true },
  { name: "Hamstring Curl", unit: "REPS", supportsWeight: true },
  { name: "Yoga Ball Hamstring Curl", unit: "REPS", supportsWeight: false },
  { name: "Glute Bridge", unit: "REPS", supportsWeight: true },
  { name: "Single-Leg Bridge", unit: "REPS", supportsWeight: true },
  { name: "Neural Glide", unit: "TIME", supportsWeight: false },
  { name: "Leg Extension", unit: "REPS", supportsWeight: true },
  { name: "Calf Raise", unit: "REPS", supportsWeight: true },
  { name: "Biceps Curl", unit: "REPS", supportsWeight: true },
  { name: "Dumbbell Biceps Curl", unit: "REPS", supportsWeight: true },
  { name: "Triceps Pressdown", unit: "REPS", supportsWeight: true },
  { name: "Lateral Raise", unit: "REPS", supportsWeight: true },
  { name: "Dumbbell Lateral Raise", unit: "REPS", supportsWeight: true },
  { name: "Dumbbell Romanian Deadlift", unit: "REPS", supportsWeight: true },
  { name: "Dumbbell Front Squat", unit: "REPS", supportsWeight: true },
  { name: "Plank", unit: "TIME", supportsWeight: false },
  { name: "Side Plank", unit: "TIME", supportsWeight: false },
  { name: "Hollow Hold", unit: "TIME", supportsWeight: false },
];

async function main() {
  for (const exercise of starterExercises) {
    await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: {
        unit: exercise.unit,
        supportsWeight: exercise.supportsWeight,
      },
      create: exercise,
    });
  }

  console.log(`Seeded ${starterExercises.length} starter exercises.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
