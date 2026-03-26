CREATE TYPE "RoutineFrequencyUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');

ALTER TABLE "Routine"
ADD COLUMN "targetFrequencyCount" INTEGER,
ADD COLUMN "targetFrequencyUnit" "RoutineFrequencyUnit",
ADD COLUMN "targetFrequencyInterval" INTEGER;

UPDATE "Routine"
SET
  "targetFrequencyCount" = "timesPerWeek",
  "targetFrequencyUnit" = 'WEEK',
  "targetFrequencyInterval" = 1
WHERE "timesPerWeek" IS NOT NULL;

CREATE INDEX "Routine_targetFrequencyUnit_targetFrequencyInterval_idx"
ON "Routine"("targetFrequencyUnit", "targetFrequencyInterval");
