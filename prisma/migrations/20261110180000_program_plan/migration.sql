-- CreateTable
CREATE TABLE "ProgramPlanItem" (
    "id" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL DEFAULT 'default',
    "programId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "routineId" TEXT,
    "startYmd" TEXT NOT NULL,
    "adjustments" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramPlanTarget" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "seconds" INTEGER,
    "weightLb" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramPlanTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramPlanItem_profileKey_isActive_idx" ON "ProgramPlanItem"("profileKey", "isActive");

-- CreateIndex
CREATE INDEX "ProgramPlanItem_programId_sortOrder_idx" ON "ProgramPlanItem"("programId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgramPlanItem_exerciseId_isActive_idx" ON "ProgramPlanItem"("exerciseId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramPlanTarget_itemId_week_key" ON "ProgramPlanTarget"("itemId", "week");

-- AddForeignKey
ALTER TABLE "ProgramPlanItem" ADD CONSTRAINT "ProgramPlanItem_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Focus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramPlanItem" ADD CONSTRAINT "ProgramPlanItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramPlanItem" ADD CONSTRAINT "ProgramPlanItem_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramPlanTarget" ADD CONSTRAINT "ProgramPlanTarget_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProgramPlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
