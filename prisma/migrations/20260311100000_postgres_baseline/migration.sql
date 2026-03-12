-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoutineKind" AS ENUM ('COMPLETION', 'WORKOUT', 'CARDIO', 'GUIDED', 'SESSION');

-- CreateEnum
CREATE TYPE "ExerciseUnit" AS ENUM ('REPS', 'TIME');

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "subtype" TEXT,
    "domain" TEXT NOT NULL DEFAULT 'general',
    "kind" "RoutineKind" NOT NULL DEFAULT 'COMPLETION',
    "timesPerWeek" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cycleLengthDays" INTEGER NOT NULL DEFAULT 7,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "schedulePlanId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulePlanActivation" (
    "id" TEXT NOT NULL,
    "schedulePlanId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulePlanActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleManualEntry" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleManualEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineLog" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "completionCount" INTEGER,
    "durationSec" INTEGER,
    "distanceMi" DOUBLE PRECISION,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidedStep" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationSec" INTEGER,
    "restSec" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuidedStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuidedStepLog" (
    "id" TEXT NOT NULL,
    "routineLogId" TEXT NOT NULL,
    "guidedStepId" TEXT,
    "title" TEXT NOT NULL,
    "durationSec" INTEGER,
    "restSec" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidedStepLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineLogMetric" (
    "id" TEXT NOT NULL,
    "routineLogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineLogMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardioRoutineDetails" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "defaultDistanceUnit" TEXT NOT NULL DEFAULT 'mi',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardioRoutineDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRoutineDetails" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "supportsLocation" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionRoutineDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "ExerciseUnit" NOT NULL DEFAULT 'REPS',
    "supportsWeight" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineExercise" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultSets" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionExercise" (
    "id" TEXT NOT NULL,
    "routineLogId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetEntry" (
    "id" TEXT NOT NULL,
    "sessionExerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER,
    "seconds" INTEGER,
    "weightLb" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Routine_isActive_idx" ON "Routine"("isActive");

-- CreateIndex
CREATE INDEX "Routine_isDeleted_idx" ON "Routine"("isDeleted");

-- CreateIndex
CREATE INDEX "Routine_category_idx" ON "Routine"("category");

-- CreateIndex
CREATE INDEX "Routine_kind_subtype_idx" ON "Routine"("kind", "subtype");

-- CreateIndex
CREATE INDEX "ScheduleEntry_schedulePlanId_dayOffset_sortOrder_idx" ON "ScheduleEntry"("schedulePlanId", "dayOffset", "sortOrder");

-- CreateIndex
CREATE INDEX "ScheduleEntry_routineId_idx" ON "ScheduleEntry"("routineId");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePlanActivation_schedulePlanId_key" ON "SchedulePlanActivation"("schedulePlanId");

-- CreateIndex
CREATE INDEX "ScheduleManualEntry_scheduledDate_sortOrder_idx" ON "ScheduleManualEntry"("scheduledDate", "sortOrder");

-- CreateIndex
CREATE INDEX "ScheduleManualEntry_routineId_idx" ON "ScheduleManualEntry"("routineId");

-- CreateIndex
CREATE INDEX "RoutineLog_routineId_performedAt_idx" ON "RoutineLog"("routineId", "performedAt");

-- CreateIndex
CREATE INDEX "GuidedStep_routineId_sortOrder_idx" ON "GuidedStep"("routineId", "sortOrder");

-- CreateIndex
CREATE INDEX "GuidedStepLog_routineLogId_sortOrder_idx" ON "GuidedStepLog"("routineLogId", "sortOrder");

-- CreateIndex
CREATE INDEX "GuidedStepLog_guidedStepId_idx" ON "GuidedStepLog"("guidedStepId");

-- CreateIndex
CREATE INDEX "RoutineLogMetric_routineLogId_sortOrder_idx" ON "RoutineLogMetric"("routineLogId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CardioRoutineDetails_routineId_key" ON "CardioRoutineDetails"("routineId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRoutineDetails_routineId_key" ON "SessionRoutineDetails"("routineId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- CreateIndex
CREATE INDEX "RoutineExercise_routineId_sortOrder_idx" ON "RoutineExercise"("routineId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineExercise_routineId_exerciseId_key" ON "RoutineExercise"("routineId", "exerciseId");

-- CreateIndex
CREATE INDEX "SessionExercise_routineLogId_idx" ON "SessionExercise"("routineLogId");

-- CreateIndex
CREATE INDEX "SessionExercise_exerciseId_idx" ON "SessionExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "SetEntry_sessionExerciseId_idx" ON "SetEntry"("sessionExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "SetEntry_sessionExerciseId_setNumber_key" ON "SetEntry"("sessionExerciseId", "setNumber");

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_schedulePlanId_fkey" FOREIGN KEY ("schedulePlanId") REFERENCES "SchedulePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePlanActivation" ADD CONSTRAINT "SchedulePlanActivation_schedulePlanId_fkey" FOREIGN KEY ("schedulePlanId") REFERENCES "SchedulePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleManualEntry" ADD CONSTRAINT "ScheduleManualEntry_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineLog" ADD CONSTRAINT "RoutineLog_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedStep" ADD CONSTRAINT "GuidedStep_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedStepLog" ADD CONSTRAINT "GuidedStepLog_guidedStepId_fkey" FOREIGN KEY ("guidedStepId") REFERENCES "GuidedStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidedStepLog" ADD CONSTRAINT "GuidedStepLog_routineLogId_fkey" FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineLogMetric" ADD CONSTRAINT "RoutineLogMetric_routineLogId_fkey" FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardioRoutineDetails" ADD CONSTRAINT "CardioRoutineDetails_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRoutineDetails" ADD CONSTRAINT "SessionRoutineDetails_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineExercise" ADD CONSTRAINT "RoutineExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineExercise" ADD CONSTRAINT "RoutineExercise_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_routineLogId_fkey" FOREIGN KEY ("routineLogId") REFERENCES "RoutineLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetEntry" ADD CONSTRAINT "SetEntry_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "SessionExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

