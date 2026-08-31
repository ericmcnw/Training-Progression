-- Goal absorbs what ProgramAssessment was built to provide: a measured
-- history, a direction, non-numeric targets, and a retest cadence. The
-- parallel tables are dropped rather than migrated because both were empty
-- when this migration was applied to the production database.

CREATE TYPE "GoalDirection" AS ENUM ('HIGHER', 'LOWER', 'HOLD', 'TRACK_ONLY');
CREATE TYPE "GoalCheckpointMode" AS ENUM ('WHEN_LOGGED', 'INTERVAL', 'DATES');
CREATE TYPE "GoalCheckpointSource" AS ENUM ('MANUAL', 'ROUTINE_LOG', 'BODY_MEASUREMENT', 'PAIN_LOG', 'CLIMB_ATTEMPT', 'DERIVED');

ALTER TABLE "Goal"
  ALTER COLUMN "targetValue" DROP NOT NULL,
  ADD COLUMN "targetText" TEXT,
  ADD COLUMN "metricKey" TEXT,
  ADD COLUMN "direction" "GoalDirection" NOT NULL DEFAULT 'HIGHER',
  ADD COLUMN "checkpointMode" "GoalCheckpointMode" NOT NULL DEFAULT 'WHEN_LOGGED',
  ADD COLUMN "checkpointIntervalWeeks" INTEGER,
  ADD COLUMN "checkpointDates" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Goal_metricKey_idx" ON "Goal"("metricKey");

CREATE TABLE "GoalCheckpoint" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "numberValue" DOUBLE PRECISION,
    "numerator" DOUBLE PRECISION,
    "denominator" DOUBLE PRECISION,
    "textValue" TEXT,
    "source" "GoalCheckpointSource" NOT NULL DEFAULT 'MANUAL',
    "sourceRefId" TEXT,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoalCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GoalCheckpoint_goalId_measuredAt_idx" ON "GoalCheckpoint"("goalId", "measuredAt");
CREATE INDEX "GoalCheckpoint_goalId_isBaseline_idx" ON "GoalCheckpoint"("goalId", "isBaseline");

ALTER TABLE "GoalCheckpoint" ADD CONSTRAINT "GoalCheckpoint_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "ProgramAssessmentResult";
DROP TABLE "ProgramAssessment";
DROP TYPE "ProgramAssessmentSource";
DROP TYPE "ProgramAssessmentDirection";
DROP TYPE "ProgramAssessmentMetricKind";
