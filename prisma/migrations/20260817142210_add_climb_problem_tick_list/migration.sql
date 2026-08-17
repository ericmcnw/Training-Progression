-- AlterTable
ALTER TABLE "ClimbProblem" ADD COLUMN     "onTickList" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ClimbProblem_onTickList_idx" ON "ClimbProblem"("onTickList");
