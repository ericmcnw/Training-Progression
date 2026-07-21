-- CreateEnum
CREATE TYPE "MilestoneGateKind" AS ENUM ('NONE', 'FREE_TEXT', 'PAIN');

-- AlterTable
ALTER TABLE "ProgressionMilestone" ADD COLUMN     "gateKind" "MilestoneGateKind" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "gateNote" TEXT,
ADD COLUMN     "gatePainZoneId" TEXT,
ADD COLUMN     "gatePainThreshold" INTEGER,
ADD COLUMN     "gatePainDays" INTEGER;
