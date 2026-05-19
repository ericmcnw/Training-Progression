-- Routine: placeholder flag for auto-created quick-log hosts (one per
-- (domain, subtype) combo). Existing rows default to false.
ALTER TABLE "Routine"
  ADD COLUMN "isPlaceholder" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Routine_isPlaceholder_idx" ON "Routine"("isPlaceholder");

-- Backfill: any existing "quick-workout-log" sentinel-domain routines become
-- placeholders so the new filter hides them from /routines and goal pickers.
UPDATE "Routine"
SET "isPlaceholder" = true
WHERE "domain" = 'quick-workout-log';

-- FrequencyGoal: optional trigger-subtype list. Postgres TEXT[] keeps the
-- match cheap (no extra join) since subtypes are short strings selected from
-- a fixed enum-like vocabulary (STRENGTH, HYPERTROPHY, CLIMBING, ...).
ALTER TABLE "FrequencyGoal"
  ADD COLUMN "triggerSubtypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- FrequencyGoalTriggerExercise: join table for "also count when this exercise
-- appears" — mirrors FrequencyGoalRoutine in shape but keyed on exercise.
CREATE TABLE "FrequencyGoalTriggerExercise" (
  "goalId"     TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "addedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FrequencyGoalTriggerExercise_pkey" PRIMARY KEY ("goalId", "exerciseId")
);

CREATE INDEX "FrequencyGoalTriggerExercise_exerciseId_idx"
  ON "FrequencyGoalTriggerExercise"("exerciseId");

ALTER TABLE "FrequencyGoalTriggerExercise"
  ADD CONSTRAINT "FrequencyGoalTriggerExercise_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "FrequencyGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FrequencyGoalTriggerExercise"
  ADD CONSTRAINT "FrequencyGoalTriggerExercise_exerciseId_fkey"
  FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
