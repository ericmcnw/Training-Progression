-- Minimum trigger-exercise set count required for a single log to claim a
-- session via the exercise-trigger path. Default 1 keeps existing goals'
-- behavior unchanged (any set counts). Larger values stop a single warmup
-- rep of a trigger exercise from claiming the goal's session.
ALTER TABLE "FrequencyGoal"
  ADD COLUMN "triggerMinSets" INTEGER NOT NULL DEFAULT 1;
