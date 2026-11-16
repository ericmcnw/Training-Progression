// Routine packs — small sets of ready-made workout routines, exercises and
// set/rep prescriptions included. Exercise names must match the shared
// catalog exactly; a name that isn't found is skipped when the pack is added.

export type PackExercise = {
  name: string;
  sets: number;
  repsMin?: number;
  repsMax?: number;
  seconds?: number;
  cue?: string;
};

export type PackRoutine = {
  key: string;
  name: string;
  description?: string;
  domain: "strength" | "mobility" | "general";
  subtype: "STRENGTH" | "HYPERTROPHY" | "REHAB" | "OTHER";
  supportsSports?: string[];
  exercises: PackExercise[];
};

export type RoutinePack = {
  key: string;
  label: string;
  description: string;
  routines: PackRoutine[];
};

// The pack built from the catalog owner's own routines (see
// lib/routine-packs-data.ts). Loads are never copied, only the structure.
export const OWNER_PACK_KEY = "owner";
export const OWNER_PACK_ROUTINE_NAMES = ["Legs A", "Pull A", "Push B", "Upper", "Core", "Hangboard"];

const reps = (name: string, sets: number, repsMin: number, repsMax: number, cue?: string): PackExercise => ({
  name,
  sets,
  repsMin,
  repsMax,
  ...(cue ? { cue } : {}),
});
const hold = (name: string, sets: number, seconds: number, cue?: string): PackExercise => ({
  name,
  sets,
  seconds,
  ...(cue ? { cue } : {}),
});

