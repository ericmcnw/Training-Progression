-- Additive: one new enum, two nullable columns. Nothing existing is dropped or
-- retyped, and no row is modified.

-- CreateEnum
CREATE TYPE "RungMetric" AS ENUM ('WEIGHT', 'REPS', 'SECONDS');

-- AlterTable
ALTER TABLE "ProgressionMilestone" ADD COLUMN "gateMetric" "RungMetric";
ALTER TABLE "ProgressionMilestone" ADD COLUMN "gateValue" DOUBLE PRECISION;
