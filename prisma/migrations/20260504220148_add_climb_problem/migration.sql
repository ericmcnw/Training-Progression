-- AlterTable
ALTER TABLE "ClimbAttempt" ADD COLUMN     "problemId" TEXT;

-- CreateTable
CREATE TABLE "ClimbProblem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "gradeSystem" "ClimbGradeSystem" NOT NULL,
    "notes" TEXT,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClimbProblem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClimbProblem_locationId_grade_idx" ON "ClimbProblem"("locationId", "grade");

-- CreateIndex
CREATE INDEX "ClimbProblem_name_idx" ON "ClimbProblem"("name");

-- CreateIndex
CREATE INDEX "ClimbAttempt_problemId_idx" ON "ClimbAttempt"("problemId");

-- AddForeignKey
ALTER TABLE "ClimbProblem" ADD CONSTRAINT "ClimbProblem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ClimbLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimbAttempt" ADD CONSTRAINT "ClimbAttempt_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "ClimbProblem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
