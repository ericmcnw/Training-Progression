-- CreateEnum
CREATE TYPE "GoalMilestoneKind" AS ENUM ('ACHIEVED', 'BAR_RAISED');

-- CreateTable
CREATE TABLE "GoalMilestone" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "lineageId" TEXT NOT NULL,
    "kind" "GoalMilestoneKind" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "valueLabel" TEXT,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoalMilestone_lineageId_achievedAt_idx" ON "GoalMilestone"("lineageId", "achievedAt");

-- CreateIndex
CREATE INDEX "GoalMilestone_goalId_idx" ON "GoalMilestone"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalMilestone_goalId_kind_value_key" ON "GoalMilestone"("goalId", "kind", "value");
