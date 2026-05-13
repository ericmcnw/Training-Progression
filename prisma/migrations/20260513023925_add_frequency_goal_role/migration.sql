-- CreateEnum
CREATE TYPE "FrequencyGoalRole" AS ENUM ('PRIMARY', 'SUBSTITUTE');

-- AlterTable
ALTER TABLE "FrequencyGoalRoutine" ADD COLUMN     "role" "FrequencyGoalRole" NOT NULL DEFAULT 'PRIMARY';
