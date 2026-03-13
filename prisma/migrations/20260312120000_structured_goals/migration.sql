-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('FREQUENCY', 'VOLUME', 'PERFORMANCE', 'COMPLETION');

-- CreateEnum
CREATE TYPE "GoalTargetType" AS ENUM ('ROUTINE', 'EXERCISE', 'CARDIO', 'GROUP');

-- CreateEnum
CREATE TYPE "GoalTimeframe" AS ENUM ('DAY', 'WEEK', 'MONTH', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "GoalMetricType" AS ENUM (
    'SESSIONS',
    'DISTANCE',
    'DURATION',
    'VOLUME',
    'REPS',
    'SETS',
    'MAX_WEIGHT',
    'MAX_DURATION',
    'PACE',
    'COMPLETED'
);

DROP TABLE "Goal";

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "targetType" "GoalTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "metricType" "GoalMetricType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "timeframe" "GoalTimeframe" NOT NULL,
    "unit" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Goal_isActive_goalType_idx" ON "Goal"("isActive", "goalType");

-- CreateIndex
CREATE INDEX "Goal_targetType_targetId_idx" ON "Goal"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Goal_timeframe_startDate_endDate_idx" ON "Goal"("timeframe", "startDate", "endDate");
