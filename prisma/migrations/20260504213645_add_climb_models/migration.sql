-- CreateEnum
CREATE TYPE "ClimbOutcome" AS ENUM ('FLASH', 'ONSIGHT', 'SEND', 'REDPOINT', 'FELL', 'PROJECT');

-- CreateEnum
CREATE TYPE "ClimbLocationType" AS ENUM ('GYM', 'CRAG');

-- CreateEnum
CREATE TYPE "ClimbGradeSystem" AS ENUM ('BOULDER_V', 'YOSEMITE');

-- AlterTable
ALTER TABLE "RoutineLog" ADD COLUMN     "climbLocationId" TEXT;

-- CreateTable
CREATE TABLE "ClimbLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClimbLocationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClimbLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClimbAttempt" (
    "id" TEXT NOT NULL,
    "sessionLogId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "gradeSystem" "ClimbGradeSystem" NOT NULL,
    "outcome" "ClimbOutcome" NOT NULL,
    "movesCompleted" INTEGER,
    "totalMoves" INTEGER,
    "notes" TEXT,
    "attemptOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClimbAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClimbLocation_type_name_idx" ON "ClimbLocation"("type", "name");

-- CreateIndex
CREATE INDEX "ClimbAttempt_sessionLogId_attemptOrder_idx" ON "ClimbAttempt"("sessionLogId", "attemptOrder");

-- CreateIndex
CREATE INDEX "ClimbAttempt_gradeSystem_grade_idx" ON "ClimbAttempt"("gradeSystem", "grade");

-- CreateIndex
CREATE INDEX "RoutineLog_climbLocationId_idx" ON "RoutineLog"("climbLocationId");

-- AddForeignKey
ALTER TABLE "ClimbAttempt" ADD CONSTRAINT "ClimbAttempt_sessionLogId_fkey" FOREIGN KEY ("sessionLogId") REFERENCES "RoutineLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineLog" ADD CONSTRAINT "RoutineLog_climbLocationId_fkey" FOREIGN KEY ("climbLocationId") REFERENCES "ClimbLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