export const ROUTINE_PACKS: RoutinePack[] = [
  {
    key: "starter",
    label: "Starter: intro to lifting",
    description: "Two full-body days to alternate, two or three times a week. Dumbbells and a cable machine are enough.",
    routines: [
      {
        key: "full-body-a",
        name: "Full Body A",
        description: "Start light. Add weight once every set reaches the top of its rep range.",
        domain: "strength",
        subtype: "STRENGTH",
        exercises: [
          reps("Goblet Squat", 3, 8, 12),
          reps("Dumbbell Bench Press", 3, 8, 12),
          reps("Single-Arm Dumbbell Row", 3, 8, 12),
          reps("Dumbbell Romanian Deadlift", 3, 8, 12),
          hold("Plank", 3, 30),
        ],
      },
      {
        key: "full-body-b",
        name: "Full Body B",
        description: "Start light. Add weight once every set reaches the top of its rep range.",
        domain: "strength",
        subtype: "STRENGTH",
        exercises: [
          reps("Reverse Lunge", 3, 8, 10),
          reps("Dumbbell Overhead Press", 3, 8, 12),
          reps("Lat Pulldown", 3, 8, 12),
          reps("Glute Bridge", 3, 10, 15),
          reps("Dead Bug", 3, 8, 10),
        ],
      },
    ],
  },
  {
    key: "ppl",
    label: "Push / Pull / Legs",
    description: "A three-day gym split for someone already comfortable with the main barbell lifts.",
    routines: [
      {
        key: "push",
        name: "Push",
        domain: "strength",
        subtype: "STRENGTH",
        exercises: [
          reps("Bench Press", 3, 5, 8),
          reps("Dumbbell Overhead Press", 3, 8, 10),
          reps("Incline Dumbbell Bench Press", 3, 8, 12),
          reps("Dumbbell Lateral Raise", 3, 12, 15),
          reps("Triceps Pressdown", 3, 10, 15),
        ],
      },
      {
        key: "pull",
        name: "Pull",
        domain: "strength",
        subtype: "STRENGTH",
        exercises: [
          reps("Pull-Up", 3, 5, 8),
          reps("Barbell Row", 3, 6, 10),
          reps("Seated Cable Row", 3, 8, 12),
          reps("Face Pull", 3, 12, 15),
          reps("Dumbbell Biceps Curl", 3, 10, 12),
        ],
      },
      {
        key: "legs",
        name: "Legs",
        domain: "strength",
        subtype: "STRENGTH",
        exercises: [
          reps("Back Squat", 3, 5, 8),
          reps("Romanian Deadlift", 3, 6, 10),
          reps("Bulgarian Split Squat", 3, 8, 10),
          reps("Hamstring Curl", 3, 10, 12),
          reps("Calf Raise", 3, 10, 15),
        ],
      },
    ],
  },
  {
    key: "running",
    label: "Get back to running",
    description: "Strength work that supports a return to running. General training, not a rehab plan. Log the runs themselves under Endurance.",
    routines: [
      {
        key: "runner-strength",
        name: "Runner Strength",
        description: "Twice a week, not the day before a hard run.",
        domain: "strength",
        subtype: "STRENGTH",
        exercises: [
          reps("Split Squat", 3, 8, 10),
          reps("Single-Leg Bridge", 3, 10, 12),
          reps("Step-Down", 3, 8, 10, "Slow on the way down"),
          reps("Single-Leg Calf Raise", 3, 10, 15),
          reps("Soleus Calf Raise", 3, 12, 15, "Knee bent"),
          reps("Tibialis Raise", 2, 15, 20),
          hold("Side Plank", 3, 30),
        ],
      },
      {
        key: "run-prep",
        name: "Run Prep",
        description: "Five minutes before a run.",
        domain: "mobility",
        subtype: "OTHER",
        exercises: [
          reps("Banded Monster Walk", 2, 10, 12),
          reps("Glute Bridge", 2, 12, 15),
          reps("Calf Raise", 2, 12, 15),
          reps("Hip Airplane", 2, 5, 6),
        ],
      },
    ],
  },
  {
    key: "plyo",
    label: "Plyometrics intro",
    description: "Two short jump sessions. Low volume on purpose: every rep should be crisp, with full rest between sets.",
    routines: [
      {
        key: "plyo-a",
        name: "Plyo A",
        description: "Two-leg jumps. Land quietly.",
        domain: "strength",
        subtype: "STRENGTH",
        exercises: [
          reps("Pogo Jump", 3, 15, 20),
          reps("Squat Jump", 3, 5, 6),
          reps("Box Jump", 3, 4, 5, "Step down, don't jump down"),
          reps("Broad Jump", 3, 3, 4),
          reps("Skater Jump", 3, 6, 8),
        ],
      },
      {
        key: "plyo-b",
        name: "Plyo B",
        description: "Single-leg and side-to-side. Add this once Plyo A feels easy.",
        domain: "strength",
        subtype: "STRENGTH",
        exercises: [
          reps("Ankle Hop", 3, 15, 20),
          reps("Countermovement Jump", 3, 4, 5),
          reps("Single-Leg Hop", 3, 6, 8),
          reps("Lateral Bound", 3, 5, 6),
          reps("Split Squat Jump", 3, 5, 6),
        ],
      },
    ],
  },
  {
    key: "climbing-strength",
    label: "Strength for climbing",
    description: "Pulling strength plus the pushing and shoulder work climbing skips. No finger training here: those loads are too individual to template.",
    routines: [
      {
        key: "climbing-pull",
        name: "Climbing Pull",
        domain: "strength",
        subtype: "STRENGTH",
        supportsSports: ["climbing"],
        exercises: [
          reps("Pull-Up", 4, 4, 6),
          reps("Scapular Pull-Up", 3, 8, 10),
          reps("Inverted Row", 3, 8, 12),
          hold("Lock-offs", 3, 8),
          reps("Hanging Knee Raise", 3, 8, 12),
          hold("Dead Hang", 3, 25),
        ],
      },
      {
        key: "climbing-antagonist",
        name: "Climbing Antagonist",
        domain: "strength",
        subtype: "STRENGTH",
        supportsSports: ["climbing"],
        exercises: [
          reps("Push-Up", 3, 8, 15),
          reps("Dumbbell Overhead Press", 3, 8, 10),
          reps("Band Shoulder External Rotation", 3, 12, 15),
          reps("Prone Y Raise", 2, 10, 12),
          reps("Reverse Wrist Curl", 3, 12, 15),
        ],
      },
    ],
  },
];
