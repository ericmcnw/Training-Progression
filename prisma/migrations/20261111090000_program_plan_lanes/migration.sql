-- CreateEnum
CREATE TYPE "ProgramPlanKind" AS ENUM ('EXERCISE', 'ACTIVITY', 'SPORT');

-- CreateEnum
CREATE TYPE "ProgramPlanPhaseEnd" AS ENUM ('ASK', 'KEEP', 'DROP');

-- AlterTable
ALTER TABLE "ProgramPlanItem" ADD COLUMN     "activityTypeId" TEXT,
ADD COLUMN     "enduranceFamilyId" TEXT,
ADD COLUMN     "kind" "ProgramPlanKind" NOT NULL DEFAULT 'EXERCISE',
ADD COLUMN     "label" TEXT,
ADD COLUMN     "phaseEnd" "ProgramPlanPhaseEnd" NOT NULL DEFAULT 'KEEP',
ADD COLUMN     "sportSlug" TEXT,
ALTER COLUMN "exerciseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProgramPlanTarget" ADD COLUMN     "distanceMi" DOUBLE PRECISION,
ADD COLUMN     "durationSec" INTEGER,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "params" JSONB,
ADD COLUMN     "sessions" INTEGER;

-- CreateIndex
CREATE INDEX "ProgramPlanItem_activityTypeId_idx" ON "ProgramPlanItem"("activityTypeId");

-- CreateIndex
CREATE INDEX "ProgramPlanItem_enduranceFamilyId_idx" ON "ProgramPlanItem"("enduranceFamilyId");

-- AddForeignKey
ALTER TABLE "ProgramPlanItem" ADD CONSTRAINT "ProgramPlanItem_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramPlanItem" ADD CONSTRAINT "ProgramPlanItem_enduranceFamilyId_fkey" FOREIGN KEY ("enduranceFamilyId") REFERENCES "EnduranceFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

