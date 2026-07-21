-- AlterEnum
ALTER TYPE "MilestoneGateKind" ADD VALUE 'FREQUENCY';

-- AlterTable
ALTER TABLE "ProgressionMilestone" ADD COLUMN     "gateFreqPerWeek" DOUBLE PRECISION,
ADD COLUMN     "gateFreqWeeks" INTEGER;
