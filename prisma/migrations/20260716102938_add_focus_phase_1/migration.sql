-- CreateEnum
CREATE TYPE "FocusStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ACHIEVED', 'PAUSED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "FocusContributorKind" AS ENUM ('ACTIVITY_FAMILY', 'ACTIVITY_TYPE', 'SPORT', 'ROUTINE', 'EXERCISE', 'FREQUENCY_GOAL');

-- CreateEnum
CREATE TYPE "MilestoneOwnerKind" AS ENUM ('FOCUS', 'INJURY');

-- CreateEnum
CREATE TYPE "MilestoneScopeKind" AS ENUM ('ROUTINE', 'EXERCISE', 'CAPACITY');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Focus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "FocusStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "icon" TEXT,
    "pursuitKey" TEXT,
    "linkedInjuryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Focus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusContributor" (
    "id" TEXT NOT NULL,
    "focusId" TEXT NOT NULL,
    "kind" "FocusContributorKind" NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FocusContributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionMilestone" (
    "id" TEXT NOT NULL,
    "ownerKind" "MilestoneOwnerKind" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "scopeKind" "MilestoneScopeKind" NOT NULL,
    "scopeRef" TEXT,
    "label" TEXT NOT NULL,
    "targetText" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressionMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Focus_status_sortOrder_idx" ON "Focus"("status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FocusContributor_focusId_kind_refId_key" ON "FocusContributor"("focusId", "kind", "refId");

-- CreateIndex
CREATE INDEX "FocusContributor_focusId_idx" ON "FocusContributor"("focusId");

-- CreateIndex
CREATE INDEX "ProgressionMilestone_ownerKind_ownerId_sortOrder_idx" ON "ProgressionMilestone"("ownerKind", "ownerId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProgressionMilestone_scopeKind_scopeRef_status_idx" ON "ProgressionMilestone"("scopeKind", "scopeRef", "status");

-- AddForeignKey
ALTER TABLE "Focus" ADD CONSTRAINT "Focus_linkedInjuryId_fkey" FOREIGN KEY ("linkedInjuryId") REFERENCES "ActiveInjury"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusContributor" ADD CONSTRAINT "FocusContributor_focusId_fkey" FOREIGN KEY ("focusId") REFERENCES "Focus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
