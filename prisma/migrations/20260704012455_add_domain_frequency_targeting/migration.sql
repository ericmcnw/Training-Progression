-- AlterTable
ALTER TABLE "FrequencyGoal" ADD COLUMN     "sessionAim" INTEGER,
ADD COLUMN     "targetDomain" TEXT,
ADD COLUMN     "triggerSupportedSports" TEXT[] DEFAULT ARRAY[]::TEXT[];
