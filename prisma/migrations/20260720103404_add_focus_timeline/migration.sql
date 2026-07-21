-- CreateEnum
CREATE TYPE "FocusTargetKind" AS ENUM ('SOFT', 'HARD');

-- AlterTable
ALTER TABLE "Focus" ADD COLUMN     "targetDate" TIMESTAMP(3),
ADD COLUMN     "targetKind" "FocusTargetKind" NOT NULL DEFAULT 'SOFT';

-- AlterTable
ALTER TABLE "ProgressionMilestone" ADD COLUMN     "dependsOnMilestoneId" TEXT,
ADD COLUMN     "estDurationDays" INTEGER;
