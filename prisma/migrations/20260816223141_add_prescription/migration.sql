-- CreateEnum
CREATE TYPE "LoadUnit" AS ENUM ('LB', 'KG', 'PCT_1RM', 'RPE', 'STACK', 'BODYWEIGHT');

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "routineExerciseId" TEXT NOT NULL,
    "sets" INTEGER,
    "repsMin" INTEGER,
    "repsMax" INTEGER,
    "seconds" INTEGER,
    "load" DOUBLE PRECISION,
    "loadUnit" "LoadUnit" NOT NULL DEFAULT 'LB',
    "tempo" TEXT,
    "restSec" INTEGER,
    "cue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_routineExerciseId_key" ON "Prescription"("routineExerciseId");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_routineExerciseId_fkey" FOREIGN KEY ("routineExerciseId") REFERENCES "RoutineExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

