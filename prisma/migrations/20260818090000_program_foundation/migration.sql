-- CreateEnum
CREATE TYPE "ProgramRelationRole" AS ENUM ('PRIMARY', 'SUPPORTING');

-- CreateEnum
CREATE TYPE "ProgramStageStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ProgramGateMode" AS ENUM ('ALL', 'ANY');

-- CreateEnum
CREATE TYPE "ProgramStageGateKind" AS ENUM ('MANUAL', 'DATE', 'MILESTONE', 'GOAL', 'FREE_TEXT');

-- CreateEnum
CREATE TYPE "ProgramBlockStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProgramScheduleMode" AS ENUM ('CALENDAR', 'FLEXIBLE', 'ROTATION');

-- CreateEnum
CREATE TYPE "ProgramBlockItemKind" AS ENUM ('ROUTINE', 'ACTIVITY_TYPE', 'SPORT');

-- CreateEnum
CREATE TYPE "ProgramTargetListKind" AS ENUM ('CHECKLIST', 'PROGRESSION');

-- CreateEnum
CREATE TYPE "ProgramTargetItemStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED');

-- AlterTable
ALTER TABLE "Focus" ADD COLUMN     "profileKey" TEXT NOT NULL DEFAULT 'default';

-- CreateTable
CREATE TABLE "ProgramGoal" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "role" "ProgramRelationRole" NOT NULL DEFAULT 'PRIMARY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramFrequencyGoal" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "frequencyGoalId" TEXT NOT NULL,
    "role" "ProgramRelationRole" NOT NULL DEFAULT 'SUPPORTING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramFrequencyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramRoutine" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "role" "ProgramRelationRole" NOT NULL DEFAULT 'SUPPORTING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramStage" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProgramStageStatus" NOT NULL DEFAULT 'PLANNED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "gateMode" "ProgramGateMode" NOT NULL DEFAULT 'ALL',
    "notBeforeYmd" TEXT,
    "targetEndYmd" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramStageGate" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "kind" "ProgramStageGateKind" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "milestoneId" TEXT,
    "goalId" TEXT,
    "dateYmd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramStageGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramBlock" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "stageId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProgramBlockStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduleMode" "ProgramScheduleMode" NOT NULL DEFAULT 'FLEXIBLE',
    "lengthWeeks" INTEGER,
    "startYmd" TEXT,
    "endYmd" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramBlockItem" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "kind" "ProgramBlockItemKind" NOT NULL,
    "routineId" TEXT,
    "activityTypeId" TEXT,
    "sportSlug" TEXT,
    "label" TEXT NOT NULL,
    "minPerWeek" DOUBLE PRECISION,
    "targetPerWeek" DOUBLE PRECISION,
    "maxPerWeek" DOUBLE PRECISION,
    "weekdayMask" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramBlockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramBlockPrescription" (
    "id" TEXT NOT NULL,
    "blockItemId" TEXT NOT NULL,
    "routineExerciseId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL DEFAULT 0,
    "sets" INTEGER,
    "repsMin" INTEGER,
    "repsMax" INTEGER,
    "seconds" INTEGER,
    "loadValue" DOUBLE PRECISION,
    "loadUnit" "LoadUnit",
    "tempo" TEXT,
    "restSec" INTEGER,
    "cue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramBlockPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramTargetList" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ProgramTargetListKind" NOT NULL DEFAULT 'CHECKLIST',
    "sportSlug" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramTargetList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramTargetListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProgramTargetItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "climbProblemId" TEXT,
    "refKind" TEXT,
    "refId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramTargetListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL DEFAULT 'default',
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "bodyFatPct" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramGoal_programId_sortOrder_idx" ON "ProgramGoal"("programId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramGoal_goalId_idx" ON "ProgramGoal"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramGoal_programId_goalId_key" ON "ProgramGoal"("programId", "goalId");

