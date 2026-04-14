-- CreateTable
CREATE TABLE "FrequencyGoal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "targetInterval" INTEGER NOT NULL,
    "targetUnit" "RoutineFrequencyUnit" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrequencyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrequencyGoalRoutine" (
    "goalId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrequencyGoalRoutine_pkey" PRIMARY KEY ("goalId","routineId")
);

-- CreateIndex
CREATE INDEX "FrequencyGoal_isActive_idx" ON "FrequencyGoal"("isActive");

-- CreateIndex
CREATE INDEX "FrequencyGoalRoutine_routineId_idx" ON "FrequencyGoalRoutine"("routineId");

-- AddForeignKey
ALTER TABLE "FrequencyGoalRoutine" ADD CONSTRAINT "FrequencyGoalRoutine_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "FrequencyGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrequencyGoalRoutine" ADD CONSTRAINT "FrequencyGoalRoutine_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
