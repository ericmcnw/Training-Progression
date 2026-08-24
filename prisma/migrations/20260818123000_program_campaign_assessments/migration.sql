-- Additive Program campaign metadata, assessments, and planned sessions.
-- Existing logs and measurements are not altered.

CREATE TYPE "ProgramObjectiveKind" AS ENUM ('SPORT', 'STRENGTH', 'ENDURANCE', 'BODY_COMPOSITION', 'RECOVERY', 'GENERAL');
CREATE TYPE "ProgramTimelineMode" AS ENUM ('SEASON', 'DURATION', 'TARGET_DATE', 'REVIEW_DATE');
CREATE TYPE "ProgramAssessmentMetricKind" AS ENUM ('NUMBER', 'RATIO', 'DURATION', 'GRADE', 'PAIN', 'BODY_WEIGHT', 'BODY_FAT', 'WAIST', 'TEXT');
CREATE TYPE "ProgramAssessmentDirection" AS ENUM ('HIGHER', 'LOWER', 'TARGET', 'INFORMATIONAL');
CREATE TYPE "ProgramAssessmentSource" AS ENUM ('MANUAL', 'ROUTINE_LOG', 'BODY_MEASUREMENT', 'PAIN_LOG', 'CLIMB_ATTEMPT', 'DERIVED');
CREATE TYPE "PlannedSessionStatus" AS ENUM ('PLANNED', 'COMPLETED', 'SKIPPED');

ALTER TABLE "Focus" ADD COLUMN "continuedFromId" TEXT,
ADD COLUMN "endYmd" TEXT,
ADD COLUMN "objectiveKind" "ProgramObjectiveKind" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN "reviewYmd" TEXT,
ADD COLUMN "startYmd" TEXT,
ADD COLUMN "timelineMode" "ProgramTimelineMode" NOT NULL DEFAULT 'REVIEW_DATE';

ALTER TABLE "ProgressionMilestone" ADD COLUMN "stageId" TEXT;

CREATE TABLE "ProgramAssessment" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "stageId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metricKind" "ProgramAssessmentMetricKind" NOT NULL,
    "metricKey" TEXT,
    "unit" TEXT,
    "direction" "ProgramAssessmentDirection" NOT NULL DEFAULT 'INFORMATIONAL',
    "checkpointIntervalWeeks" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgramAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgramAssessmentResult" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "numberValue" DOUBLE PRECISION,
    "numerator" DOUBLE PRECISION,
    "denominator" DOUBLE PRECISION,
    "textValue" TEXT,
    "source" "ProgramAssessmentSource" NOT NULL DEFAULT 'MANUAL',
    "sourceRefId" TEXT,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgramAssessmentResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlannedSession" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "blockId" TEXT,
    "blockItemId" TEXT,
    "routineId" TEXT,
    "activityTypeId" TEXT,
    "sportSlug" TEXT,
    "label" TEXT NOT NULL,
    "originalYmd" TEXT NOT NULL,
    "currentYmd" TEXT NOT NULL,
    "status" "PlannedSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "completedLogId" TEXT,
    "reminderAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlannedSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgramAssessment_programId_sortOrder_idx" ON "ProgramAssessment"("programId", "sortOrder");
CREATE INDEX "ProgramAssessment_stageId_idx" ON "ProgramAssessment"("stageId");
CREATE INDEX "ProgramAssessmentResult_assessmentId_measuredAt_idx" ON "ProgramAssessmentResult"("assessmentId", "measuredAt");
CREATE INDEX "ProgramAssessmentResult_source_sourceRefId_idx" ON "ProgramAssessmentResult"("source", "sourceRefId");
CREATE UNIQUE INDEX "PlannedSession_completedLogId_key" ON "PlannedSession"("completedLogId");
CREATE INDEX "PlannedSession_programId_currentYmd_status_idx" ON "PlannedSession"("programId", "currentYmd", "status");
CREATE INDEX "PlannedSession_blockId_currentYmd_idx" ON "PlannedSession"("blockId", "currentYmd");
CREATE INDEX "PlannedSession_blockItemId_idx" ON "PlannedSession"("blockItemId");
CREATE INDEX "PlannedSession_routineId_currentYmd_idx" ON "PlannedSession"("routineId", "currentYmd");
CREATE INDEX "Focus_continuedFromId_idx" ON "Focus"("continuedFromId");
CREATE INDEX "Focus_pursuitKey_status_idx" ON "Focus"("pursuitKey", "status");
CREATE INDEX "ProgressionMilestone_stageId_sortOrder_idx" ON "ProgressionMilestone"("stageId", "sortOrder");

ALTER TABLE "Focus" ADD CONSTRAINT "Focus_continuedFromId_fkey" FOREIGN KEY ("continuedFromId") REFERENCES "Focus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgressionMilestone" ADD CONSTRAINT "ProgressionMilestone_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProgramStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgramAssessment" ADD CONSTRAINT "ProgramAssessment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Focus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramAssessment" ADD CONSTRAINT "ProgramAssessment_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProgramStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgramAssessmentResult" ADD CONSTRAINT "ProgramAssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ProgramAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Focus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProgramBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_blockItemId_fkey" FOREIGN KEY ("blockItemId") REFERENCES "ProgramBlockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_completedLogId_fkey" FOREIGN KEY ("completedLogId") REFERENCES "RoutineLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