-- CreateIndex
CREATE INDEX "ProgramFrequencyGoal_programId_sortOrder_idx" ON "ProgramFrequencyGoal"("programId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramFrequencyGoal_frequencyGoalId_idx" ON "ProgramFrequencyGoal"("frequencyGoalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramFrequencyGoal_programId_frequencyGoalId_key" ON "ProgramFrequencyGoal"("programId", "frequencyGoalId");

-- CreateIndex
CREATE INDEX "ProgramRoutine_programId_sortOrder_idx" ON "ProgramRoutine"("programId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramRoutine_routineId_idx" ON "ProgramRoutine"("routineId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramRoutine_programId_routineId_key" ON "ProgramRoutine"("programId", "routineId");

-- CreateIndex
CREATE INDEX "ProgramStage_programId_sortOrder_idx" ON "ProgramStage"("programId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramStage_programId_status_idx" ON "ProgramStage"("programId", "status");

-- CreateIndex
CREATE INDEX "ProgramStageGate_stageId_sortOrder_idx" ON "ProgramStageGate"("stageId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramStageGate_milestoneId_idx" ON "ProgramStageGate"("milestoneId");

-- CreateIndex
CREATE INDEX "ProgramStageGate_goalId_idx" ON "ProgramStageGate"("goalId");

-- CreateIndex
CREATE INDEX "ProgramBlock_programId_sortOrder_idx" ON "ProgramBlock"("programId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramBlock_stageId_idx" ON "ProgramBlock"("stageId");

-- CreateIndex
CREATE INDEX "ProgramBlock_programId_status_idx" ON "ProgramBlock"("programId", "status");

-- CreateIndex
CREATE INDEX "ProgramBlockItem_blockId_sortOrder_idx" ON "ProgramBlockItem"("blockId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramBlockItem_routineId_idx" ON "ProgramBlockItem"("routineId");

-- CreateIndex
CREATE INDEX "ProgramBlockItem_activityTypeId_idx" ON "ProgramBlockItem"("activityTypeId");

-- CreateIndex
CREATE INDEX "ProgramBlockPrescription_routineExerciseId_idx" ON "ProgramBlockPrescription"("routineExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramBlockPrescription_blockItemId_routineExerciseId_week_key" ON "ProgramBlockPrescription"("blockItemId", "routineExerciseId", "weekNumber");

-- CreateIndex
CREATE INDEX "ProgramTargetList_programId_sortOrder_idx" ON "ProgramTargetList"("programId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramTargetListItem_listId_sortOrder_idx" ON "ProgramTargetListItem"("listId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramTargetListItem_climbProblemId_idx" ON "ProgramTargetListItem"("climbProblemId");

-- CreateIndex
CREATE INDEX "ProgramTargetListItem_refKind_refId_idx" ON "ProgramTargetListItem"("refKind", "refId");

-- CreateIndex
CREATE INDEX "BodyMeasurement_profileKey_measuredAt_idx" ON "BodyMeasurement"("profileKey", "measuredAt");

-- CreateIndex
CREATE INDEX "Focus_profileKey_status_sortOrder_idx" ON "Focus"("profileKey", "status", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProgramGoal" ADD CONSTRAINT "ProgramGoal_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Focus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramGoal" ADD CONSTRAINT "ProgramGoal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramFrequencyGoal" ADD CONSTRAINT "ProgramFrequencyGoal_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Focus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramFrequencyGoal" ADD CONSTRAINT "ProgramFrequencyGoal_frequencyGoalId_fkey" FOREIGN KEY ("frequencyGoalId") REFERENCES "FrequencyGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRoutine" ADD CONSTRAINT "ProgramRoutine_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Focus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRoutine" ADD CONSTRAINT "ProgramRoutine_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramStage" ADD CONSTRAINT "ProgramStage_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Focus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramStageGate" ADD CONSTRAINT "ProgramStageGate_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProgramStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramStageGate" ADD CONSTRAINT "ProgramStageGate_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProgressionMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramStageGate" ADD CONSTRAINT "ProgramStageGate_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlock" ADD CONSTRAINT "ProgramBlock_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Focus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlock" ADD CONSTRAINT "ProgramBlock_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProgramStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlockItem" ADD CONSTRAINT "ProgramBlockItem_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ProgramBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlockItem" ADD CONSTRAINT "ProgramBlockItem_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlockItem" ADD CONSTRAINT "ProgramBlockItem_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlockPrescription" ADD CONSTRAINT "ProgramBlockPrescription_blockItemId_fkey" FOREIGN KEY ("blockItemId") REFERENCES "ProgramBlockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramBlockPrescription" ADD CONSTRAINT "ProgramBlockPrescription_routineExerciseId_fkey" FOREIGN KEY ("routineExerciseId") REFERENCES "RoutineExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTargetList" ADD CONSTRAINT "ProgramTargetList_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Focus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTargetListItem" ADD CONSTRAINT "ProgramTargetListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ProgramTargetList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTargetListItem" ADD CONSTRAINT "ProgramTargetListItem_climbProblemId_fkey" FOREIGN KEY ("climbProblemId") REFERENCES "ClimbProblem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
