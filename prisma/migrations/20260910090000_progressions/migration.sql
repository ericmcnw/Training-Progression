-- Additive only: one new enum, one new enum value, one new table, one nullable
-- column. Nothing existing is dropped, renamed, or retyped, and no code reads
-- any of it until the /progressions surface ships.

-- CreateEnum
CREATE TYPE "ProgressionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DONE', 'ARCHIVED');

-- AlterEnum
-- Safe on PG 12+: the new value is added here but not USED until a later
-- migration/runtime, which is the only in-transaction restriction.
ALTER TYPE "MilestoneOwnerKind" ADD VALUE 'PROGRESSION';

-- CreateTable
CREATE TABLE "Progression" (
    "id" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProgressionStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "scopeKind" "MilestoneScopeKind",
    "scopeRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Progression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Progression_profileKey_status_sortOrder_idx" ON "Progression"("profileKey", "status", "sortOrder");

-- AlterTable
ALTER TABLE "ProgressionMilestone" ADD COLUMN "modifier" TEXT;
