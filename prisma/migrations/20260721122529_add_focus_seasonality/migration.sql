-- CreateEnum
CREATE TYPE "FocusPhase" AS ENUM ('BUILD', 'PEAK', 'OFFSEASON', 'MAINTAIN');

-- AlterTable
ALTER TABLE "Focus" ADD COLUMN     "season" TEXT,
ADD COLUMN     "phase" "FocusPhase",
ADD COLUMN     "handoffNote" TEXT;
